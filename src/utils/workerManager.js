// Web Worker Manager for handling background port scanning operations

class WorkerManager {
  constructor() {
    this.worker = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.isSupported = typeof Worker !== 'undefined';
    
    if (this.isSupported) {
      this.initWorker();
    }
  }

  initWorker() {
    try {
      // Try multiple possible paths for the worker
      const possiblePaths = [
        './workers/portScanner.worker.js',
        '../workers/portScanner.worker.js',
        'workers/portScanner.worker.js',
        '/src/workers/portScanner.worker.js'
      ];
      
      let workerInitialized = false;
      let lastError = null;
      
      for (const path of possiblePaths) {
        try {
          this.worker = new Worker(path);
          workerInitialized = true;
          console.log(`Worker initialized with path: ${path}`);
          break;
        } catch (e) {
          lastError = e;
          console.log(`Failed to load worker from ${path}:`, e.message);
        }
      }
      
      if (!workerInitialized) {
        throw lastError || new Error('Could not find worker file');
      }
      
      // Handle messages from worker
      this.worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(event.data);
      });
      
      // Handle errors
      this.worker.addEventListener('error', (error) => {
        console.warn('Worker runtime error:', error);
        // Don't call handleWorkerError here as it will try to restart
        // Just disable the worker
        this.isSupported = false;
      });
      
      console.log('Port scanner worker initialized successfully');
    } catch (error) {
      console.warn('Worker not available, will use main thread fallback:', error.message);
      this.isSupported = false;
      this.worker = null;
    }
  }

  handleWorkerMessage(message) {
    const { type, data, error, requestId } = message;
    
    // Find pending request if it has an ID
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      if (error) {
        reject(new Error(error));
      } else {
        resolve(data);
      }
      return;
    }
    
    // Handle broadcast messages
    switch (type) {
      case 'PORTS_PROCESSED':
        this.onPortsProcessed?.(data);
        break;
      case 'PORTS_FILTERED':
        this.onPortsFiltered?.(data);
        break;
      case 'PORTS_SORTED':
        this.onPortsSorted?.(data);
        break;
      case 'CHANGES_ANALYZED':
        this.onChangesAnalyzed?.(data);
        break;
      case 'ERROR':
        console.error('Worker error:', error);
        break;
    }
  }

  handleWorkerError(error) {
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(error);
    });
    this.pendingRequests.clear();
    
    // Disable worker and use fallback
    console.warn('Worker failed, switching to main thread processing');
    this.isSupported = false;
    this.worker = null;
  }

  // Send message to worker with promise support
  sendMessage(type, data) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported || !this.worker) {
        // Fallback to main thread processing
        reject(new Error('Worker not available'));
        return;
      }
      
      const requestId = ++this.requestId;
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Worker request timeout'));
        }
      }, 5000);
      
      // Send message to worker
      this.worker.postMessage({ type, data, requestId });
    });
  }

  // Public API methods
  async processPorts(ports) {
    if (!this.isSupported) {
      // Fallback to main thread
      return this.processPortsMainThread(ports);
    }
    
    try {
      return await this.sendMessage('PROCESS_PORTS', { ports });
    } catch (error) {
      console.warn('Worker processing failed, using main thread:', error);
      return this.processPortsMainThread(ports);
    }
  }

  async filterPorts(ports, filters) {
    if (!this.isSupported) {
      return this.filterPortsMainThread(ports, filters);
    }
    
    try {
      return await this.sendMessage('FILTER_PORTS', { ports, filters });
    } catch (error) {
      console.warn('Worker filtering failed, using main thread:', error);
      return this.filterPortsMainThread(ports, filters);
    }
  }

  async sortPorts(ports, sortConfig) {
    if (!this.isSupported) {
      return this.sortPortsMainThread(ports, sortConfig);
    }
    
    try {
      return await this.sendMessage('SORT_PORTS', { ports, sortConfig });
    } catch (error) {
      console.warn('Worker sorting failed, using main thread:', error);
      return this.sortPortsMainThread(ports, sortConfig);
    }
  }

  async analyzeChanges(currentPorts, previousPorts) {
    if (!this.isSupported) {
      return this.analyzeChangesMainThread(currentPorts, previousPorts);
    }
    
    try {
      return await this.sendMessage('ANALYZE_CHANGES', { 
        current: currentPorts, 
        previous: previousPorts 
      });
    } catch (error) {
      console.warn('Worker analysis failed, using main thread:', error);
      return this.analyzeChangesMainThread(currentPorts, previousPorts);
    }
  }

  // Fallback methods for main thread processing
  processPortsMainThread(ports) {
    // Simplified processing in main thread
    return {
      ports: ports.map(port => ({
        ...port,
        cpuValue: parseFloat(port.cpu || 0),
        memoryBytes: this.convertMemoryToBytes(port.memory),
        isCritical: port.port < 1024,
        isProtected: false
      })),
      stats: {
        total: ports.length,
        critical: ports.filter(p => p.port < 1024).length,
        protected: 0,
        processingTime: 0
      }
    };
  }

  filterPortsMainThread(ports, filters) {
    let filtered = [...ports];
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(port => {
        return port.port.toString().includes(searchLower) ||
               (port.process && port.process.toLowerCase().includes(searchLower)) ||
               port.pid.toString().includes(searchLower);
      });
    }
    
    if (filters.category && filters.category !== 'all') {
      switch (filters.category) {
        case 'critical':
          filtered = filtered.filter(p => p.port < 1024);
          break;
        case 'protected':
          filtered = filtered.filter(p => p.isProtected);
          break;
      }
    }
    
    return filtered;
  }

  sortPortsMainThread(ports, sortConfig) {
    const { column, direction } = sortConfig;
    
    return [...ports].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      if (typeof aVal === 'number' || !isNaN(aVal)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  analyzeChangesMainThread(currentPorts, previousPorts) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };
    
    const currentMap = new Map(currentPorts.map(p => [`${p.port}-${p.pid}`, p]));
    const previousMap = new Map(previousPorts.map(p => [`${p.port}-${p.pid}`, p]));
    
    currentMap.forEach((port, key) => {
      if (!previousMap.has(key)) {
        changes.added.push(port);
      }
    });
    
    previousMap.forEach((port, key) => {
      if (!currentMap.has(key)) {
        changes.removed.push(port);
      }
    });
    
    return changes;
  }

  convertMemoryToBytes(memory) {
    if (!memory) return 0;
    
    const memStr = memory.toString().toUpperCase();
    const value = parseFloat(memStr);
    
    if (memStr.includes('GB')) return value * 1024 * 1024 * 1024;
    if (memStr.includes('MB')) return value * 1024 * 1024;
    if (memStr.includes('KB')) return value * 1024;
    return value;
  }

  // Cleanup
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkerManager;
} else {
  window.WorkerManager = WorkerManager;
}