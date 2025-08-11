const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  getPortInfo: (port) => ipcRenderer.invoke('get-port-info', port),
  killProcess: (pid, processName, port, forceKill = false) => ipcRenderer.invoke('kill-process', pid, processName, port, forceKill),
  getAllPorts: () => ipcRenderer.invoke('get-all-ports'),
  checkSystemRequirements: () => ipcRenderer.invoke('check-system-requirements')
});

// Keep the electron version API for backward compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => process.versions.electron,
  checkSystemRequirements: () => ipcRenderer.invoke('check-system-requirements')
});