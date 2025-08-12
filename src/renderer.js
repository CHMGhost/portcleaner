// Renderer process JavaScript
// This file handles the frontend logic for the PortCleaner app

// Error state handlers removed - app works without special permissions
// The app successfully loads ports without needing these handlers

// Initialize Web Worker for heavy operations
let workerManager = null;
let performanceMonitor = null;

try {
  // Load WorkerManager
  const workerScript = document.createElement('script');
  workerScript.src = 'utils/workerManager.js';
  workerScript.onload = () => {
    try {
      workerManager = new WorkerManager();
      console.log('Worker manager initialized');
    } catch (error) {
      console.warn('Worker manager initialization failed, will use main thread:', error);
      workerManager = null;
    }
  };
  workerScript.onerror = () => {
    console.warn('Failed to load worker manager script');
    workerManager = null;
  };
  document.head.appendChild(workerScript);
  
  // Load PerformanceMonitor
  const perfScript = document.createElement('script');
  perfScript.src = 'utils/performanceMonitor.js';
  perfScript.onload = () => {
    performanceMonitor = new PerformanceMonitor();
    console.log('Performance monitor initialized');
    
    // Log initial memory usage
    const memory = performanceMonitor.measureMemory();
    if (memory) {
      console.log('Initial memory usage:', memory);
    }
  };
  document.head.appendChild(perfScript);
} catch (error) {
  console.warn('Worker/Performance manager not available:', error);
}

// Loading splash screen management
function hideLoadingSplash() {
  const splash = document.getElementById('loadingSplash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 300);
  }
}

// Error state management removed - app works without permission checks

// Error state handlers removed - app loads ports successfully without them

// Load cached ports from localStorage
function loadCachedPorts() {
  try {
    const cached = localStorage.getItem('cachedPorts');
    if (cached) {
      const { ports, timestamp } = JSON.parse(cached);
      allPorts = ports;
      
      // Show table section
      const tableSection = document.getElementById('tableSection');
      if (tableSection) {
        tableSection.style.display = 'flex';
      }
      
      applyFiltersAndSort();
      showToast(`Showing cached data from ${new Date(timestamp).toLocaleTimeString()}`, 'info');
    } else {
      showToast('No cached data available', 'warning');
    }
  } catch (error) {
    console.error('Error loading cached ports:', error);
  }
}


// Setup port row interactions for feature discovery
function setupPortRowInteractions() {
  const table = document.getElementById('portsTable');
  if (!table) return;
  
  let hintTimeout = null;
  let hasShownContextHint = localStorage.getItem('hasShownContextHint') === 'true';
  
  // Event delegation for hover hints
  table.addEventListener('mouseenter', (e) => {
    const row = e.target.closest('tbody tr');
    if (!row || hasShownContextHint) return;
    
    // Show right-click hint after hovering for 2 seconds
    hintTimeout = setTimeout(() => {
      const hint = document.getElementById('contextMenuHint');
      if (hint && !hint.classList.contains('hidden')) return;
      
      showHint('contextMenuHint', row, 'right');
      hasShownContextHint = true;
      localStorage.setItem('hasShownContextHint', 'true');
    }, 2000);
  }, true);
  
  table.addEventListener('mouseleave', (e) => {
    const row = e.target.closest('tbody tr');
    if (!row) return;
    
    if (hintTimeout) {
      clearTimeout(hintTimeout);
      hintTimeout = null;
    }
  }, true);
  
  // Track context menu usage
  table.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('tbody tr');
    if (!row) return;
    
    e.preventDefault();
    
    // Hide context hint if shown
    const hint = document.getElementById('contextMenuHint');
    if (hint) {
      hint.classList.add('hidden');
    }
    
    // Mark that user has discovered context menu
    localStorage.setItem('hasUsedContextMenu', 'true');
    localStorage.setItem('hasShownContextHint', 'true');
    
    // Show the actual context menu
    showContextMenu(e, row);
  });
}

// Show context menu
function showContextMenu(event, row) {
  const contextMenu = document.getElementById('contextMenu');
  const advancedSubmenu = document.getElementById('advancedSubmenu');
  if (!contextMenu) return;
  
  // Hide any open menus
  contextMenu.classList.add('hidden');
  advancedSubmenu?.classList.add('hidden');
  
  // Get port data from row
  const portCell = row.querySelector('td:first-child');
  const processCell = row.querySelector('td:nth-child(2)');
  const pidCell = row.querySelector('td:nth-child(3)');
  
  if (!portCell || !processCell || !pidCell) return;
  
  const port = portCell.textContent.trim();
  const processName = processCell.textContent.trim();
  const pid = pidCell.textContent.trim();
  
  // Store data for menu actions
  currentMenuData = { port, processName, pid, row };
  
  // Position and show menu
  const rect = row.getBoundingClientRect();
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  
  // Adjust if menu goes off screen
  contextMenu.classList.remove('hidden');
  const menuRect = contextMenu.getBoundingClientRect();
  
  if (menuRect.right > window.innerWidth) {
    contextMenu.style.left = `${event.clientX - menuRect.width}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    contextMenu.style.top = `${event.clientY - menuRect.height}px`;
  }
  
  // Setup menu item handlers
  setupContextMenuHandlers();
}

// Setup context menu handlers
function setupContextMenuHandlers() {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu || !currentMenuData) return;
  
  const menuItems = contextMenu.querySelectorAll('.menu-item[data-action]');
  menuItems.forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      handleContextMenuAction(action);
    };
  });
  
  // Hide menu on click outside
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', hideContextMenu);
}

function hideContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  const advancedSubmenu = document.getElementById('advancedSubmenu');
  
  contextMenu?.classList.add('hidden');
  advancedSubmenu?.classList.add('hidden');
  
  document.removeEventListener('click', hideContextMenu);
  document.removeEventListener('contextmenu', hideContextMenu);
}

function handleContextMenuAction(action) {
  if (!currentMenuData) return;
  
  switch(action) {
    case 'inspect':
      inspectProcess(currentMenuData);
      break;
    case 'copy-info':
      copyProcessInfo(currentMenuData);
      break;
    case 'graceful-stop':
      showGracefulStopCommand(currentMenuData);
      break;
    case 'force-kill':
    case 'force-stop':  // Handle both for compatibility
      forceKillProcess(currentMenuData);
      break;
    case 'advanced':
      showAdvancedSubmenu();
      break;
    case 'restart-hint':
      showRestartHint(currentMenuData);
      break;
  }
  
  hideContextMenu();
}

// Breadcrumb navigation management
class BreadcrumbManager {
  constructor() {
    this.navigationStack = [];
    this.currentContext = { type: 'main', label: 'Ports' };
  }
  
  push(context) {
    this.navigationStack.push(this.currentContext);
    this.currentContext = context;
    this.updateBreadcrumbs();
  }
  
  pop() {
    if (this.navigationStack.length > 0) {
      this.currentContext = this.navigationStack.pop();
      this.updateBreadcrumbs();
      return this.currentContext;
    }
    return null;
  }
  
  updateBreadcrumbs() {
    // Update all breadcrumb displays
    const breadcrumbs = document.querySelectorAll('.breadcrumb');
    breadcrumbs.forEach(breadcrumb => {
      this.renderBreadcrumb(breadcrumb);
    });
  }
  
  renderBreadcrumb(container) {
    if (!container) return;
    
    const items = [...this.navigationStack, this.currentContext];
    const html = items.map((item, index) => {
      const isLast = index === items.length - 1;
      const itemHtml = `
        <li class="breadcrumb-item ${isLast ? 'active' : 'clickable'}" data-index="${index}">
          ${item.icon ? item.icon : ''}
          <span>${item.label}</span>
        </li>
      `;
      
      if (!isLast) {
        return itemHtml + `
          <li class="breadcrumb-separator" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </li>
        `;
      }
      return itemHtml;
    }).join('');
    
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.breadcrumb-item.clickable').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.navigateToIndex(index);
      });
    });
  }
  
  navigateToIndex(index) {
    // Navigate back to a specific breadcrumb level
    while (this.navigationStack.length > index) {
      this.pop();
    }
    
    // Close any open modals/panels
    this.closeCurrentView();
  }
  
  closeCurrentView() {
    // Close modals and panels based on current context
    if (this.currentContext.type === 'modal') {
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.classList.add('hidden');
      });
    } else if (this.currentContext.type === 'panel') {
      document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.add('hidden');
      });
    }
  }
}

// Initialize breadcrumb manager
const breadcrumbManager = new BreadcrumbManager();

// Context menu action handlers
function inspectProcess(data) {
  const modal = document.getElementById('inspectModal');
  if (!modal) return;
  
  // Update breadcrumb context
  breadcrumbManager.push({
    type: 'modal',
    label: `Port ${data.port}`,
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 16v-4"></path>
      <path d="M12 8h.01"></path>
    </svg>`
  });
  
  // Update specific breadcrumb in modal
  const breadcrumbPort = document.getElementById('inspectBreadcrumbPort');
  if (breadcrumbPort) {
    breadcrumbPort.innerHTML = `<span>Port ${data.port}</span>`;
  }
  
  // Populate modal with process data
  document.getElementById('inspectProcessName').textContent = data.processName;
  document.getElementById('inspectPid').textContent = data.pid;
  document.getElementById('inspectPort').textContent = data.port;
  
  // Get additional data from row
  const row = data.row;
  const userCell = row.querySelector('td:nth-child(4)');
  const cpuCell = row.querySelector('td:nth-child(5)');
  const memCell = row.querySelector('td:nth-child(6)');
  
  document.getElementById('inspectUser').textContent = userCell?.textContent || '-';
  document.getElementById('inspectCpu').textContent = cpuCell?.textContent || '-';
  document.getElementById('inspectMemory').textContent = memCell?.textContent || '-';
  
  // Check protection status
  const isProtected = row.classList.contains('protected');
  document.getElementById('inspectProtection').textContent = isProtected ? 'Protected' : 'Normal';
  
  // Check port type
  const portNum = parseInt(data.port);
  let portType = 'User Port';
  if (portNum < 1024) portType = 'System Port';
  else if (portNum >= 49152) portType = 'Dynamic/Private Port';
  document.getElementById('inspectPortType').textContent = portType;
  
  // Show modal
  modal.classList.remove('hidden');
  
  // Setup close handlers
  const closeBtn = modal.querySelector('.modal-close');
  const closeModalBtn = document.getElementById('closeInspectModal');
  const copyBtn = document.getElementById('copyProcessInfo');
  
  const closeModal = () => {
    modal.classList.add('hidden');
    breadcrumbManager.pop();
  };
  
  closeBtn?.addEventListener('click', closeModal);
  closeModalBtn?.addEventListener('click', closeModal);
  copyBtn?.addEventListener('click', () => {
    copyProcessInfo(data);
    closeModal();
  });
}

