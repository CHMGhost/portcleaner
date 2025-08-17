// Web Worker for heavy port scanning operations
// This worker handles CPU-intensive tasks in a background thread

// Port scanning and processing logic
class PortScannerWorker {
  constructor() {
    this.cache = new Map();
    this.lastScanTime = 0;
    this.scanInterval = 5000; // Default 5 seconds
  }

  // Process raw port data
  processPortData(ports) {
    const startTime = performance.now();
    
    // Process each port with optimizations
    const processed = ports.map(port => {
      // Calculate derived values
      const cpuValue = parseFloat(port.cpu || 0);
      const memoryBytes = this.convertMemoryToBytes(port.memory);
      
      // Categorize port
      const category = this.categorizePort(port);
      const protection = this.getProtectionLevel(port);
      
      // Cache process info for faster lookups
      const cacheKey = `${port.pid}-${port.port}`;
      const cachedInfo = this.cache.get(cacheKey);
      
      if (cachedInfo && cachedInfo.timestamp > Date.now() - 60000) {
        // Use cached data if less than 1 minute old
        return {
          ...port,
          ...cachedInfo.data,
          cached: true
        };
      }
      
      // Process and cache new data
      const processedPort = {
        ...port,
        cpuValue,
        cpuClass: this.getCpuClass(cpuValue),
        memoryBytes,
        memoryFormatted: this.formatMemory(memoryBytes),
        category,
        protection,
        isCritical: this.isCriticalPort(port.port),
        isProtected: protection.level !== 'none',
        timestamp: Date.now()
      };
      
      // Update cache
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: processedPort
      });
      
      return processedPort;
    });
    
    const processingTime = performance.now() - startTime;
    
    return {
      ports: processed,
      stats: {
        total: processed.length,
        critical: processed.filter(p => p.isCritical).length,
        protected: processed.filter(p => p.isProtected).length,
        processingTime: processingTime.toFixed(2)
      }
    };
  }

  // Filter ports based on criteria
  filterPorts(ports, filters) {
    let filtered = [...ports];
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(port => {
        return port.port.toString().includes(searchLower) ||
               (port.process && port.process.toLowerCase().includes(searchLower)) ||
               (port.command && port.command.toLowerCase().includes(searchLower)) ||
               port.pid.toString().includes(searchLower) ||
               (port.user && port.user.toLowerCase().includes(searchLower));
      });
    }
    
    // Apply category filter
    if (filters.category && filters.category !== 'all') {
      switch (filters.category) {
        case 'favorites':
          filtered = filtered.filter(p => filters.favoritePorts?.includes(p.port));
          break;
        case 'critical':
          filtered = filtered.filter(p => p.isCritical || p.port < 1024);
          break;
        case 'protected':
          filtered = filtered.filter(p => p.isProtected);
          break;
      }
    }
    
    return filtered;
  }

  // Sort ports by specified column
  sortPorts(ports, sortConfig) {
    const { column, direction } = sortConfig;
    
    return [...ports].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      // Handle numeric columns
      if (['port', 'pid', 'cpuValue', 'memoryBytes'].includes(column)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      
      // Handle string columns
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Convert memory string to bytes
  convertMemoryToBytes(memory) {
    if (!memory) return 0;
    
    const memStr = memory.toString().toUpperCase();
    const value = parseFloat(memStr);
    
    if (memStr.includes('GB')) return value * 1024 * 1024 * 1024;
    if (memStr.includes('MB')) return value * 1024 * 1024;
    if (memStr.includes('KB')) return value * 1024;
    return value;
  }

  // Format memory for display
  formatMemory(bytes) {
    if (bytes > 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
    if (bytes > 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    if (bytes > 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return bytes + ' B';
  }

  // Get CPU class based on usage
  getCpuClass(cpuValue) {
    if (cpuValue > 50) return 'cpu-high';
    if (cpuValue > 20) return 'cpu-medium';
    return 'cpu-normal';
  }

  // Check if port is critical
  isCriticalPort(port) {
    const criticalPorts = {
      22: 'SSH',
      80: 'HTTP',
      443: 'HTTPS',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      27017: 'MongoDB',
      6379: 'Redis',
      3000: 'Development',
      8080: 'Web Server',
      8443: 'HTTPS Alt'
    };
    
    return criticalPorts.hasOwnProperty(port);
  }

  // Categorize port
  categorizePort(port) {
    const portNum = parseInt(port.port);
    
    if (portNum < 1024) return 'system';
    if (portNum < 49152) return 'registered';
    return 'dynamic';
  }

  // Get protection level
  getProtectionLevel(port) {
    const processName = (port.command || port.process || '').toLowerCase();
    
    // Critical system processes
    const criticalProcesses = ['kernel_task', 'launchd', 'systemd', 'init', 'system'];
    if (criticalProcesses.some(p => processName.includes(p))) {
      return { level: 'critical', reason: 'Core system process' };
    }
    
    // Protected services
    const protectedServices = [
      'postgres', 'mysql', 'mongod', 'redis',
      'docker', 'nginx', 'apache', 'httpd'
    ];
    if (protectedServices.some(p => processName.includes(p))) {
      return { level: 'protected', reason: 'Critical service' };
    }
    
    // System ports
    if (port.port < 1024) {
      return { level: 'warning', reason: 'System port' };
    }
    
    return { level: 'none', reason: null };
  }

  // Analyze port changes
  analyzeChanges(currentPorts, previousPorts) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };
    
    const currentMap = new Map(currentPorts.map(p => [`${p.port}-${p.pid}`, p]));
    const previousMap = new Map(previousPorts.map(p => [`${p.port}-${p.pid}`, p]));
    
    // Find added and modified
    currentMap.forEach((port, key) => {
      if (!previousMap.has(key)) {
        changes.added.push(port);
      } else {
        const prev = previousMap.get(key);
        if (prev.cpu !== port.cpu || prev.memory !== port.memory) {
          changes.modified.push({
            ...port,
            previousCpu: prev.cpu,
            previousMemory: prev.memory
          });
        }
      }
    });
    
    // Find removed
    previousMap.forEach((port, key) => {
      if (!currentMap.has(key)) {
        changes.removed.push(port);
      }
    });
    
    return changes;
  }

  // Clean up old cache entries
  cleanupCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

// Initialize worker
const scanner = new PortScannerWorker();

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'PROCESS_PORTS':
      const processed = scanner.processPortData(data.ports);
      self.postMessage({ type: 'PORTS_PROCESSED', data: processed });
      break;
      
    case 'FILTER_PORTS':
      const filtered = scanner.filterPorts(data.ports, data.filters);
      self.postMessage({ type: 'PORTS_FILTERED', data: filtered });
      break;
      
    case 'SORT_PORTS':
      const sorted = scanner.sortPorts(data.ports, data.sortConfig);
      self.postMessage({ type: 'PORTS_SORTED', data: sorted });
      break;
      
    case 'ANALYZE_CHANGES':
      const changes = scanner.analyzeChanges(data.current, data.previous);
      self.postMessage({ type: 'CHANGES_ANALYZED', data: changes });
      break;
      
    case 'CLEANUP_CACHE':
      scanner.cleanupCache();
      self.postMessage({ type: 'CACHE_CLEANED' });
      break;
      
    default:
      self.postMessage({ 
        type: 'ERROR', 
        error: `Unknown message type: ${type}` 
      });
  }
});

// Periodic cache cleanup
setInterval(() => {
  scanner.cleanupCache();
}, 60000); // Every minute