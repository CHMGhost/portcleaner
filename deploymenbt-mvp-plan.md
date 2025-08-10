# WTFIsOnMyPort - Complete Development Plan

## Project Overview
Cross-platform desktop app (Windows/Mac) that shows what's running on which ports and lets you kill processes with one click.

## Phase 1: Setup and Learning (Days 1-3)

### Day 1: Environment Setup
**Goal:** Get a basic Electron app running

1. **Install required tools:**
   ```bash
   # Install Node.js (if not already installed)
   # Download from nodejs.org - get the LTS version
   
   # Verify installation
   node --version  # Should show v18.x or higher
   npm --version   # Should show 9.x or higher
   ```

2. **Create project from scratch (better for learning):**
   ```bash
   # Create project folder
   mkdir wtf-is-on-my-port
   cd wtf-is-on-my-port
   
   # Initialize npm project
   npm init -y
   
   # Install Electron
   npm install --save-dev electron
   
   # Install development tools
   npm install --save-dev @electron-forge/cli
   npx electron-forge import
   ```

3. **Create basic file structure:**
   ```
   wtf-is-on-my-port/
   ├── src/
   │   ├── main.js           # Main process (Node.js environment)
   │   ├── preload.js         # Bridge between main and renderer
   │   ├── renderer.js        # Frontend JavaScript
   │   └── index.html         # Your app's UI
   ├── package.json
   └── .gitignore
   ```

4. **Basic main.js to get started:**
   ```javascript
   const { app, BrowserWindow } = require('electron');
   const path = require('path');
   
   function createWindow() {
     const mainWindow = new BrowserWindow({
       width: 800,
       height: 600,
       webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         contextIsolation: true,
         nodeIntegration: false  // Security: keep this false
       }
     });
   
     mainWindow.loadFile('src/index.html');
     mainWindow.webContents.openDevTools(); // For debugging
   }
   
   app.whenReady().then(createWindow);
   ```

5. **Test your setup:**
   ```bash
   npm start  # Should open an Electron window
   ```

### Day 2: Understanding Electron Architecture
**Goal:** Understand how Electron apps actually work

1. **Learn the key concepts:**
   - **Main Process:** Runs Node.js, manages windows, handles system calls
   - **Renderer Process:** Your web page (HTML/CSS/JS)
   - **Preload Script:** Safely exposes Node.js features to your web page
   - **IPC (Inter-Process Communication):** How main and renderer talk

2. **Set up proper IPC communication:**
   
   **preload.js:**
   ```javascript
   const { contextBridge, ipcRenderer } = require('electron');
   
   // Expose protected methods that allow the renderer process to use
   // the ipcRenderer without exposing the entire object
   contextBridge.exposeInMainWorld('api', {
     getPortInfo: (port) => ipcRenderer.invoke('get-port-info', port),
     killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
     getAllPorts: () => ipcRenderer.invoke('get-all-ports')
   });
   ```
   
   **main.js additions:**
   ```javascript
   const { ipcMain } = require('electron');
   
   // Handle IPC calls from renderer
   ipcMain.handle('get-port-info', async (event, port) => {
     // We'll implement this tomorrow
     return { port, process: 'dummy process' };
   });
   ```

