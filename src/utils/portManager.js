// Mock implementation of PortManager for testing
class PortManager {
  constructor() {
    this.protectedProcesses = [];
    this.ports = [];
  }
  
  setProtectedProcesses(processes) {
    this.protectedProcesses = processes.map(p => p.toLowerCase());
  }
  
  addProtectedProcesses(processes) {
    processes.forEach(p => {
      const lower = p.toLowerCase();
      if (!this.protectedProcesses.includes(lower)) {
        this.protectedProcesses.push(lower);
      }
    });
  }
  
  removeProtectedProcess(process) {
    const index = this.protectedProcesses.indexOf(process.toLowerCase());
    if (index > -1) {
      this.protectedProcesses.splice(index, 1);
    }
  }
  
  isProtected(process) {
    if (!process) return false;
    const processLower = process.toLowerCase();
    
    // Check exact match
    if (this.protectedProcesses.includes(processLower)) {
      return true;
    }
    
    // Check partial match (process contains protected name)
    return this.protectedProcesses.some(protectedName => {
      // Check if process name contains the protected process name
      return processLower.includes(protectedName) || 
             // Check if it's a path containing the process
             processLower.endsWith('/' + protectedName) ||
             // Check if it has extension (.exe on Windows)
             processLower.startsWith(protectedName + '.');
    });
  }
  
