# PortCleaner UX Design System

## 🎨 Design Philosophy
Modern, safe, and powerful port management with a focus on clarity and preventing destructive mistakes.

### Core Principles
1. **Safety First**: Protected processes are visually distinct
2. **Information Hierarchy**: Critical info is immediately visible
3. **Responsive Feedback**: Every action has immediate visual feedback
4. **Platform Native**: Respects OS design patterns
5. **Accessibility**: Usable by everyone

## 🎭 Theme Specifications

### Light Theme Color Palette
```css
:root {
  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F7F9FC;
  --bg-tertiary: #EDF2F7;
  --bg-hover: rgba(0, 0, 0, 0.02);
  --bg-active: rgba(0, 0, 0, 0.04);
  
  /* Text */
  --text-primary: #1A202C;
  --text-secondary: #4A5568;
  --text-muted: #718096;
  --text-disabled: #A0AEC0;
  
  /* Borders */
  --border-default: #E2E8F0;
  --border-hover: #CBD5E0;
  --border-focus: #4299E1;
  
  /* Status Colors */
  --color-success: #48BB78;
  --color-warning: #F6AD55;
  --color-danger: #F56565;
  --color-info: #4299E1;
  
  /* Accent */
  --accent-primary: #5B67F5;
  --accent-secondary: #667EEA;
  --accent-tertiary: #7C3AED;
  
  /* Process States */
  --process-normal: #48BB78;
  --process-protected: #F6AD55;
  --process-system: #9F7AEA;
  --process-killing: #F56565;
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.1);
}
```

### Dark Theme Color Palette
```css
body.dark-theme {
  /* Backgrounds */
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  --bg-hover: rgba(255, 255, 255, 0.02);
  --bg-active: rgba(255, 255, 255, 0.04);
  
  /* Text */
  --text-primary: #F0F6FC;
  --text-secondary: #C9D1D9;
  --text-muted: #8B949E;
  --text-disabled: #484F58;
  
  /* Borders */
  --border-default: #30363D;
  --border-hover: #484F58;
  --border-focus: #58A6FF;
  
  /* Status Colors (vibrant for dark mode) */
  --color-success: #3FB950;
  --color-warning: #D29922;
  --color-danger: #F85149;
  --color-info: #58A6FF;
  
  /* Accent (neon-like for dark theme) */
  --accent-primary: #6E7FF3;
  --accent-secondary: #8B92F8;
  --accent-tertiary: #A78BFA;
  
  /* Process States (with glow) */
  --process-normal: #3FB950;
  --process-protected: #D29922;
  --process-system: #A78BFA;
  --process-killing: #F85149;
  
  /* Shadows (with subtle glow) */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.6);
  --shadow-glow: 0 0 20px rgba(110, 127, 243, 0.15);
}
```

## 🎯 Visual Hierarchy & Information Design

### Port Card Component
```html
<div class="port-card" data-port="3000" data-protected="false">
  <div class="port-card-header">
    <div class="port-badge">
      <span class="port-icon">🔌</span>
      <span class="port-number">3000</span>
      <span class="port-type-badge">HTTP</span>
    </div>
    <div class="port-actions">
      <button class="btn-icon favorite" title="Add to favorites">
        <svg><!-- star icon --></svg>
      </button>
      <button class="btn-icon more" title="More options">
        <svg><!-- dots icon --></svg>
      </button>
    </div>
  </div>
  
  <div class="port-card-body">
    <div class="process-info">
      <img src="app-icon.png" class="process-icon" />
      <div class="process-details">
        <div class="process-name">node</div>
        <div class="process-meta">
          <span class="pid">PID: 1234</span>
          <span class="user">User: admin</span>
        </div>
      </div>
    </div>
    
    <div class="resource-meters">
      <div class="meter cpu-meter">
        <span class="meter-label">CPU</span>
        <div class="meter-bar">
          <div class="meter-fill" style="width: 23%"></div>
        </div>
        <span class="meter-value">23%</span>
      </div>
      <div class="meter memory-meter">
        <span class="meter-label">MEM</span>
        <div class="meter-bar">
          <div class="meter-fill" style="width: 45%"></div>
        </div>
        <span class="meter-value">145MB</span>
      </div>
    </div>
  </div>
  
  <div class="port-card-footer">
    <button class="btn btn-secondary" data-action="inspect">
      <svg><!-- eye icon --></svg>
      Inspect
    </button>
    <button class="btn btn-danger" data-action="kill">
      <svg><!-- x icon --></svg>
      Kill Process
    </button>
  </div>
</div>
```

