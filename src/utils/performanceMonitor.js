// Performance Monitor for tracking app performance metrics

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = true;
    this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
    
    // Initialize performance observer if available
    if (typeof PerformanceObserver !== 'undefined') {
      this.initObserver();
    }
  }

  initObserver() {
    try {
      // Observe long tasks
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            this.recordMetric('longTask', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('Performance observer not available:', error);
    }
  }

  // Start timing an operation
  startTimer(operation) {
    if (!this.enabled) return;
    
    const timer = {
      operation,
      startTime: performance.now(),
      marks: []
    };
    
    this.metrics.set(operation, timer);
    return timer;
  }

  // Mark a point in an operation
  mark(operation, label) {
    if (!this.enabled) return;
    
    const timer = this.metrics.get(operation);
    if (timer) {
      timer.marks.push({
        label,
        time: performance.now() - timer.startTime
      });
    }
  }

  // End timing and record metrics
  endTimer(operation, metadata = {}) {
    if (!this.enabled) return null;
    
    const timer = this.metrics.get(operation);
    if (!timer) return null;
    
    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    
    const result = {
      operation,
      duration: duration.toFixed(2),
      startTime: timer.startTime,
      endTime,
      marks: timer.marks,
      ...metadata
    };
    
    this.logMetric(result);
    this.metrics.delete(operation);
    
    return result;
  }

  // Record a metric directly
  recordMetric(name, value) {
    if (!this.enabled) return;
    
    const metric = {
      name,
      value,
      timestamp: performance.now()
    };
    
    this.logMetric(metric);
  }

  // Log metrics based on level
  logMetric(metric) {
    const { operation, duration, name } = metric;
    
    if (this.logLevel === 'debug') {
      console.log(`[Performance] ${operation || name}:`, metric);
    } else if (duration && parseFloat(duration) > 100) {
      console.warn(`[Performance] Slow operation: ${operation} took ${duration}ms`);
    }
    
    // Store for analysis
    this.storeMetric(metric);
  }

  // Store metrics for later analysis
  storeMetric(metric) {
    try {
      const stored = JSON.parse(localStorage.getItem('performanceMetrics') || '[]');
      stored.push({
        ...metric,
        timestamp: Date.now()
      });
      
      // Keep only last 100 metrics
      if (stored.length > 100) {
        stored.splice(0, stored.length - 100);
      }
      
      localStorage.setItem('performanceMetrics', JSON.stringify(stored));
    } catch (error) {
      // Ignore storage errors
    }
  }

  // Get performance summary
  getSummary() {
    try {
      const stored = JSON.parse(localStorage.getItem('performanceMetrics') || '[]');
      
      const summary = {
        totalOperations: stored.length,
        averageDuration: 0,
        slowOperations: [],
        operationCounts: {}
      };
      
      let totalDuration = 0;
      let count = 0;
      
      stored.forEach(metric => {
        if (metric.duration) {
          const duration = parseFloat(metric.duration);
          totalDuration += duration;
          count++;
          
          if (duration > 100) {
            summary.slowOperations.push(metric);
          }
        }
        
        const op = metric.operation || metric.name;
        summary.operationCounts[op] = (summary.operationCounts[op] || 0) + 1;
      });
      
      summary.averageDuration = count > 0 ? (totalDuration / count).toFixed(2) : 0;
      
      return summary;
    } catch (error) {
      return null;
    }
  }

  // Measure frame rate
  measureFPS(duration = 1000) {
    let frameCount = 0;
    let lastTime = performance.now();
    const startTime = lastTime;
    
    const measure = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - startTime < duration) {
        requestAnimationFrame(measure);
      } else {
        const fps = (frameCount / ((currentTime - startTime) / 1000)).toFixed(1);
        this.recordMetric('fps', fps);
        console.log(`FPS: ${fps}`);
      }
    };
    
    requestAnimationFrame(measure);
  }

  // Measure memory usage (if available)
  measureMemory() {
    if (performance.memory) {
      const memory = {
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
      };
      
      this.recordMetric('memory', memory);
      return memory;
    }
    return null;
  }

  // Check if virtual scrolling should be enabled
  shouldUseVirtualScrolling(rowCount) {
    // Measure render performance
    const renderTime = this.getAverageRenderTime();
    
    // Use virtual scrolling if:
    // 1. More than 50 rows, OR
    // 2. Average render time > 16ms (60fps threshold), OR
    // 3. Low memory available
    if (rowCount > 50) return true;
    if (renderTime > 16) return true;
    if (this.isLowMemory()) return true;
    
    return false;
  }

  getAverageRenderTime() {
    try {
      const stored = JSON.parse(localStorage.getItem('performanceMetrics') || '[]');
      const renderMetrics = stored.filter(m => 
        m.operation && m.operation.includes('render')
      );
      
      if (renderMetrics.length === 0) return 0;
      
      const total = renderMetrics.reduce((sum, m) => 
        sum + parseFloat(m.duration || 0), 0
      );
      
      return total / renderMetrics.length;
    } catch (error) {
      return 0;
    }
  }

  isLowMemory() {
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      const limit = performance.memory.jsHeapSizeLimit;
      return used / limit > 0.9; // 90% memory usage
    }
    return false;
  }

  // Clear stored metrics
  clearMetrics() {
    localStorage.removeItem('performanceMetrics');
    this.metrics.clear();
  }

  // Export metrics for analysis
  exportMetrics() {
    const metrics = localStorage.getItem('performanceMetrics');
    if (metrics) {
      const blob = new Blob([metrics], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-metrics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
} else {
  window.PerformanceMonitor = PerformanceMonitor;
}