function copyProcessInfo(data) {
  const info = `Port: ${data.port}\nProcess: ${data.processName}\nPID: ${data.pid}`;
  navigator.clipboard.writeText(info).then(() => {
    showToast('Process info copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

function showGracefulStopCommand(data) {
  const processLower = data.processName.toLowerCase();
  let command = null;
  
  // Find matching graceful stop command
  for (const [key, cmd] of Object.entries(GRACEFUL_STOP_COMMANDS)) {
    if (processLower.includes(key)) {
      command = cmd.replace('{pid}', data.pid);
      break;
    }
  }
  
  if (command) {
    navigator.clipboard.writeText(command).then(() => {
      showToast(`Graceful stop command copied: ${command}`, 'success');
    });
  } else {
    showToast('No graceful stop command available for this process', 'info');
  }
}

function forceKillProcess(data) {
  console.log('Force kill requested for:', data);
  // Show confirmation dialog
  if (confirm(`Force kill ${data.processName} (PID: ${data.pid})?\n\nThis will immediately terminate the process.`)) {
    console.log('User confirmed force kill');
    window.api.killProcess(data.pid, data.processName, data.port, true).then(result => {
      console.log('Force kill result:', result);
      if (result.success) {
        showToast(`Process ${data.processName} terminated`, 'success');
        refreshPorts();
      } else {
        showToast(`Failed to kill process: ${result.error}`, 'error');
      }
    });
  }
}

function showAdvancedSubmenu() {
  const submenu = document.getElementById('advancedSubmenu');
  const contextMenu = document.getElementById('contextMenu');
  if (!submenu || !contextMenu) return;
  
  const menuRect = contextMenu.getBoundingClientRect();
  submenu.style.left = `${menuRect.right + 5}px`;
  submenu.style.top = `${menuRect.top}px`;
  
  // Adjust if submenu goes off screen
  submenu.classList.remove('hidden');
  const submenuRect = submenu.getBoundingClientRect();
  
  if (submenuRect.right > window.innerWidth) {
    submenu.style.left = `${menuRect.left - submenuRect.width - 5}px`;
  }
}

function showRestartHint(data) {
  const processLower = data.processName.toLowerCase();
  let hint = 'To restart this process, first stop it gracefully, then start it again.';
  
  // Provide specific restart hints
  if (processLower.includes('node')) {
    hint = 'To restart Node.js: npm restart or pm2 restart <app>';
  } else if (processLower.includes('docker')) {
    hint = 'To restart Docker container: docker restart <container>';
  } else if (processLower.includes('nginx')) {
    hint = 'To restart Nginx: nginx -s reload or systemctl restart nginx';
  } else if (processLower.includes('mysql')) {
    hint = 'To restart MySQL: mysql.server restart or systemctl restart mysql';
  }
  
  showToast(hint, 'info', 5000);
}

// Feature hints management
const HINTS_SHOWN_KEY = 'portcleaner-hints-shown';

function showFeatureHints() {
  const hintsShown = JSON.parse(localStorage.getItem(HINTS_SHOWN_KEY) || '{}');
  
  // Show context menu hint on first port row
  if (!hintsShown.contextMenu) {
    setTimeout(() => {
      const firstRow = document.querySelector('#portsTable tbody tr');
      if (firstRow) {
        showHint('contextMenuHint', firstRow, 'right');
        hintsShown.contextMenu = true;
      }
    }, 1000);
  }
  
  // Show filter hint
  if (!hintsShown.filters) {
    setTimeout(() => {
      const filterChips = document.querySelector('.filter-chips');
      if (filterChips) {
        showHint('filterHint', filterChips, 'bottom');
        hintsShown.filters = true;
      }
    }, 2000);
  }
  
  // Show resize hint on table header
  if (!hintsShown.resize) {
    setTimeout(() => {
      const resizeHandle = document.querySelector('.resize-handle');
      if (resizeHandle) {
        const header = resizeHandle.parentElement;
        showHint('resizeHint', header, 'bottom');
        hintsShown.resize = true;
      }
    }, 3000);
  }
  
  localStorage.setItem(HINTS_SHOWN_KEY, JSON.stringify(hintsShown));
  
  // Setup persistent help tooltips
  setupPersistentTooltips();
}

// Setup persistent tooltips for complex features
function setupPersistentTooltips() {
  // Tooltip for auto-refresh toggle
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  if (autoRefreshToggle && !autoRefreshToggle.dataset.tooltipAdded) {
    autoRefreshToggle.dataset.tooltipAdded = 'true';
    autoRefreshToggle.setAttribute('title', 'Enable automatic port scanning at regular intervals');
  }
  
  // Tooltip for refresh interval
  const refreshInterval = document.getElementById('refreshInterval');
  if (refreshInterval && !refreshInterval.dataset.tooltipAdded) {
    refreshInterval.dataset.tooltipAdded = 'true';
    refreshInterval.setAttribute('title', 'Set how often to automatically scan for port changes');
  }
  
  // Tooltip for search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput && !searchInput.dataset.tooltipAdded) {
    searchInput.dataset.tooltipAdded = 'true';
    searchInput.setAttribute('placeholder', 'Search ports, processes, PIDs... (supports regex)');
  }
  
  // Tooltip for theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle && !themeToggle.dataset.tooltipAdded) {
    themeToggle.dataset.tooltipAdded = 'true';
    themeToggle.setAttribute('title', 'Toggle between light and dark theme (Shortcut: T)');
  }
  
  // Add info icons to filter chips
  addFilterChipTooltips();
  
  // Add column header tooltips
  addColumnHeaderTooltips();
}

// Add tooltips to filter chips
function addFilterChipTooltips() {
  const filterTooltips = {
    'all': 'Show all active ports on your system',
    'favorites': 'Show only ports you\'ve starred for quick access',
    'critical': 'Show system-critical ports (< 1024) that require admin privileges',
    'protected': 'Show ports used by protected system services'
  };
  
  document.querySelectorAll('.filter-chip').forEach(chip => {
    const filter = chip.dataset.filter;
    if (filter && filterTooltips[filter] && !chip.dataset.tooltipAdded) {
      chip.dataset.tooltipAdded = 'true';
      chip.setAttribute('title', filterTooltips[filter]);
    }
  });
}

// Add tooltips to column headers
function addColumnHeaderTooltips() {
  const columnTooltips = {
    'port': 'Port number (click to sort, drag border to resize)',
    'process': 'Process name using the port',
    'pid': 'Process ID - unique identifier for the process',
    'user': 'User account running the process',
    'cpu': 'CPU usage percentage',
    'memory': 'Memory usage in MB'
  };
  
  document.querySelectorAll('#portsTable thead th').forEach(header => {
    const column = header.dataset.col;
    if (column && columnTooltips[column] && !header.dataset.tooltipAdded) {
      header.dataset.tooltipAdded = 'true';
      header.setAttribute('title', columnTooltips[column]);
    }
  });
}

function showHint(hintId, targetElement, position = 'bottom') {
  const hint = document.getElementById(hintId);
  if (!hint || !targetElement) return;
  
  const rect = targetElement.getBoundingClientRect();
  const arrow = hint.querySelector('.hint-arrow');
  
  // Position hint
  let top, left;
  arrow.className = 'hint-arrow';
  
  switch(position) {
    case 'bottom':
      top = rect.bottom + 10;
      left = rect.left + (rect.width / 2) - (hint.offsetWidth / 2);
      arrow.classList.add('arrow-top');
      break;
    case 'top':
      top = rect.top - hint.offsetHeight - 10;
      left = rect.left + (rect.width / 2) - (hint.offsetWidth / 2);
      arrow.classList.add('arrow-bottom');
      break;
    case 'right':
      top = rect.top + (rect.height / 2) - (hint.offsetHeight / 2);
      left = rect.right + 10;
      arrow.classList.add('arrow-left');
      break;
    case 'left':
      top = rect.top + (rect.height / 2) - (hint.offsetHeight / 2);
      left = rect.left - hint.offsetWidth - 10;
      arrow.classList.add('arrow-right');
      break;
  }
  
  hint.style.left = `${left}px`;
  hint.style.top = `${top}px`;
  hint.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    hint.classList.add('hidden');
  }, 5000);
  
  // Dismiss button
  const dismissBtn = hint.querySelector('.hint-dismiss');
  dismissBtn?.addEventListener('click', () => {
    hint.classList.add('hidden');
  });
}

// Initialize app with error checking
async function initializeApp() {
  try {
    // Update splash status
    const splashStatus = document.querySelector('.splash-status');
    if (splashStatus) {
      splashStatus.textContent = 'Checking system...';
    }
    
    // Skip system requirement checks - app works without them
    // Just hide splash and load ports
    hideLoadingSplash();
    if (refreshPorts) {
      await refreshPorts();
    } else {
      console.warn('refreshPorts not yet initialized');
    }
    
  } catch (error) {
    console.error('Initialization error:', error);
    hideLoadingSplash();
    // Continue anyway - app works
  }
}

// Declare refreshPorts as a variable that will be defined later
let refreshPorts;

// Note: Button handler functions are now defined at the top of this file
// The duplicate definitions have been removed to avoid conflicts