### Protected Process Card Variant
```html
<div class="port-card protected-process" data-protected="true">
  <div class="protection-banner">
    <svg class="lock-icon"><!-- lock --></svg>
    <span>System Protected</span>
  </div>
  <!-- Rest of card with modified kill button -->
  <div class="port-card-footer">
    <button class="btn btn-warning" data-action="force-kill">
      <svg><!-- warning icon --></svg>
      Force Kill
    </button>
  </div>
</div>
```

## 💫 Micro-Interactions & Animations

### Animation Specifications
```css
/* Transition Timings */
--ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-expo: cubic-bezier(0.7, 0, 0.84, 0);

/* Duration Scale */
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-slower: 800ms;

/* Port Card Animations */
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(110, 127, 243, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(110, 127, 243, 0);
  }
}

@keyframes killProcess {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.95);
    opacity: 0.8;
  }
  100% {
    transform: scale(0.9);
    opacity: 0;
    height: 0;
    padding: 0;
    margin: 0;
  }
}

/* Hover Effects */
.port-card {
  transition: all var(--duration-fast) var(--ease-out-expo);
}

.port-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Kill Animation */
.port-card.killing {
  animation: killProcess var(--duration-slow) var(--ease-in-expo) forwards;
}

/* Resource Meter Animation */
.meter-fill {
  transition: width var(--duration-normal) var(--ease-out-expo);
  background: linear-gradient(90deg, var(--color-success), var(--accent-primary));
}

.meter-fill.high {
  background: linear-gradient(90deg, var(--color-warning), var(--color-danger));
  animation: pulseGlow 2s infinite;
}
```

## 🔍 Search & Filter Design

### Advanced Filter Panel
```html
<div class="filter-panel">
  <div class="search-container">
    <svg class="search-icon"><!-- magnifying glass --></svg>
    <input type="text" class="search-input" placeholder="Search ports, processes, PIDs..." />
    <button class="search-clear" style="display: none;">
      <svg><!-- x icon --></svg>
    </button>
  </div>
  
  <div class="filter-chips">
    <button class="chip active" data-filter="all">
      All Ports
      <span class="chip-count">24</span>
    </button>
    <button class="chip" data-filter="protected">
      <svg class="chip-icon"><!-- lock --></svg>
      Protected
      <span class="chip-count">5</span>
    </button>
    <button class="chip" data-filter="user">
      User Services
      <span class="chip-count">12</span>
    </button>
    <button class="chip" data-filter="system">
      System
      <span class="chip-count">7</span>
    </button>
    <button class="chip" data-filter="high-cpu">
      High CPU
      <span class="chip-count">2</span>
    </button>
  </div>
  
  <div class="filter-actions">
    <button class="btn-text" data-action="save-filter">
      Save Filter
    </button>
    <button class="btn-text" data-action="clear-filters">
      Clear All
    </button>
  </div>
</div>
```

## 🎮 Kill Process Flow

### Safe Kill Confirmation Dialog
```html
<div class="modal kill-confirmation">
  <div class="modal-content">
    <div class="modal-header danger">
      <svg class="modal-icon warning"><!-- warning triangle --></svg>
      <h2>Confirm Process Termination</h2>
    </div>
    
    <div class="modal-body">
      <div class="process-summary">
        <img src="node.png" class="process-icon-large" />
        <div class="process-info-detailed">
          <h3>Node.js Development Server</h3>
          <p class="text-muted">Port 3000 • PID 1234</p>
        </div>
      </div>
      
      <div class="warning-box">
        <p><strong>This will immediately terminate the process.</strong></p>
        <ul class="consequences">
          <li>Any unsaved work will be lost</li>
          <li>Active connections will be dropped</li>
          <li>Related services may be affected</li>
        </ul>
      </div>
      
      <div class="confirmation-input">
        <label>
          <input type="checkbox" id="understand-risks" />
          I understand the consequences
        </label>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="cancel">
        Cancel
      </button>
      <button class="btn btn-danger" data-action="confirm" disabled>
        Kill Process
      </button>
    </div>
  </div>
</div>
```

