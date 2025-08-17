// Preferences connector - syncs UI preferences with application store
class PreferencesConnector {
  constructor() {
    this.preferences = {};
    this.callbacks = new Map();
    this.systemThemeListener = null;
  }

  async initialize() {
    // Load initial preferences
    this.preferences = await window.electronAPI.getPreferences();
    
    // Listen for preference updates from main process
    window.electronAPI.receive('preferences-updated', (prefs) => {
      this.preferences = prefs;
      this.applyPreferences();
    });
    
    // Apply initial preferences
    this.applyPreferences();
    
    // Set up system theme change listener
    this.setupSystemThemeListener();
  }

  applyPreferences() {
    // Apply theme
    if (this.preferences.theme) {
      this.applyTheme(this.preferences.theme);
    }
    
    // Apply auto-refresh settings
    if (this.preferences.autoRefreshEnabled !== undefined) {
      const autoRefreshToggle = document.getElementById('autoRefreshToggle');
      if (autoRefreshToggle && autoRefreshToggle.checked !== this.preferences.autoRefreshEnabled) {
        autoRefreshToggle.checked = this.preferences.autoRefreshEnabled;
        // Don't dispatch change event here to avoid recursion - let renderer handle it directly
      }
    }
    
    if (this.preferences.refreshInterval !== undefined) {
      const refreshIntervalSelect = document.getElementById('refreshInterval');
      if (refreshIntervalSelect && refreshIntervalSelect.value !== this.preferences.refreshInterval) {
        refreshIntervalSelect.value = this.preferences.refreshInterval;
        // Don't dispatch change event here to avoid recursion - let renderer handle it directly
      }
    }
    
    // Apply compact mode
    if (this.preferences.compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
    
    // Apply showPortIcons preference
    // Note: This will trigger a table re-render when preferences change
    if (this.preferences.showPortIcons !== undefined) {
      // Trigger table refresh to show/hide icons
      if (window.refreshPorts && typeof window.refreshPorts === 'function') {
        // Small delay to ensure preference is applied
        setTimeout(() => {
          window.refreshPorts(false);
        }, 50);
      }
    }
    
    // Apply behavior preferences
    if (this.preferences.soundAlerts !== undefined) {
      // Initialize audio context if sound alerts are enabled and not already initialized
      if (this.preferences.soundAlerts && typeof window.audioContext === 'undefined') {
        try {
          window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
          console.warn('Could not initialize audio context:', error);
        }
      }
    }
    
    // Apply advanced preferences
    if (this.preferences.debugMode !== undefined && window.debugLogger) {
      window.debugLogger.setEnabled(this.preferences.debugMode);
    }
    
    // Apply max ports and virtualization preferences - trigger re-render if needed
    if ((this.preferences.maxPorts !== undefined || this.preferences.enableVirtualization !== undefined) && 
        window.refreshPorts && typeof window.refreshPorts === 'function') {
      setTimeout(() => {
        window.refreshPorts(false);
      }, 50);
    }
    
    // Apply show hidden processes preference - trigger re-render if needed
    if (this.preferences.showHidden !== undefined && 
        window.refreshPorts && typeof window.refreshPorts === 'function') {
      setTimeout(() => {
        window.refreshPorts(false);
      }, 50);
    }
    
    // Notify callbacks
    this.callbacks.forEach(callback => callback(this.preferences));
  }

  applyTheme(theme) {
    const isDark = theme === 'dark' || 
                   (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    
    // Update theme toggle icon
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const lightIcon = themeToggle.querySelector('.theme-icon-light');
      const darkIcon = themeToggle.querySelector('.theme-icon-dark');
      
      if (isDark) {
        lightIcon?.classList.add('hidden');
        darkIcon?.classList.remove('hidden');
      } else {
        lightIcon?.classList.remove('hidden');
        darkIcon?.classList.add('hidden');
      }
      
      // Update tooltip to show current mode
      const themeLabel = theme === 'system' ? 'system' : (isDark ? 'dark' : 'light');
      themeToggle.setAttribute('title', `Current theme: ${themeLabel} (Click to cycle themes)`);
    }
  }

  setupSystemThemeListener() {
    // Listen for system theme changes if theme is set to 'system'
    if (window.matchMedia) {
      this.systemThemeListener = (e) => {
        if (this.preferences.theme === 'system') {
          this.applyTheme('system');
        }
      };
      
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.systemThemeListener);
    }
  }

  get(key) {
    return this.preferences[key];
  }

  async set(key, value) {
    this.preferences[key] = value;
    await window.electronAPI.savePreferences(this.preferences);
  }

  onChange(callback) {
    const id = Date.now();
    this.callbacks.set(id, callback);
    return () => this.callbacks.delete(id);
  }
}

// Export for use in renderer
window.preferencesConnector = new PreferencesConnector();