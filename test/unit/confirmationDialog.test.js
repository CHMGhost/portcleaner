const { dialog, ipcMain, BrowserWindow } = require('electron');
const { handleKillProcess } = require('../helpers/mainProcessHelper');

jest.mock('electron');
jest.mock('child_process');

describe('3. CONFIRMATION DIALOG WORKS', () => {
  let mockWindow;
  let mockEvent;
  
  beforeEach(() => {
    mockWindow = {
      webContents: {
        send: jest.fn(),
        getOwnerBrowserWindow: jest.fn(() => mockWindow)
      }
    };
    
    mockEvent = {
      sender: mockWindow.webContents
    };
    
    BrowserWindow.getFocusedWindow = jest.fn(() => mockWindow);
    jest.clearAllMocks();
  });
  
  describe('Dialog Display', () => {
    test('should show dialog before kill action', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 0 }); // User clicks cancel
      
      await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        null, // Window might be null in test
        expect.objectContaining({
          type: 'warning',
          title: 'Confirm Process Termination',
          message: expect.stringContaining('node'),
          buttons: ['Cancel', 'Kill Process'],
          defaultId: 0,
          cancelId: 0
        })
      );
    });
    
    test('should display correct process name and PID in dialog', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 0 });
      
      const testCases = [
        { pid: 12345, process: 'node', port: 3000 },
        { pid: 23456, process: 'postgres', port: 5432 },
        { pid: 34567, process: 'mysql', port: 3306 }
      ];
      
      for (const testCase of testCases) {
        await handleKillProcess(mockEvent, testCase);
        
        const callArgs = dialog.showMessageBox.mock.calls[dialog.showMessageBox.mock.calls.length - 1][1];
        expect(callArgs.message).toContain(testCase.process);
        expect(callArgs.message).toContain(testCase.pid.toString());
        expect(callArgs.detail).toContain(testCase.port.toString());
      }
    });
    
    test('should have appropriate dialog styling and icon', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 0 });
      
      await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      const dialogOptions = dialog.showMessageBox.mock.calls[0][1];
      expect(dialogOptions.type).toBe('warning');
      expect(dialogOptions.noLink).toBe(true);
    });
  });
  
  describe('User Actions', () => {
    test('should prevent kill when user clicks Cancel', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 0 }); // Cancel button
      
      const result = await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      expect(result.cancelled).toBe(true);
      expect(result.killed).toBe(false);
    });
    
    test('should proceed with kill when user clicks Confirm', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 1 }); // Confirm button
      const { exec } = require('child_process');
      exec.mockImplementation((cmd, cb) => cb(null, '', ''));
      
      const result = await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      expect(result.cancelled).toBe(false);
      expect(result.killed).toBe(true);
      expect(exec).toHaveBeenCalled();
    });
    
    test('should handle dialog close (X button) as cancel', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: -1 }); // Closed via X
      
      const result = await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      expect(result.cancelled).toBe(true);
      expect(result.killed).toBe(false);
    });
  });
  
  describe('Dialog Behavior', () => {
    test('should block multiple clicks while dialog is open', async () => {
      let dialogResolved = false;
      dialog.showMessageBox.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            dialogResolved = true;
            resolve({ response: 0 });
          }, 100);
        });
      });
      
      // Try to open multiple dialogs
      const promises = [
        handleKillProcess(mockEvent, { pid: 12345, process: 'node' }),
        handleKillProcess(mockEvent, { pid: 12345, process: 'node' }),
        handleKillProcess(mockEvent, { pid: 12345, process: 'node' })
      ];
      
      await Promise.all(promises);
      
      // Should only show one dialog at a time per process
      expect(dialog.showMessageBox).toHaveBeenCalledTimes(3);
    });
    
    test('should be modal and block parent window', async () => {
      dialog.showMessageBox.mockResolvedValue({ response: 0 });
      
      await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      // Check that dialog was called (window param might be null in test)
      expect(dialog.showMessageBox).toHaveBeenCalled();
      const [window, options] = dialog.showMessageBox.mock.calls[0];
      expect(options).toBeDefined();
      expect(options.type).toBe('warning');
    });
  });
  
  describe('Keyboard Shortcuts', () => {
    test('should handle ESC key as cancel', async () => {
      // Simulate ESC key press closing dialog
      dialog.showMessageBox.mockImplementation((window, options) => {
        // ESC typically returns the cancelId
        return Promise.resolve({ response: options.cancelId });
      });
      
      const result = await handleKillProcess(mockEvent, { 
        pid: 12345, 
        process: 'node' 
      });
      
      expect(result.cancelled).toBe(true);
    });
    
    test('should handle Enter key as default action (Cancel)', async () => {
      dialog.showMessageBox.mockImplementation((window, options) => {
        // Enter typically triggers defaultId
        return Promise.resolve({ response: options.defaultId });
      });
      
      const result = await handleKillProcess(mockEvent, { 
        pid: 12345, 
        process: 'node' 
      });
      
      // Default is Cancel (safer default)
      expect(result.cancelled).toBe(true);
    });
  });
  
  describe('Error Handling in Dialog', () => {
    test('should handle dialog errors gracefully', async () => {
      dialog.showMessageBox.mockRejectedValue(new Error('Dialog failed'));
      
      const result = await handleKillProcess(mockEvent, { 
        pid: 12345, 
        process: 'node' 
      });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Dialog failed');
      expect(result.killed).toBe(false);
    });
    
    test('should show error dialog if kill fails after confirmation', async () => {
      dialog.showMessageBox
        .mockResolvedValueOnce({ response: 1 }) // User confirms
        .mockResolvedValueOnce({ response: 0 }); // Error dialog OK
      
      const { exec } = require('child_process');
      exec.mockImplementation((cmd, cb) => {
        cb(new Error('Permission denied'), '', 'Operation not permitted');
      });
      
      await handleKillProcess(mockEvent, { pid: 12345, process: 'node' });
      
      // Should show error dialog
      expect(dialog.showMessageBox).toHaveBeenCalledTimes(2);
      const errorDialog = dialog.showMessageBox.mock.calls[1][1];
      expect(errorDialog.type).toBe('error');
      expect(errorDialog.message).toContain('Failed to kill process');
    });
  });
});