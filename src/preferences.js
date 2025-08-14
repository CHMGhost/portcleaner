// Apply theme based on preferences
function applyTheme(theme = 'system') {
  let isDark;
  if (theme === 'system') {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    isDark = theme === 'dark';
  }
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

// Listen for system theme changes when theme is set to 'system'
let systemThemeListener = null;
function setupSystemThemeListener(currentTheme) {
  // Remove existing listener
  if (systemThemeListener && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener);
  }
  
  // Add new listener only if theme is 'system'
  if (currentTheme === 'system' && window.matchMedia) {
    systemThemeListener = () => applyTheme('system');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener);
  }
}

// Wait for DOM to be fully loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preferences window loaded');
  
  // Apply initial theme - will be updated when preferences load
  applyTheme();
  
  // Handle sidebar navigation
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  console.log('Found sidebar items:', sidebarItems.length);
  
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      console.log('Sidebar item clicked:', item.dataset.section);
      
      // Update active sidebar item
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Show corresponding section
      const sectionId = item.dataset.section;
      const sections = document.querySelectorAll('.section');
      sections.forEach(s => s.classList.remove('active'));
      
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        targetSection.classList.add('active');
        console.log('Activated section:', sectionId);
      } else {
        console.error('Section not found:', sectionId);
      }
    });
  });
  
  // Load saved preferences
  window.electronAPI.getPreferences().then(prefs => {
    if (prefs) {
      // Apply saved preferences to UI
      Object.keys(prefs).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = prefs[key];
          } else {
            element.value = prefs[key];
          }
        }
      });
      
      // Apply theme preference
      if (prefs.theme) {
        applyTheme(prefs.theme);
        setupSystemThemeListener(prefs.theme);
      }
    }
  });
  
  // Save preferences on change
  document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('change', () => {
      const prefs = {};
      document.querySelectorAll('input, select').forEach(el => {
        if (el.id) {
          if (el.type === 'checkbox') {
            prefs[el.id] = el.checked;
          } else {
            prefs[el.id] = el.value;
          }
        }
      });
      
      // Apply theme immediately if it changed
      if (element.id === 'theme') {
        applyTheme(element.value);
        setupSystemThemeListener(element.value);
      }
      
      // Handle immediate preference changes that need special handling
      if (element.id === 'compactMode' || element.id === 'showPortIcons') {
        // Trigger immediate preference update via IPC
        console.log(`Preference ${element.id} changed to:`, element.type === 'checkbox' ? element.checked : element.value);
      }
      
      window.electronAPI.savePreferences(prefs);
    });
  });
  
  // Handle button clicks
  document.getElementById('resetDefaults').addEventListener('click', () => {
    if (confirm('Reset all preferences to default values?')) {
      window.electronAPI.resetPreferences();
      location.reload();
    }
  });
  
  document.getElementById('exportSettings').addEventListener('click', () => {
    window.electronAPI.exportSettings();
  });
  
  document.getElementById('importSettings').addEventListener('click', () => {
    window.electronAPI.importSettings();
  });
  
  // Privacy policy link
  document.getElementById('privacyPolicy').addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.showPrivacyPolicy();
  });
});