### Protected Process Force Kill Dialog
```html
<div class="modal force-kill-confirmation">
  <div class="modal-content critical">
    <div class="modal-header critical">
      <svg class="modal-icon danger animated-pulse"><!-- shield with X --></svg>
      <h2>⚠️ CRITICAL: Protected System Process</h2>
    </div>
    
    <div class="modal-body">
      <div class="danger-zone">
        <h3>You are about to force kill: PostgreSQL Database</h3>
        <p class="critical-warning">
          This is a protected system service. Terminating it may cause:
        </p>
        <ul class="critical-consequences">
          <li>🔴 Database corruption and data loss</li>
          <li>🔴 Application crashes</li>
          <li>🔴 System instability</li>
          <li>🔴 Loss of active transactions</li>
        </ul>
      </div>
      
      <div class="alternative-actions">
        <p><strong>Recommended alternatives:</strong></p>
        <button class="btn btn-info">
          <svg><!-- terminal icon --></svg>
          Stop via pg_ctl
        </button>
        <button class="btn btn-info">
          <svg><!-- restart icon --></svg>
          Graceful Restart
        </button>
      </div>
      
      <div class="final-confirmation">
        <label class="danger-checkbox">
          <input type="checkbox" id="force-kill-confirm" />
          <span>I accept full responsibility for any system damage</span>
        </label>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-success" data-action="safe-stop">
        Use Safe Stop Instead
      </button>
      <button class="btn btn-danger-outline" data-action="force-kill" disabled>
        Force Kill Anyway
      </button>
    </div>
  </div>
</div>
```

## 📊 Data Visualization Components

### Port Range Heatmap
```html
<div class="port-heatmap">
  <div class="heatmap-header">
    <h3>Port Usage by Range</h3>
    <div class="heatmap-legend">
      <span class="legend-item low">Low</span>
      <span class="legend-gradient"></span>
      <span class="legend-item high">High</span>
    </div>
  </div>
  <div class="heatmap-grid">
    <div class="range-block system" data-range="0-1023" data-count="5">
      <span class="range-label">System</span>
      <span class="range-count">5 ports</span>
    </div>
    <div class="range-block user" data-range="1024-49151" data-count="18">
      <span class="range-label">User</span>
      <span class="range-count">18 ports</span>
    </div>
    <div class="range-block dynamic" data-range="49152-65535" data-count="3">
      <span class="range-label">Dynamic</span>
      <span class="range-count">3 ports</span>
    </div>
  </div>
</div>
```

### Resource Usage Indicators
```html
<div class="resource-gauge">
  <svg class="gauge-chart" viewBox="0 0 200 100">
    <path class="gauge-background" d="..." />
    <path class="gauge-fill" d="..." stroke-dasharray="..." />
  </svg>
  <div class="gauge-value">
    <span class="value">45</span>
    <span class="unit">%</span>
  </div>
  <div class="gauge-label">CPU Usage</div>
</div>
```

## 🖥️ Platform-Specific Adaptations

### macOS Big Sur+ Design
```css
.platform-macos {
  /* Window styling */
  --window-border-radius: 10px;
  --titlebar-height: 38px;
  --traffic-light-space: 72px;
  
  /* Vibrancy effect */
  .sidebar {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  
  /* SF Symbols integration */
  .icon {
    font-family: 'SF Symbols', -apple-system, BlinkMacSystemFont;
  }
  
  /* Native context menu styling */
  .context-menu {
    border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    padding: 4px 0;
  }
}
```

### Windows 11 Fluent Design
```css
.platform-windows {
  /* Mica material effect */
  --window-background: rgba(255, 255, 255, 0.8);
  
  /* Rounded corners */
  --window-border-radius: 8px;
  --button-border-radius: 4px;
  
  /* Acrylic blur */
  .sidebar {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(60px) saturate(125%);
  }
  
  /* Segoe UI Variable */
  body {
    font-family: 'Segoe UI Variable', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  
  /* Reveal highlight effect */
  .btn:hover::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), 
                rgba(255,255,255,0.1) 0%, 
                transparent 100%);
    pointer-events: none;
  }
}
```

## ♿ Accessibility Features

### Keyboard Navigation
```css
/* Focus indicators */
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Skip links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root {
    --text-primary: #000000;
    --bg-primary: #FFFFFF;
    --border-default: #000000;
  }
  
  .port-card {
    border: 2px solid var(--border-default);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support
```html
<!-- ARIA labels and live regions -->
<div class="port-list" role="list" aria-label="Active ports">
  <div class="port-card" role="listitem" aria-label="Port 3000, Node.js">
    <button 
      class="btn btn-danger" 
      aria-label="Kill Node.js process on port 3000"
      aria-describedby="kill-warning">
      Kill Process
    </button>
  </div>
</div>

