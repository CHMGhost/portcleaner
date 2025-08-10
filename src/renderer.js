// Renderer process JavaScript
// This file handles the frontend logic for the PortCleaner app

document.addEventListener('DOMContentLoaded', () => {
  console.log('PortCleaner renderer loaded');
  
  const portInput = document.getElementById('portInput');
  const checkBtn = document.getElementById('checkBtn');
  const results = document.getElementById('results');
  const freePortInput = document.getElementById('freePortInput');
  const freePortBtn = document.getElementById('freePortBtn');
  const getAllPortsBtn = document.getElementById('getAllPortsBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const allPortsList = document.getElementById('allPortsList');
  const portTableContainer = document.getElementById('portTableContainer') || document.getElementById('tableSection');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');
  const autoRefreshContainer = document.getElementById('autoRefreshContainer');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const refreshIntervalSelect = document.getElementById('refreshInterval');
  const refreshCountdown = document.getElementById('refreshCountdown');
  
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
  let currentFilter = localStorage.getItem(FILTER_TAB_KEY) || 'all';
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
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    // Light theme is default
    if (themeIcon) themeIcon.textContent = '🌙';
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
  
  // Apply saved filter tab
  filterButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === currentFilter) {
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
  // SEARCH HIGHLIGHTING
  // ========================================
  function highlightText(text, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }
  
  // ========================================
  // TOAST NOTIFICATION SYSTEM
  // ========================================
  function showToast(message, type = 'info', title = null) {
    const toastContainer = document.getElementById('toastContainer');
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icons for different types
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    // Build toast HTML
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">×</button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
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
    
    // Show loading state
    freePortBtn.disabled = true;
    const btnText = freePortBtn.querySelector('.btn-text');
    const spinner = freePortBtn.querySelector('.spinner');
    const originalText = btnText.textContent;
    btnText.textContent = 'Checking...';
    spinner.style.display = 'inline-block';
    
    try {
      // First check if port is in use
      const portInfo = await window.api.getPortInfo(port);
      
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
        `Terminating ${processInfo.command} (PID: ${processInfo.pid})...`,
        'warning',
        `Freeing Port ${port}`
      );
      
      // Kill the process (this will show confirmation dialog from main.js)
      const killResult = await window.api.killProcess(
        processInfo.pid,
        processInfo.command,
        port,
        false // Don't force kill initially
      );
      
      if (killResult.success) {
        showToast(
          `Successfully freed port ${port}`,
          'success',
          'Port Freed!'
        );
        freePortInput.value = '';
        
        // Optionally refresh the port list if it's visible
        if (portTableContainer.style.display !== 'none') {
          setTimeout(() => refreshPorts(false), 500);
        }
      } else {
        if (killResult.error === 'User cancelled') {
          showToast('Operation cancelled', 'info');
        } else {
          showToast(
            killResult.error || 'Failed to terminate process',
            'error',
            'Failed to Free Port'
          );
        }
      }
    } catch (error) {
      showToast(`Unexpected error: ${error.message}`, 'error', 'Error');
    } finally {
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
  
  // Function to refresh ports
  async function refreshPorts(isAutoRefresh = false) {
    if (isRefreshing) return;
    isRefreshing = true;
    
    // Hide any existing error banner
    hideErrorBanner();
    
    // Show loading state
    const btnText = getAllPortsBtn.querySelector('.btn-text');
    const spinner = getAllPortsBtn.querySelector('.spinner');
    
    if (!isAutoRefresh) {
      // Show skeleton loading in table
      showSkeletonLoading(allPorts.length > 0 ? Math.min(allPorts.length, 10) : 5);
      
      if (btnText) btnText.textContent = 'Loading...';
      if (spinner) spinner.style.display = 'inline-block';
      getAllPortsBtn.disabled = true;
      getAllPortsBtn.classList.add('loading');
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
      
      if (result.success) {
        allPorts = result.data;
        
        // Show table section
        if (tableSection) {
          tableSection.style.display = 'flex';
        }
        
        applyFiltersAndSort();
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
      } else {
        // Show error in both banner and toast
        const errorMsg = result.error || 'Failed to fetch port information';
        showErrorBanner('Unable to fetch ports', errorMsg);
        showToast(errorMsg, 'error', 'Port Fetch Failed');
        showEmptyState('error');
        portsVisible = false;
      }
    } catch (error) {
      // Show error in both banner and toast
      showErrorBanner('Unexpected error', error.message);
      showToast(`Unexpected error: ${error.message}`, 'error');
      showEmptyState('error');
      portsVisible = false;
    } finally {
      // Reset button state
      if (!isAutoRefresh) {
        if (btnText) btnText.textContent = 'View All Active Ports';
        if (spinner) spinner.style.display = 'none';
        getAllPortsBtn.disabled = false;
        getAllPortsBtn.classList.remove('loading');
      } else {
        document.body.classList.remove('auto-refreshing');
        document.getElementById('portsTable').classList.remove('loading');
      }
      isRefreshing = false;
    }
  }
  
  // Get all ports button handler
  getAllPortsBtn.addEventListener('click', () => {
    refreshPorts(false);
  });
  
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
  
  // Show context menu
  function showContextMenu(event, pid, processName, port) {
    if (!contextMenu) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Store current menu data
    currentMenuData = { pid, processName, port };
    
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
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    // Show tooltip
    tooltip.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      tooltip.classList.add('hidden');
    }, 5000);
  }
  
  // Event delegation for dynamically created elements
  allPortsList.addEventListener('click', (event) => {
    // Handle favorite star clicks
    if (event.target.classList.contains('favorite-star')) {
      const port = parseInt(event.target.dataset.port);
      toggleFavorite(port);
    }
    
    // Handle regular kill button clicks
    if (event.target.classList.contains('kill-btn') && !event.target.disabled) {
      const pid = parseInt(event.target.dataset.pid);
      killProcess(pid);
    }
    
    // Handle action menu button clicks
    if (event.target.classList.contains('action-menu-btn')) {
      const pid = parseInt(event.target.dataset.pid);
      const processName = event.target.dataset.process;
      const port = parseInt(event.target.dataset.port);
      showContextMenu(event, pid, processName, port);
    }
    
    // Handle "Why?" button clicks
    if (event.target.classList.contains('why-protected')) {
      const processName = event.target.dataset.process;
      showProtectionTooltip(event, processName);
    }
  });
  
  // Context menu item clicks
  contextMenu.addEventListener('click', (event) => {
    const menuItem = event.target.closest('.menu-item');
    if (!menuItem) return;
    
    const action = menuItem.dataset.action;
    
    switch (action) {
      case 'force-kill':
        if (currentMenuData) {
          // Force kill bypasses initial protection check, but still shows warnings
          // The main.js will handle the force kill warning dialogs
          killProcess(currentMenuData.pid, currentMenuData.processName, currentMenuData.port, false);
        }
        break;
        
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
    }
    
    hideContextMenu();
  });
  
  // Close menus when clicking outside
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.context-menu') && !event.target.closest('.action-menu-btn')) {
      hideContextMenu();
    }
    if (!event.target.closest('.protection-tooltip') && !event.target.closest('.why-protected')) {
      protectionTooltip.classList.add('hidden');
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
      let protectionReason = '🔒 Protected';
      if (isProtectedProcess) {
        protectionReason = '🔒 System Process';
      } else if (isCriticalPort) {
        protectionReason = `🔒 ${CRITICAL_PORTS[port]} Service`;
      } else if (isSystemPort) {
        protectionReason = '🔒 System Port';
      }
      protectionEl.textContent = protectionReason;
      protectionEl.className = 'inspect-value protected';
    } else {
      protectionEl.textContent = '✅ Not Protected';
      protectionEl.className = 'inspect-value safe';
    }
    
    // Set port type
    const portTypeEl = document.getElementById('inspectPortType');
    if (CRITICAL_PORTS[port]) {
      portTypeEl.textContent = `⚠️ ${CRITICAL_PORTS[port]} Service`;
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
  
  // Apply filters and sorting
  function applyFiltersAndSort() {
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
    
    // Apply category filter
    switch (currentFilter) {
      case 'favorites':
        filteredPorts = filteredPorts.filter(port => favoritePorts.includes(port.port));
        break;
      case 'critical':
        const CRITICAL_PORTS = [22, 80, 443, 3306, 5432, 27017, 6379];
        filteredPorts = filteredPorts.filter(port => CRITICAL_PORTS.includes(port.port));
        break;
      case 'protected':
        const PROTECTED_PROCESSES = [
          'kernel_task', 'launchd', 'systemd', 'init',
          'postgres', 'mysql', 'mongod', 'redis',
          'docker', 'nginx', 'apache'
        ];
        filteredPorts = filteredPorts.filter(port => {
          const processName = (port.command || port.process || '').toLowerCase();
          return PROTECTED_PROCESSES.some(proc => processName.includes(proc.toLowerCase()));
        });
        break;
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
    
    displayAllPorts(filteredPorts);
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
  
  // Filter buttons with toggle functionality
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.dataset.filter;
      
      // If clicking "All", always activate it
      if (filterType === 'all') {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = 'all';
      } 
      // If clicking an already active filter (not "All"), deactivate it and go back to "All"
      else if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        // Activate the "All" button
        filterButtons.forEach(b => {
          if (b.dataset.filter === 'all') {
            b.classList.add('active');
          }
        });
        currentFilter = 'all';
      } 
      // Otherwise, activate the clicked filter
      else {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = filterType;
      }
      
      localStorage.setItem(FILTER_TAB_KEY, currentFilter);
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
  function showSkeletonLoading(rowCount = 5) {
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
        icon: '🔌',
        title: 'No active ports found',
        message: 'All ports are currently free. Services you start will appear here.',
        action: null
      },
      'no-results': {
        icon: '🔍',
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
  
  // Display all active ports in table format with search highlighting
  function displayAllPorts(ports) {
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
    hideSkeletonLoading();
    
    // Get search term for highlighting
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
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
    
    allPortsList.innerHTML = ports.map(port => {
      const cpuValue = parseFloat(port.cpu || 0);
      let cpuClass = '';
      if (cpuValue > 50) cpuClass = 'cpu-high';
      else if (cpuValue > 20) cpuClass = 'cpu-medium';
      
      const processName = port.command || port.process || 'Unknown';
      const isCritical = CRITICAL_PORTS[port.port];
      const isProtected = PROTECTED_PROCESSES.some(
        proc => processName.toLowerCase().includes(proc.toLowerCase())
      );
      
      let rowClass = '';
      if (isProtected) rowClass = 'protected-process';
      else if (isCritical) rowClass = 'critical-port';
      
      const isFavorite = favoritePorts.includes(port.port);
      
      // Apply highlighting to text fields if there's a search term
      const highlightedPort = searchTerm ? highlightText(port.port.toString(), searchTerm) : port.port;
      const highlightedProcess = searchTerm ? highlightText(processName, searchTerm) : processName;
      const highlightedPid = searchTerm ? highlightText(port.pid.toString(), searchTerm) : port.pid;
      const highlightedUser = searchTerm ? highlightText(port.user || 'Unknown', searchTerm) : (port.user || 'Unknown');
      
      return `
        <tr class="${rowClass}">
          <td>
            <button class="favorite-star ${isFavorite ? 'active' : ''}" 
                    data-port="${port.port}"
                    onclick="toggleFavorite(${port.port})"
                    title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
              ${isFavorite ? '⭐' : '☆'}
            </button>
            <span class="port-number">${highlightedPort}</span>
            ${isCritical ? `<span class="critical-badge" title="${CRITICAL_PORTS[port.port]} Service">⚠️</span>` : ''}
          </td>
          <td>${highlightedPid}</td>
          <td class="${cpuClass}">${port.cpu || '0'}%</td>
          <td class="memory-value">${port.memory || '0 KB'}</td>
          <td>${highlightedUser}</td>
          <td>
            <span class="process-name">${highlightedProcess}</span>
            ${isProtected ? `<span class="protected-badge" title="Protected Process">🔒</span>` : ''}
          </td>
          <td>
            <div class="action-cell">
              ${isProtected 
                ? `<button class="kill-btn" disabled title="This process is protected">
                     Kill
                   </button>
                   <button class="why-protected" data-process="${processName}" title="Why is this protected?">
                     Why?
                   </button>`
                : `<button class="kill-btn" data-pid="${port.pid}">Kill</button>`
              }
              <button class="action-menu-btn" data-pid="${port.pid}" data-process="${processName}" data-port="${port.port}" title="More actions">
                ⋯
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  // Kill process function
  async function killProcess(pid, processName = null, port = null, forceKill = false) {
    try {
      console.log('Killing process:', pid, 'Force:', forceKill);
      console.log('Available portData:', window.portData);
      
      // Get process info from stored data if not provided
      if (!processName || !port) {
        const processInfo = window.portData?.[pid] || {};
        processName = processName || processInfo.processName || 'Unknown';
        port = port || processInfo.port || 0;
      }
      
      console.log('Process info:', { pid, processName, port, forceKill });
      
      // The main process will show the proper dialog
      const result = await window.api.killProcess(pid, processName, port, forceKill);
      console.log('Kill result:', result);
      
      if (result.success) {
        showResult(`✓ Process ${processName} (PID: ${pid}) terminated successfully`, 'success');
        // Refresh the ports list after a short delay
        setTimeout(() => {
          if (typeof refreshPorts === 'function') {
            refreshPorts(false);
          } else {
            getAllPortsBtn.click();
          }
        }, 500);
      } else {
        if (result.error === 'User cancelled') {
          // User cancelled, no need to show error
          console.log('User cancelled kill operation');
          return;
        }
        showResult(`✗ ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error in killProcess:', error);
      showResult(`✗ Error: ${error.message}`, 'error');
    }
  }
  
  // Show skeleton loading
  function showSkeletonLoading() {
    if (skeletonLoader) {
      skeletonLoader.style.display = 'block';
    }
    if (emptyState) {
      emptyState.style.display = 'none';
    }
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.style.display = 'none';
    }
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
  
  // Show error banner
  function showErrorBanner(title, message) {
    if (errorBanner) {
      const messageEl = errorBanner.querySelector('.banner-message');
      if (messageEl) {
        messageEl.textContent = `${title}: ${message}`;
      }
      errorBanner.classList.remove('hidden');
    }
  }
  
  // Hide error banner
  function hideErrorBanner() {
    if (errorBanner) {
      errorBanner.classList.add('hidden');
    }
  }
  
  // Update last refresh time
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
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K: Quick actions (focus search)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if (searchInput && tableSection?.style.display !== 'none') {
        searchInput.focus();
        searchInput.select();
      } else {
        freePortInput?.focus();
      }
    }
    
    // Cmd/Ctrl + R: Refresh ports
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      if (portsVisible) {
        refreshPorts(false);
      }
    }
    
    // Cmd/Ctrl + F: Focus free port input
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      freePortInput?.focus();
      freePortInput?.select();
    }
    
    // T: Toggle theme
    if (e.key === 't' && !e.metaKey && !e.ctrlKey && 
        e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      themeToggle?.click();
    }
    
    // Escape: Clear search/close modals
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('searchInput');
      const inspectModal = document.getElementById('inspectModal');
      const contextMenu = document.getElementById('contextMenu');
      
      if (contextMenu && !contextMenu.classList.contains('hidden')) {
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
  });
  
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
  
  // Column resizing functionality
  initColumnResizing();
  
  function initColumnResizing() {
    const table = document.getElementById('portsTable');
    if (!table) return;
    
    const resizeHandles = table.querySelectorAll('.resize-handle');
    let currentHandle = null;
    let startX = 0;
    let startWidth = 0;
    let column = null;
    
    // Column width storage key
    const COLUMN_WIDTHS_KEY = 'portcleaner-column-widths';
    
    // Load saved column widths
    function loadColumnWidths() {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      if (saved) {
        try {
          const widths = JSON.parse(saved);
          Object.keys(widths).forEach(col => {
            const th = table.querySelector(`th[data-col="${col}"]`);
            if (th) {
              th.style.width = widths[col] + 'px';
            }
          });
        } catch (e) {
          console.error('Error loading column widths:', e);
        }
      }
    }
    
    // Save column widths
    function saveColumnWidths() {
      const widths = {};
      table.querySelectorAll('th[data-col]').forEach(th => {
        const col = th.dataset.col;
        widths[col] = th.offsetWidth;
      });
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    }
    
    // Handle resize start
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        currentHandle = handle;
        column = handle.parentElement;
        startX = e.clientX;
        startWidth = column.offsetWidth;
        
        // Add classes for visual feedback
        handle.classList.add('resizing');
        document.body.classList.add('resizing-table');
        
        // Prevent text selection
        document.addEventListener('selectstart', preventSelect);
      });
    });
    
    // Handle resize move
    document.addEventListener('mousemove', (e) => {
      if (!currentHandle) return;
      
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff); // Minimum width of 50px
      
      // Update column width
      column.style.width = newWidth + 'px';
      
      // Update table layout
      table.style.tableLayout = 'fixed';
    });
    
    // Handle resize end
    document.addEventListener('mouseup', () => {
      if (currentHandle) {
        // Remove classes
        currentHandle.classList.remove('resizing');
        document.body.classList.remove('resizing-table');
        
        // Save column widths
        saveColumnWidths();
        
        // Clean up
        currentHandle = null;
        column = null;
        
        // Re-enable text selection
        document.removeEventListener('selectstart', preventSelect);
      }
    });
    
    // Prevent text selection during resize
    function preventSelect(e) {
      e.preventDefault();
      return false;
    }
    
    // Double-click to auto-fit column
    resizeHandles.forEach(handle => {
      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const th = handle.parentElement;
        const col = th.dataset.col;
        const columnIndex = Array.from(th.parentElement.children).indexOf(th);
        
        // Find maximum content width in this column
        let maxWidth = th.querySelector('.th-text').offsetWidth + 40; // Header width + padding
        
        // Check all cells in this column
        const cells = table.querySelectorAll(`tbody tr td:nth-child(${columnIndex + 1})`);
        cells.forEach(cell => {
          const width = cell.scrollWidth;
          if (width > maxWidth) {
            maxWidth = width;
          }
        });
        
        // Set the column width
        th.style.width = Math.min(maxWidth + 20, 400) + 'px'; // Max 400px
        
        // Save widths
        saveColumnWidths();
      });
    });
    
    // Load saved widths on init
    loadColumnWidths();
  }
  
  // Initialize on page load
  setTimeout(() => {
    refreshPorts(false);
    
    // Set version info
    if (versionInfo) {
      versionInfo.textContent = 'PortCleaner v1.0.0';
    }
  }, 100);
});