3. **Create basic UI in index.html:**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>WTF Is On My Port</title>
     <link rel="stylesheet" href="styles.css">
   </head>
   <body>
     <h1>Port Monitor</h1>
     <div>
       <input type="number" id="portInput" placeholder="Enter port number">
       <button id="checkBtn">Check Port</button>
     </div>
     <div id="results"></div>
     <script src="renderer.js"></script>
   </body>
   </html>
   ```

### Day 3: Core System Functionality
**Goal:** Actually read port information from the OS

1. **Implement cross-platform port checking:**
   
   Create `src/utils/portManager.js`:
   ```javascript
   const { exec } = require('child_process');
   const util = require('util');
   const execPromise = util.promisify(exec);
   
   class PortManager {
     async getPortInfo(port) {
       if (process.platform === 'win32') {
         return this.getWindowsPortInfo(port);
       } else {
         return this.getMacPortInfo(port);
       }
     }
   
     async getMacPortInfo(port) {
       try {
         // lsof -i :8080 -P -n
         const { stdout } = await execPromise(`lsof -i :${port} -P -n`);
         return this.parseLsofOutput(stdout);
       } catch (error) {
         if (error.code === 1) {
           return null; // Port not in use
         }
         throw error;
       }
     }
   
     async getWindowsPortInfo(port) {
       try {
         // netstat -ano | findstr :8080
         const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
         return this.parseNetstatOutput(stdout);
       } catch (error) {
         return null; // Port not in use
       }
     }
   
     parseLsofOutput(output) {
       const lines = output.split('\n').filter(line => line.trim());
       if (lines.length < 2) return null;
       
       // Parse lsof output
       // COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
       const dataLine = lines[1];
       const parts = dataLine.split(/\s+/);
       
       return {
         command: parts[0],
         pid: parseInt(parts[1]),
         user: parts[2],
         port: parts[8]?.split(':').pop()
       };
     }
   
     parseNetstatOutput(output) {
       // Parse Windows netstat output
       // TCP    0.0.0.0:8080    0.0.0.0:0    LISTENING    1234
       const lines = output.split('\n').filter(line => line.includes('LISTENING'));
       if (lines.length === 0) return null;
       
       const parts = lines[0].trim().split(/\s+/);
       const pid = parseInt(parts[parts.length - 1]);
       
       return {
         pid,
         port: parts[1]?.split(':').pop(),
         command: 'Unknown' // We'll get this in next step
       };
     }
   
     async killProcess(pid) {
       if (process.platform === 'win32') {
         await execPromise(`taskkill /PID ${pid} /F`);
       } else {
         await execPromise(`kill -9 ${pid}`);
       }
     }
   }
   
   module.exports = PortManager;
   ```

2. **Wire it up to the main process:**
   ```javascript
   // In main.js
   const PortManager = require('./utils/portManager');
   const portManager = new PortManager();
   
   ipcMain.handle('get-port-info', async (event, port) => {
     try {
       const info = await portManager.getPortInfo(port);
       return { success: true, data: info };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });
   
   ipcMain.handle('kill-process', async (event, pid) => {
     try {
       await portManager.killProcess(pid);
       return { success: true };
     } catch (error) {
       return { success: false, error: error.message };
     }
   });
   ```

## Phase 2: Core Features (Days 4-7)

### Day 4: Get All Active Ports
**Goal:** Show all ports in use, not just check one

1. **Add getAllPorts method:**
   ```javascript
   async getAllPorts() {
     if (process.platform === 'win32') {
       const { stdout } = await execPromise('netstat -ano');
       return this.parseAllWindowsPorts(stdout);
     } else {
       const { stdout } = await execPromise('lsof -i -P -n | grep LISTEN');
       return this.parseAllMacPorts(stdout);
     }
   }
   ```

2. **Create a proper UI table to display results**

### Day 5: Process Details Enhancement
**Goal:** Get process names on Windows, more details on Mac

1. **Windows process name lookup:**
   ```javascript
   async getWindowsProcessName(pid) {
     const { stdout } = await execPromise(`tasklist /FI "PID eq ${pid}" /FO CSV`);
     // Parse CSV output to get process name
   }
   ```

2. **Add CPU/Memory usage info:**
   ```javascript
   // Mac: ps aux | grep <PID>
   // Windows: wmic process where ProcessId=<PID> get WorkingSetSize,CPUTime
   ```

### Day 6: UI Polish
**Goal:** Make it not look like trash

1. **Add a CSS framework or write custom styles:**
   ```css
   /* Simple dark theme */
   body {
     background: #1e1e1e;
     color: #ffffff;
     font-family: 'SF Mono', Monaco, monospace;
   }
   
   .port-item {
     background: #2d2d2d;
     padding: 10px;
     margin: 5px 0;
     border-radius: 5px;
     display: flex;
     justify-content: space-between;
   }
   
   .kill-btn {
     background: #dc3545;
     color: white;
     border: none;
     padding: 5px 15px;
     cursor: pointer;
     border-radius: 3px;
   }
   
   .kill-btn:hover {
     background: #c82333;
   }
   ```

2. **Add loading states and error handling**

### Day 7: Safety Features
**Goal:** Don't let users nuke their system

1. **Add confirmation dialogs:**
   ```javascript
   const { dialog } = require('electron');
   
   ipcMain.handle('kill-process', async (event, pid, processName) => {
     const result = await dialog.showMessageBox({
       type: 'warning',
       buttons: ['Cancel', 'Kill Process'],
       defaultId: 0,
       message: `Kill ${processName} (PID: ${pid})?`,
       detail: 'This will forcefully terminate the process.'
     });
     
     if (result.response === 1) {
       await portManager.killProcess(pid);
     }
   });
   ```

2. **Protected process list:**
   ```javascript
   const PROTECTED_PROCESSES = [
     'postgres', 'mysql', 'mongod', 'redis-server',
     'docker', 'WindowServer', 'kernel_task'
   ];
   ```

## Phase 3: Advanced Features (Days 8-10)

### Day 8: Menu Bar/System Tray
**Goal:** Quick access without opening full app

```javascript
const { Menu, Tray } = require('electron');

let tray = null;
app.whenReady().then(() => {
  tray = new Tray('icon.png');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Quick Scan', click: () => quickScanPorts() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
});
```

### Day 9: Search and Filter
1. Add search box to filter by port/process name
2. Add sorting (by port, PID, memory usage)
3. Add "favorite ports" to monitor

### Day 10: Auto-refresh and Notifications
```javascript
// Poll for changes every 5 seconds
setInterval(async () => {
  const ports = await portManager.getAllPorts();
  mainWindow.webContents.send('ports-updated', ports);
}, 5000);

// Notify when specific port becomes available
if (watchedPort8080 && !ports.includes(8080)) {
  new Notification({
    title: 'Port 8080 Available',
    body: 'The port you were waiting for is now free!'
  }).show();
}
```

## Phase 4: Distribution (Days 11-14)

### Day 11: Building and Packaging
1. **Configure electron-builder:**
   ```json
   {
     "build": {
       "appId": "com.yourname.wtfisonmyport",
       "productName": "WTF Is On My Port",
       "directories": {
         "output": "dist"
       },
       "mac": {
         "category": "public.app-category.developer-tools"
       },
       "win": {
         "target": "nsis"
       }
     }
   }
   ```

2. **Build commands:**
   ```bash
   npm run make  # Creates distributables
   ```

### Day 12: Testing on Both Platforms
- Test on real Windows machine (or VM)
- Test on Mac
- Document platform-specific issues

### Day 13: Create Landing Page
- Simple HTML page with screenshots
- Buy domain (wtfisonmyport.com?)
- Set up Gumroad/Paddle for payments

### Day 14: Launch
- Upload to Gumroad
- Post on Show HN
- Tweet about it
- Submit to ProductHunt

## Testing Checklist
- [ ] Can see all active ports
- [ ] Can kill a process
- [ ] Confirmation dialog works
- [ ] Protected processes can't be killed
- [ ] Works on Mac
- [ ] Works on Windows
- [ ] Handles errors gracefully
- [ ] No memory leaks after running for hours
- [ ] Auto-update works

## Common Pitfalls to Avoid

1. **Permissions:** Your app needs admin rights to see all processes
2. **Antivirus:** Killing processes triggers Windows Defender
3. **Platform differences:** Windows and Mac outputs are VERY different
4. **Zombie processes:** Sometimes kill -9 doesn't work
5. **Port 0:** Some processes bind to port 0 (any available port)

## Resources You'll Actually Need
- Electron docs: https://www.electronjs.org/docs
- Node.js child_process: https://nodejs.org/api/child_process.html
- electron-builder: https://www.electron.build/
- Icon generator: https://www.electronforge.io/guides/create-and-add-icons

Start with Day 1. Get the basic app running. Everything else builds on that foundation. Ship something ugly that works before making it pretty.