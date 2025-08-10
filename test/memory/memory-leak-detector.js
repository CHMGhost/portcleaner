/**
 * Memory Leak Detection for WTFIsOnMyPort
 * Run with: npm run test:memory
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const v8 = require('v8');
const fs = require('fs').promises;

class MemoryLeakDetector {
  constructor() {
    this.samples = [];
    this.window = null;
    this.config = {
      sampleInterval: 5000, // 5 seconds
      testDuration: 8 * 60 * 60 * 1000, // 8 hours
      memoryThreshold: 100 * 1024 * 1024, // 100MB increase threshold
      autoRefreshInterval: 1000, // 1 second auto-refresh
      reportPath: path.join(__dirname, 'memory-report.json')
    };
    this.startTime = Date.now();
    this.peakMemory = 0;
    this.leakDetected = false;
  }
  
  async initialize() {
    await app.whenReady();
    
    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, '../../src/preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    await this.window.loadFile(path.join(__dirname, '../../src/index.html'));
    
    // Start auto-refresh
    this.window.webContents.executeJavaScript(`
      window.testMode = true;
      window.autoRefreshPorts(${this.config.autoRefreshInterval});
    `);
    
    console.log('Memory leak detection started...');
    console.log(`Test duration: ${this.config.testDuration / 1000 / 60} minutes`);
  }
  
  getMemoryUsage() {
    const processMemory = process.memoryUsage();
    const v8Memory = v8.getHeapStatistics();
    
    return {
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      process: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers
      },
      v8: {
        totalHeapSize: v8Memory.total_heap_size,
        usedHeapSize: v8Memory.used_heap_size,
        heapSizeLimit: v8Memory.heap_size_limit,
        mallocedMemory: v8Memory.malloced_memory,
        peakMallocedMemory: v8Memory.peak_malloced_memory,
        numberOfNativeContexts: v8Memory.number_of_native_contexts,
        numberOfDetachedContexts: v8Memory.number_of_detached_contexts
      }
    };
  }
  
  async collectSample() {
    const usage = this.getMemoryUsage();
    this.samples.push(usage);
    
    // Update peak memory
    if (usage.process.heapUsed > this.peakMemory) {
      this.peakMemory = usage.process.heapUsed;
    }
    
    // Check for potential leak
    if (this.samples.length > 10) {
      this.checkForLeak();
    }
    
    // Log progress
    const elapsedMinutes = Math.floor(usage.elapsed / 1000 / 60);
    const heapMB = Math.round(usage.process.heapUsed / 1024 / 1024);
    const rssMB = Math.round(usage.process.rss / 1024 / 1024);
    
    console.log(`[${elapsedMinutes}m] Heap: ${heapMB}MB, RSS: ${rssMB}MB, Contexts: ${usage.v8.numberOfNativeContexts}`);
    
    // Simulate user actions periodically
    if (this.samples.length % 20 === 0) {
      await this.simulateUserActions();
    }
  }
  
  checkForLeak() {
    const recentSamples = this.samples.slice(-20);
    const oldestRecent = recentSamples[0];
    const newestRecent = recentSamples[recentSamples.length - 1];
    
    const memoryIncrease = newestRecent.process.heapUsed - oldestRecent.process.heapUsed;
    const timeElapsed = newestRecent.elapsed - oldestRecent.elapsed;
    const increaseRate = memoryIncrease / timeElapsed * 1000 * 60; // bytes per minute
    
    // Check for steady memory increase
    const steadyIncrease = recentSamples.every((sample, i) => {
      if (i === 0) return true;
      return sample.process.heapUsed >= recentSamples[i - 1].process.heapUsed * 0.98;
    });
    
    // Detect potential leak
    if (memoryIncrease > this.config.memoryThreshold && steadyIncrease) {
      this.leakDetected = true;
      console.warn(`⚠️  Potential memory leak detected!`);
      console.warn(`   Memory increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.warn(`   Rate: ${Math.round(increaseRate / 1024 / 1024)}MB/min`);
      
      // Take heap snapshot
      this.takeHeapSnapshot();
    }
    
    // Check for detached contexts (DOM leaks)
    if (newestRecent.v8.numberOfDetachedContexts > 5) {
      console.warn(`⚠️  Detached contexts detected: ${newestRecent.v8.numberOfDetachedContexts}`);
    }
  }
  
  async simulateUserActions() {
    console.log('Simulating user actions...');
    
    // Click refresh button
    await this.window.webContents.executeJavaScript(`
      document.getElementById('refreshBtn')?.click();
    `);
    
    // Open and close port details
    await this.window.webContents.executeJavaScript(`
      const ports = document.querySelectorAll('.port-row');
      if (ports.length > 0) {
        ports[0].click();
        setTimeout(() => ports[0].click(), 100);
      }
    `);
    
    // Toggle filters
    await this.window.webContents.executeJavaScript(`
      const filters = document.querySelectorAll('.filter-btn');
      filters.forEach(f => f.click());
    `);
    
    // Search for ports
    await this.window.webContents.executeJavaScript(`
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = '3000';
        searchInput.dispatchEvent(new Event('input'));
        setTimeout(() => {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
        }, 1000);
      }
    `);
  }
  
  takeHeapSnapshot() {
    const heapSnapshot = v8.writeHeapSnapshot();
    console.log(`Heap snapshot saved: ${heapSnapshot}`);
  }
  
  async generateReport() {
    const report = {
      testDuration: Date.now() - this.startTime,
      samplesCollected: this.samples.length,
      leakDetected: this.leakDetected,
      peakMemory: this.peakMemory,
      initialMemory: this.samples[0]?.process.heapUsed || 0,
      finalMemory: this.samples[this.samples.length - 1]?.process.heapUsed || 0,
      memoryIncrease: (this.samples[this.samples.length - 1]?.process.heapUsed || 0) - (this.samples[0]?.process.heapUsed || 0),
      analysis: this.analyzeMemoryTrend(),
      samples: this.samples
    };
    
    await fs.writeFile(this.config.reportPath, JSON.stringify(report, null, 2));
    console.log(`Memory report saved to: ${this.config.reportPath}`);
    
    return report;
  }
  
  analyzeMemoryTrend() {
    if (this.samples.length < 10) {
      return 'Insufficient data';
    }
    
    // Calculate linear regression to determine trend
    const n = this.samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    this.samples.forEach((sample, i) => {
      const x = i;
      const y = sample.process.heapUsed;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Slope represents memory increase per sample
    const memoryIncreasePerHour = slope * (3600000 / this.config.sampleInterval);
    
    let trend = 'Stable';
    if (memoryIncreasePerHour > 10 * 1024 * 1024) { // > 10MB/hour
      trend = 'Increasing (Potential Leak)';
    } else if (memoryIncreasePerHour > 1 * 1024 * 1024) { // > 1MB/hour
      trend = 'Slightly Increasing';
    } else if (memoryIncreasePerHour < -1 * 1024 * 1024) { // < -1MB/hour
      trend = 'Decreasing';
    }
    
    return {
      trend,
      slopePerSample: slope,
      increasePerHour: memoryIncreasePerHour,
      r2: this.calculateR2(slope, intercept)
    };
  }
  
  calculateR2(slope, intercept) {
    const yMean = this.samples.reduce((sum, s) => sum + s.process.heapUsed, 0) / this.samples.length;
    
    let ssRes = 0, ssTot = 0;
    this.samples.forEach((sample, i) => {
      const yPred = slope * i + intercept;
      const yActual = sample.process.heapUsed;
      ssRes += Math.pow(yActual - yPred, 2);
      ssTot += Math.pow(yActual - yMean, 2);
    });
    
    return 1 - (ssRes / ssTot);
  }
  
  async run() {
    try {
      await this.initialize();
      
      // Set up sampling interval
      const sampleInterval = setInterval(() => {
        this.collectSample();
      }, this.config.sampleInterval);
      
      // Set up test duration timeout
      setTimeout(async () => {
        clearInterval(sampleInterval);
        
        console.log('\nMemory leak test completed!');
        const report = await this.generateReport();
        
        console.log('\n=== SUMMARY ===');
        console.log(`Leak Detected: ${report.leakDetected ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`Memory Increase: ${Math.round(report.memoryIncrease / 1024 / 1024)}MB`);
        console.log(`Peak Memory: ${Math.round(report.peakMemory / 1024 / 1024)}MB`);
        console.log(`Trend: ${JSON.stringify(report.analysis.trend)}`);
        
        process.exit(report.leakDetected ? 1 : 0);
      }, this.config.testDuration);
      
      // Keep process alive
      process.stdin.resume();
      
    } catch (error) {
      console.error('Memory test failed:', error);
      process.exit(1);
    }
  }
}

// Run the detector
if (require.main === module) {
  const detector = new MemoryLeakDetector();
  detector.run();
}

module.exports = MemoryLeakDetector;