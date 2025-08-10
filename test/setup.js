// Global test setup
const { ipcMain, dialog, app } = require('electron');

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/path'),
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve())
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn()
  },
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn()
  },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn()
  }))
}));

// Global test utilities
global.mockExecResponse = (stdout, stderr = '', exitCode = 0) => {
  return {
    stdout: stdout,
    stderr: stderr,
    exitCode: exitCode
  };
};

// Platform detection helpers
global.setPlatform = (platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    enumerable: true,
    configurable: true
  });
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});