<div id="kill-warning" class="sr-only">
  Warning: This will immediately terminate the process. Any unsaved work will be lost.
</div>

<!-- Live region for updates -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  <div id="notification-area"></div>
</div>
```

## 🎨 Icon System

### Process Type Icons
```javascript
const processIcons = {
  'node': '⚡',
  'python': '🐍',
  'docker': '🐳',
  'postgres': '🐘',
  'mysql': '🐬',
  'mongodb': '🍃',
  'redis': '📮',
  'nginx': '🌐',
  'apache': '🪶',
  'java': '☕',
  'ruby': '💎',
  'go': '🐹',
  'rust': '🦀',
  'default': '📦'
};
```

### Status Icons
```javascript
const statusIcons = {
  'listening': '👂',
  'established': '🔗',
  'time_wait': '⏳',
  'close_wait': '🚪',
  'protected': '🔒',
  'killing': '💀',
  'error': '❌',
  'success': '✅',
  'warning': '⚠️',
  'info': 'ℹ️'
};
```

## 🚀 Quick Implementation Guide

### 1. Base Layout Structure
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles/design-system.css">
  <link rel="stylesheet" href="styles/components.css">
  <link rel="stylesheet" href="styles/animations.css">
</head>
<body class="platform-macos theme-auto">
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">PortCleaner</h1>
      </div>
      <div class="header-center">
        <div class="search-bar"><!-- Global search --></div>
      </div>
      <div class="header-right">
        <button class="theme-toggle"><!-- Theme switcher --></button>
      </div>
    </header>
    
    <div class="app-body">
      <aside class="sidebar">
        <!-- Quick filters and stats -->
      </aside>
      
      <main class="main-content">
        <div class="toolbar">
          <!-- Filter chips and actions -->
        </div>
        <div class="port-list">
          <!-- Port cards -->
        </div>
      </main>
    </div>
    
    <footer class="app-footer">
      <div class="status-bar">
        <!-- Status information -->
      </div>
    </footer>
  </div>
</body>
</html>
```

### 2. Typography Scale
```css
/* Type Scale */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### 3. Spacing System
```css
/* Spacing Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## 🎯 Empty States & Onboarding

### No Ports Active
```html
<div class="empty-state">
  <svg class="empty-illustration"><!-- Port icon --></svg>
  <h2>No Active Ports</h2>
  <p>All ports are currently available. Start a service to see it here.</p>
  <button class="btn btn-primary">
    <svg><!-- refresh icon --></svg>
    Refresh
  </button>
</div>
```

### First Launch Welcome
```html
<div class="onboarding-overlay">
  <div class="onboarding-card">
    <h1>Welcome to PortCleaner</h1>
    <p>Manage your system ports with confidence</p>
    
    <div class="feature-highlights">
      <div class="feature">
        <svg><!-- shield icon --></svg>
        <h3>Protected Processes</h3>
        <p>System-critical processes are protected from accidental termination</p>
      </div>
      <div class="feature">
        <svg><!-- search icon --></svg>
        <h3>Smart Search</h3>
        <p>Quickly find ports by number, process name, or PID</p>
      </div>
      <div class="feature">
        <svg><!-- chart icon --></svg>
        <h3>Resource Monitoring</h3>
        <p>Track CPU and memory usage in real-time</p>
      </div>
    </div>
    
    <button class="btn btn-primary btn-large">Get Started</button>
  </div>
</div>
```

## 📱 Responsive Breakpoints

```css
/* Breakpoint definitions */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;

/* Mobile-first responsive design */
@media (min-width: 640px) {
  .port-list {
    grid-template-columns: repeat(1, 1fr);
  }
}

@media (min-width: 768px) {
  .port-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .app-body {
    display: grid;
    grid-template-columns: 240px 1fr;
  }
}

@media (min-width: 1280px) {
  .port-list {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## 🎬 Implementation Priority

### Phase 1: Core Visual Update
1. Implement new color system
2. Update typography scale
3. Create card-based layout
4. Add basic animations

### Phase 2: Safety Features
1. Protected process indicators
2. Multi-step kill confirmation
3. Visual warnings
4. Undo capability

### Phase 3: Enhanced UX
1. Advanced search/filter
2. Resource monitoring
3. Keyboard navigation
4. Context menus

### Phase 4: Polish
1. Micro-interactions
2. Platform-specific features
3. Accessibility improvements
4. Performance optimization

This design system provides a modern, safe, and powerful interface for port management that feels native on each platform while maintaining consistency and usability.