  async getAllPorts() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN');
        return this.parseMacPorts(stdout);
      } else if (process.platform === 'win32') {
        const { stdout } = await execAsync('netstat -ano');
        return this.parseWindowsPorts(stdout);
      }
      
      return { ports: [], error: 'Unsupported platform' };
    } catch (error) {
      return { 
        ports: [], 
        error: error.message,
        userMessage: 'Unable to retrieve port information. Please check your system permissions.'
      };
    }
  }
  
  parseMacPorts(output) {
    const lines = output.split('\n').filter(line => line.trim());
    const ports = [];
    
    lines.forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        const command = parts[0];
        const pid = parseInt(parts[1]);
        const user = parts[2];
        const name = parts[8];
        
        // Extract port number
        const portMatch = name.match(/:(\d+)/);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          ports.push({
            port,
            pid,
            process: command,
            user,
            protected: this.isProtected(command),
            killable: !this.isProtected(command),
            uiHint: this.isProtected(command) ? 'Protected Process' : ''
          });
        }
      }
    });
    
    return ports;
  }
  
  parseWindowsPorts(output) {
    const lines = output.split('\n').filter(line => line.includes('LISTENING'));
    const ports = [];
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        const pid = parseInt(parts[4]);
        
        // Extract port number
        const portMatch = localAddress.match(/:(\d+)$/);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          ports.push({
            port,
            pid,
            process: 'Unknown', // Will be filled by tasklist
            protected: false,
            killable: true
          });
        }
      }
    });
    
    return ports;
  }
  
  async killProcess(pid, processName) {
    // Validate PID
    if (!pid || pid <= 0 || isNaN(pid)) {
      return {
        success: false,
        error: 'Invalid PID provided'
      };
    }
    
    // Check if protected
    if (processName && this.isProtected(processName)) {
      return {
        success: false,
        error: `Cannot kill protected process: ${processName}`,
        protected: true,
        suggestion: 'Please stop the service properly using the appropriate method.'
      };
    }
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const command = process.platform === 'darwin' 
        ? `kill -9 ${pid}`
        : `taskkill /F /PID ${pid}`;
      
      await execAsync(command);
      
      return {
        success: true,
        message: `Process ${pid} has been terminated`
      };
    } catch (error) {
      const errorLower = error.message.toLowerCase();
      
      if (errorLower.includes('not permitted') || errorLower.includes('access')) {
        return {
          success: false,
          error: error.message,
          userMessage: 'Permission denied. Try running as administrator.',
          needsElevation: process.platform === 'win32'
        };
      }
      
      if (errorLower.includes('no such process') || errorLower.includes('not found')) {
        return {
          success: false,
          error: error.message,
          userMessage: 'Process already terminated or does not exist.'
        };
      }
      
      return {
        success: false,
        error: error.message,
        userMessage: 'Failed to terminate process. Please try again.'
      };
    }
  }
  
  async killProcessWithElevation(pid) {
    // Simulate elevation requirement
    return {
      success: false,
      elevationRequired: true,
      userMessage: 'Administrator privileges required to kill this process.'
    };
  }
  
  async isProcessRunning(pid) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync(`ps -p ${pid}`);
        return stdout.includes(pid.toString());
      } else {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}"`);
        return stdout.includes(pid.toString());
      }
    } catch {
      return false;
    }
  }
  
  async getAllPortsWithRetry(maxAttempts = 3) {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.getAllPorts();
      if (!result.error) {
        return { success: true, ports: result };
      }
      
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { success: false, error: 'Failed after multiple attempts' };
  }
  
  async getAllPortsWithFallback() {
    const primary = await this.getAllPorts();
    if (!primary.error) {
      return { ports: primary, usedFallback: false };
    }
    
    // Try fallback command
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'darwin') {
        // Fallback to netstat on Mac
        const { stdout } = await execAsync('netstat -an | grep LISTEN');
        return { 
          ports: this.parseNetstatFallback(stdout), 
          usedFallback: true 
        };
      }
      
      return { ports: [], error: 'No fallback available' };
    } catch (error) {
      return { ports: [], error: error.message };
    }
  }
  
  parseNetstatFallback(output) {
    // Simple fallback parser
    const lines = output.split('\n');
    const ports = [];
    
    lines.forEach(line => {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        ports.push({
          port: parseInt(match[1]),
          pid: 0,
          process: 'Unknown'
        });
      }
    });
    
    return ports;
  }
  
  async handleCriticalError(error) {
    const fs = require('fs').promises;
    const path = require('path');
    const report = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      platform: process.platform,
      nodeVersion: process.version
    };
    
    const reportPath = path.join(__dirname, `error-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    return reportPath;
  }
  
  async getProcessStats(pid) {
    if (!pid || pid <= 0) {
      return { cpu: '0', memory: '0 KB' };
    }
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'darwin') {
        // Mac: Use ps to get CPU and memory usage
        const { stdout } = await execAsync(`ps -p ${pid} -o %cpu,%mem,rss`);
        const lines = stdout.split('\n').filter(line => line.trim());
        
        if (lines.length > 1) {
          const stats = lines[1].trim().split(/\s+/);
          return {
            cpu: stats[0] || '0',
            memory: stats[2] ? `${Math.round(parseInt(stats[2]) / 1024)} MB` : '0 KB'
          };
        }
      } else if (process.platform === 'win32') {
        // Windows: Use wmic to get process stats
        const { stdout } = await execAsync(
          `wmic process where ProcessId=${pid} get WorkingSetSize,PageFileUsage /format:csv`
        );
        const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
        
        if (lines.length > 0) {
          const parts = lines[0].split(',');
          if (parts.length >= 3) {
            const workingSet = parseInt(parts[2]) || 0;
            return {
              cpu: '0', // Windows doesn't easily provide CPU % via wmic
              memory: `${Math.round(workingSet / 1024 / 1024)} MB`
            };
          }
        }
      }
    } catch (error) {
      // Process might have ended or permission denied
      console.debug(`Could not get stats for PID ${pid}:`, error.message);
    }
    
    return { cpu: '0', memory: '0 KB' };
  }
  
  async getPortInfo(port) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync(`lsof -i :${port} -P -n | grep LISTEN`);
        const lines = stdout.split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          const parts = lines[0].split(/\s+/);
          if (parts.length >= 9) {
            return {
              command: parts[0],
              pid: parseInt(parts[1]),
              user: parts[2],
              port: port
            };
          }
        }
      } else if (process.platform === 'win32') {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
        
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1]);
          
          // Get process name
          try {
            const { stdout: taskList } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
            const taskLines = taskList.split('\n').filter(line => line.includes(`"${pid}"`));
            if (taskLines.length > 0) {
              const taskParts = taskLines[0].split(',');
              return {
                command: taskParts[0].replace(/"/g, ''),
                pid: pid,
                user: 'Unknown',
                port: port
              };
            }
          } catch {
            // Fallback if tasklist fails
          }
          
          return {
            command: 'Unknown',
            pid: pid,
            user: 'Unknown',
            port: port
          };
        }
      }
      
      return null; // Port not in use
    } catch (error) {
      // Port might not be in use or command failed
      return null;
    }
  }
}

// Mock for main process handlers
const handleKillProcess = async (event, data) => {
  const { dialog } = require('electron');
  const portManager = new PortManager();
  
  try {
    const result = await dialog.showMessageBox(
      BrowserWindow.getFocusedWindow(),
      {
        type: 'warning',
        title: 'Confirm Process Termination',
        message: `Are you sure you want to kill ${data.process} (PID: ${data.pid})?`,
        detail: data.port ? `This process is using port ${data.port}` : '',
        buttons: ['Cancel', 'Kill Process'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      }
    );
    
    if (result.response === 0 || result.response === -1) {
      return { cancelled: true, killed: false };
    }
    
    const killResult = await portManager.killProcess(data.pid, data.process);
    
    if (!killResult.success) {
      await dialog.showMessageBox(
        BrowserWindow.getFocusedWindow(),
        {
          type: 'error',
          title: 'Failed to Kill Process',
          message: 'Failed to kill process',
          detail: killResult.userMessage || killResult.error,
          buttons: ['OK']
        }
      );
    }
    
    return { 
      cancelled: false, 
      killed: killResult.success,
      error: killResult.error
    };
  } catch (error) {
    return {
      cancelled: false,
      killed: false,
      error: error.message
    };
  }
};

module.exports = PortManager;
module.exports.handleKillProcess = handleKillProcess;