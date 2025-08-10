const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const PortManager = require('./utils/portManager');
const { createTrayIcon, createStatusIcon } = require('./utils/trayIcon');

const portManager = new PortManager();
let mainWindow = null;
let tray = null;
let activePortCount = 0;

// Critical system processes that should not be killed
const PROTECTED_PROCESSES = [
  // System critical processes
  'kernel_task', 'launchd', 'systemd', 'init',
  'WindowServer', 'loginwindow', 'csrss.exe', 
  'winlogon.exe', 'services.exe', 'lsass.exe',
  'svchost.exe', 'explorer.exe', 'finder',
  
  // Database services
  'postgres', 'postgresql', 'mysql', 'mysqld', 
  'mongod', 'mongodb', 'redis-server', 'redis',
  
  // Development services
  'docker', 'dockerd', 'containerd',
  'nginx', 'apache', 'httpd'
];

// Critical ports that need extra warning
const CRITICAL_PORTS = {
  22: 'SSH',
  80: 'HTTP',
  443: 'HTTPS',
  3306: 'MySQL',
  5432: 'PostgreSQL',
  27017: 'MongoDB',
  6379: 'Redis'
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false  // Security: keep this false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.openDevTools(); // For debugging
  
  // Handle window minimize to tray
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
  
  // Handle window close to tray (instead of quitting)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Create system tray
function createTray() {
  const icon = createTrayIcon(process.platform === 'darwin');
  tray = new Tray(icon);
  
  updateTrayMenu();
  
  // Set tooltip
  tray.setToolTip(`PortCleaner - ${activePortCount} active ports`);
  
  // Handle tray click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// Update tray menu
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: mainWindow?.isVisible() ? 'Hide App' : 'Show App', 
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      }
    },
    { 
      label: 'Quick Scan', 
      click: async () => {
        await quickScanPorts();
      }
    },
    { type: 'separator' },
    {
      label: `Active Ports: ${activePortCount}`,
      enabled: false
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray?.setContextMenu(contextMenu);
}

// Quick scan function
async function quickScanPorts() {
  try {
    const ports = await portManager.getAllPorts();
    activePortCount = ports.length;
    
    // Update tray tooltip and menu
    tray?.setToolTip(`PortCleaner - ${activePortCount} active ports`);
    updateTrayMenu();
    
    // Show notification
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Port Scan Complete',
        body: `Found ${activePortCount} active ports`,
        icon: createTrayIcon()
      });
      
      notification.on('click', () => {
        mainWindow?.show();
      });
      
      notification.show();
    }
    
    // Send update to renderer if window is open
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.webContents.send('ports-updated', ports);
    }
    
    return ports;
  } catch (error) {
    console.error('Quick scan error:', error);
    return [];
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Do an initial quick scan
  quickScanPorts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle IPC calls from renderer
ipcMain.handle('get-port-info', async (event, port) => {
  try {
    const info = await portManager.getPortInfo(port);
    return { success: true, data: info };
  } catch (error) {
    console.error('Error getting port info:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('kill-process', async (event, pid, processName, port, forceKill = false) => {
  try {
    // Check if it's a protected system process
    const isProtected = PROTECTED_PROCESSES.some(
      proc => processName?.toLowerCase().includes(proc.toLowerCase())
    );
    
    if (isProtected && !forceKill) {
      let detailMessage = 'This process is protected because:\n\n';
      
      // Provide specific reasons based on process type
      if (['kernel_task', 'launchd', 'systemd', 'init', 'WindowServer', 'explorer.exe', 'finder'].some(p => processName?.toLowerCase().includes(p.toLowerCase()))) {
        detailMessage += '• It is a critical system process\n• Killing it could crash your system or make it unusable';
      } else if (['postgres', 'mysql', 'mongod', 'redis'].some(p => processName?.toLowerCase().includes(p.toLowerCase()))) {
        detailMessage += '• It is a database service\n• Killing it could cause data loss or corruption\n• Applications may depend on this service';
      } else if (['docker', 'nginx', 'apache'].some(p => processName?.toLowerCase().includes(p.toLowerCase()))) {
        detailMessage += '• It is a critical development service\n• Other containers or services may depend on it\n• It should be stopped gracefully through proper commands';
      }
      
      detailMessage += '\n\n⚠️ However, you can still force kill this process if you understand the risks.';
      
      // Ensure window is visible for dialog
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
      }
      
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Force Kill Anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Protected Process Warning',
        message: `${processName} is a protected process`,
        detail: detailMessage,
        checkboxLabel: 'I understand the risks and want to proceed',
        checkboxChecked: false
      });
      
      // If user chooses to force kill and checked the understanding box
      if (result.response === 1 && result.checkboxChecked) {
        // Call this function again with forceKill = true
        return await ipcMain._events['kill-process'][0](event, pid, processName, port, true);
      }
      
      return { success: false, error: 'Protected system process', userCancelled: true };
    }
    
    // If forceKill is true and process is protected, show final warning
    if (isProtected && forceKill) {
      const finalWarning = await dialog.showMessageBox(mainWindow, {
        type: 'error',
        buttons: ['Cancel', 'Yes, Force Kill'],
        defaultId: 0,
        cancelId: 0,
        title: '⚠️ FINAL WARNING',
        message: `Are you ABSOLUTELY sure?`,
        detail: `You are about to forcefully terminate ${processName} (PID: ${pid}).\n\n` +
                `🚨 This may cause:\n` +
                `• System instability or crashes\n` +
                `• Data loss or corruption\n` +
                `• Loss of unsaved work\n` +
                `• Network or service disruptions\n\n` +
                `This action cannot be undone. Only proceed if you fully understand the consequences.`,
        noLink: true
      });
      
      if (finalWarning.response !== 1) {
        return { success: false, error: 'User cancelled force kill', userCancelled: true };
      }
      // Proceed to kill the protected process
    }
    
    // Build warning message
    let warningDetail = 'This will forcefully terminate the process.';
    
    // Add extra warning for critical ports
    if (CRITICAL_PORTS[port]) {
      warningDetail += `\n\n⚠️ WARNING: Port ${port} is commonly used for ${CRITICAL_PORTS[port]}. Killing this process may affect important services.`;
    }
    
    // Show confirmation dialog (ensure window is visible for dialog)
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Kill Process'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm Process Termination',
      message: `Kill ${processName || 'process'} (PID: ${pid})?`,
      detail: warningDetail
    });
    
    if (result.response === 1) {
      await portManager.killProcess(pid);
      return { success: true };
    } else {
      return { success: false, error: 'User cancelled' };
    }
  } catch (error) {
    console.error('Error killing process:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-ports', async (event) => {
  try {
    const ports = await portManager.getAllPorts();
    // Enrich with CPU/Memory stats
    const enrichedPorts = await Promise.all(ports.map(async (port) => {
      const stats = await portManager.getProcessStats(port.pid);
      return {
        ...port,
        cpu: stats.cpu,
        memory: stats.memory
      };
    }));
    
    // Update tray with port count
    activePortCount = enrichedPorts.length;
    tray?.setToolTip(`PortCleaner - ${activePortCount} active ports`);
    updateTrayMenu();
    
    return { success: true, data: enrichedPorts };
  } catch (error) {
    console.error('Error getting all ports:', error);
    return { success: false, error: error.message, data: [] };
  }
});