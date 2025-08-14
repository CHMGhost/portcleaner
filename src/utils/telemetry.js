const { app } = require('electron');
const crypto = require('crypto');
const os = require('os');

class TelemetryManager {
  constructor() {
    this.enabled = false;
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.events = [];
    this.flushInterval = 60000; // Flush every minute
    this.maxBatchSize = 100;
    this.telemetryEndpoint = 'https://api.portcleaner.app/telemetry'; // Replace with actual endpoint
  }

  initialize(store) {
    this.store = store;
    
    // Check if telemetry is enabled
    const preferences = store.get('preferences', {});
    this.enabled = preferences.telemetryEnabled || false;
    
    // Get or generate anonymous user ID
    this.userId = store.get('telemetryUserId');
    if (!this.userId) {
      this.userId = this.generateUserId();
      store.set('telemetryUserId', this.userId);
    }
    
    // Start flush timer if enabled
    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateUserId() {
    // Generate anonymous user ID based on machine ID
    const machineId = crypto.createHash('sha256')
      .update(os.hostname() + os.platform() + os.arch())
      .digest('hex')
      .substring(0, 16);
    return machineId;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    
    if (enabled) {
      this.startFlushTimer();
      // Send opt-in event
      this.trackEvent('telemetry_enabled', {
        timestamp: Date.now()
      });
    } else {
      this.stopFlushTimer();
      // Clear any pending events
      this.events = [];
    }
  }

  startFlushTimer() {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  trackEvent(eventName, properties = {}) {
    if (!this.enabled) {
      console.log(`🔇 Telemetry disabled - would track: ${eventName}`);
      return;
    }
    
    const event = {
      name: eventName,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      properties: {
        ...properties,
        // Add system context
        platform: os.platform(),
        arch: os.arch(),
        electronVersion: process.versions.electron,
        appVersion: app.getVersion(),
        nodeVersion: process.versions.node
      }
    };
    
    console.log(`📊 Tracking: ${eventName}`, properties);
    this.events.push(event);
    
    // Auto-flush if batch size exceeded
    if (this.events.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  trackAction(action, category = 'user_action', metadata = {}) {
    this.trackEvent(`${category}_${action}`, metadata);
  }

  trackError(error, context = {}) {
    if (!this.enabled) return;
    
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  trackPerformance(metric, value, unit = 'ms') {
    if (!this.enabled) return;
    
    this.trackEvent('performance', {
      metric,
      value,
      unit
    });
  }

  async flush() {
    if (!this.enabled || this.events.length === 0) return;
    
    const eventsToSend = [...this.events];
    this.events = [];
    
    try {
      // Always log in development or when no endpoint is configured
      console.log('\n📊 TELEMETRY DATA COLLECTED:');
      console.log('================================');
      eventsToSend.forEach(event => {
        console.log(`\n📌 Event: ${event.name}`);
        console.log(`   Time: ${new Date(event.timestamp).toLocaleTimeString()}`);
        console.log(`   Properties:`, event.properties);
      });
      console.log('================================\n');
      
      // Example of how to send to actual endpoint:
      /*
      const response = await fetch(this.telemetryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToSend,
          userId: this.userId,
          sessionId: this.sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Telemetry send failed: ${response.status}`);
      }
      */
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.error('Failed to send telemetry:', error);
    }
  }

  // Get anonymous statistics
  getStatistics() {
    const preferences = this.store?.get('preferences', {});
    const stats = this.store?.get('usageStats', {
      portsScanned: 0,
      processesKilled: 0,
      appLaunches: 0,
      totalUsageTime: 0,
      lastUsed: Date.now()
    });
    
    return {
      telemetryEnabled: this.enabled,
      userId: this.userId,
      sessionId: this.sessionId,
      stats: {
        ...stats,
        preferences: {
          theme: preferences.theme,
          autoRefreshEnabled: preferences.autoRefreshEnabled,
          refreshInterval: preferences.refreshInterval
        }
      }
    };
  }

  // Clean up on app quit
  destroy() {
    this.flush();
    this.stopFlushTimer();
  }
}

module.exports = new TelemetryManager();