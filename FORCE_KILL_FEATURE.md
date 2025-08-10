# Force Kill Feature for Protected Processes

## Overview
The PortCleaner app now allows users to force kill protected processes with appropriate warnings and safeguards.

## How It Works

### 1. Protected Process Detection
When a process is identified as protected (databases, system processes, critical services), it shows:
- 🔒 Protected badge next to the process name
- A red "⚠️ Force Kill" button instead of being disabled

### 2. Three-Level Safety System

#### Level 1: Initial Warning
When clicking "Force Kill" on a protected process:
- Shows a warning dialog explaining why the process is protected
- Lists specific risks (data loss, system crashes, etc.)
- Requires checking "I understand the risks" checkbox
- Options: Cancel or "Force Kill Anyway"

#### Level 2: Final Warning
If user proceeds with Force Kill:
- Shows a FINAL WARNING dialog in red
- Lists all potential consequences in detail
- Makes it clear this action cannot be undone
- Options: Cancel or "Yes, Force Kill"

#### Level 3: Process Termination
Only after confirming both dialogs will the process be killed.

## Protected Processes Include:

### System Critical
- `kernel_task`, `launchd`, `systemd`, `init`
- `WindowServer`, `loginwindow`, `explorer.exe`, `finder`
- `csrss.exe`, `winlogon.exe`, `services.exe`, `lsass.exe`
- `svchost.exe`

### Database Services
- `postgres`, `postgresql`, `mysql`, `mysqld`
- `mongod`, `mongodb`, `redis-server`, `redis`

### Development Services
- `docker`, `dockerd`, `containerd`
- `nginx`, `apache`, `httpd`

## UI Indicators

### Visual Cues
- **Protected Badge**: 🔒 icon next to process name
- **Force Kill Button**: 
  - Red gradient background
  - ⚠️ warning icon
  - Pulsing animation to draw attention
  - Hover effect with stronger red color

### Button States
- **Normal Process**: Blue "Kill" button
- **Protected Process**: Red animated "⚠️ Force Kill" button
- **Critical Port**: Yellow background on row

## Technical Implementation

### Files Modified
1. **main.js**: Added `forceKill` parameter to kill-process handler
2. **preload.js**: Updated API to pass forceKill parameter
3. **renderer.js**: Added force kill handling and UI logic
4. **styles.css**: Added visual styling for force kill button

### API Changes
```javascript
// Old API
window.api.killProcess(pid, processName, port)

// New API
window.api.killProcess(pid, processName, port, forceKill)
```

## Safety Features

1. **Multi-step Confirmation**: Two separate dialogs to prevent accidents
2. **Checkbox Requirement**: Must actively acknowledge understanding risks
3. **Clear Warnings**: Specific consequences listed for each process type
4. **Visual Distinction**: Force kill buttons look very different from normal kill buttons
5. **Default to Safety**: Cancel is always the default button option

## Usage Guidelines

### When to Use Force Kill
- Development environment cleanup
- Recovering from hung processes
- Emergency troubleshooting
- When you fully understand the consequences

### When NOT to Use Force Kill
- Production servers
- When unsure about the process
- System-critical processes (kernel_task, etc.)
- Active database servers with important data

## Risks and Warnings

Force killing protected processes may cause:
- 🚨 System instability or crashes
- 💾 Data loss or corruption
- 📝 Loss of unsaved work
- 🌐 Network or service disruptions
- 🔄 Need for system restart

## Best Practices

1. **Try graceful shutdown first**: Use proper commands (e.g., `docker stop`, `service mysql stop`)
2. **Save your work**: Before force killing any process
3. **Check dependencies**: Other services may depend on the process
4. **Have backups**: Especially for database services
5. **Know recovery steps**: How to restart the service if needed

## Recovery Steps

If you force kill a critical process:

### Databases
```bash
# PostgreSQL
brew services restart postgresql  # Mac
sudo service postgresql restart   # Linux

# MySQL
brew services restart mysql       # Mac
sudo service mysql restart        # Linux

# MongoDB
brew services restart mongodb     # Mac
sudo service mongod restart       # Linux
```

### Docker
```bash
# Restart Docker
sudo systemctl restart docker     # Linux
# On Mac/Windows: Restart Docker Desktop
```

### System Processes
- May require system restart
- Use Activity Monitor (Mac) or Task Manager (Windows) to verify

## Testing

The force kill feature has been tested with:
- ✅ Protected process detection
- ✅ Multi-step confirmation flow
- ✅ Visual indicators and animations
- ✅ Both light and dark themes
- ✅ Keyboard navigation (ESC to cancel)

## Future Enhancements

Potential improvements:
- Add option to remember choice for session
- Log force kill attempts for audit
- Add "safe mode" toggle to hide force kill entirely
- Implement process restart after force kill
- Add custom protected process list in settings