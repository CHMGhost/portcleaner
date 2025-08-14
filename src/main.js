const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, shell, nativeTheme } = require('electron');
const path = require('path');
const PortManager = require('./utils/portManager');
const { createTrayIcon, createStatusIcon } = require('./utils/trayIcon');
const telemetry = require('./utils/telemetry');

// Set app name early for macOS menu
app.setName('PortCleaner');

const portManager = new PortManager();
let mainWindow = null;
let tray = null;
let activePortCount = 0;
let preferencesWindow = null;

// Helper function to set dock icon
function setDockIcon() {
  if (process.platform === 'darwin' && app.dock) {
    const { nativeImage } = require('electron');
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (require('fs').existsSync(iconPath)) {
      try {
        const image = nativeImage.createFromPath(iconPath);
        if (!image.isEmpty()) {
          app.dock.setIcon(image);
        }
      } catch (err) {
        console.log('Could not set dock icon:', err.message);
      }
    }
  }
}

// Set app icon for share menu and other system integrations
function setAppIcon() {
  if (process.platform === 'darwin') {
    // For macOS, set the icon that will be used in share sheets and other system UI
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (require('fs').existsSync(iconPath)) {
      try {
        const image = nativeImage.createFromPath(iconPath);
        if (!image.isEmpty()) {
          // This sets the icon for share menu and other system integrations
          app.setName('PortCleaner');
          // Set the app's about panel icon
          app.setAboutPanelOptions({
            applicationName: 'PortCleaner',
            applicationVersion: app.getVersion(),
            copyright: '© 2025 PortCleaner',
            version: app.getVersion(),
            iconPath: iconPath
          });
        }
      } catch (err) {
        console.log('Could not set app icon:', err.message);
      }
    }
  }
}

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
  // Determine icon path based on platform
  let iconPath;
  if (process.platform === 'darwin') {
    // For macOS, use PNG for window icon (icns is for app bundle)
    iconPath = path.join(__dirname, 'assets', 'icon.png');
  } else if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets', 'icon.ico');
  } else {
    iconPath = path.join(__dirname, 'assets', 'icon256.png');
  }
  
  // Only set icon if file exists
  const windowConfig = {
    width: 800,
    height: 600,
    title: 'PortCleaner',
    show: false, // Start hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false  // Security: keep this false
    }
  };
  
  // Add icon if it exists
  if (require('fs').existsSync(iconPath)) {
    windowConfig.icon = iconPath;
  }
  
  mainWindow = new BrowserWindow(windowConfig);

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
            setDockIcon(); // Set custom icon
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
            setDockIcon(); // Set custom icon
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
            setDockIcon(); // Set custom icon
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
    telemetry.trackAction('quick_scan', 'port_actions');
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

// Create application menu
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: 'PortCleaner',
      submenu: [
        { 
          label: 'About PortCleaner',
          click: () => showAboutDialog()
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => showPreferences()
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide PortCleaner',
          accelerator: 'CmdOrCtrl+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'CmdOrCtrl+Shift+H',
          role: 'hideOthers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit PortCleaner',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh Ports',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.send('refresh-ports');
          }
        },
        {
          label: 'Export Ports...',
          accelerator: 'CmdOrCtrl+E',
          enabled: false, // Future feature
          click: () => {
            // TODO: Implement export functionality
          }
        },
        { type: 'separator' },
        ...(isMac ? [] : [
          {
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => showPreferences()
          },
          { type: 'separator' },
          {
            label: 'Exit',
            click: () => {
              app.isQuitting = true;
              app.quit();
            }
          }
        ])
      ]
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow?.webContents.send('focus-search');
          }
        }
      ]
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow?.webContents.send('toggle-theme');
          }
        },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+F', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    
    // Window menu
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { label: 'Bring All to Front', role: 'front' },
          { type: 'separator' },
          { label: 'PortCleaner', accelerator: 'CmdOrCtrl+1', 
            click: () => {
              mainWindow?.show();
              mainWindow?.focus();
            }
          }
        ] : [])
      ]
    },
    
    // Help menu
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/yourusername/portcleaner#readme');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/yourusername/portcleaner/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'Keyboard Shortcuts',
          click: () => showKeyboardShortcuts()
        },
        { type: 'separator' },
        ...(isMac ? [] : [
          {
            label: 'About PortCleaner',
            click: () => showAboutDialog()
          }
        ])
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Show About dialog
function showAboutDialog() {
  const version = app.getVersion();
  const electronVersion = process.versions.electron;
  const nodeVersion = process.versions.node;
  
  // Use the app's about panel on macOS for native feel
  if (process.platform === 'darwin') {
    app.showAboutPanel();
  } else {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'About PortCleaner',
      message: 'PortCleaner',
      detail: `Version: ${version}\n` +
              `A modern port management utility for developers.\n\n` +
              `Electron: ${electronVersion}\n` +
              `Node: ${nodeVersion}\n\n` +
              `© 2024 PortCleaner. All rights reserved.`,
      buttons: ['OK'],
      icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon256.png'))
    });
  }
}

