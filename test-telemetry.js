const path = require('path');

// Mock electron module before requiring telemetry
require('module').Module._cache[require.resolve('electron')] = {
  exports: {
    app: {
      getVersion: () => '1.0.0'
    }
  }
};

// Load telemetry module after mocking electron
const telemetry = require('./src/utils/telemetry');

// Mock store for testing
const mockStore = {
  data: {
    preferences: { telemetryEnabled: true },
    telemetryUserId: 'test-user-123',
    usageStats: {}
  },
  get: function(key, defaultValue) {
    return this.data[key] || defaultValue;
  },
  set: function(key, value) {
    this.data[key] = value;
    console.log(`💾 Stored: ${key} =`, value);
  }
};

console.log('\n🧪 TELEMETRY TEST STARTING...\n');

// Initialize telemetry with mock store
telemetry.initialize(mockStore);

// Enable telemetry
console.log('✅ Enabling telemetry...');
telemetry.setEnabled(true);

// Simulate various app events
console.log('\n🎯 Simulating app events...\n');

// 1. App launch
telemetry.trackEvent('app_launched', {
  firstLaunch: false,
  version: '1.0.0'
});

// 2. Port scan
telemetry.trackAction('scan_ports', 'port_actions');
telemetry.trackPerformance('port_scan_count', 15, 'count');
telemetry.trackPerformance('port_scan_duration', 234, 'ms');

// 3. Process kill attempt
telemetry.trackAction('kill_process_attempt', 'port_actions', {
  port: 3000,
  forceStop: false
});

// 4. Process kill success
telemetry.trackAction('kill_process_success', 'port_actions', {
  port: 3000
});

// 5. Quick scan
telemetry.trackAction('quick_scan', 'port_actions');

// 6. Preferences changed
telemetry.trackAction('preferences_changed', 'settings', {
  theme: 'dark',
  autoRefreshEnabled: true,
  refreshInterval: 5000
});

// 7. Error tracking
telemetry.trackError(new Error('Test error for telemetry'), {
  context: 'port_scan',
  severity: 'low'
});

// 8. Performance metrics
telemetry.trackPerformance('app_startup_time', 1250, 'ms');
telemetry.trackPerformance('memory_usage', 45.2, 'MB');

// Get statistics
console.log('\n📈 Current Statistics:');
const stats = telemetry.getStatistics();
console.log(stats);

// Force flush to see all events
console.log('\n🚀 Flushing telemetry data...');
setTimeout(() => {
  telemetry.flush();
  
  // Test disabling telemetry
  setTimeout(() => {
    console.log('\n🔴 Disabling telemetry...');
    telemetry.setEnabled(false);
    
    // Try to track after disabling
    telemetry.trackEvent('test_after_disable');
    
    console.log('\n✅ TELEMETRY TEST COMPLETE\n');
    process.exit(0);
  }, 1000);
}, 1000);