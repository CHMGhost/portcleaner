// Helper for testing main process functions
const { dialog } = require('electron');
const PortManager = require('../../src/utils/portManager');

const handleKillProcess = async (event, data) => {
  const portManager = new PortManager();
  
  try {
    const window = event.sender?.getOwnerBrowserWindow?.() || null;
    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Confirm Process Termination',
      message: `Are you sure you want to kill ${data.process} (PID: ${data.pid})?`,
      detail: data.port ? `This process is using port ${data.port}` : '',
      buttons: ['Cancel', 'Kill Process'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    
    if (result.response === 0 || result.response === -1) {
      return { cancelled: true, killed: false };
    }
    
    const killResult = await portManager.killProcess(data.pid, data.process);
    
    if (!killResult.success) {
      await dialog.showMessageBox(window, {
        type: 'error',
        title: 'Failed to Kill Process',
        message: 'Failed to kill process',
        detail: killResult.userMessage || killResult.error,
        buttons: ['OK']
      });
    }
    
    return { 
      cancelled: false, 
      killed: killResult.success,
      error: killResult.error
    };
  } catch (error) {
    return {
      cancelled: false,
      killed: false,
      error: error.message
    };
  }
};

module.exports = { handleKillProcess };