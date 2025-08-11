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
    show: false, // Start hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false  // Security: keep this false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // mainWindow.webContents.openDevTools(); // Commented out for production
  
  // Window stays hidden until user explicitly opens it from tray
  
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
      // Hide dock icon when window is closed (macOS)
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      updateTrayMenu(); // Update menu label
    }
  });
}

// Create system tray
function createTray() {
  try {
    console.log('Creating tray icon...');
    const icon = createTrayIcon(process.platform === 'darwin');
    
    if (!icon || icon.isEmpty()) {
      console.error('Failed to create tray icon - icon is empty');
      return;
    }
    
    tray = new Tray(icon);
    
    if (!tray) {
      console.error('Failed to create tray object');
      return;
    }
    
    console.log('Tray created successfully');
    
    updateTrayMenu();
    
    // Set tooltip
    tray.setToolTip(`PortCleaner - Click to open`);
  
    // Handle tray click
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
          // Hide dock icon when window is hidden (macOS)
          if (process.platform === 'darwin') {
            app.dock.hide();
          }
        } else {
          mainWindow.show();
          mainWindow.focus();
          // Show dock icon when window is visible (macOS)
          if (process.platform === 'darwin') {
            app.dock.show();
          }
        }
        updateTrayMenu(); // Update menu label
      }
    });
  } catch (error) {
    console.error('Error creating tray:', error);
  }
}