// Helper function to show warning banner
function showWarningBanner(message) {
  const banner = document.createElement('div');
  banner.className = 'warning-banner';
  banner.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff9800;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  banner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px;">×</button>
  `;
  
  // Remove existing warning banners
  document.querySelectorAll('.warning-banner').forEach(b => b.remove());
  
  // Add new banner
  document.body.appendChild(banner);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    banner.remove();
  }, 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('PortCleaner renderer loaded');
  
  const portInput = document.getElementById('portInput');
  const checkBtn = document.getElementById('checkBtn');
  const results = document.getElementById('results');
  const freePortInput = document.getElementById('freePortInput');
  const freePortBtn = document.getElementById('freePortBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const allPortsList = document.getElementById('allPortsList');
  const portTableContainer = document.getElementById('portTableContainer') || document.getElementById('tableSection');
  const themeToggle = document.getElementById('themeToggle');
  const autoRefreshContainer = document.getElementById('autoRefreshContainer');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const refreshIntervalSelect = document.getElementById('refreshInterval');
  const refreshCountdown = document.getElementById('refreshCountdown');
  
  // Error state buttons removed - app works without permission checks
  
  // Persistence Keys
  const THEME_KEY = 'portcleaner-theme';
  const REFRESH_INTERVAL_KEY = 'portcleaner-refresh-interval';
  const FILTER_TAB_KEY = 'portcleaner-filter-tab';
  const AUTO_REFRESH_KEY = 'portcleaner-auto-refresh';
  
  // Auto-refresh Management
  let autoRefreshInterval = null;
  let countdownInterval = null;
  let isRefreshing = false;
  let portsVisible = false;
  let lastRefreshTime = null;
  let relativeTimeInterval = null;
  let isInitialLoad = true;
  
  // Status bar elements
  const activePortCountEl = document.getElementById('activePortCount');
  const statusRefreshTimeEl = document.getElementById('statusRefreshTime');
  const statusAutoRefreshEl = document.getElementById('statusAutoRefresh');
  const versionInfo = document.getElementById('versionInfo');
  
  // Search and Filter Management
  let allPorts = [];
  let filteredPorts = [];
  let previousPortData = new Map(); // Track previous data for update detection
  let activeFilters = JSON.parse(localStorage.getItem('activeFilters') || '[]');
  let currentFilter = localStorage.getItem(FILTER_TAB_KEY) || 'all'; // Keep for backward compatibility
  let currentSort = { column: 'port', direction: 'asc' };
  let favoritePorts = JSON.parse(localStorage.getItem('favoritePorts') || '[]');
  
  // Search and filter elements
  const filterSection = document.getElementById('filterSection');
  const tableSection = document.getElementById('tableSection');
  const emptyState = document.getElementById('emptyState');
  const skeletonLoader = document.getElementById('skeletonLoader');
  const errorBanner = document.getElementById('errorBanner');
  const lastRefreshTimeEl = document.getElementById('lastRefreshTime');
  const portCountBadge = document.getElementById('portCountBadge');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterButtons = document.querySelectorAll('.filter-chip');
  const sortableHeaders = document.querySelectorAll('.sortable');
  
  // Load saved preferences
  const savedTheme = localStorage.getItem(THEME_KEY);
  const lightIcon = themeToggle?.querySelector('.theme-icon-light');
  const darkIcon = themeToggle?.querySelector('.theme-icon-dark');
  
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    // Show moon icon for dark theme
    lightIcon?.classList.add('hidden');
    darkIcon?.classList.remove('hidden');
  } else {
    // Light theme is default - show sun icon
    lightIcon?.classList.remove('hidden');
    darkIcon?.classList.add('hidden');
  }
  
  // Load saved refresh interval
  const savedRefreshInterval = localStorage.getItem(REFRESH_INTERVAL_KEY);
  if (savedRefreshInterval && refreshIntervalSelect) {
    refreshIntervalSelect.value = savedRefreshInterval;
  }
  
  // Load saved auto-refresh state
  const savedAutoRefresh = localStorage.getItem(AUTO_REFRESH_KEY);
  if (autoRefreshToggle) {
    autoRefreshToggle.checked = savedAutoRefresh !== 'false';
  }
  
  // Apply saved filters
  filterButtons.forEach(btn => {
    btn.classList.remove('active');
    const filterType = btn.dataset.filter;
    
    if (filterType === 'all' && activeFilters.length === 0) {
      btn.classList.add('active');
    } else if (activeFilters.includes(filterType)) {
      btn.classList.add('active');
    }
  });
  
  // ========================================
  // TIME HELPERS
  // ========================================
  function getRelativeTime(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  
  function updateRelativeTime() {
    const timeElement = document.getElementById('lastRefreshTime');
    if (timeElement && lastRefreshTime) {
      const relativeTime = getRelativeTime(lastRefreshTime);
      timeElement.textContent = relativeTime;
      
      // Add stale indicator if older than 1 minute
      const isStale = (Date.now() - lastRefreshTime) > 60000;
      timeElement.classList.toggle('stale', isStale);
    }
  }
  
  function updateLastRefreshTime() {
    lastRefreshTime = Date.now();
    updateRelativeTime();
    
    // Update status bar
    if (statusRefreshTimeEl) {
      statusRefreshTimeEl.textContent = getRelativeTime(lastRefreshTime);
    }
  }
  
  // Update port count in status bar
  function updatePortCount(count) {
    if (activePortCountEl) {
      activePortCountEl.textContent = count;
    }
  }
  
  // Update auto-refresh status
  function updateAutoRefreshStatus(isActive) {
    if (statusAutoRefreshEl) {
      statusAutoRefreshEl.textContent = isActive ? 'ON' : 'OFF';
      statusAutoRefreshEl.classList.toggle('active', isActive);
    }
  }
  
  // Start relative time updater
  if (!relativeTimeInterval) {
    relativeTimeInterval = setInterval(updateRelativeTime, 5000); // Update every 5 seconds
  }
  
  // ========================================
  // DEBOUNCE HELPER
  // ========================================
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // ========================================
  // OPTIMIZED SEARCH HIGHLIGHTING
  // ========================================
  const highlightCache = new Map();
  let lastSearchTerm = '';
  
  function highlightText(text, searchTerm, cache = null) {
    if (!searchTerm || searchTerm.length < 2) return text;
    
    // Use cache if available
    const cacheKey = `${text}::${searchTerm}`;
    if (cache && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    // Create highlight span with minimal reflow
    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    const highlighted = text.replace(regex, '<mark class="search-highlight">$1</mark>');
    
    // Store in cache
    if (cache) {
      cache.set(cacheKey, highlighted);
    }
    
    return highlighted;
  }
  
  // Helper to escape regex special characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Clear highlight cache when search term changes
  function clearHighlightCache() {
    highlightCache.clear();
  }
  
  // ========================================
  // TOAST NOTIFICATION SYSTEM WITH SMART POSITIONING
  // ========================================
  const MAX_TOASTS = 3;
  let activeToasts = [];
  
  function showToast(message, type = 'info', title = null, duration = 5000) {
    const toastContainer = document.getElementById('toastContainer');
    
    // Manage toast queue - remove oldest if at max
    if (activeToasts.length >= MAX_TOASTS) {
      const oldestToast = activeToasts.shift();
      if (oldestToast && oldestToast.parentElement) {
        oldestToast.classList.add('removing');
        setTimeout(() => oldestToast.remove(), 300);
      }
    }
    
    // Check for UI overlaps and adjust container position
    adjustToastContainerPosition();
    
    // Announce to screen readers
    announceToScreenReader(message, type === 'error' ? 'alert' : 'polite');
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    
    // Icons for different types
    const icons = {
      success: '✅',
      error: '❌',
      warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffc107" stroke="#ffc107" stroke-width="0" style="display: inline-block; vertical-align: middle;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2"></line>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="2"></line>
      </svg>`,
      info: 'ℹ️',
      progress: '⏳'
    };
    
    // Build toast HTML
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss notification">×</button>
    `;
    
    // Add to container with animation
    toastContainer.appendChild(toast);
    activeToasts.push(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast-enter');
    });
    
    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      removeToast(toast);
    });
    
    // Auto remove after duration (unless it's a progress toast)
    if (type !== 'progress' && duration > 0) {
      setTimeout(() => {
        removeToast(toast);
      }, duration);
    }
    
    return toast;
  }
  
  function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    
    const index = activeToasts.indexOf(toast);
    if (index > -1) {
      activeToasts.splice(index, 1);
    }
    
    toast.classList.add('removing');
    setTimeout(() => {
      toast.remove();
      repositionToasts();
    }, 300);
  }
  
  function repositionToasts() {
    activeToasts.forEach((toast, index) => {
      toast.style.transform = `translateY(${index * 10}px)`;
    });
  }
  
  function adjustToastContainerPosition() {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    // Check for overlapping elements
    const historyPanel = document.getElementById('recentlyKilledPanel');
    const inspectModal = document.getElementById('inspectModal');
    const quickActions = document.getElementById('quickActionsModal');
    
    // Default position
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.bottom = 'auto';
    container.style.left = 'auto';
    
    // Adjust if history panel is visible
    if (historyPanel && !historyPanel.classList.contains('hidden')) {
      container.style.left = '20px';
      container.style.right = 'auto';
    }
    
    // Adjust if modal is visible
    if ((inspectModal && !inspectModal.classList.contains('hidden')) ||
        (quickActions && !quickActions.classList.contains('hidden'))) {
      container.style.top = 'auto';
      container.style.bottom = '60px';
    }
  }
  
  // Announce messages to screen readers
  function announceToScreenReader(message, level = 'polite') {
    const announcer = level === 'alert' 
      ? document.getElementById('srAlerts')
      : document.getElementById('srAnnouncements');
    
    if (announcer) {
      announcer.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }
  
  // Show progress toast with animated progress bar
  function showProgressToast(message, subtitle = null) {
    const toast = showToast(
      `<div class="progress-content">
        <div>${message}</div>
        ${subtitle ? `<div class="progress-subtitle">${subtitle}</div>` : ''}
        <div class="progress-bar-container">
          <div class="progress-bar-indeterminate"></div>
        </div>
      </div>`,
      'progress',
      null,
      0 // Don't auto-remove
    );
    return toast;
  }
  
  // ========================================
  // FREE PORT FUNCTIONALITY (PRIMARY ACTION)
  // ========================================
  async function freePort() {
    const port = parseInt(freePortInput.value);
    
    if (!port || port < 1 || port > 65535) {
      showToast('Please enter a valid port number (1-65535)', 'error', 'Invalid Port');
      freePortInput.focus();
      return;
    }
    
    // Track operation time
    const startTime = Date.now();
    let progressToast = null;
    
    // Show loading state
    freePortBtn.disabled = true;
    const btnText = freePortBtn.querySelector('.btn-text');
    const spinner = freePortBtn.querySelector('.spinner');
    const originalText = btnText.textContent;
    btnText.textContent = 'Checking...';
    spinner.style.display = 'inline-block';
    
    // Show progress if operation takes > 2 seconds
    const progressTimeout = setTimeout(() => {
      progressToast = showProgressToast(`Checking port ${port}...`, 'Scanning system processes');
    }, 2000);
    
    try {
      // First check if port is in use
      console.log('Checking port:', port);
      const portInfo = await window.api.getPortInfo(port);
      console.log('Port info result:', portInfo);
      
      if (!portInfo.success) {
        showToast(`Error checking port: ${portInfo.error}`, 'error', 'Check Failed');
        return;
      }
      
      if (!portInfo.data) {
        // Port is not in use
        showToast(`Port ${port} is already free!`, 'success', 'Port Available');
        freePortInput.value = '';
        return;
      }
      
      // Port is in use - show process info and kill it
      const processInfo = portInfo.data;
      showToast(
        `Stopping ${processInfo.command} (PID: ${processInfo.pid})...`,
        'warning',
        `Stopping Process on Port ${port}`
      );
      
      // Stop the process (this will show confirmation dialog from main.js)
      console.log('Calling killProcess with:', {
        pid: processInfo.pid,
        command: processInfo.command,
        port: port
      });
      const stopResult = await window.api.killProcess(
        processInfo.pid,
        processInfo.command,
        port,
        false // Don't force stop initially
      );
      console.log('Stop result:', stopResult);
      
      if (stopResult.success) {
        showToast(
          `Successfully stopped process on port ${port}`,
          'success',
          'Process Stopped!'
        );
        freePortInput.value = '';
        
        // Optionally refresh the port list if it's visible
        if (portTableContainer.style.display !== 'none') {
          setTimeout(() => refreshPorts(false), 500);
        }
      } else {
        if (stopResult.error === 'User cancelled') {
          showToast('Operation cancelled', 'info');
        } else {
          showToast(
            stopResult.error || 'Failed to stop process',
            'error',
            'Failed to Stop Process'
          );
        }
      }
    } catch (error) {
      showToast(`Unexpected error: ${error.message}`, 'error', 'Error');
    } finally {
      // Clear progress indicators
      clearTimeout(progressTimeout);
      if (progressToast) removeToast(progressToast);
      
      // Reset button state
      freePortBtn.disabled = false;
      btnText.textContent = originalText;
      spinner.style.display = 'none';
    }
  }
  
  // Free Port button click handler
  freePortBtn?.addEventListener('click', freePort);
  
  // Handle Enter key in free port input
  freePortInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      freePort();
    }
  });
  
  // Theme toggle handler with SVG icons
  themeToggle?.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    
    // Update SVG icons
    const lightIcon = themeToggle.querySelector('.theme-icon-light');
    const darkIcon = themeToggle.querySelector('.theme-icon-dark');
    
    if (isDark) {
      lightIcon?.classList.add('hidden');
      darkIcon?.classList.remove('hidden');
    } else {
      lightIcon?.classList.remove('hidden');
      darkIcon?.classList.add('hidden');
    }
    
    // Save preference
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    
    // Add a nice transition effect
    document.body.style.transition = 'all 0.3s ease';
  });
  
  // Check single port with loading state (only if elements exist)
  if (checkBtn && portInput) {
    checkBtn.addEventListener('click', async () => {
      const port = parseInt(portInput.value);
      
      if (!port || port < 1 || port > 65535) {
        showResult('Please enter a valid port number (1-65535)', 'error');
        return;
      }
      
      // Show loading state
      const originalText = checkBtn.textContent;
      checkBtn.textContent = 'Checking...';
      checkBtn.disabled = true;
      portInput.disabled = true;
      
      try {
        const result = await window.api.getPortInfo(port);
        if (result.success) {
          if (!result.data) {
            showResult(`✓ Port ${port} is not in use`, 'success');
          } else {
            const info = result.data;
            showResult(`⚠ Port ${port} is in use by ${info.command} (PID: ${info.pid}, User: ${info.user})`, 'success');
          }
        } else {
          showResult(`✗ Error checking port: ${result.error}`, 'error');
        }
      } catch (error) {
        showResult(`✗ Unexpected error: ${error.message}`, 'error');
      } finally {
        // Reset button state
        checkBtn.textContent = originalText;
        checkBtn.disabled = false;
        portInput.disabled = false;
        portInput.focus();
      }
    });
    
    // Handle Enter key in port input
    portInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        checkBtn.click();
      }
    });
  }
  
  // Function to refresh ports with progress tracking
  refreshPorts = async function(isAutoRefresh = false) {
    if (isRefreshing) return;
    isRefreshing = true;
    
    // Hide any existing error banner
    hideErrorBanner();
    
    // Track operation time for progress indicator
    const startTime = Date.now();
    let progressToast = null;
    let progressTimeout = null;
    
    if (!isAutoRefresh) {
      // Show skeleton loading in table
      showSkeletonLoading();
      
      // Show progress indicator if operation takes > 2 seconds
      progressTimeout = setTimeout(() => {
        progressToast = showProgressToast('Fetching port information...', 'This may take a moment');
      }, 2000);
    } else {
      // For auto-refresh, show subtle loading indication
      const interval = parseInt(refreshIntervalSelect.value);
      if (interval > 2000) {
        document.body.classList.add('auto-refreshing');
        // Add loading class to table for subtle opacity change
        document.getElementById('portsTable').classList.add('loading');
      }
    }
    
    try {
      const result = await window.api.getAllPorts();
      
      // Handle errors simply - just log them since the app works
      if (!result.success) {
        console.warn('Port scan had issues but continuing:', result);
        // Try to use whatever data we got
        result.data = result.data || [];
      }
      
      if (result.success || result.data) {
        // Success - we have data to work with
        
        // Check if results are limited
        if (result.limited && result.limitedMessage) {
          showWarningBanner(result.limitedMessage);
        }
        
        allPorts = result.data;
        
        // Define the continuation function
        const continuePortProcessing = () => {
          // Cache ports data for offline use
          try {
            localStorage.setItem('cachedPorts', JSON.stringify({
              ports: allPorts,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('Failed to cache ports data:', e);
          }
          
          // Show table section
          if (tableSection) {
            tableSection.style.display = 'flex';
          }
          
          applyFiltersAndSort(isAutoRefresh);
          portsVisible = true;
          
          // Update port count badge
          const portCountBadge = document.getElementById('portCountBadge');
          if (portCountBadge) {
            portCountBadge.textContent = result.data.length;
            portCountBadge.style.display = result.data.length > 0 ? 'inline-block' : 'none';
          }
          
          // Update last refresh time
          updateLastRefreshTime();
          
          // Update port count in status bar
          updatePortCount(result.data.length);
          
          // Start auto-refresh if enabled and not already running
          if (autoRefreshToggle.checked && !autoRefreshInterval) {
            startAutoRefresh();
          }
        };
        
        // Process ports using worker if available
        if (workerManager && allPorts.length > 20) {
          workerManager.processPorts(allPorts)
            .then(processed => {
              allPorts = processed.ports;
              console.log(`Ports processed by worker in ${processed.stats.processingTime}ms`);
              
              // Continue with normal flow
              continuePortProcessing();
            })
            .catch(error => {
              console.warn('Worker processing failed:', error);
              // Continue without worker processing
              continuePortProcessing();
            });
        } else {
          // Process in main thread for small datasets
          continuePortProcessing();
        }
      } else {
        // Show error with retry option
        const errorMsg = result.error || 'Failed to fetch port information';
        showErrorBanner('Unable to fetch ports', errorMsg, () => refreshPorts(false));
        showToast(errorMsg, 'error', 'Port Fetch Failed');
        showEmptyState('error');
        portsVisible = false;
      }
    } catch (error) {
      // Show error with retry option
      showErrorBanner('Unexpected error', error.message, () => refreshPorts(false));
      showToast(`Unexpected error: ${error.message}`, 'error');
      showEmptyState('error');
      portsVisible = false;
    } finally {
      // Clear progress indicators
      if (progressTimeout) clearTimeout(progressTimeout);
      if (progressToast) removeToast(progressToast);
      // Reset button state
      if (!isAutoRefresh) {
      } else {
        document.body.classList.remove('auto-refreshing');
        const portsTable = document.getElementById('portsTable');
        if (portsTable) {
          portsTable.classList.remove('loading');
        }
      }
      isRefreshing = false;
    }
  };
  
  // Refresh button with improved loading state
  refreshBtn?.addEventListener('click', async () => {
    if (refreshBtn) refreshBtn.classList.add('refreshing');
    await refreshPorts(false);
    setTimeout(() => {
      if (refreshBtn) refreshBtn.classList.remove('refreshing');
    }, 500);
  });
  
  // Auto-refresh functions
  function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing intervals
    
    const interval = parseInt(refreshIntervalSelect.value);
    if (interval === 0 || !autoRefreshToggle.checked) {
      refreshCountdown.textContent = 'Paused';
      return;
    }
    
    // For real-time updates (1-2 seconds), don't show countdown
    if (interval <= 2000 && refreshCountdown) {
      refreshCountdown.textContent = 'Live';
      refreshCountdown.style.color = '#48bb78';
    }
    
    autoRefreshInterval = setInterval(() => {
      if (portsVisible && !isRefreshing) {
        refreshPorts(true);
      }
    }, interval);
  }
  
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
  
  // ========================================
  // CONTEXT MENU & TOOLTIPS
  // ========================================
  const contextMenu = document.getElementById('contextMenu');
  const protectionTooltip = document.getElementById('protectionTooltip');
  let currentMenuData = null;
  
  // Protection reasons for different process types
  const PROTECTION_REASONS = {
    'kernel_task': {
      message: 'Core macOS system process',
      reasons: [
        'Manages CPU, memory, and disk',
        'Killing it will crash your system',
        'Required for OS operation'
      ]
    },
    'launchd': {
      message: 'System initialization daemon',
      reasons: [
        'Parent of all processes',
        'Manages system services',
        'Killing it will force reboot'
      ]
    },
    'postgres': {
      message: 'PostgreSQL database server',
      reasons: [
        'Active database connections',
        'May cause data corruption',
        'Use pg_ctl stop instead'
      ]
    },
    'mysql': {
      message: 'MySQL database server',
      reasons: [
        'Active database connections',
        'May cause data corruption',
        'Use mysql.server stop instead'
      ]
    },
    'docker': {
      message: 'Docker container runtime',
      reasons: [
        'Running containers depend on it',
        'May corrupt container state',
        'Use docker daemon commands'
      ]
    },
    'nginx': {
      message: 'Web server process',
      reasons: [
        'Serving active connections',
        'May have pending requests',
        'Use nginx -s quit instead'
      ]
    },
    'default': {
      message: 'Critical system service',
      reasons: [
        'Required for system stability',
        'Other services may depend on it',
        'Should be stopped gracefully'
      ]
    }
  };
  
  // Get protection reason for a process
  function getProtectionReason(processName) {
    const processLower = processName.toLowerCase();
    for (const [key, value] of Object.entries(PROTECTION_REASONS)) {
      if (processLower.includes(key)) {
        return value;
      }
    }
    return PROTECTION_REASONS.default;
  }
  
  // Graceful stop commands for known processes
  const GRACEFUL_STOP_COMMANDS = {
    'node': 'kill -SIGTERM {pid}',
    'npm': 'npm stop',
    'yarn': 'yarn stop',
    'docker': 'docker stop {container}',
    'nginx': 'nginx -s quit',
    'apache': 'apachectl graceful-stop',
    'httpd': 'httpd -k graceful-stop',
    'postgres': 'pg_ctl stop -D /path/to/data',
    'postgresql': 'systemctl stop postgresql',
    'mysql': 'mysqladmin shutdown',
    'mysqld': 'mysqladmin shutdown',
    'mongod': 'mongod --shutdown',
    'mongodb': 'systemctl stop mongodb',
    'redis': 'redis-cli shutdown',
    'redis-server': 'redis-cli shutdown',
    'pm2': 'pm2 stop {process}',
    'java': 'kill -SIGTERM {pid}',
    'python': 'kill -SIGTERM {pid}',
    'ruby': 'kill -SIGTERM {pid}',
    'php': 'kill -SIGTERM {pid}'
  };
  
  // Get graceful stop command for a process
  function getGracefulStopCommand(processName, pid) {
    const processLower = processName.toLowerCase();
    for (const [key, command] of Object.entries(GRACEFUL_STOP_COMMANDS)) {
      if (processLower.includes(key)) {
        return command.replace('{pid}', pid).replace('{process}', processName).replace('{container}', processName);
      }
    }
    return null;
  }
  
  // Show context menu
  function showActionContextMenu(event, pid, processName, port) {
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Store current menu data
    currentMenuData = { pid, processName, port };
    
    // Check for graceful stop command
    const gracefulStopItem = document.getElementById('gracefulStopItem');
    const gracefulStopHint = document.getElementById('gracefulStopHint');
    const gracefulCommand = getGracefulStopCommand(processName, pid);
    
    if (gracefulCommand && gracefulStopItem) {
      gracefulStopItem.style.display = 'flex';
      if (gracefulStopHint) {
        gracefulStopHint.textContent = gracefulCommand.length > 20 ? 
          gracefulCommand.substring(0, 20) + '...' : gracefulCommand;
      }
      currentMenuData.gracefulCommand = gracefulCommand;
    } else if (gracefulStopItem) {
      gracefulStopItem.style.display = 'none';
    }
    
    // Position menu
    const rect = event.target.getBoundingClientRect();
    contextMenu.style.left = `${rect.left}px`;
    contextMenu.style.top = `${rect.bottom + 5}px`;
    
    // Adjust if menu would go off screen
    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      contextMenu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      contextMenu.style.top = `${rect.top - menuRect.height - 5}px`;
    }
    
    // Show menu
    contextMenu.classList.remove('hidden');
    
    // Mark button as active
    event.target.classList.add('active');
  }
  
  // Hide context menu
  function hideContextMenu() {
    if (!contextMenu) return;
    
    contextMenu.classList.add('hidden');
    document.querySelectorAll('.action-menu-btn.active').forEach(btn => {
      btn.classList.remove('active');
    });
    currentMenuData = null;
  }
  
  // Show protection tooltip
  function showProtectionTooltip(event, processName) {
    const reason = getProtectionReason(processName);
    const tooltip = protectionTooltip;
    
    // Update content
    tooltip.querySelector('.tooltip-message').textContent = reason.message;
    
    const reasonsList = reason.reasons.map(r => `<li>${r}</li>`).join('');
    tooltip.querySelector('.tooltip-reasons').innerHTML = `<ul>${reasonsList}</ul>`;
    
    // Add close button if not present
    if (!tooltip.querySelector('.tooltip-close')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tooltip-close';
      closeBtn.innerHTML = '×';
      closeBtn.setAttribute('aria-label', 'Close tooltip');
      tooltip.querySelector('.tooltip-content').appendChild(closeBtn);
    }
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    // Adjust if tooltip goes off screen
    requestAnimationFrame(() => {
      const tooltipRect = tooltip.getBoundingClientRect();
      if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
      }
      if (tooltipRect.bottom > window.innerHeight) {
        tooltip.style.top = `${rect.top - tooltipRect.height - 10}px`;
      }
    });
    
    // Show tooltip
    tooltip.classList.remove('hidden');
    tooltip.classList.add('show');
    
    // Make it dismissible on click (anywhere in tooltip or close button)
    const closeTooltip = () => {
      tooltip.classList.remove('show');
      setTimeout(() => {
        tooltip.classList.add('hidden');
      }, 200);
    };
    
    // Close on button click
    const closeBtn = tooltip.querySelector('.tooltip-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTooltip();
      };
    }
    
    // Close on clicking outside
    const handleOutsideClick = (e) => {
      if (!tooltip.contains(e.target) && !event.target.contains(e.target)) {
        closeTooltip();
        document.removeEventListener('click', handleOutsideClick);
      }
    };
    
    // Add listener after a brief delay to prevent immediate closure
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
  }
  
  // Event delegation for dynamically created elements
  allPortsList.addEventListener('click', (event) => {
    // Handle favorite star clicks
    if (event.target.classList.contains('favorite-star')) {
      const port = parseInt(event.target.dataset.port);
      toggleFavorite(port);
    }
    
    // Kill button click now just shows instructions (actual kill happens on hold)
    if (event.target.classList.contains('kill-btn') && !event.target.disabled) {
      // Handled by mousedown/mouseup events
    }
    
    // Handle action menu button clicks
    const actionMenuBtn = event.target.closest('.action-menu-btn');
    if (actionMenuBtn) {
      const pid = parseInt(actionMenuBtn.dataset.pid);
      const processName = actionMenuBtn.dataset.process;
      const port = parseInt(actionMenuBtn.dataset.port);
      showActionContextMenu(event, pid, processName, port);
    }
    
    // Handle "Why?" button clicks
    const whyProtectedBtn = event.target.closest('.why-protected');
    if (whyProtectedBtn) {
      const processName = whyProtectedBtn.dataset.process;
      showProtectionTooltip(event, processName);
    }
  });
  
  // Context menu item clicks
  contextMenu.addEventListener('click', (event) => {
    const menuItem = event.target.closest('.menu-item');
    if (!menuItem) return;
    
    const action = menuItem.dataset.action;
    
    switch (action) {
      case 'advanced':
        // Show advanced submenu
        showAdvancedSubmenu(event, currentMenuData);
        return; // Don't hide main menu
        
      case 'inspect':
        if (currentMenuData) {
          showProcessInspectModal(currentMenuData.pid, currentMenuData.processName, currentMenuData.port);
        }
        break;
        
      case 'copy-info':
        if (currentMenuData) {
          const info = `Process: ${currentMenuData.processName}\nPID: ${currentMenuData.pid}\nPort: ${currentMenuData.port}`;
          navigator.clipboard.writeText(info);
          showToast('Process info copied to clipboard', 'success');
        }
        break;
        
      case 'graceful-stop':
        if (currentMenuData && currentMenuData.gracefulCommand) {
          navigator.clipboard.writeText(currentMenuData.gracefulCommand);
          showToast(`Graceful stop command copied: ${currentMenuData.gracefulCommand}`, 'success');
        }
        break;
    }
    
    hideContextMenu();
  });
  
  // Show advanced actions submenu
  function showAdvancedSubmenu(event, menuData) {
    const submenu = document.getElementById('advancedSubmenu');
    if (!submenu) return;
    
    // Position submenu next to the menu item
    const menuItem = event.target.closest('.menu-item');
    const rect = menuItem.getBoundingClientRect();
    
    submenu.style.left = `${rect.right + 5}px`;
    submenu.style.top = `${rect.top}px`;
    
    // Adjust if it would go off screen
    requestAnimationFrame(() => {
      const submenuRect = submenu.getBoundingClientRect();
      if (submenuRect.right > window.innerWidth) {
        submenu.style.left = `${rect.left - submenuRect.width - 5}px`;
      }
      if (submenuRect.bottom > window.innerHeight) {
        submenu.style.top = `${window.innerHeight - submenuRect.height - 10}px`;
      }
    });
    
    // Show submenu
    submenu.classList.remove('hidden');
    
    // Handle submenu clicks
    submenu.onclick = (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      
      const subAction = item.dataset.action;
      
      switch (subAction) {
        case 'force-kill':
        case 'force-stop':  // Handle both for compatibility
          showForceKillConfirmation(e, menuData);
          break;
          
        case 'restart-hint':
          showRestartHint(menuData);
          break;
      }
      
      // Hide menus
      submenu.classList.add('hidden');
      hideContextMenu();
    };
  }
  
  // Hide advanced submenu when clicking outside
  document.addEventListener('click', (event) => {
    const submenu = document.getElementById('advancedSubmenu');
    if (submenu && !submenu.classList.contains('hidden')) {
      if (!event.target.closest('#advancedSubmenu') && 
          !event.target.closest('.menu-item[data-action="advanced"]')) {
        submenu.classList.add('hidden');
      }
    }
  });
  
  // Show force kill confirmation submenu
  function showForceKillConfirmation(event, menuData) {
    // Create confirmation submenu if it doesn't exist
    let confirmMenu = document.getElementById('forceKillConfirm');
    if (!confirmMenu) {
      confirmMenu = document.createElement('div');
      confirmMenu.id = 'forceKillConfirm';
      confirmMenu.className = 'context-menu submenu';
      confirmMenu.innerHTML = `
        <div class="menu-header danger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#dc3545" stroke="#dc3545" stroke-width="0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2"></line>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="2"></line>
          </svg>
          <span>Force Kill Warning</span>
        </div>
        <div class="menu-message">
          This will immediately terminate the process.<br>
          Data loss may occur.
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item danger" data-action="confirm-force-kill">
          <span class="menu-text">Yes, Force Kill Process</span>
        </div>
        <div class="menu-item" data-action="cancel">
          <span class="menu-text">Cancel</span>
        </div>
      `;
      document.body.appendChild(confirmMenu);
    }
    
    // Position submenu next to the original menu item
    const menuRect = event.target.closest('.menu-item').getBoundingClientRect();
    confirmMenu.style.left = `${menuRect.right + 5}px`;
    confirmMenu.style.top = `${menuRect.top}px`;
    
    // Adjust if it would go off screen
    const confirmRect = confirmMenu.getBoundingClientRect();
    if (confirmRect.right > window.innerWidth) {
      confirmMenu.style.left = `${menuRect.left - confirmRect.width - 5}px`;
    }
    
    // Show confirmation menu
    confirmMenu.classList.remove('hidden');
    
    // Handle confirmation menu clicks
    confirmMenu.onclick = (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      
      const confirmAction = item.dataset.action;
      if (confirmAction === 'confirm-force-kill') {
        // Now actually perform the force kill
        killProcess(menuData.pid, menuData.processName, menuData.port, true);
      }
      
      // Hide both menus
      confirmMenu.classList.add('hidden');
      hideContextMenu();
    };
  }
  
  // Close menus when clicking outside
  document.addEventListener('click', (event) => {
    // Close context menu
    if (!event.target.closest('.context-menu') && !event.target.closest('.action-menu-btn')) {
      hideContextMenu();
      document.getElementById('advancedSubmenu')?.classList.add('hidden');
      document.getElementById('forceKillConfirm')?.classList.add('hidden');
    }
    
    // Close protection tooltip
    if (!event.target.closest('.protection-tooltip') && !event.target.closest('.why-protected')) {
      protectionTooltip.classList.add('hidden');
    }
    
    // Close history panel
    if (!event.target.closest('.recently-killed-panel') && 
        !event.target.closest('[data-action="show-history"]')) {
      document.getElementById('recentlyKilledPanel')?.classList.add('hidden');
    }
  });
  
  // ========================================
  // STOP PROCESS FUNCTIONALITY
  // ========================================
  
  // Handle click on stop buttons
  allPortsList.addEventListener('click', async (event) => {
    const stopBtn = event.target.closest('.stop-btn:not([disabled])');
    if (!stopBtn) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Get button data
    const pid = parseInt(stopBtn.dataset.pid);
    const processName = stopBtn.dataset.process;
    const port = parseInt(stopBtn.dataset.port);
    
    // Show confirmation dialog
    const message = `Stop process "${processName}" (PID: ${pid}) on port ${port}?\n\nThis will gracefully stop the process.`;
    
    if (confirm(message)) {
      // Visual feedback
      stopBtn.disabled = true;
      stopBtn.classList.add('stopping');
      const originalContent = stopBtn.innerHTML;
      stopBtn.innerHTML = `
        <span class="spinner"></span>
        Stopping...
      `;
      
      // Stop the process
      try {
        await killProcess(pid, processName, port, false);
        
        // Success feedback
        stopBtn.classList.remove('stopping');
        stopBtn.classList.add('success');
        stopBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
          Stopped
        `;
      } catch (error) {
        // Error feedback
        stopBtn.classList.remove('stopping');
        stopBtn.classList.add('error');
        stopBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Failed
        `;
      }
      
      // Reset button after delay
      setTimeout(() => {
        stopBtn.disabled = false;
        stopBtn.classList.remove('success', 'error');
        stopBtn.innerHTML = originalContent;
      }, 2000);
    }
  });
  
  // ========================================
  // PROCESS INSPECT MODAL
  // ========================================
  const inspectModal = document.getElementById('inspectModal');
  const modalClose = inspectModal?.querySelector('.modal-close');
  const closeInspectModalBtn = document.getElementById('closeInspectModal');
  const copyProcessInfoBtn = document.getElementById('copyProcessInfo');
  
  // Show process inspect modal with detailed information
  function showProcessInspectModal(pid, processName, port) {
    // Find the full port data from our stored information
    const portData = allPorts.find(p => p.pid === pid && p.port === port);
    
    if (!portData) {
      showToast('Process information not available', 'error');
      return;
    }
    
    // Populate modal fields
    document.getElementById('inspectProcessName').textContent = processName || 'Unknown';
    document.getElementById('inspectPid').textContent = pid;
    document.getElementById('inspectPort').textContent = port;
    document.getElementById('inspectUser').textContent = portData.user || 'Unknown';
    document.getElementById('inspectCpu').textContent = `${portData.cpu || 0}%`;
    document.getElementById('inspectMemory').textContent = portData.memory || '0 KB';
    
    // Check if process is protected
    const PROTECTED_PROCESSES = [
      'kernel_task', 'launchd', 'systemd', 'init',
      'WindowServer', 'loginwindow', 'csrutil', 'mds',
      'mdworker', 'spotlightd', 'coreservicesd', 'finder'
    ];
    
    // Critical ports that need extra caution
    const CRITICAL_PORTS = {
      22: 'SSH',
      80: 'HTTP',
      443: 'HTTPS',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      27017: 'MongoDB',
      6379: 'Redis'
    };
    
    // Determine if the process is protected based on multiple factors
    const isProtectedProcess = PROTECTED_PROCESSES.some(p => 
      processName.toLowerCase().includes(p.toLowerCase())
    );
    const isSystemPort = port < 1024;
    const isCriticalPort = CRITICAL_PORTS.hasOwnProperty(port);
    
    // A process is considered protected if ANY of these conditions are true
    const isProtected = isProtectedProcess || isSystemPort || isCriticalPort;
    
    const protectionEl = document.getElementById('inspectProtection');
    if (isProtected) {
      // Provide specific reason for protection
      let protectionReason = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>Protected`;
      if (isProtectedProcess) {
        protectionReason = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>System Process`;
      } else if (isCriticalPort) {
        protectionReason = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>${CRITICAL_PORTS[port]} Service`;
      } else if (isSystemPort) {
        protectionReason = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>System Port`;
      }
      protectionEl.innerHTML = protectionReason;
      protectionEl.className = 'inspect-value protected';
    } else {
      protectionEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>Not Protected`;
      protectionEl.className = 'inspect-value safe';
    }
    
    // Set port type
    const portTypeEl = document.getElementById('inspectPortType');
    if (CRITICAL_PORTS[port]) {
      portTypeEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffc107" stroke="#ffc107" stroke-width="0" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2"></line>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="2"></line>
      </svg>${CRITICAL_PORTS[port]} Service`;
      portTypeEl.className = 'inspect-value critical';
    } else if (port < 1024) {
      portTypeEl.textContent = '🔐 System Port (< 1024)';
      portTypeEl.className = 'inspect-value protected';
    } else {
      portTypeEl.textContent = `User Port (${port})`;
      portTypeEl.className = 'inspect-value';
    }
    
    // Add port number styling
    const portEl = document.getElementById('inspectPort');
    portEl.className = 'inspect-value port-number';
    
    // Show the modal
    inspectModal.classList.remove('hidden');
    hideContextMenu(); // Close context menu when opening modal
  }
  
  // Close modal handlers
  modalClose?.addEventListener('click', () => {
    inspectModal.classList.add('hidden');
  });
  
  closeInspectModalBtn?.addEventListener('click', () => {
    inspectModal.classList.add('hidden');
  });
  
  // Close modal when clicking backdrop
  inspectModal?.addEventListener('click', (event) => {
    if (event.target === inspectModal) {
      inspectModal.classList.add('hidden');
    }
  });
  
  // Copy process info button
  copyProcessInfoBtn?.addEventListener('click', () => {
    const processName = document.getElementById('inspectProcessName').textContent;
    const pid = document.getElementById('inspectPid').textContent;
    const port = document.getElementById('inspectPort').textContent;
    const user = document.getElementById('inspectUser').textContent;
    const cpu = document.getElementById('inspectCpu').textContent;
    const memory = document.getElementById('inspectMemory').textContent;
    const protection = document.getElementById('inspectProtection').textContent;
    const portType = document.getElementById('inspectPortType').textContent;
    
    const info = `Process Details
================
Process Name: ${processName}
PID: ${pid}
Port: ${port}
User: ${user}
CPU Usage: ${cpu}
Memory Usage: ${memory}
Protection Status: ${protection}
Port Type: ${portType}`;
    
    navigator.clipboard.writeText(info);
    showToast('Process details copied to clipboard', 'success');
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !inspectModal.classList.contains('hidden')) {
      inspectModal.classList.add('hidden');
    }
  });
  
  // Toggle favorite function
  function toggleFavorite(port) {
    const index = favoritePorts.indexOf(port);
    if (index > -1) {
      favoritePorts.splice(index, 1);
    } else {
      favoritePorts.push(port);
    }
    localStorage.setItem('favoritePorts', JSON.stringify(favoritePorts));
    
    // Update the display if currently filtering favorites
    if (currentFilter === 'favorites') {
      applyFiltersAndSort();
    } else {
      // Just update the star icon
      const star = document.querySelector(`.favorite-star[data-port="${port}"]`);
      if (star) {
        const isFavorite = favoritePorts.includes(port);
        star.classList.toggle('active', isFavorite);
        star.textContent = isFavorite ? '⭐' : '☆';
        star.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
      }
    }
  }
  
  // Auto-refresh toggle handler with live indicator
  autoRefreshToggle.addEventListener('change', () => {
    localStorage.setItem(AUTO_REFRESH_KEY, autoRefreshToggle.checked);
    const liveIndicator = document.getElementById('liveIndicator');
    
    if (autoRefreshToggle.checked) {
      startAutoRefresh();
      updateAutoRefreshStatus(true);
      if (liveIndicator) {
        liveIndicator.classList.remove('paused');
        const liveText = liveIndicator.querySelector('.live-text');
        if (liveText) liveText.textContent = 'Live';
      }
    } else {
      stopAutoRefresh();
      if (liveIndicator) {
        liveIndicator.classList.add('paused');
        const liveText = liveIndicator.querySelector('.live-text');
        if (liveText) liveText.textContent = 'Paused';
      }
      updateAutoRefreshStatus(false);
    }
  });
  
  // Refresh interval change handler
  refreshIntervalSelect.addEventListener('change', () => {
    localStorage.setItem(REFRESH_INTERVAL_KEY, refreshIntervalSelect.value);
    if (autoRefreshToggle.checked) {
      startAutoRefresh();
    }
  });
  
  // Display result message (updated to use toast for better UX)
  function showResult(message, type) {
    // Also show in the results div for backward compatibility
    results.textContent = message;
    results.className = 'show ' + type;
    
    // Show toast notification
    const toastType = type === 'error' ? 'error' : 'success';
    showToast(message, toastType);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      results.classList.remove('show');
    }, 5000);
  }
  
  // Update context breadcrumb based on active filters/search
  function updateContextBreadcrumb() {
    const contextBar = document.getElementById('contextBreadcrumb');
    const contextItem = document.getElementById('contextActiveItem');
    const searchTerm = searchInput?.value.trim();
    const activeFilterChip = document.querySelector('.filter-chip.active');
    const activeFilter = activeFilterChip?.dataset.filter;
    
    if (!contextBar || !contextItem) return;
    
    // Determine if we need to show context
    const hasSearch = searchTerm && searchTerm.length > 0;
    const hasFilter = activeFilter && activeFilter !== 'all';
    
    if (hasSearch || hasFilter) {
      contextBar.style.display = 'flex';
      
      // Build context label
      let contextLabel = '';
      if (hasFilter) {
        const filterLabels = {
          'favorites': 'Favorite Ports',
          'critical': 'Critical Ports',
          'protected': 'Protected Processes'
        };
        contextLabel = filterLabels[activeFilter] || 'Filtered';
      }
      
      if (hasSearch) {
        if (contextLabel) {
          contextLabel += ` → Search: "${searchTerm}"`;
        } else {
          contextLabel = `Search: "${searchTerm}"`;
        }
      }
      
      contextItem.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        <span>${contextLabel}</span>
      `;
    } else {
      contextBar.style.display = 'none';
    }
  }
  
  // Clear context button handler
  document.getElementById('clearContextBtn')?.addEventListener('click', () => {
    // Clear search
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Reset to 'all' filter
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.remove('active');
      if (chip.dataset.filter === 'all') {
        chip.classList.add('active');
      }
    });
    
    // Re-apply filters
    applyFiltersAndSort();
  });
  
  // Apply filters and sorting
  async function applyFiltersAndSort(isAutoRefresh = false) {
    // Use worker for filtering/sorting if available and dataset is large
    if (workerManager && allPorts.length > 50) {
      try {
        const filters = {
          search: searchInput?.value.trim(),
          category: currentFilter,
          favoritePorts: favoritePorts
        };
        
        // Filter ports using worker
        filteredPorts = await workerManager.filterPorts(allPorts, filters);
        
        // Sort ports using worker
        filteredPorts = await workerManager.sortPorts(filteredPorts, currentSort);
        
        // Display results
        displayAllPorts(filteredPorts, isAutoRefresh);
        updateResultCount(filteredPorts.length, allPorts.length);
        updateContextBreadcrumb();
        return;
      } catch (error) {
        console.warn('Worker filtering/sorting failed:', error);
        // Fall through to main thread processing
      }
    }
    
    // Main thread processing (fallback or small datasets)
    // Start with all ports
    filteredPorts = [...allPorts];
    
    // Apply search filter
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (searchTerm) {
      filteredPorts = filteredPorts.filter(port => {
        const processName = (port.command || port.process || '').toLowerCase();
        const portNumber = port.port.toString();
        const pid = port.pid.toString();
        const user = (port.user || '').toLowerCase();
        
        return processName.includes(searchTerm) ||
               portNumber.includes(searchTerm) ||
               pid.includes(searchTerm) ||
               user.includes(searchTerm);
      });
    }
    
    // Apply multiple filters (can combine)
    if (activeFilters.length > 0) {
      const CRITICAL_PORTS = [22, 80, 443, 3306, 5432, 27017, 6379];
      const PROTECTED_PROCESSES = [
        'kernel_task', 'launchd', 'systemd', 'init',
        'postgres', 'mysql', 'mongod', 'redis',
        'docker', 'nginx', 'apache'
      ];
      
      // Filter to only show ports that match ANY active filter (OR logic)
      filteredPorts = filteredPorts.filter(port => {
        return activeFilters.some(filter => {
          switch (filter) {
            case 'favorites':
              return favoritePorts.includes(port.port);
            case 'critical':
              return CRITICAL_PORTS.includes(port.port);
            case 'protected':
              const processName = (port.command || port.process || '').toLowerCase();
              return PROTECTED_PROCESSES.some(proc => processName.includes(proc.toLowerCase()));
            default:
              return true;
          }
        });
      });
    }
    
    // Apply sorting
    filteredPorts.sort((a, b) => {
      let aVal, bVal;
      
      switch (currentSort.column) {
        case 'port':
          aVal = a.port;
          bVal = b.port;
          break;
        case 'process':
          aVal = a.command || a.process || '';
          bVal = b.command || b.process || '';
          break;
        case 'pid':
          aVal = a.pid;
          bVal = b.pid;
          break;
        case 'user':
          aVal = a.user || '';
          bVal = b.user || '';
          break;
        case 'cpu':
          aVal = parseFloat(a.cpu || 0);
          bVal = parseFloat(b.cpu || 0);
          break;
        case 'memory':
          aVal = parseMemoryValue(a.memory || '0 KB');
          bVal = parseMemoryValue(b.memory || '0 KB');
          break;
        default:
          aVal = a.port;
          bVal = b.port;
      }
      
      if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    displayAllPorts(filteredPorts, isAutoRefresh);
    
    // Update result count
    updateResultCount(filteredPorts.length, allPorts.length);
    
    // Update context breadcrumb
    updateContextBreadcrumb();
  }
  
  // Update result count display
  function updateResultCount(visible, total) {
    const visibleCountEl = document.getElementById('visibleCount');
    const totalCountEl = document.getElementById('totalCount');
    const resultCountEl = document.getElementById('resultCount');
    
    if (visibleCountEl) visibleCountEl.textContent = visible;
    if (totalCountEl) totalCountEl.textContent = total;
    
    // Show/hide result count based on filtering
    if (resultCountEl) {
      const hasFilters = activeFilters.length > 0 || (searchInput && searchInput.value.trim());
      resultCountEl.style.display = hasFilters ? 'flex' : 'none';
    }
  }
  
  // Parse memory value for sorting
  function parseMemoryValue(memStr) {
    const match = memStr.match(/(\d+\.?\d*)\s*([KMGT]?B)/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }
  
  // Search functionality with debounce (250ms)
  const debouncedSearch = debounce(() => {
    applyFiltersAndSort();
  }, 250);
  
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', !searchInput.value);
      }
      debouncedSearch();
    });
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      applyFiltersAndSort();
    });
  }
  
  // Filter buttons with multiple selection support
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.dataset.filter;
      
      // If clicking "All", clear all other filters
      if (filterType === 'all') {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilters = [];
      } 
      // Toggle individual filter
      else {
        // Remove "All" active state
        filterButtons.forEach(b => {
          if (b.dataset.filter === 'all') {
            b.classList.remove('active');
          }
        });
        
        // Toggle this filter
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          activeFilters = activeFilters.filter(f => f !== filterType);
        } else {
          btn.classList.add('active');
          if (!activeFilters.includes(filterType)) {
            activeFilters.push(filterType);
          }
        }
        
        // If no filters active, activate "All"
        if (activeFilters.length === 0) {
          filterButtons.forEach(b => {
            if (b.dataset.filter === 'all') {
              b.classList.add('active');
            }
          });
        }
      }
      
      localStorage.setItem('activeFilters', JSON.stringify(activeFilters));
      applyFiltersAndSort();
    });
  });
  
  // Sorting functionality with improved indicators
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      
      // Update sort direction
      if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
      }
      
      // Update UI - remove all sort classes first
      sortableHeaders.forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc', 'sort-active');
        const indicator = h.querySelector('.sort-indicator');
        if (indicator) {
          indicator.textContent = '⇅'; // Reset to neutral
        }
      });
      
      // Add active sort class to current column
      header.classList.add('sort-active', `sort-${currentSort.direction}`);
      const activeIndicator = header.querySelector('.sort-indicator');
      if (activeIndicator) {
        activeIndicator.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
      }
      
      applyFiltersAndSort();
    });
  });
  
  // Toggle favorite port
  window.toggleFavorite = (port) => {
    const index = favoritePorts.indexOf(port);
    if (index > -1) {
      favoritePorts.splice(index, 1);
    } else {
      favoritePorts.push(port);
    }
    
    localStorage.setItem('favoritePorts', JSON.stringify(favoritePorts));
    applyFiltersAndSort();
  };
  
  // ========================================
  // LOADING & EMPTY STATES
  // ========================================
  
  // Generate skeleton loading rows
  function showSkeletonRows(rowCount = 5) {
    const skeletonRows = Array(rowCount).fill(0).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-cell number"></div></td>
        <td><div class="skeleton-cell medium"></div></td>
        <td><div class="skeleton-cell number"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td><div class="skeleton-cell number"></div></td>
        <td><div class="skeleton-cell short"></div></td>
        <td>
          <div class="action-cell">
            <div class="skeleton-cell button"></div>
          </div>
        </td>
      </tr>
    `).join('');
    
    allPortsList.innerHTML = skeletonRows;
  }
  
  // Show appropriate empty state
  function showEmptyState(type = 'no-data') {
    const states = {
      'no-data': {
        icon: '✨',
        title: 'No active ports found',
        message: 'Your system is clean! All ports are currently free.',
        action: null
      },
      'no-results': {
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>`,
        title: 'No matches found',
        message: 'Try adjusting your filters or search terms.',
        action: `
          <button class="btn-secondary" onclick="clearAllFilters()">
            Clear all filters
          </button>
        `
      },
      'error': {
        icon: '❌',
        title: 'Unable to load ports',
        message: 'There was a problem fetching port information.',
        action: `
          <button class="btn-secondary" onclick="refreshPorts(false)">
            Try again
          </button>
        `
      }
    };
    
    const state = states[type] || states['no-data'];
    
    allPortsList.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state ${type}">
            <div class="empty-state-icon">${state.icon}</div>
            <div class="empty-state-title">${state.title}</div>
            <div class="empty-state-message">${state.message}</div>
            ${state.action ? `<div class="empty-state-action">${state.action}</div>` : ''}
          </div>
        </td>
      </tr>
    `;
  }
  
  // Clear all filters helper
  window.clearAllFilters = function() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    currentFilter = 'all';
    localStorage.setItem(FILTER_TAB_KEY, currentFilter);
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === 'all') {
        btn.classList.add('active');
      }
    });
    applyFiltersAndSort();
  };
  
  // Show error banner
  function showErrorBanner(message, details = '') {
    const errorBanner = document.getElementById('errorBanner');
    const errorMessage = errorBanner.querySelector('.error-message');
    
    errorMessage.textContent = details || message;
    errorBanner.classList.remove('hidden');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      errorBanner.classList.add('hidden');
    }, 10000);
  }
  
  // Hide error banner
  function hideErrorBanner() {
    const errorBanner = document.getElementById('errorBanner');
    errorBanner.classList.add('hidden');
  }
  
  // Error banner dismiss button
  document.querySelector('.error-dismiss')?.addEventListener('click', hideErrorBanner);
  
  // ========================================
  // VIRTUAL SCROLLING FOR PERFORMANCE
  // ========================================
  const VIRTUAL_SCROLL_THRESHOLD = 50; // Use virtual scrolling for >50 rows
  const ROW_HEIGHT = 48; // Approximate height of each row in pixels
  const VISIBLE_BUFFER = 5; // Extra rows to render outside viewport
  
  let virtualScrollContainer = null;
  let virtualScrollViewport = null;
  let virtualScrollOffset = 0;
  let virtualScrollTotalHeight = 0;
  let visibleStartIndex = 0;
  let visibleEndIndex = 0;
  
  // Initialize virtual scrolling
  function initVirtualScrolling() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    
    // Create virtual scroll wrapper if needed
    if (!virtualScrollContainer) {
      virtualScrollContainer = document.createElement('div');
      virtualScrollContainer.className = 'virtual-scroll-container';
      virtualScrollContainer.style.position = 'relative';
      virtualScrollContainer.style.height = '600px'; // Max height
      virtualScrollContainer.style.overflowY = 'auto';
      
      // Wrap existing table
      const table = document.getElementById('portsTable');
      if (table && table.parentElement) {
        table.parentElement.insertBefore(virtualScrollContainer, table);
        virtualScrollContainer.appendChild(table);
      }
      
      // Handle scroll events
      virtualScrollContainer.addEventListener('scroll', handleVirtualScroll, { passive: true });
    }
  }
  
  function handleVirtualScroll() {
    if (!virtualScrollContainer || filteredPorts.length <= VIRTUAL_SCROLL_THRESHOLD) return;
    
    const scrollTop = virtualScrollContainer.scrollTop;
    const containerHeight = virtualScrollContainer.clientHeight;
    
    // Calculate visible range
    const newStartIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
    const newEndIndex = Math.min(
      filteredPorts.length,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER
    );
    
    // Only re-render if visible range changed significantly
    if (Math.abs(newStartIndex - visibleStartIndex) > 2 || 
        Math.abs(newEndIndex - visibleEndIndex) > 2) {
      visibleStartIndex = newStartIndex;
      visibleEndIndex = newEndIndex;
      renderVirtualRows();
    }
  }
  
  function renderVirtualRows() {
    const tbody = document.getElementById('allPortsList');
    if (!tbody) return;
    
    // Get visible subset of data
    const visiblePorts = filteredPorts.slice(visibleStartIndex, visibleEndIndex);
    
    // Create spacer for scrolling
    const topSpacer = visibleStartIndex * ROW_HEIGHT;
    const bottomSpacer = (filteredPorts.length - visibleEndIndex) * ROW_HEIGHT;
    
    // Build rows HTML with spacers
    const rowsHtml = buildPortRows(visiblePorts, visibleStartIndex);
    
    tbody.innerHTML = `
      <tr style="height: ${topSpacer}px;" class="virtual-spacer" aria-hidden="true">
        <td colspan="7"></td>
      </tr>
      ${rowsHtml}
      <tr style="height: ${bottomSpacer}px;" class="virtual-spacer" aria-hidden="true">
        <td colspan="7"></td>
      </tr>
    `;
    
    // Update total height for scrollbar
    if (virtualScrollContainer) {
      const table = document.getElementById('portsTable');
      if (table) {
        table.style.height = `${filteredPorts.length * ROW_HEIGHT + 100}px`; // +100 for header
      }
    }
  }
  
  // Display all active ports with virtual scrolling support
  function displayAllPorts(ports, isAutoRefresh = false) {
    // Start performance timing
    performanceMonitor?.startTimer('displayPorts');
    
    // Reset table focus when content changes
    focusedRowIndex = -1;
    focusedCellIndex = -1;
    
    // Check if this is a filtered empty result or truly no data
    const hasActiveFilters = (searchInput && searchInput.value.trim()) || currentFilter !== 'all';
    
    if (ports.length === 0) {
      if (hasActiveFilters) {
        showEmptyState('no-results');
      } else if (allPorts.length === 0) {
        showEmptyState('no-data');
      } else {
        showEmptyState('no-results');
      }
      return;
    }
    
    // Hide empty state and show table
    hideEmptyState();
    if (!isAutoRefresh) {
      hideSkeletonLoading();
    }
    
    // Check with performance monitor if virtual scrolling should be used
    const shouldUseVirtual = performanceMonitor?.shouldUseVirtualScrolling(ports.length) || 
                            ports.length > VIRTUAL_SCROLL_THRESHOLD;
    
    // Use virtual scrolling for large datasets or poor performance
    if (shouldUseVirtual) {
      performanceMonitor?.mark('displayPorts', 'virtualScrolling');
      initVirtualScrolling();
      visibleStartIndex = 0;
      visibleEndIndex = Math.min(ports.length, Math.ceil(600 / ROW_HEIGHT) + VISIBLE_BUFFER);
      renderVirtualRows();
    } else {
      // Regular rendering for small datasets
      performanceMonitor?.mark('displayPorts', 'regularRendering');
      renderRegularTable(ports, isAutoRefresh);
    }
    
    // End performance timing
    const metrics = performanceMonitor?.endTimer('displayPorts', {
      rowCount: ports.length,
      method: shouldUseVirtual ? 'virtual' : 'regular',
      isAutoRefresh
    });
    
    if (metrics && parseFloat(metrics.duration) > 50) {
      console.warn(`Slow render detected: ${metrics.duration}ms for ${ports.length} rows`);
    }
  }
  
  // Build HTML for port rows (extracted for reuse)
  function buildPortRows(ports, startIndex = 0) {
    // Cache search term for highlighting
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const highlightCache = new Map();
    
    return ports.map((port, index) => {
      const actualIndex = startIndex + index;
      return buildSinglePortRow(port, actualIndex, searchTerm, highlightCache);
    }).join('');
  }
  
  // Build HTML for a single port row
  function buildSinglePortRow(port, index, searchTerm, cache) {
    const cpuValue = parseFloat(port.cpu || 0);
    let cpuClass = '';
    let cpuIcon = '';
    let cpuAriaLabel = '';
    
    // Add data attributes for hover hints
    const hasShownContextHint = localStorage.getItem('hasShownContextHint') === 'true';
    
    if (cpuValue > 50) {
      cpuClass = 'cpu-high';
      cpuIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="cpu-icon" aria-hidden="true">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
        <path d="M12 11V7" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="15" r="1" fill="white"/>
      </svg>`;
      cpuAriaLabel = ' (High CPU usage)';
    } else if (cpuValue > 20) {
      cpuClass = 'cpu-medium';
      cpuIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="cpu-icon" aria-hidden="true">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>`;
      cpuAriaLabel = ' (Medium CPU usage)';
    } else {
      cpuIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="cpu-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12l2 2 4-4"/>
      </svg>`;
      cpuAriaLabel = ' (Normal CPU usage)';
    }
    
    const processName = port.command || port.process || 'Unknown';
    const CRITICAL_PORTS = {
      22: 'SSH',
      80: 'HTTP',
      443: 'HTTPS',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      27017: 'MongoDB',
      6379: 'Redis'
    };
    
    const PROTECTED_PROCESSES = [
      'kernel_task', 'launchd', 'systemd', 'init',
      'WindowServer', 'loginwindow', 'finder',
      'postgres', 'postgresql', 'mysql', 'mysqld',
      'mongod', 'mongodb', 'redis-server', 'redis',
      'docker', 'dockerd', 'nginx', 'apache', 'httpd'
    ];
    
    const isCritical = CRITICAL_PORTS[port.port];
    const isProtected = PROTECTED_PROCESSES.some(
      proc => processName.toLowerCase().includes(proc.toLowerCase())
    );
    
    let rowClass = '';
    if (isProtected) rowClass = 'protected-process';
    else if (isCritical) rowClass = 'critical-port';
    
    const isFavorite = favoritePorts.includes(port.port);
    
    // Apply highlighting with cache
    const highlightedPort = searchTerm ? highlightText(port.port.toString(), searchTerm, cache) : port.port;
    const highlightedProcess = searchTerm ? highlightText(processName, searchTerm, cache) : processName;
    const highlightedPid = searchTerm ? highlightText(port.pid.toString(), searchTerm, cache) : port.pid;
    const highlightedUser = searchTerm ? highlightText(port.user || 'Unknown', searchTerm, cache) : (port.user || 'Unknown');
    
    return `
      <tr class="${rowClass}" data-row-key="${port.port}-${port.pid}" data-index="${index}">
        <td>
          <button class="favorite-star ${isFavorite ? 'active' : ''}" 
                  data-port="${port.port}"
                  onclick="toggleFavorite(${port.port})"
                  title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <span class="port-number">${highlightedPort}</span>
          ${isCritical ? `<span class="critical-badge" title="${CRITICAL_PORTS[port.port]} Service">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          </span>` : ''}
        </td>
        <td>
          <span class="process-name">${highlightedProcess}</span>
          ${isProtected ? `<span class="protected-badge" title="Protected Process">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </span>` : ''}
        </td>
        <td>${highlightedPid}</td>
        <td>${highlightedUser}</td>
        <td class="${cpuClass}">
          <span class="cpu-value" aria-label="${port.cpu || '0'}%${cpuAriaLabel}">
            ${cpuIcon}
            <span>${port.cpu || '0'}%</span>
          </span>
        </td>
        <td class="memory-value">${port.memory || '0 KB'}</td>
        <td>
          <div class="action-cell">
            ${isProtected 
              ? `<button class="stop-btn" disabled title="This process is protected">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                   </svg>
                   Stop
                 </button>
                 <button class="why-protected" data-process="${processName}" title="Why is this protected?">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <circle cx="12" cy="12" r="10"></circle>
                     <path d="M12 16v-4"></path>
                     <path d="M12 8h.01"></path>
                   </svg>
                 </button>`
              : `<button class="stop-btn" data-pid="${port.pid}" data-process="${processName}" data-port="${port.port}" title="Stop this process">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                   </svg>
                   Stop
                 </button>`
            }
            <button class="action-menu-btn" data-pid="${port.pid}" data-process="${processName}" data-port="${port.port}" title="More actions">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1" fill="currentColor"></circle>
                <circle cx="12" cy="12" r="1" fill="currentColor"></circle>
                <circle cx="12" cy="19" r="1" fill="currentColor"></circle>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }
  
  // Build content for multiple port rows
  function buildPortRowsContent(ports) {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const cache = searchTerm !== lastSearchTerm ? new Map() : highlightCache;
    
    if (searchTerm !== lastSearchTerm) {
      lastSearchTerm = searchTerm;
    }
    
    return ports.map((port, index) => buildSinglePortRow(port, index, searchTerm, cache)).join('');
  }
  
  // Regular table rendering (non-virtual)
  function renderRegularTable(ports, isAutoRefresh = false) {
    
    // Hide empty state and show table
    hideEmptyState();
    if (!isAutoRefresh) {
      hideSkeletonLoading();
    }
    
    // Clear highlight cache if search term changed
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (searchTerm !== lastSearchTerm) {
      clearHighlightCache();
      lastSearchTerm = searchTerm;
    }
    
    // Detect which ports have changed since last update
    const changedPorts = new Set();
    ports.forEach(p => {
      const key = `${p.port}-${p.pid}`;
      const previousData = previousPortData.get(key);
      const currentData = {
        cpu: p.cpu,
        memory: p.memory,
        user: p.user
      };
      
      if (previousData) {
        // Check if any values changed
        if (previousData.cpu !== currentData.cpu || 
            previousData.memory !== currentData.memory ||
            previousData.user !== currentData.user) {
          changedPorts.add(key);
        }
      }
      
      // Update previous data map
      previousPortData.set(key, currentData);
    });
    
    // Store port data globally for kill process function - make sure it's always updated
    window.portData = {};
    ports.forEach(p => {
      window.portData[p.pid] = {
        processName: p.command || p.process || 'Unknown',
        port: p.port
      };
    });
    
    // Debug: log to check if portData is properly set
    console.log('Port data updated:', window.portData);
    
    // Critical ports that need visual indication
    const CRITICAL_PORTS = {
      22: 'SSH',
      80: 'HTTP',
      443: 'HTTPS',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      27017: 'MongoDB',
      6379: 'Redis'
    };
    
    // Protected processes that should not be killed
    const PROTECTED_PROCESSES = [
      'kernel_task', 'launchd', 'systemd', 'init',
      'WindowServer', 'loginwindow', 'finder',
      'postgres', 'postgresql', 'mysql', 'mysqld',
      'mongod', 'mongodb', 'redis-server', 'redis',
      'docker', 'dockerd', 'nginx', 'apache', 'httpd'
    ];
    
    // Build the new table content  
    const newTableContent = buildPortRowsContent(ports);
    
    // Preserve table height to prevent layout shift
    const currentHeight = allPortsList.offsetHeight;
    if (isAutoRefresh && currentHeight > 0) {
      allPortsList.style.minHeight = `${currentHeight}px`;
    }
    
    // Use requestAnimationFrame to ensure smooth update
    requestAnimationFrame(() => {
      // Update the table content
      allPortsList.innerHTML = newTableContent;
      
      // Reset min-height after content is rendered
      if (isAutoRefresh) {
        requestAnimationFrame(() => {
          allPortsList.style.minHeight = '';
        });
      }
      
      // After rendering, remove the update animation class after animation completes
      if (changedPorts.size > 0) {
        setTimeout(() => {
          document.querySelectorAll('.row-updated').forEach(row => {
            row.classList.remove('row-updated');
          });
        }, 1500); // Match the animation duration
      }
    });
  }
  
  // Kill process function with history tracking
  async function killProcess(pid, processName = null, port = null, forceKill = false) {
    try {
      console.log('Killing process:', pid, 'Force:', forceKill);
      
      // Get process info from stored data if not provided
      if (!processName || !port) {
        const processInfo = window.portData?.[pid] || {};
        processName = processName || processInfo.processName || 'Unknown';
        port = port || processInfo.port || 0;
      }
      
      // Store process info before killing for history
      const processSnapshot = {
        pid,
        processName,
        port,
        killedAt: Date.now(),
        command: getRestartCommand(processName, port),
        wasForceKilled: forceKill
      };
      
      console.log('Process info:', { pid, processName, port, forceKill });
      
      // The main process will validate protection and show dialogs
      const result = await window.api.killProcess(pid, processName, port, forceKill);
      console.log('Kill result:', result);
      
      if (result.success) {
        // Add to kill history
        addToKillHistory(processSnapshot);
        
        // Show success with undo option
        showToastWithUndo(
          `Process ${processName} (PID: ${pid}) terminated`,
          processSnapshot
        );
        
        // Refresh the ports list after a short delay
        setTimeout(() => {
          refreshPorts(false);
        }, 500);
      } else {
        if (result.error === 'User cancelled') {
          console.log('User cancelled kill operation');
          return;
        }
        if (result.error === 'Process is protected') {
          showToast('This process is protected and cannot be killed', 'error', 'Protected Process');
        } else {
          showResult(`✗ ${result.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error in killProcess:', error);
      showResult(`✗ Error: ${error.message}`, 'error');
    }
  }
  
  // ========================================
  // KILL HISTORY MANAGEMENT
  // ========================================
  const KILL_HISTORY_KEY = 'portcleaner-kill-history';
  const MAX_HISTORY_ITEMS = 10;
  let killHistory = JSON.parse(localStorage.getItem(KILL_HISTORY_KEY) || '[]');
  
  function addToKillHistory(processInfo) {
    killHistory.unshift(processInfo);
    
    // Limit history size
    if (killHistory.length > MAX_HISTORY_ITEMS) {
      killHistory = killHistory.slice(0, MAX_HISTORY_ITEMS);
    }
    
    localStorage.setItem(KILL_HISTORY_KEY, JSON.stringify(killHistory));
    updateHistoryPanel();
  }
  
  function getRestartCommand(processName, port) {
    const commands = {
      'node': `node server.js # or npm start`,
      'python': `python app.py # or python -m http.server ${port}`,
      'ruby': `ruby app.rb # or rails server -p ${port}`,
      'java': `java -jar app.jar # or mvn spring-boot:run`,
      'nginx': `nginx # or systemctl start nginx`,
      'apache': `apachectl start # or systemctl start httpd`,
      'mysql': `mysql.server start # or systemctl start mysql`,
      'postgres': `pg_ctl start # or systemctl start postgresql`,
      'mongodb': `mongod # or systemctl start mongodb`,
      'redis': `redis-server # or systemctl start redis`,
      'docker': `docker start [container_name]`,
      'php': `php -S localhost:${port}`
    };
    
    const processLower = processName.toLowerCase();
    for (const [key, command] of Object.entries(commands)) {
      if (processLower.includes(key)) {
        return command;
      }
    }
    
    return `# Check your process documentation for restart instructions`;
  }
  
  function showToastWithUndo(message, processInfo) {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = 'toast success with-action';
    toast.innerHTML = `
      <span class="toast-icon">✅</span>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
        <button class="toast-action" data-action="show-restart">How to restart?</button>
      </div>
      <button class="toast-close">×</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Handle action button
    const actionBtn = toast.querySelector('.toast-action');
    actionBtn.addEventListener('click', () => {
      showRestartHint(processInfo);
      toast.remove();
    });
    
    // Handle close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    });
    
    // Auto remove after 8 seconds (longer for action toasts)
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }
    }, 8000);
  }
  
  function showRestartHint(processInfo) {
    const command = processInfo.command || getRestartCommand(processInfo.processName, processInfo.port);
    
    showToast(`
      <div class="restart-hint">
        <h4>How to restart ${processInfo.processName}:</h4>
        <code>${command}</code>
        <button class="copy-command" data-command="${command.replace(/"/g, '&quot;')}">
          Copy command
        </button>
      </div>
    `, 'info', 'Restart Instructions');
    
    // Handle copy button
    setTimeout(() => {
      const copyBtn = document.querySelector('.copy-command');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const cmd = copyBtn.dataset.command.replace(/&quot;/g, '"');
          navigator.clipboard.writeText(cmd);
          showToast('Command copied to clipboard', 'success');
        });
      }
    }, 100);
  }
  
  function updateHistoryPanel() {
    const panel = document.getElementById('recentlyKilledPanel');
    const list = document.getElementById('killedProcessList');
    
    if (!list) return;
    
    if (killHistory.length === 0) {
      list.innerHTML = '<div class="empty-history">No recently terminated processes</div>';
      return;
    }
    
    list.innerHTML = killHistory.slice(0, 5).map(item => `
      <div class="history-item">
        <div class="history-info">
          <strong>${item.processName}</strong>
          <span class="history-meta">Port ${item.port} • PID ${item.pid}</span>
          <span class="history-time">${getRelativeTime(item.killedAt)}</span>
        </div>
        <button class="history-action" data-index="${killHistory.indexOf(item)}">
          Restart hint
        </button>
      </div>
    `).join('');
    
    // Add event listeners
    list.querySelectorAll('.history-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        showRestartHint(killHistory[index]);
      });
    });
  }
  
  // History panel controls
  document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    killHistory = [];
    localStorage.setItem(KILL_HISTORY_KEY, JSON.stringify(killHistory));
    updateHistoryPanel();
    showToast('History cleared', 'success');
  });
  
  document.getElementById('showHistoryBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('recentlyKilledPanel');
    panel.classList.toggle('expanded');
    updateHistoryPanel();
  });
  
  // Toggle kill history panel
  function toggleKillHistory() {
    const panel = document.getElementById('recentlyKilledPanel');
    if (panel) {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        updateHistoryPanel();
      }
    }
  }
  
  // Close button for history panel - use event delegation
  document.addEventListener('click', (e) => {
    // Check if clicked element is the close button or inside it
    const closeBtn = e.target.closest('.panel-close');
    const panel = e.target.closest('.recently-killed-panel');
    
    if (closeBtn && panel) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Closing history panel');
      document.getElementById('recentlyKilledPanel')?.classList.add('hidden');
    }
  });
  
  // Show skeleton loading in table
  function showSkeletonLoading() {
    if (skeletonLoader) {
      skeletonLoader.style.display = 'block';
    }
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      // Keep container visible but show skeleton inside
      tableContainer.style.display = 'block';
    }
    // Also show skeleton rows in the table body
    const rowCount = allPorts.length > 0 ? Math.min(allPorts.length, 10) : 5;
    showSkeletonRows(rowCount);
  }
  
  // Hide skeleton loading
  function hideSkeletonLoading() {
    if (skeletonLoader) {
      skeletonLoader.style.display = 'none';
    }
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.style.display = 'block';
    }
  }
  
  // Show empty state
  function showEmptyState(type = 'empty') {
    if (emptyState) {
      const title = emptyState.querySelector('.empty-state-title');
      const message = emptyState.querySelector('.empty-state-message');
      const clearBtn = document.getElementById('clearFiltersBtn');
      
      if (type === 'error') {
        title.textContent = 'Unable to load ports';
        message.textContent = 'There was an error fetching port information. Please try again.';
        if (clearBtn) clearBtn.style.display = 'none';
      } else if (type === 'filtered') {
        title.textContent = 'No matching ports';
        message.textContent = 'No ports match your current filters or search.';
        if (clearBtn) clearBtn.style.display = 'inline-block';
      } else {
        title.textContent = 'No active ports';
        message.textContent = 'There are no ports currently in use on your system.';
        if (clearBtn) clearBtn.style.display = 'none';
      }
      
      emptyState.style.display = 'flex';
      const tableContainer = document.querySelector('.table-container');
      if (tableContainer) {
        tableContainer.style.display = 'none';
      }
    }
  }
  
  // Hide empty state
  function hideEmptyState() {
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.style.display = 'block';
    }
  }
  
  // Show error banner with retry option
  function showErrorBanner(title, message, retryCallback = null) {
    if (errorBanner) {
      const messageEl = errorBanner.querySelector('.banner-message');
      const errorContent = errorBanner.querySelector('.error-message-container');
      
      if (messageEl) {
        messageEl.textContent = `${title}: ${message}`;
      }
      
      // Add retry button if callback provided
      if (retryCallback && errorContent) {
        const existingRetry = errorBanner.querySelector('.error-retry');
        if (existingRetry) {
          existingRetry.remove();
        }
        
        const retryBtn = document.createElement('button');
        retryBtn.className = 'error-retry btn-secondary';
        retryBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Retry
        `;
        retryBtn.addEventListener('click', () => {
          hideErrorBanner();
          retryCallback();
        });
        errorContent.appendChild(retryBtn);
      }
      
      errorBanner.classList.remove('hidden');
      errorBanner.classList.add('show');
    }
  }
  
  // Hide error banner
  function hideErrorBanner() {
    if (errorBanner) {
      errorBanner.classList.add('hidden');
    }
  }
  
  // Update last refresh time (removed duplicate - using the one at line 129)
  /*
  function updateLastRefreshTime() {
    lastRefreshTime = new Date();
    const timeString = lastRefreshTime.toLocaleTimeString();
    
    if (lastRefreshTimeEl) {
      lastRefreshTimeEl.textContent = timeString;
    }
    
    if (statusRefreshTimeEl) {
      statusRefreshTimeEl.textContent = timeString;
    }
  }
  */
  
  // Update port count
  function updatePortCount(count) {
    const elements = document.querySelectorAll('#activePortCount');
    elements.forEach(el => {
      if (el) el.textContent = count;
    });
  }
  
  // Clear filters button handler
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      
      // Reset filter chips
      document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
        if (chip.dataset.filter === 'all') {
          chip.classList.add('active');
        }
      });
      
      currentFilter = 'all';
      applyFiltersAndSort();
    });
  }
  
  // Error banner dismiss button
  const bannerDismiss = errorBanner?.querySelector('.banner-dismiss');
  if (bannerDismiss) {
    bannerDismiss.addEventListener('click', hideErrorBanner);
  }
  
  // Keyboard shortcuts - Complete Implementation
  document.addEventListener('keydown', (e) => {
    const isInputFocused = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    // Cmd/Ctrl + K: Quick actions palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showQuickActions();
    }
    
    // Slash key: Focus search (when not in input)
    if (e.key === '/' && !isInputFocused) {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if (searchInput && tableSection?.style.display !== 'none') {
        searchInput.focus();
        searchInput.select();
        showToast('Search mode activated', 'info');
      }
    }
    
    // R key: Refresh (when not in input)
    if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !isInputFocused) {
      e.preventDefault();
      refreshPorts(false);
      showToast('Refreshing ports...', 'info');
    }
    
    // Cmd/Ctrl + R: Force refresh (override browser refresh)
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      if (portsVisible) {
        refreshPorts(false);
        showToast('Force refreshing ports...', 'info');
      }
    }
    
    // Cmd/Ctrl + F: Focus free port input
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      freePortInput?.focus();
      freePortInput?.select();
      showToast('Free port mode', 'info');
    }
    
    // T: Toggle theme (when not in input)
    if (e.key === 't' && !e.metaKey && !e.ctrlKey && !isInputFocused) {
      themeToggle?.click();
    }
    
    // A: Toggle auto-refresh (when not in input)
    if (e.key === 'a' && !e.metaKey && !e.ctrlKey && !isInputFocused) {
      e.preventDefault();
      if (autoRefreshToggle) {
        autoRefreshToggle.checked = !autoRefreshToggle.checked;
        autoRefreshToggle.dispatchEvent(new Event('change'));
        showToast(`Auto-refresh ${autoRefreshToggle.checked ? 'enabled' : 'disabled'}`, 'info');
      }
    }
    
    // Number keys 1-3: Quick filter tabs (when not in input)
    if (!isInputFocused && !e.metaKey && !e.ctrlKey) {
      const filterMap = {
        '1': 'all',
        '2': 'critical',
        '3': 'protected'
      };
      
      if (filterMap[e.key]) {
        e.preventDefault();
        const filterBtn = document.querySelector(`.filter-chip[data-filter="${filterMap[e.key]}"]`);
        if (filterBtn) {
          filterBtn.click();
          showToast(`Filter: ${filterMap[e.key]}`, 'info');
        }
      }
    }
    
    // Escape: Clear search/close modals
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('searchInput');
      const inspectModal = document.getElementById('inspectModal');
      const contextMenu = document.getElementById('contextMenu');
      const quickActions = document.getElementById('quickActionsModal');
      
      if (quickActions && !quickActions.classList.contains('hidden')) {
        hideQuickActions();
      } else if (contextMenu && !contextMenu.classList.contains('hidden')) {
        contextMenu.classList.add('hidden');
      } else if (inspectModal && !inspectModal.classList.contains('hidden')) {
        inspectModal.classList.add('hidden');
      } else if (searchInput && searchInput.value) {
        searchInput.value = '';
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) clearBtn.classList.add('hidden');
        applyFiltersAndSort();
      }
    }
    
    // Question mark: Show keyboard shortcuts help (when not in input)
    if (e.key === '?' && !isInputFocused) {
      e.preventDefault();
      showKeyboardShortcutsHelp();
    }
    
    // H key: Show kill history (when not in input)
    if (e.key === 'h' && !e.metaKey && !e.ctrlKey && !isInputFocused) {
      e.preventDefault();
      toggleKillHistory();
    }
  });
  
  // Quick Actions Palette
  function showQuickActions() {
    let modal = document.getElementById('quickActionsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'quickActionsModal';
      modal.className = 'quick-actions-modal hidden';
      modal.innerHTML = `
        <div class="quick-actions-backdrop"></div>
        <div class="quick-actions-content">
          <input type="text" id="quickActionsSearch" class="quick-actions-search" 
                 placeholder="Type a command or search..." autocomplete="off">
          <div class="quick-actions-list">
            <div class="quick-action" data-action="free-port">
              <span class="quick-action-icon">🚪</span>
              <span class="quick-action-text">Free a port</span>
              <kbd>⌘F</kbd>
            </div>
            <div class="quick-action" data-action="refresh">
              <span class="quick-action-icon">🔄</span>
              <span class="quick-action-text">Refresh ports</span>
              <kbd>R</kbd>
            </div>
            <div class="quick-action" data-action="search">
              <span class="quick-action-icon">🔍</span>
              <span class="quick-action-text">Search ports</span>
              <kbd>/</kbd>
            </div>
            <div class="quick-action" data-action="toggle-theme">
              <span class="quick-action-icon">🌓</span>
              <span class="quick-action-text">Toggle theme</span>
              <kbd>T</kbd>
            </div>
            <div class="quick-action" data-action="toggle-auto-refresh">
              <span class="quick-action-icon">♻️</span>
              <span class="quick-action-text">Toggle auto-refresh</span>
              <kbd>A</kbd>
            </div>
            <div class="quick-action" data-action="show-all">
              <span class="quick-action-icon">📋</span>
              <span class="quick-action-text">Show all ports</span>
              <kbd>1</kbd>
            </div>
            <div class="quick-action" data-action="help">
              <span class="quick-action-icon">❓</span>
              <span class="quick-action-text">Keyboard shortcuts</span>
              <kbd>?</kbd>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Handle quick action clicks
      modal.addEventListener('click', (e) => {
        const action = e.target.closest('.quick-action');
        if (action) {
          const actionType = action.dataset.action;
          executeQuickAction(actionType);
          hideQuickActions();
        }
        
        // Close on backdrop click
        if (e.target.classList.contains('quick-actions-backdrop')) {
          hideQuickActions();
        }
      });
      
      // Filter actions on search
      const searchField = modal.querySelector('#quickActionsSearch');
      searchField.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        modal.querySelectorAll('.quick-action').forEach(action => {
          const text = action.querySelector('.quick-action-text').textContent.toLowerCase();
          action.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
      
      // Handle enter key in search
      searchField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const visibleActions = modal.querySelectorAll('.quick-action:not([style*="none"])');
          if (visibleActions.length > 0) {
            const actionType = visibleActions[0].dataset.action;
            executeQuickAction(actionType);
            hideQuickActions();
          }
        }
      });
    }
    
    // Show modal
    modal.classList.remove('hidden');
    const searchField = modal.querySelector('#quickActionsSearch');
    searchField.value = '';
    searchField.focus();
    
    // Reset all actions visibility
    modal.querySelectorAll('.quick-action').forEach(action => {
      action.style.display = 'flex';
    });
  }
  
  function hideQuickActions() {
    const modal = document.getElementById('quickActionsModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
  
  function executeQuickAction(action) {
    switch (action) {
      case 'free-port':
        freePortInput?.focus();
        break;
      case 'refresh':
        refreshPorts(false);
        break;
      case 'search':
        document.getElementById('searchInput')?.focus();
        break;
      case 'toggle-theme':
        themeToggle?.click();
        break;
      case 'toggle-auto-refresh':
        autoRefreshToggle.checked = !autoRefreshToggle.checked;
        autoRefreshToggle.dispatchEvent(new Event('change'));
        break;
      case 'show-all':
        document.querySelector('.filter-chip[data-filter="all"]')?.click();
        break;
      case 'help':
        showKeyboardShortcutsHelp();
        break;
    }
  }
  
  // Show keyboard shortcuts help
  function showKeyboardShortcutsHelp() {
    const shortcuts = [
      { keys: '⌘K', description: 'Quick actions palette' },
      { keys: '/', description: 'Focus search' },
      { keys: 'R', description: 'Refresh ports' },
      { keys: '⌘F', description: 'Focus free port input' },
      { keys: 'T', description: 'Toggle theme' },
      { keys: 'A', description: 'Toggle auto-refresh' },
      { keys: 'H', description: 'Show kill history' },
      { keys: '1-3', description: 'Quick filter tabs' },
      { keys: 'Tab', description: 'Navigate between elements' },
      { keys: '↑↓←→', description: 'Navigate table cells' },
      { keys: 'Enter/Space', description: 'Activate table cell action' },
      { keys: 'Home/End', description: 'Jump to first/last cell' },
      { keys: 'ESC', description: 'Close modals / Clear search' },
      { keys: '?', description: 'Show this help' }
    ];
    
    const shortcutsList = shortcuts.map(s => 
      `<div class="shortcut-item">
        <kbd>${s.keys}</kbd>
        <span>${s.description}</span>
      </div>`
    ).join('');
    
    showToast(`
      <div class="shortcuts-help">
        <h4>Keyboard Shortcuts</h4>
        ${shortcutsList}
      </div>
    `, 'info', 'Help');
  }
  
  // Accessibility: Add ARIA live regions for status updates
  const createLiveRegion = () => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'live-region';
    document.body.appendChild(liveRegion);
    return liveRegion;
  };
  
  const liveRegion = createLiveRegion();
  
  // Announce status changes
  window.announceStatus = (message) => {
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 100);
    }
  };
  
  // Column resizing functionality - FIXED VERSION
  function initColumnResizing() {
    const table = document.getElementById('portsTable');
    if (!table) return;
    
    const headers = table.querySelectorAll('th');
    let isResizing = false;
    let currentHeader = null;
    let startX = 0;
    let startWidth = 0;
    
    // Column width storage key
    const COLUMN_WIDTHS_KEY = 'portcleaner-column-widths';
    
    // Create resize handles dynamically
    headers.forEach((header, index) => {
      // Skip the last column (actions)
      if (index === headers.length - 1) return;
      
      // Create resize handle if it doesn't exist
      let handle = header.querySelector('.resize-handle');
      if (!handle) {
        handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.style.position = 'absolute';
        handle.style.right = '0';
        handle.style.top = '0';
        handle.style.bottom = '0';
        handle.style.width = '4px';
        handle.style.cursor = 'col-resize';
        handle.style.userSelect = 'none';
        handle.style.touchAction = 'none';
        header.style.position = 'relative';
        header.appendChild(handle);
      }
      
      // Mouse events for resizing
      handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentHeader = header;
        startX = e.pageX;
        startWidth = header.offsetWidth;
        
        // Visual feedback
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        handle.style.backgroundColor = 'var(--primary-color, #3b82f6)';
        
        e.preventDefault();
        e.stopPropagation();
      });
      
      // Double-click to auto-fit
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoFitColumn(header, index);
      });
    });
    
    // Global mouse move handler
    document.addEventListener('mousemove', (e) => {
      if (!isResizing || !currentHeader) return;
      
      const diff = e.pageX - startX;
      const newWidth = Math.max(60, startWidth + diff);
      currentHeader.style.width = newWidth + 'px';
      
      // Apply fixed table layout for better performance
      table.style.tableLayout = 'fixed';
    });
    
    // Global mouse up handler
    document.addEventListener('mouseup', () => {
      if (isResizing && currentHeader) {
        // Save column widths
        saveColumnWidths();
        
        // Reset visual feedback
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const handle = currentHeader.querySelector('.resize-handle');
        if (handle) handle.style.backgroundColor = '';
      }
      
      isResizing = false;
      currentHeader = null;
    });
    
    // Auto-fit column width
    function autoFitColumn(header, columnIndex) {
      const cells = table.querySelectorAll(`tbody tr td:nth-child(${columnIndex + 1})`);
      let maxWidth = header.scrollWidth;
      
      cells.forEach(cell => {
        const width = getTextWidth(cell.textContent, window.getComputedStyle(cell).font);
        maxWidth = Math.max(maxWidth, width + 20); // Add padding
      });
      
      header.style.width = Math.min(maxWidth, 400) + 'px';
      table.style.tableLayout = 'fixed';
      saveColumnWidths();
    }
    
    // Helper to measure text width
    function getTextWidth(text, font) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = font;
      return context.measureText(text).width;
    }
    
    // Save column widths
    function saveColumnWidths() {
      const widths = {};
      headers.forEach((header, index) => {
        const col = header.dataset.sort || `col-${index}`;
        widths[col] = header.offsetWidth;
      });
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    }
    
    // Load saved column widths
    function loadColumnWidths() {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      if (saved) {
        try {
          const widths = JSON.parse(saved);
          headers.forEach((header, index) => {
            const col = header.dataset.sort || `col-${index}`;
            if (widths[col]) {
              header.style.width = widths[col] + 'px';
            }
          });
          table.style.tableLayout = 'fixed';
        } catch (e) {
          console.error('Error loading column widths:', e);
        }
      }
    }
    
    // Load saved widths on init
    loadColumnWidths();
  }
  
  // Initialize column resizing when DOM is ready
  initColumnResizing();
  
  // ========================================
  // TABLE KEYBOARD NAVIGATION
  // ========================================
  let focusedRowIndex = -1;
  let focusedCellIndex = -1;
  
  function initTableKeyboardNavigation() {
    const table = document.getElementById('portsTable');
    if (!table) return;
    
    // Make table focusable
    table.setAttribute('tabindex', '0');
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Active ports table');
    
    // Handle table focus
    table.addEventListener('focus', () => {
      if (focusedRowIndex === -1) {
        focusedRowIndex = 0;
        focusedCellIndex = 0;
        updateTableFocus();
      }
    });
    
    // Handle keyboard navigation
    table.addEventListener('keydown', (e) => {
      const rows = table.querySelectorAll('tbody tr');
      if (rows.length === 0) return;
      
      let handled = false;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (focusedRowIndex > 0) {
            focusedRowIndex--;
            updateTableFocus();
            announceTableCell();
          }
          handled = true;
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (focusedRowIndex < rows.length - 1) {
            focusedRowIndex++;
            updateTableFocus();
            announceTableCell();
          }
          handled = true;
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedCellIndex > 0) {
            focusedCellIndex--;
            updateTableFocus();
            announceTableCell();
          }
          handled = true;
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          const cells = rows[focusedRowIndex]?.querySelectorAll('td');
          if (cells && focusedCellIndex < cells.length - 1) {
            focusedCellIndex++;
            updateTableFocus();
            announceTableCell();
          }
          handled = true;
          break;
          
        case 'Home':
          e.preventDefault();
          if (e.ctrlKey) {
            // Ctrl+Home: Go to first cell
            focusedRowIndex = 0;
            focusedCellIndex = 0;
          } else {
            // Home: Go to first cell in row
            focusedCellIndex = 0;
          }
          updateTableFocus();
          announceTableCell();
          handled = true;
          break;
          
        case 'End':
          e.preventDefault();
          const currentRow = rows[focusedRowIndex];
          if (e.ctrlKey) {
            // Ctrl+End: Go to last cell
            focusedRowIndex = rows.length - 1;
            const lastRow = rows[focusedRowIndex];
            focusedCellIndex = lastRow.querySelectorAll('td').length - 1;
          } else {
            // End: Go to last cell in row
            focusedCellIndex = currentRow.querySelectorAll('td').length - 1;
          }
          updateTableFocus();
          announceTableCell();
          handled = true;
          break;
          
        case 'Enter':
        case ' ':
          e.preventDefault();
          // Activate the current cell's primary action
          const cell = getCurrentCell();
          if (cell) {
            const button = cell.querySelector('button:not([disabled])');
            const link = cell.querySelector('a');
            
            if (button) {
              button.click();
            } else if (link) {
              link.click();
            }
          }
          handled = true;
          break;
          
        case 'Tab':
          // Allow Tab to move to next focusable element
          focusedRowIndex = -1;
          focusedCellIndex = -1;
          clearTableFocus();
          break;
      }
      
      if (handled) {
        e.stopPropagation();
      }
    });
    
    // Handle click to focus
    table.addEventListener('click', (e) => {
      const cell = e.target.closest('td');
      const row = e.target.closest('tr');
      
      if (cell && row) {
        const rows = table.querySelectorAll('tbody tr');
        const cells = row.querySelectorAll('td');
        
        focusedRowIndex = Array.from(rows).indexOf(row);
        focusedCellIndex = Array.from(cells).indexOf(cell);
        updateTableFocus();
      }
    });
  }
  
  function updateTableFocus() {
    const table = document.getElementById('portsTable');
    if (!table) return;
    
    // Clear all focus styles
    clearTableFocus();
    
    // Get current row and cell
    const rows = table.querySelectorAll('tbody tr');
    const currentRow = rows[focusedRowIndex];
    
    if (currentRow) {
      currentRow.classList.add('keyboard-focused');
      currentRow.setAttribute('aria-selected', 'true');
      
      const cells = currentRow.querySelectorAll('td');
      const currentCell = cells[focusedCellIndex];
      
      if (currentCell) {
        currentCell.setAttribute('tabindex', '0');
        currentCell.focus();
        
        // Scroll into view if needed
        currentCell.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }
  
  function clearTableFocus() {
    const table = document.getElementById('portsTable');
    if (!table) return;
    
    table.querySelectorAll('tbody tr').forEach(row => {
      row.classList.remove('keyboard-focused');
      row.removeAttribute('aria-selected');
    });
    
    table.querySelectorAll('td[tabindex]').forEach(cell => {
      cell.removeAttribute('tabindex');
    });
  }
  
  function getCurrentCell() {
    const table = document.getElementById('portsTable');
    if (!table) return null;
    
    const rows = table.querySelectorAll('tbody tr');
    const currentRow = rows[focusedRowIndex];
    
    if (currentRow) {
      const cells = currentRow.querySelectorAll('td');
      return cells[focusedCellIndex];
    }
    
    return null;
  }
  
  function announceTableCell() {
    const cell = getCurrentCell();
    if (!cell) return;
    
    // Get cell content for screen reader announcement
    const cellText = cell.textContent.trim();
    const row = cell.closest('tr');
    const rowIndex = focusedRowIndex + 1;
    const colIndex = focusedCellIndex + 1;
    
    // Get column header
    const table = document.getElementById('portsTable');
    const headers = table.querySelectorAll('thead th');
    const columnName = headers[focusedCellIndex]?.textContent.trim() || '';
    
    const announcement = `Row ${rowIndex}, Column ${colIndex}, ${columnName}: ${cellText}`;
    announceToScreenReader(announcement);
  }
  
  // Initialize on page load
  setTimeout(() => {
    // Initialize table keyboard navigation
    initTableKeyboardNavigation();
    // Show the table section immediately
    if (tableSection) {
      tableSection.style.display = 'flex';
    }
    
    // Show skeleton loader while loading initial data
    showSkeletonLoading();
    
    // Initialize app with error handling instead of direct refresh
    initializeApp();
    
    // Setup help button - currently disabled as hints are showing as empty boxes
    const helpButton = document.getElementById('helpButton');
    
    helpButton?.addEventListener('click', () => {
      // Feature hints disabled - was showing empty boxes
      // showFeatureHints();
      showToast('Help documentation coming soon', 'info');
    });
    
    // Disabled feature hints - was showing empty boxes after tour removal
    // setTimeout(() => {
    //   if (allPorts.length > 0) {
    //     showFeatureHints();
    //   }
    // }, 2000);
    
    // Start relative time updates
    if (relativeTimeInterval) {
      clearInterval(relativeTimeInterval);
    }
    relativeTimeInterval = setInterval(updateRelativeTime, 10000); // Update every 10 seconds
    
    // Setup event delegation for port row interactions
    setupPortRowInteractions();
    
    // Set version info
    if (versionInfo) {
      versionInfo.textContent = 'PortCleaner v1.0.0';
    }
  }, 100);
});