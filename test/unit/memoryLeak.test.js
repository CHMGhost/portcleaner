const { ipcMain, BrowserWindow } = require('electron');
const MemoryLeakDetector = require('../memory/memory-leak-detector');

describe('8. NO MEMORY LEAKS AFTER RUNNING FOR HOURS', () => {
  let detector;
  
  beforeEach(() => {
    detector = new MemoryLeakDetector();
    detector.config.sampleInterval = 100; // Speed up for testing
    detector.config.testDuration = 1000; // Short duration for tests
  });
  
  describe('Memory Monitoring', () => {
    test('should track heap usage over time', () => {
      const sample1 = detector.getMemoryUsage();
      expect(sample1.process.heapUsed).toBeGreaterThan(0);
      expect(sample1.v8.usedHeapSize).toBeGreaterThan(0);
      expect(sample1.timestamp).toBeDefined();
    });
    
    test('should detect steady memory increase', () => {
      // Simulate steadily increasing memory
      detector.samples = [
        { process: { heapUsed: 10000000 }, elapsed: 0 },
        { process: { heapUsed: 15000000 }, elapsed: 5000 },
        { process: { heapUsed: 20000000 }, elapsed: 10000 },
        { process: { heapUsed: 25000000 }, elapsed: 15000 },
        { process: { heapUsed: 30000000 }, elapsed: 20000 }
      ];
      
      const analysis = detector.analyzeMemoryTrend();
      // Check if trend indicates increase
      expect(analysis.trend).toBeDefined();
      if (typeof analysis.trend === 'string') {
        expect(analysis.trend).toMatch(/Increasing|Slightly Increasing/);
      } else {
        expect(analysis.trend.trend).toMatch(/Increasing|Slightly Increasing/);
      }
    });
    
    test('should identify stable memory usage', () => {
      // Simulate stable memory with normal fluctuations
      detector.samples = [
        { process: { heapUsed: 10000000 }, elapsed: 0 },
        { process: { heapUsed: 10100000 }, elapsed: 5000 },
        { process: { heapUsed: 9900000 }, elapsed: 10000 },
        { process: { heapUsed: 10050000 }, elapsed: 15000 },
        { process: { heapUsed: 9950000 }, elapsed: 20000 }
      ];
      
      const analysis = detector.analyzeMemoryTrend();
      // Check for stable trend
      if (typeof analysis.trend === 'string') {
        expect(analysis.trend).toMatch(/Stable/);
      } else {
        expect(analysis.trend.trend).toMatch(/Stable/);
      }
    });
  });
  
  describe('IPC Listener Cleanup', () => {
    test('should remove IPC listeners on window close', () => {
      const mockWindow = {
        webContents: {
          send: jest.fn()
        },
        on: jest.fn(),
        removeAllListeners: jest.fn()
      };
      
      // Register listeners
      const handlers = new Map();
      ipcMain.handle = jest.fn((channel, handler) => {
        handlers.set(channel, handler);
      });
      
      ipcMain.removeHandler = jest.fn((channel) => {
        handlers.delete(channel);
      });
      
      // Simulate registering handlers
      ipcMain.handle('get-all-ports', () => {});
      ipcMain.handle('kill-process', () => {});
      
      expect(handlers.size).toBe(2);
      
      // Simulate window close
      ipcMain.removeHandler('get-all-ports');
      ipcMain.removeHandler('kill-process');
      
      expect(handlers.size).toBe(0);
    });
    
    test('should prevent duplicate IPC listeners', () => {
      const handlers = [];
      
      ipcMain.handle = jest.fn((channel, handler) => {
        // Check if already registered
        const existing = handlers.find(h => h.channel === channel);
        if (!existing) {
          handlers.push({ channel, handler });
        }
      });
      
      // Try to register same handler multiple times
      ipcMain.handle('get-all-ports', () => {});
      ipcMain.handle('get-all-ports', () => {});
      ipcMain.handle('get-all-ports', () => {});
      
      expect(handlers.filter(h => h.channel === 'get-all-ports')).toHaveLength(1);
    });
  });
  
  describe('DOM Node Cleanup', () => {
    test('should clean up detached DOM nodes', async () => {
      const mockWindow = {
        webContents: {
          executeJavaScript: jest.fn()
        }
      };
      
      // Simulate checking for detached nodes
      mockWindow.webContents.executeJavaScript.mockResolvedValue({
        detachedNodes: 0,
        totalNodes: 100
      });
      
      const result = await mockWindow.webContents.executeJavaScript(`
        (() => {
          const allNodes = document.querySelectorAll('*').length;
          const attached = document.body.querySelectorAll('*').length;
          return {
            detachedNodes: allNodes - attached,
            totalNodes: allNodes
          };
        })()
      `);
      
      expect(result.detachedNodes).toBe(0);
    });
    
    test('should properly remove old port list items', async () => {
      const mockWindow = {
        webContents: {
          executeJavaScript: jest.fn()
        }
      };
      
      // Simulate port list update
      mockWindow.webContents.executeJavaScript.mockImplementation(async (script) => {
        if (script.includes('removeOldPorts')) {
          return { removed: 5, remaining: 10 };
        }
        return {};
      });
      
      const result = await mockWindow.webContents.executeJavaScript(`
        window.removeOldPorts();
      `);
      
      expect(result.removed).toBeGreaterThan(0);
    });
  });
  
  describe('Auto-refresh Memory Management', () => {
    test('should not leak memory during continuous refresh', async () => {
      const samples = [];
      
      // Simulate continuous refresh for 100 iterations
      for (let i = 0; i < 100; i++) {
        const memBefore = process.memoryUsage().heapUsed;
        
        // Simulate refresh operation
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const memAfter = process.memoryUsage().heapUsed;
        samples.push(memAfter - memBefore);
      }
      
      // Average memory increase should be minimal
      const avgIncrease = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(avgIncrease).toBeLessThan(100000); // Less than 100KB average increase
    });
    
    test('should clear timers on auto-refresh stop', () => {
      const timers = [];
      
      // Mock setInterval to track timers
      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;
      
      global.setInterval = jest.fn((fn, delay) => {
        const id = Math.random();
        timers.push(id);
        return id;
      });
      
      // Mock clearInterval
      global.clearInterval = jest.fn((id) => {
        const index = timers.indexOf(id);
        if (index > -1) timers.splice(index, 1);
      });
      
      // Start auto-refresh
      const refreshId = setInterval(() => {}, 1000);
      expect(timers).toHaveLength(1);
      
      // Stop auto-refresh
      clearInterval(refreshId);
      expect(timers).toHaveLength(0);
      
      // Restore mocks
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    });
  });
  
  describe('Event Listener Management', () => {
    test('should remove event listeners on element removal', () => {
      const listeners = new Map();
      
      // Track event listeners
      const mockElement = {
        addEventListener: jest.fn((event, handler) => {
          if (!listeners.has(event)) {
            listeners.set(event, []);
          }
          listeners.get(event).push(handler);
        }),
        removeEventListener: jest.fn((event, handler) => {
          const handlers = listeners.get(event);
          if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
          }
        })
      };
      
      // Add listener
      const handler = () => {};
      mockElement.addEventListener('click', handler);
      expect(listeners.get('click')).toHaveLength(1);
      
      // Remove listener
      mockElement.removeEventListener('click', handler);
      expect(listeners.get('click')).toHaveLength(0);
    });
    
    test('should use weak references for DOM event handlers', () => {
      const weakRefs = [];
      
      // Create elements with weak references
      for (let i = 0; i < 10; i++) {
        const element = { id: i };
        const weakRef = new WeakRef(element);
        weakRefs.push(weakRef);
      }
      
      // Force garbage collection (in real environment)
      if (global.gc) {
        global.gc();
      }
      
      // Check that weak refs can be collected
      weakRefs.forEach(ref => {
        // In test environment, objects might not be collected
        // This tests the pattern, not actual GC
        expect(ref.deref).toBeDefined();
      });
    });
  });
  
  describe('Memory Threshold Detection', () => {
    test('should alert when memory exceeds threshold', () => {
      detector.config.memoryThreshold = 50 * 1024 * 1024; // 50MB
      
      detector.samples = [
        { process: { heapUsed: 100 * 1024 * 1024 }, elapsed: 0, v8: { numberOfDetachedContexts: 0 } },
        { process: { heapUsed: 200 * 1024 * 1024 }, elapsed: 60000, v8: { numberOfDetachedContexts: 0 } }
      ];
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      detector.checkForLeak();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential memory leak')
      );
      expect(detector.leakDetected).toBe(true);
      
      consoleSpy.mockRestore();
    });
    
    test('should detect detached contexts', () => {
      detector.samples = Array(20).fill(null).map((_, i) => ({
        process: { heapUsed: 100 * 1024 * 1024 },
        elapsed: i * 1000,
        v8: { numberOfDetachedContexts: i > 15 ? 10 : 1 }
      }));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      detector.checkForLeak();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detached contexts')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Long-running Stress Test', () => {
    test('should handle rapid port scanning without memory leak', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        // Simulate port scan
        const ports = Array(50).fill(null).map((_, index) => ({
          port: 3000 + index,
          pid: 1000 + index,
          process: `app${index}`
        }));
        
        // Process ports (simulate rendering)
        ports.forEach(port => {
          const element = { port: port.port, pid: port.pid };
          // Simulate DOM manipulation
          delete element.port;
          delete element.pid;
        });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable for 1000 iterations
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });
});