// Update tray menu
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'PortCleaner',
      enabled: false
    },
    { type: 'separator' },
    { 
      label: mainWindow?.isVisible() ? 'Hide Window' : 'Show Window', 
      accelerator: 'CommandOrControl+Shift+P',
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else if (mainWindow.isVisible()) {
          mainWindow.hide();
          // Hide dock icon when window is hidden (macOS)
          if (process.platform === 'darwin') {
            app.dock.hide();
          }
        } else {
          mainWindow.show();
          mainWindow.focus();
          // Show dock icon when window is visible for better UX (macOS)
          if (process.platform === 'darwin') {
            app.dock.show();
          }
        }
        updateTrayMenu(); // Update menu label
      }
    },
    { 
      label: 'Quick Scan Ports', 
      accelerator: 'CommandOrControl+Shift+S',
      click: async () => {
        await quickScanPorts();
        // Show window with results
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Show dock icon when showing results (macOS)
          if (process.platform === 'darwin') {
            app.dock.show();
          }
        }
        updateTrayMenu(); // Update menu label
      }
    },
    { type: 'separator' },
    {
      label: `Active Ports: ${activePortCount}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Preferences...',
      accelerator: 'CommandOrControl+,',
      click: () => {
        // Show preferences (could open a preferences window in the future)
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit PortCleaner', 
      accelerator: 'CommandOrControl+Q',
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
  console.log('App is ready, creating tray and window...');
  
  // Create tray first so app has menu bar presence immediately
  createTray();
  createWindow();
  
  // Show window on first run to help users find the app
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Showing main window for first run...');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 500);
  
  // Hide dock after window is shown (for menu bar app behavior)
  setTimeout(() => {
    if (process.platform === 'darwin') {
      // Keep dock visible for now to help with debugging
      // app.dock.hide();
    }
  }, 1000);
  
  // Do an initial quick scan after a short delay
  setTimeout(() => {
    quickScanPorts();
  }, 2000);
});

// Don't quit when all windows are closed (keep running in tray)
app.on('window-all-closed', (event) => {
  // Prevent the app from quitting
  event.preventDefault();
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

// Server-side protection validation
function validateProcessProtection(pid, processName, port) {
  const validation = {
    isProtected: false,
    protectionLevel: 'none', // none, warning, critical
    reasons: [],
    canOverride: true
  };
  
  // Check critical system processes (cannot be killed)
  const CRITICAL_SYSTEM_PROCESSES = [
    'kernel_task', 'launchd', 'systemd', 'init', 
    'System', 'Registry', 'smss.exe', 'csrss.exe'
  ];
  
  if (CRITICAL_SYSTEM_PROCESSES.some(proc => 
    processName?.toLowerCase().includes(proc.toLowerCase()))) {
    validation.isProtected = true;
    validation.protectionLevel = 'critical';
    validation.canOverride = false;
    validation.reasons.push('Core operating system process');
    validation.reasons.push('Killing this will crash your system');
    return validation;
  }
  
  // Check protected services (can be overridden with warnings)
  if (PROTECTED_PROCESSES.some(proc => 
    processName?.toLowerCase().includes(proc.toLowerCase()))) {
    validation.isProtected = true;
    validation.protectionLevel = 'warning';
    validation.canOverride = true;
    
    // Add specific reasons
    if (['postgres', 'mysql', 'mongod', 'redis'].some(p => 
      processName?.toLowerCase().includes(p.toLowerCase()))) {
      validation.reasons.push('Database service');
      validation.reasons.push('May cause data corruption');
    } else if (['docker', 'nginx', 'apache'].some(p => 
      processName?.toLowerCase().includes(p.toLowerCase()))) {
      validation.reasons.push('Critical service');
      validation.reasons.push('Other services depend on this');
    }
  }
  
  // Check system ports (ports < 1024)
  if (port && port < 1024) {
    validation.isProtected = true;
    validation.protectionLevel = validation.protectionLevel === 'critical' ? 'critical' : 'warning';
    validation.reasons.push(`System port (${port})`);
    validation.reasons.push('Requires elevated privileges');
  }
  
  // Check critical service ports
  if (CRITICAL_PORTS[port]) {
    validation.isProtected = true;
    validation.protectionLevel = validation.protectionLevel === 'critical' ? 'critical' : 'warning';
    validation.reasons.push(`${CRITICAL_PORTS[port]} service port`);
  }
  
  return validation;
}

ipcMain.handle('kill-process', async (event, pid, processName, port, forceStop = false) => {
  console.log('Kill process called with:', { pid, processName, port, forceStop });
  try {
    // Server-side protection validation
    const protection = validateProcessProtection(pid, processName, port);
    
    // Block critical processes that cannot be killed
    if (protection.protectionLevel === 'critical' && !protection.canOverride) {
      // Show error dialog
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        buttons: ['OK'],
        title: 'Cannot Stop Process',
        message: `${processName} cannot be stopped`,
        detail: `This is a critical system process that cannot be stopped:\n\n${protection.reasons.join('\n')}`
      });
      
      return { 
        success: false, 
        error: 'Process is protected',
        protection: protection
      };
    }
    
    // Check if it's a protected system process
    const isProtected = protection.isProtected;
    
    if (isProtected && !forceStop) {
      let detailMessage = 'This process is protected because:\n\n';
      
      // Provide specific reasons based on process type
      if (['kernel_task', 'launchd', 'systemd', 'init', 'WindowServer', 'explorer.exe', 'finder'].some(p => processName?.toLowerCase().includes(p.toLowerCase()))) {
        detailMessage += '• It is a critical system process\n• Killing it could crash your system or make it unusable';
      } else if (['postgres', 'mysql', 'mongod', 'redis'].some(p => processName?.toLowerCase().includes(p.toLowerCase()))) {
        detailMessage += '• It is a database service\n• Killing it could cause data loss or corruption\n• Applications may depend on this service';
      } else if (['docker', 'nginx', 'apache'].some(p => processName?.toLowerCase().includes(p.toLowerCase()))) {
        detailMessage += '• It is a critical development service\n• Other containers or services may depend on it\n• It should be stopped gracefully through proper commands';
      }
      
      detailMessage += '\n\n⚠️ However, you can still force stop this process if you understand the risks.';
      
      // Ensure window is visible for dialog
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
      }
      
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Force Stop Anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Protected Process Warning',
        message: `${processName} is a protected process`,
        detail: detailMessage,
        checkboxLabel: 'I understand the risks and want to proceed',
        checkboxChecked: false
      });
      
      // If user chooses to force stop and checked the understanding box
      if (result.response === 1 && result.checkboxChecked) {
        // Set forceStop to true and continue with the stop logic
        forceStop = true;
      } else {
        return { success: false, error: 'Protected system process', userCancelled: true };
      }
    }
    
    // If forceStop is true and process is protected, show final warning
    if (isProtected && forceStop) {
      const finalWarning = await dialog.showMessageBox(mainWindow, {
        type: 'error',
        buttons: ['Cancel', 'Yes, Force Stop'],
        defaultId: 0,
        cancelId: 0,
        title: '⚠️ FINAL WARNING',
        message: `Are you ABSOLUTELY sure?`,
        detail: `You are about to forcefully stop ${processName} (PID: ${pid}).\n\n` +
                `🚨 This may cause:\n` +
                `• System instability or crashes\n` +
                `• Data loss or corruption\n` +
                `• Loss of unsaved work\n` +
                `• Network or service disruptions\n\n` +
                `This action cannot be undone. Only proceed if you fully understand the consequences.`,
        noLink: true
      });
      
      if (finalWarning.response !== 1) {
        return { success: false, error: 'User cancelled force stop', userCancelled: true };
      }
      // Proceed to kill the protected process
    }
    
    // Build warning message
    let warningDetail = 'This will stop the process.';
    
    // Add extra warning for critical ports
    if (CRITICAL_PORTS[port]) {
      warningDetail += `\n\n⚠️ WARNING: Port ${port} is commonly used for ${CRITICAL_PORTS[port]}. Stopping this process may affect important services.`;
    }
    
    // Show confirmation dialog (ensure window is visible for dialog)
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Stop Process'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm Process Stop',
      message: `Stop ${processName || 'process'} (PID: ${pid})?`,
      detail: warningDetail
    });
    
    if (result.response === 1) {
      console.log('User confirmed kill, calling portManager.killProcess with:', pid, processName);
      const killResult = await portManager.killProcess(pid, processName);
      console.log('Kill result:', killResult);
      return killResult;
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
    const result = await portManager.getAllPorts();
    
    // Check if it's an error response
    if (result.error) {
      console.error('Port scan error:', result.error);
      return { 
        success: false, 
        error: result.error,
        errorType: result.errorType || 'UNKNOWN_ERROR',
        userMessage: result.userMessage || 'Unable to scan ports',
        data: [] 
      };
    }
    
    // Handle different result formats
    let ports = [];
    let isLimited = false;
    let limitedMessage = null;
    
    if (Array.isArray(result)) {
      // Simple array of ports
      ports = result;
    } else if (result.ports) {
      // Object with ports array
      ports = result.ports;
      isLimited = result.limited || false;
      limitedMessage = result.userMessage;
    } else {
      // Empty result
      ports = [];
    }
    
    // Enrich with CPU/Memory stats
    const enrichedPorts = await Promise.all(ports.map(async (port) => {
      const stats = await portManager.getProcessStats(port.pid);
      return {
        ...port,
        cpu: stats.cpu || '0',
        memory: stats.memory || '0 KB'
      };
    }));
    
    // Update tray with port count
    activePortCount = enrichedPorts.length;
    tray?.setToolTip(`PortCleaner - ${activePortCount} active ports`);
    updateTrayMenu();
    
    return { 
      success: true, 
      data: enrichedPorts,
      limited: isLimited,
      limitedMessage: limitedMessage
    };
  } catch (error) {
    console.error('Error getting all ports:', error);
    return { 
      success: false, 
      error: error.message,
      errorType: 'UNKNOWN_ERROR',
      userMessage: 'An unexpected error occurred',
      data: [] 
    };
  }
});

// System requirement checks
ipcMain.handle('check-system-requirements', async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  const result = {
    hasPermissions: true,
    hasCommands: true, 
    isConnected: true
  };
  
  // Check for required commands
  try {
    if (process.platform === 'win32') {
      await execAsync('where netstat');
    } else {
      await execAsync('which lsof');
    }
  } catch (error) {
    result.hasCommands = false;
  }
  
  // Check for admin/sudo permissions (simplified check)
  try {
    if (process.platform === 'win32') {
      // Windows permission check
      const isAdmin = process.env.USERNAME === 'Administrator';
      result.hasPermissions = isAdmin || true; // Allow non-admin with warning
    } else {
      // Unix permission check - try to read a protected port
      await execAsync('lsof -i:1 2>/dev/null || true');
    }
  } catch (error) {
    // If command fails, we might need permissions
    result.hasPermissions = true; // Allow with limited functionality
  }
  
  // Check network connectivity
  try {
    const { net } = require('electron');
    result.isConnected = net.online;
  } catch (error) {
    result.isConnected = true; // Assume connected if check fails
  }
  
  return result;
});

ipcMain.handle('request-admin-permissions', async () => {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // On macOS/Linux, we'd need to restart with sudo
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['OK'],
        title: 'Administrator Privileges Required',
        message: 'PortCleaner needs to be run with administrator privileges',
        detail: 'Please restart the application with sudo:\nsudo npm start\n\nOr use the packaged app with admin rights.'
      });
      return { success: false };
    } else if (process.platform === 'win32') {
      // On Windows, request elevation
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['OK'],
        title: 'Administrator Privileges Required', 
        message: 'Please run PortCleaner as Administrator',
        detail: 'Right-click the application and select "Run as administrator"'
      });
      return { success: false };
    }
  } catch (error) {
    console.error('Permission request error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-connection', async () => {
  try {
    const { net } = require('electron');
    return { connected: net.online };
  } catch (error) {
    return { connected: true }; // Assume connected if check fails
  }
});

ipcMain.handle('check-system-commands', async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    if (process.platform === 'win32') {
      await execAsync('where netstat');
    } else {
      await execAsync('which lsof');
    }
    return { available: true };
  } catch (error) {
    return { available: false };
  }
});