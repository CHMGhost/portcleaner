const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  getPortInfo: (port) => ipcRenderer.invoke('get-port-info', port),
  stopProcess: (pid, processName, port, forceStop = false) => ipcRenderer.invoke('stop-process', pid, processName, port, forceStop),
  killProcess: (pid, processName, port, forceKill = false) => ipcRenderer.invoke('stop-process', pid, processName, port, forceKill), // Alias for compatibility
  getAllPorts: () => ipcRenderer.invoke('get-all-ports'),
  checkSystemRequirements: () => ipcRenderer.invoke('check-system-requirements'),
  
  // Notification support
  showNotification: (title, body, type = 'info') => ipcRenderer.invoke('show-notification', title, body, type),
  isWindowFocused: () => ipcRenderer.invoke('is-window-focused')
});

// Keep the electron version API for backward compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => process.versions.electron,
  checkSystemRequirements: () => ipcRenderer.invoke('check-system-requirements'),
  
  // Menu command handlers
  receive: (channel, func) => {
    const validChannels = ['focus-search', 'refresh-ports', 'toggle-theme', 'ports-updated', 'preferences-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  
  // Preferences handlers
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (prefs) => ipcRenderer.invoke('save-preferences', prefs),
  resetPreferences: () => ipcRenderer.invoke('reset-preferences'),
  exportSettings: () => ipcRenderer.invoke('export-settings'),
  importSettings: () => ipcRenderer.invoke('import-settings')
});