// Show Preferences window
function showPreferences() {
  if (preferencesWindow) {
    preferencesWindow.focus();
    return;
  }
  
  preferencesWindow = new BrowserWindow({
    width: 600,
    height: 400,
    parent: mainWindow,
    modal: false,
    show: false,
    title: 'Preferences',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#f5f5f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Load preferences HTML (to be created)
  preferencesWindow.loadFile(path.join(__dirname, 'preferences.html'));
  
  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow.show();
  });
  
  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });
}

// Show keyboard shortcuts
function showKeyboardShortcuts() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Keyboard Shortcuts',
    message: 'Keyboard Shortcuts',
    detail: `Main Shortcuts:\n` +
            `⌘F / Ctrl+F - Focus search\n` +
            `⌘R / Ctrl+R - Refresh ports\n` +
            `⌘T / Ctrl+T - Toggle theme\n` +
            `⌘, / Ctrl+, - Open preferences\n` +
            `⌘Q / Ctrl+Q - Quit application\n\n` +
            `Port Actions:\n` +
            `Enter - Stop selected port\n` +
            `/ - Quick search\n` +
            `Escape - Clear search\n` +
            `A - Toggle auto-refresh`,
    buttons: ['OK']
  });
}

// Show telemetry opt-in dialog
async function showTelemetryOptInDialog() {
  const result = await dialog.showMessageBox(null, {
    type: 'question',
    title: 'Help Improve PortCleaner',
    message: 'Help us improve PortCleaner',
    detail: 'Would you like to share anonymous usage data to help us improve PortCleaner?\n\n' +
            'We collect:\n' +
            '• Anonymous usage statistics\n' +
            '• Crash reports and errors\n' +
            '• Feature usage patterns\n' +
            '• System information (OS, version)\n\n' +
            'We NEVER collect:\n' +
            '• Personal information\n' +
            '• Port data or process names\n' +
            '• Network traffic\n' +
            '• File paths or contents\n\n' +
            'You can change this setting anytime in Preferences.',
    buttons: ['Share Anonymous Data', 'No Thanks'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  
  const telemetryEnabled = result.response === 0;
  
  // Save preference
  const prefs = store.get('preferences', {});
  prefs.telemetryEnabled = telemetryEnabled;
  store.set('preferences', prefs);
  store.set('hasSeenTelemetryPrompt', true);
  
  // Enable/disable telemetry
  telemetry.setEnabled(telemetryEnabled);
  
  return telemetryEnabled;
}

// Show privacy policy
function showPrivacyPolicy() {
  dialog.showMessageBox(preferencesWindow || mainWindow, {
    type: 'info',
    title: 'Privacy Policy',
    message: 'PortCleaner Privacy Policy',
    detail: 'PortCleaner respects your privacy and is committed to protecting your data.\n\n' +
            'WHAT WE COLLECT (when telemetry is enabled):\n' +
            '• Anonymous user ID (hashed machine identifier)\n' +
            '• App version and system information\n' +
            '• Feature usage statistics\n' +
            '• Error and crash reports\n' +
            '• Performance metrics\n\n' +
            'WHAT WE DO NOT COLLECT:\n' +
            '• Personal information or identifiable data\n' +
            '• Process names or port details\n' +
            '• Network traffic or connections\n' +
            '• File contents or paths\n' +
            '• Location information\n\n' +
            'HOW WE USE DATA:\n' +
            '• Improve app stability and performance\n' +
            '• Understand feature usage patterns\n' +
            '• Fix bugs and crashes\n' +
            '• Plan future improvements\n\n' +
            'DATA SECURITY:\n' +
            '• All data is transmitted securely\n' +
            '• Data is anonymized and aggregated\n' +
            '• We do not sell or share data with third parties\n' +
            '• Data is retained for 90 days\n\n' +
            'YOUR RIGHTS:\n' +
            '• Telemetry is completely optional\n' +
            '• You can disable it anytime in Preferences\n' +
            '• Disabling telemetry immediately stops data collection\n\n' +
            'For questions, contact: me@minorkeith.com',
    buttons: ['OK']
  });
}

// Set app icon early for share menu
setAppIcon();

app.whenReady().then(async () => {
  console.log('App is ready, creating tray and window...');
  
  // Initialize telemetry
  telemetry.initialize(store);
  
  // Check for first launch and show telemetry opt-in
  const hasSeenTelemetryPrompt = store.get('hasSeenTelemetryPrompt', false);
  if (!hasSeenTelemetryPrompt) {
    await showTelemetryOptInDialog();
  }
  
  // Track app launch
  telemetry.trackEvent('app_launched', {
    firstLaunch: !hasSeenTelemetryPrompt
  });
  
  // Update app launch stats
  const stats = store.get('usageStats', {});
  stats.appLaunches = (stats.appLaunches || 0) + 1;
  store.set('usageStats', stats);
  store.set('sessionStart', Date.now());
  
  // Set initial dock icon and app icon again
  setDockIcon();
  setAppIcon();
  
  // Create application menu
  createApplicationMenu();
  
  // Create tray first so app has menu bar presence immediately
  createTray();
  createWindow();
  
  // Show window based on preferences
  const prefs = store.get('preferences', {});
  const isFirstRun = !store.has('hasSeenApp');
  
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      if (isFirstRun) {
        store.set('hasSeenApp', true);
        console.log('Showing main window for first run...');
        mainWindow.show();
        mainWindow.focus();
      } else if (!prefs.startMinimized) {
        console.log('Showing main window (startMinimized is false)...');
        mainWindow.show();
        mainWindow.focus();
      }
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

// Clean up telemetry on app quit
app.on('before-quit', () => {
  // Track app quit
  telemetry.trackEvent('app_quit');
  
  // Update total usage time
  const stats = store.get('usageStats', {});
  const sessionStart = store.get('sessionStart', Date.now());
  const sessionDuration = Date.now() - sessionStart;
  stats.totalUsageTime = (stats.totalUsageTime || 0) + sessionDuration;
  store.set('usageStats', stats);
  
  // Flush telemetry and clean up
  telemetry.destroy();
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
    // Track kill attempt
    telemetry.trackAction('kill_process_attempt', 'port_actions', {
      port,
      forceStop
    });
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
      
      // Track successful kill
      if (killResult.success) {
        telemetry.trackAction('kill_process_success', 'port_actions', {
          port
        });
        
        // Update usage stats
        const stats = store.get('usageStats', {});
        stats.processesKilled = (stats.processesKilled || 0) + 1;
        store.set('usageStats', stats);
      }
      
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
    telemetry.trackAction('scan_ports', 'port_actions');
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
    
    // Update usage stats
    const stats = store.get('usageStats', {});
    stats.portsScanned = (stats.portsScanned || 0) + enrichedPorts.length;
    stats.lastUsed = Date.now();
    store.set('usageStats', stats);
    
    // Track performance
    telemetry.trackPerformance('port_scan_count', enrichedPorts.length, 'count');
    
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

// Preferences handlers  
let store;
try {
  const Store = require('electron-store');
  store = new Store.default ? new Store.default() : new Store();
} catch (e) {
  console.log('electron-store not available, using in-memory storage');
  // Fallback to in-memory storage
  const memoryStore = {};
  store = {
    get: (key, defaultValue) => memoryStore[key] || defaultValue,
    set: (key, value) => { memoryStore[key] = value; },
    delete: (key) => { delete memoryStore[key]; }
  };
}

ipcMain.handle('get-preferences', () => {
  return store.get('preferences', {
    launchAtStartup: false,
    startMinimized: true,
    autoRefreshEnabled: true,
    refreshInterval: 5000,
    theme: 'system',
    showPortIcons: true,
    compactMode: false,
    confirmStop: true,
    warnProtected: true,
    showNotifications: true,
    soundAlerts: false,
    maxPorts: 1000,
    enableVirtualization: true,
    showHidden: false,
    debugMode: false,
    telemetryEnabled: false
  });
});

ipcMain.handle('save-preferences', (event, prefs) => {
  store.set('preferences', prefs);
  
  // Handle telemetry preference change
  if (prefs.telemetryEnabled !== undefined) {
    telemetry.setEnabled(prefs.telemetryEnabled);
    telemetry.trackAction('preferences_changed', 'settings', {
      telemetryEnabled: prefs.telemetryEnabled
    });
  }
  
  // Apply preferences that need immediate action
  if (prefs.launchAtStartup !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: prefs.launchAtStartup
    });
  }
  
  // Send preferences update to renderer
  mainWindow?.webContents.send('preferences-updated', prefs);
  
  return { success: true };
});

ipcMain.handle('reset-preferences', () => {
  store.delete('preferences');
  return { success: true };
});

ipcMain.handle('export-settings', async () => {
  const { dialog } = require('electron');
  const fs = require('fs').promises;
  
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Settings',
    defaultPath: 'portcleaner-settings.json',
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  
  if (!result.canceled) {
    const settings = store.get('preferences', {});
    await fs.writeFile(result.filePath, JSON.stringify(settings, null, 2));
    return { success: true };
  }
  
  return { success: false, canceled: true };
});

ipcMain.handle('show-privacy-policy', () => {
  showPrivacyPolicy();
  return { success: true };
});

ipcMain.handle('import-settings', async () => {
  const { dialog } = require('electron');
  const fs = require('fs').promises;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Settings',
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ],
    properties: ['openFile']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = await fs.readFile(result.filePaths[0], 'utf8');
      const settings = JSON.parse(content);
      store.set('preferences', settings);
      
      // Apply settings
      if (settings.launchAtStartup !== undefined) {
        app.setLoginItemSettings({
          openAtLogin: settings.launchAtStartup
        });
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, canceled: true };
});

// Notification handlers
ipcMain.handle('show-notification', async (event, title, body, type = 'info') => {
  try {
    // Check if notifications are enabled in preferences
    const prefs = store.get('preferences', {});
    if (prefs.showNotifications === false) {
      return { success: false, reason: 'notifications_disabled' };
    }
    
    // Check if Electron notifications are supported
    const { Notification } = require('electron');
    if (!Notification.isSupported()) {
      return { success: false, reason: 'not_supported' };
    }
    
    // Create notification
    const notification = new Notification({
      title: title,
      body: body,
      icon: createTrayIcon(),
      silent: type === 'info' // Don't play sound for info notifications
    });
    
    // Handle notification click - show window
    notification.on('click', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        // Show dock icon when bringing window to front (macOS)
        if (process.platform === 'darwin') {
          app.dock.show();
          setDockIcon();
        }
      }
    });
    
    notification.show();
    return { success: true };
  } catch (error) {
    console.error('Error showing notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-window-focused', () => {
  return mainWindow ? mainWindow.isFocused() : false;
});