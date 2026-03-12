const { exec } = require('child_process');
const { promisify } = require('util');
const parseNmapOutput = require('../utils/parseNmap');
const vulnerabilityDetection = require('./vulnerabilityDetection');

const execAsync = promisify(exec);

/**
 * Enhanced Scanner Service with comprehensive vulnerability detection
 * Cross-platform compatible with improved stability and realistic timeouts
 * FIXED: Shell syntax errors, Windows UDP support, and cross-platform vulnerability detection
 */
class ScannerService {
  constructor() {
    this.defaultTimeout = 600000; // 10 minutes default
    this.maxConcurrentScans = 3;
    this.activeScanCount = 0;
    this.platform = process.platform;
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
  }

  /**
   * Main scanning function with enhanced vulnerability detection
   */
  async runNmapScan(ip, options = {}) {
    const {
      onProgress,
      scanType = 'quick',
      timeout = this.getScanTimeout(scanType),
      includeVulnScripts = true
    } = options;

    if (this.activeScanCount >= this.maxConcurrentScans) {
      throw new Error('Maximum concurrent scans reached. Please wait for current scans to complete.');
    }

    this.activeScanCount++;

    try {
      if (onProgress) onProgress(0, `Initializing scan for ${ip}`);

      const nmapCommand = this.buildNmapCommand(ip, scanType, includeVulnScripts);
      if (onProgress) onProgress(10, `Starting ${scanType} scan for ${ip}`);
      console.log(`Executing: ${nmapCommand}`);

      const rawOutput = await this.executeNmapCommand(nmapCommand, timeout, onProgress);
      if (onProgress) onProgress(70, `Parsing scan results for ${ip}`);

      const parsedResults = await parseNmapOutput(rawOutput);
      if (onProgress) onProgress(80, `Analyzing vulnerabilities for ${ip}`);

      const enhancedResults = await this.enhanceResultsWithVulnerabilities(parsedResults, ip, onProgress);
      if (onProgress) onProgress(100, `Scan completed for ${ip}`);

      return enhancedResults;
    } catch (error) {
      console.error(`Scan error for ${ip}:`, error);
      if (onProgress) onProgress(0, `Scan failed for ${ip}: ${error.message}`);
      throw error;
    } finally {
      this.activeScanCount--;
    }
  }

  /**
   * Get appropriate timeout based on scan type (realistic timeouts)
   */
  getScanTimeout(scanType) {
    const timeouts = {
      quick: 300000,         // 5 minutes - top 100 ports
      comprehensive: 1800000, // 30 minutes - top 10000 ports
      stealth: 2400000,      // 40 minutes - slower timing
      udp: 1800000,          // 30 minutes - UDP is slow
      vulnerability: 1200000  // 20 minutes - with vuln scripts
    };
    return timeouts[scanType] || this.defaultTimeout;
  }

  /**
   * Check if we have elevated privileges - FIXED for Windows
   */
  hasElevatedPrivileges() {
    if (this.isWindows) {
      // On Windows, we can't reliably check admin status in Node.js
      // So we assume TRUE and let nmap handle the fallback
      // Nmap on Windows can perform most scans without explicit admin
      return true;
    } else {
      // On Unix systems, check if running as root (UID 0)
      try {
        return process.getuid && process.getuid() === 0;
      } catch (e) {
        return false;
      }
    }
  }

  /**
   * Build cross-platform compatible nmap command - FIXED shell syntax
   */
  buildNmapCommand(ip, scanType, includeVulnScripts) {
    let baseCommand = 'nmap';
    let options = [];

    // Check if we have privileges
    const hasPrivileges = this.hasElevatedPrivileges();

    // Common options for all scans
    options.push('-Pn'); // Skip ping (works better across firewalls)
    options.push('-sV'); // Version detection
    options.push('--version-intensity', '7');
    options.push('-oX', '-'); // XML output to stdout

    switch (scanType) {
      case 'quick':
        // Quick scan: Top 100 ports, fast
        options.push('-F'); // Fast mode (top 100 ports)
        if (hasPrivileges) {
          options.push('-sS'); // SYN scan
        } else {
          options.push('-sT'); // TCP connect scan
        }
        options.push('-T4');
        break;

      case 'comprehensive':
        // Comprehensive scan: Top 10000 ports
        if (hasPrivileges) {
          options.push('-sS'); // SYN scan
        } else {
          options.push('-sT'); // TCP connect scan
        }
        options.push('--top-ports', '10000');
        if (hasPrivileges) {
          // OS detection works better on Linux/Mac
          options.push('-O');
        }
        options.push('-T4');
        options.push('--max-retries', '2');
        options.push('--host-timeout', '1500s');
        options.push('--max-rtt-timeout', '500ms');
        break;

      case 'stealth':
        // Stealth scan: Top 1000 ports, slow and careful
        if (hasPrivileges) {
          options.push('-sS'); // SYN scan
        } else {
          options.push('-sT'); // TCP connect
          console.warn('Stealth scan works best with root privileges. Using TCP connect scan.');
        }
        options.push('-T2'); // Polite timing
        options.push('--top-ports', '1000');
        options.push('--max-retries', '1');
        options.push('--scan-delay', '200ms');
        options.push('--max-rtt-timeout', '1000ms');
        break;

      case 'udp':
        // UDP scan: Top 100 UDP ports
        if (!hasPrivileges) {
          // Only throw error on Linux/Mac without root
          throw new Error(
            'UDP scan requires root privileges on Linux/Mac. Solutions:\n' +
            '1. Run with sudo: sudo node your-app.js\n' +
            '2. Grant capabilities: sudo setcap cap_net_raw+eip $(which node)\n' +
            '3. Use a different scan type like "quick"'
          );
        } else {
          options.push('-sU'); // UDP scan
          options.push('--top-ports', '100');
          options.push('-T4');
          options.push('--max-retries', '1');
          options.push('--host-timeout', '1200s');
          options.push('--max-rtt-timeout', '1000ms');
        }
        break;

      case 'vulnerability':
        // Vulnerability scan: Top 1000 ports with vuln scripts
        if (hasPrivileges) {
          options.push('-sS');
        } else {
          options.push('-sT');
        }
        options.push('--top-ports', '1000');
        options.push('-T4');
        
        if (includeVulnScripts) {
          // FIXED: Use proper script syntax that works across platforms
          // Use individual safe scripts instead of complex boolean expressions
          if (this.isWindows) {
            // Windows: Use simpler, more reliable scripts
            options.push('--script', 'vuln,safe,version');
          } else {
            // Linux/Mac: Use script file approach to avoid shell parsing issues
            // Create a safer script selection
            options.push('--script', 'vuln,safe,default');
          }
          options.push('--script-timeout', '300s');
          options.push('--script-args', 'unsafe=1'); // Enable more thorough checking
        }
        options.push('--max-retries', '2');
        break;

      default:
        // Default: Top 1000 ports
        if (hasPrivileges) {
          options.push('-sS');
        } else {
          options.push('-sT');
        }
        options.push('--top-ports', '1000');
        options.push('-T4');
    }

    // Add vulnerability scripts for non-vulnerability scans if requested
    if (includeVulnScripts && scanType !== 'vulnerability' && scanType !== 'udp') {
      // Use simple, reliable scripts that work on all platforms
      options.push('--script', 'banner,version,vuln');
      options.push('--script-timeout', '120s');
    }

    // Add target IP
    options.push(ip);

    return `${baseCommand} ${options.join(' ')}`;
  }

  /**
   * Execute nmap command with proper error handling - FIXED
   */
  executeNmapCommand(command, timeout, onProgress) {
    return new Promise((resolve, reject) => {
      const maxBuffer = 1024 * 1024 * 100; // 100MB buffer

      const childProcess = exec(command, {
        timeout,
        maxBuffer,
        // FIXED: Use bash on Linux to handle complex scripts better
        shell: this.isWindows ? true : '/bin/bash',
        killSignal: 'SIGTERM'
      }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed && error.signal === 'SIGTERM') {
            reject(new Error(`Scan timeout after ${timeout / 1000} seconds. Try a quicker scan type.`));
          } else if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            reject(new Error('Scan output exceeded buffer size. Results too large.'));
          } else {
            // Check for specific nmap errors
            const errorMsg = stderr || error.message;
            
            // Check for shell syntax errors
            if (errorMsg.includes('Syntax error') || errorMsg.includes('unexpected')) {
              reject(new Error(
                'Nmap command syntax error. This may be a bug in the scanner service. ' +
                'Try using a different scan type or updating nmap.'
              ));
            }
            else if (errorMsg.includes('requires root privileges') || 
                errorMsg.includes('requires elevated privileges')) {
              reject(new Error(
                'This scan requires root privileges. Solutions:\n' +
                '1. Run with sudo: sudo node your-app.js\n' +
                '2. Use "quick" scan type (doesn\'t require root)\n' +
                '3. Grant capabilities: sudo setcap cap_net_raw+eip $(which node)'
              ));
            } 
            else if (errorMsg.includes('module \'openssl\' not found') || 
                     errorMsg.includes('NSE: Failed to load')) {
              // More lenient handling - continue with scan but warn
              console.warn('Some NSE scripts failed to load. Continuing with available scripts...');
              // If we got some output, use it
              if (stdout && stdout.trim().length > 0) {
                resolve(stdout);
                return;
              }
              reject(new Error(
                'Nmap NSE scripts missing dependencies. Solutions:\n' +
                '1. Reinstall nmap: sudo apt-get install --reinstall nmap nmap-common\n' +
                '2. Or disable vulnerability scripts in scan options'
              ));
            }
            else if (errorMsg.includes('invalid option')) {
              reject(new Error('Invalid nmap option. Your nmap version may not support all features.'));
            } 
            else if (errorMsg.includes('Failed to resolve')) {
              reject(new Error('Failed to resolve hostname. Please check the IP address.'));
            } 
            else {
              reject(new Error(`Nmap execution failed: ${error.message}`));
            }
          }
          return;
        }

        if (stderr && stderr.trim()) {
          console.warn('Nmap stderr:', stderr);
        }

        if (!stdout || stdout.trim().length === 0) {
          reject(new Error('Nmap produced no output. Target may be offline or unreachable.'));
          return;
        }

        resolve(stdout);
      });

      // Track progress from stdout
      let progressPercent = 10;
      let lastProgressUpdate = Date.now();
      
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          const now = Date.now();
          
          if (now - lastProgressUpdate < 2000 && progressPercent < 65) {
            return;
          }
          lastProgressUpdate = now;
          
          if (output.includes('Scanning') || output.includes('Discovered')) {
            progressPercent = Math.min(progressPercent + 2, 60);
            if (onProgress) onProgress(progressPercent, 'Scanning ports...');
          } else if (output.includes('Service detection') || output.includes('Version detection')) {
            progressPercent = 50;
            if (onProgress) onProgress(progressPercent, 'Detecting services...');
          } else if (output.includes('NSE') || output.includes('Script')) {
            progressPercent = 60;
            if (onProgress) onProgress(progressPercent, 'Running vulnerability scripts...');
          } else if (output.includes('completed')) {
            progressPercent = 65;
            if (onProgress) onProgress(progressPercent, 'Finalizing scan...');
          } else if (output.match(/\d+% done/)) {
            const match = output.match(/(\d+)% done/);
            if (match) {
              const nmapProgress = parseInt(match[1]);
              progressPercent = Math.min(10 + Math.floor(nmapProgress * 0.6), 65);
              if (onProgress) onProgress(progressPercent, `Scanning... ${nmapProgress}% complete`);
            }
          }
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const warning = data.toString();
          // Don't log script loading warnings as errors
          if (!warning.includes('NSE: Failed to load')) {
            console.warn('Nmap warning:', warning);
          }
        });
      }
    });
  }

  /**
   * Enhance scan results with vulnerability analysis
   */
  async enhanceResultsWithVulnerabilities(scanResults, targetIP, onProgress) {
    const enhancedResults = [];
    const totalResults = scanResults.length;

    if (totalResults === 0) {
      console.warn('No scan results to enhance');
      return enhancedResults;
    }

    for (let i = 0; i < scanResults.length; i++) {
      const result = scanResults[i];
      if (onProgress) {
        const progress = 80 + Math.floor((i / totalResults) * 15);
        onProgress(progress, `Analyzing port ${result.port} (${result.state})...`);
      }

      try {
        // Only run vulnerability detection on OPEN ports
        let vulnAnalysis;
        if (result.state === 'open') {
          vulnAnalysis = await vulnerabilityDetection.analyzeScan(result);
        } else {
          // For closed/filtered ports, provide minimal vulnerability info
          vulnAnalysis = {
            vulnerabilityScore: 0,
            vulnerabilities: [],
            detectionDetails: [],
            confidence: 0,
            detectionMethods: [],
            scanEnhancement: `Port is ${result.state} - no vulnerabilities to analyze`
          };
        }

        const enhancedResult = {
          ...result,
          targetIP,
          vulnerabilityScore: vulnAnalysis.vulnerabilityScore,
          vulnerabilities: vulnAnalysis.vulnerabilities,
          detectionDetails: vulnAnalysis.detectionDetails,
          confidence: vulnAnalysis.confidence,
          detectionMethods: vulnAnalysis.detectionMethods,
          scanEnhancement: vulnAnalysis.scanEnhancement,
          scannedAt: new Date(),
          scanMetadata: {
            totalVulnerabilities: vulnAnalysis.detectionDetails.length,
            highestSeverity: this.getHighestSeverity(vulnAnalysis.detectionDetails),
            riskLevel: this.calculateRiskLevel(vulnAnalysis.vulnerabilityScore, vulnAnalysis.confidence),
            platform: this.platform
          }
        };
        enhancedResults.push(enhancedResult);
      } catch (error) {
        console.error(`Error analyzing port ${result.port}:`, error);
        enhancedResults.push({
          ...result,
          targetIP,
          vulnerabilityScore: 0,
          vulnerabilities: [],
          detectionDetails: [],
          confidence: 0,
          error: error.message,
          scannedAt: new Date()
        });
      }
    }

    // Log summary of port states
    const summary = {
      total: enhancedResults.length,
      open: enhancedResults.filter(r => r.state === 'open').length,
      closed: enhancedResults.filter(r => r.state === 'closed').length,
      filtered: enhancedResults.filter(r => r.state === 'filtered').length,
      withVulns: enhancedResults.filter(r => r.vulnerabilities && r.vulnerabilities.length > 0).length
    };
    console.log(
      `Scan summary for ${targetIP}: ` +
      `${summary.open} open, ${summary.closed} closed, ${summary.filtered} filtered | ` +
      `${summary.withVulns} ports with vulnerabilities (${summary.total} total)`
    );

    return enhancedResults;
  }

  getHighestSeverity(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return 'None';
    const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
    for (const severity of severityOrder) {
      if (vulnerabilities.some(v => v.severity === severity)) return severity;
    }
    return 'Unknown';
  }

  calculateRiskLevel(vulnerabilityScore, confidence) {
    if (vulnerabilityScore === 0) return 'Low';
    const adjustedScore = vulnerabilityScore * (confidence / 100);
    if (adjustedScore >= 8.0) return 'Critical';
    if (adjustedScore >= 6.0) return 'High';
    if (adjustedScore >= 4.0) return 'Medium';
    return 'Low';
  }

  /**
   * Alternative connectivity test using TCP connection
   */
  async tcpTest(ip, port = 80, timeout = 2000) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Validate IP address format
   */
  validateIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Cross-platform ping test
   */
  async pingTest(ip) {
    if (!this.validateIP(ip)) {
      console.error(`Invalid IP address: ${ip}`);
      return false;
    }

    try {
      const pingCommand = this.isWindows 
        ? `ping -n 1 -w 1000 ${ip}`
        : `ping -c 1 -W 1 ${ip}`;

      console.log(`Testing connectivity to ${ip}...`);
      
      const { stdout } = await execAsync(pingCommand, { 
        timeout: 3000
      });

      const isReachable = this.isWindows 
        ? stdout.includes('Reply from') || stdout.includes('bytes=')
        : stdout.includes('1 received') || stdout.includes('1 packets received');

      console.log(`Ping test for ${ip}: ${isReachable ? '✓ Reachable' : '✗ Not reachable'}`);
      return isReachable;

    } catch (error) {
      console.log(`Ping test for ${ip}: ✗ Not reachable (${error.message})`);
      return false;
    }
  }

  /**
   * Enhanced connectivity test
   */
  async enhancedConnectivityTest(ip) {
    console.log(`Running enhanced connectivity test for ${ip}...`);
    
    const pingResult = await this.pingTest(ip);
    if (pingResult) {
      return { reachable: true, method: 'ping' };
    }

    console.log(`Ping failed for ${ip}, trying TCP ports...`);
    const commonPorts = [80, 443, 22, 3389, 8080, 21, 25, 3306];
    
    for (const port of commonPorts) {
      const tcpResult = await this.tcpTest(ip, port, 1000);
      if (tcpResult) {
        console.log(`TCP test successful on ${ip}:${port}`);
        return { reachable: true, method: `tcp:${port}` };
      }
    }

    return { reachable: false, method: 'none' };
  }

  /**
   * Get current scan statistics
   */
  getScanStats() {
    return {
      activeScanCount: this.activeScanCount,
      maxConcurrentScans: this.maxConcurrentScans,
      canStartNewScan: this.activeScanCount < this.maxConcurrentScans,
      platform: this.platform,
      hasPrivileges: this.hasElevatedPrivileges(),
      privilegeInfo: this.getPrivilegeInfo()
    };
  }

  /**
   * Get privilege information and recommendations
   */
  getPrivilegeInfo() {
    const hasPrivileges = this.hasElevatedPrivileges();
    
    if (this.isWindows) {
      return {
        hasPrivileges: true,
        message: 'Running on Windows - most scans available',
        recommendations: [
          'Run as Administrator for best results',
          'UDP scans work on Windows without admin in most cases'
        ],
        availableScanTypes: ['quick', 'comprehensive', 'stealth', 'udp', 'vulnerability']
      };
    }
    
    return {
      hasPrivileges,
      message: hasPrivileges 
        ? 'Running with elevated privileges - all scan types available'
        : 'Running without privileges - some scan types limited',
      recommendations: hasPrivileges ? [] : [
        'Run with sudo for full functionality: sudo node your-app.js',
        'Or use "quick" scan type which works without root',
        'Or grant capabilities: sudo setcap cap_net_raw+eip $(which node)'
      ],
      availableScanTypes: hasPrivileges 
        ? ['quick', 'comprehensive', 'stealth', 'udp', 'vulnerability']
        : ['quick', 'comprehensive (limited)', 'stealth (limited)', 'vulnerability (limited)']
    };
  }

  /**
   * Run batch scan with concurrent control
   */
  async runBatchScan(ipList, options = {}) {
    const results = [];
    const errors = [];
    const { maxConcurrent = 2, onProgress } = options;

    const validIPs = ipList.filter(ip => {
      if (!this.validateIP(ip)) {
        errors.push({ ip, error: 'Invalid IP address format' });
        return false;
      }
      return true;
    });

    if (validIPs.length === 0) {
      throw new Error('No valid IP addresses provided');
    }

    for (let i = 0; i < validIPs.length; i += maxConcurrent) {
      const batch = validIPs.slice(i, i + maxConcurrent);
      if (onProgress) {
        onProgress(
          Math.floor((i / validIPs.length) * 100), 
          `Processing batch ${Math.floor(i / maxConcurrent) + 1} of ${Math.ceil(validIPs.length / maxConcurrent)}`
        );
      }

      const batchPromises = batch.map(async (ip) => {
        try {
          const result = await this.runNmapScan(ip, options);
          return { ip, result, success: true };
        } catch (error) {
          return { ip, error: error.message, success: false };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(item => {
        if (item.success) {
          results.push(item);
        } else {
          errors.push(item);
        }
      });
    }

    return { results, errors };
  }
}

// Create singleton instance
const scannerService = new ScannerService();

// Export module functions
module.exports = {
  runNmapScan: (ip, onProgressOrOptions) => {
    if (typeof onProgressOrOptions === 'function') {
      return scannerService.runNmapScan(ip, { onProgress: onProgressOrOptions });
    }
    return scannerService.runNmapScan(ip, onProgressOrOptions || {});
  },
  runBatchScan: (ipList, options) => scannerService.runBatchScan(ipList, options),
  getScanStats: () => scannerService.getScanStats(),
  validateIP: (ip) => scannerService.validateIP(ip),
  pingTest: (ip) => scannerService.pingTest(ip),
  tcpTest: (ip, port, timeout) => scannerService.tcpTest(ip, port, timeout),
  enhancedConnectivityTest: (ip) => scannerService.enhancedConnectivityTest(ip)
};

/**2nd Version */

// const { exec } = require('child_process');
// const os = require('os');
// const parseNmapOutput = require('../utils/parseNmap');
// const vulnerabilityDetection = require('./vulnerabilityDetection');

// /**
//  * Enhanced Scanner Service with cross-platform support and comprehensive vulnerability detection
//  */
// class ScannerService {
//   constructor() {
//     this.defaultTimeout = 300000; // 5 minutes
//     this.maxConcurrentScans = 3;
//     this.activeScanCount = 0;
//     this.platform = os.platform();
//     this.isLinux = this.platform === 'linux';
//     this.isWindows = this.platform === 'win32';
//     this.isMac = this.platform === 'darwin';
//     this.nmapAvailable = null;
//   }

//   /**
//    * Check if nmap is available on the system
//    */
//   async checkNmapAvailability() {
//     if (this.nmapAvailable !== null) {
//       return this.nmapAvailable;
//     }

//     return new Promise((resolve) => {
//       const checkCommand = this.isWindows ? 'where nmap' : 'which nmap';
//       exec(checkCommand, (error, stdout) => {
//         this.nmapAvailable = !error && stdout.trim().length > 0;
//         resolve(this.nmapAvailable);
//       });
//     });
//   }

//   /**
//    * Main scanning function with enhanced vulnerability detection
//    */
//   async runNmapScan(ip, options = {}) {
//     const {
//       onProgress,
//       scanType = 'comprehensive',
//       timeout = this.defaultTimeout,
//       includeVulnScripts = true,
//       fallbackMode = true
//     } = options;

//     // Check nmap availability
//     const nmapExists = await this.checkNmapAvailability();
//     if (!nmapExists) {
//       const errorMsg = 'Nmap is not installed or not available in PATH. Please install nmap first.';
//       if (onProgress) onProgress(0, errorMsg);
      
//       if (fallbackMode) {
//         return this.fallbackScan(ip, onProgress);
//       }
//       throw new Error(errorMsg);
//     }

//     if (this.activeScanCount >= this.maxConcurrentScans) {
//       throw new Error('Maximum concurrent scans reached. Please wait for current scans to complete.');
//     }

//     this.activeScanCount++;

//     try {
//       if (onProgress) onProgress(0, `Initializing scan for ${ip}`);

//       const nmapCommand = this.buildNmapCommand(ip, scanType, includeVulnScripts);
//       if (onProgress) onProgress(10, `Starting ${scanType} scan for ${ip}`);
//       console.log(`Executing: ${nmapCommand}`);

//       const rawOutput = await this.executeNmapCommand(nmapCommand, timeout, onProgress);
//       if (onProgress) onProgress(70, `Parsing scan results for ${ip}`);

//       const parsedResults = await parseNmapOutput(rawOutput);
//       if (onProgress) onProgress(80, `Analyzing vulnerabilities for ${ip}`);

//       const enhancedResults = await this.enhanceResultsWithVulnerabilities(parsedResults, ip, onProgress);
//       if (onProgress) onProgress(100, `Scan completed for ${ip}`);

//       return enhancedResults;
//     } catch (error) {
//       console.error(`Scan error for ${ip}:`, error);
//       if (onProgress) onProgress(0, `Scan failed for ${ip}: ${error.message}`);
//       throw error;
//     } finally {
//       this.activeScanCount--;
//     }
//   }

//   /**
//    * Fallback scan when nmap is not available
//    */
//   async fallbackScan(ip, onProgress) {
//     if (onProgress) onProgress(10, 'Using fallback scan mode (basic connectivity test)');
    
//     const isReachable = await this.pingTest(ip);
    
//     if (onProgress) onProgress(100, 'Fallback scan completed');
    
//     return [{
//       targetIP: ip,
//       port: null,
//       state: isReachable ? 'host-up' : 'host-down',
//       service: 'N/A',
//       version: 'N/A',
//       vulnerabilityScore: 0,
//       vulnerabilities: [],
//       detectionDetails: [],
//       confidence: 0,
//       scannedAt: new Date(),
//       scanMetadata: {
//         scanType: 'fallback',
//         nmapAvailable: false,
//         totalVulnerabilities: 0,
//         highestSeverity: 'None',
//         riskLevel: 'Unknown'
//       }
//     }];
//   }

//   buildNmapCommand(ip, scanType, includeVulnScripts) {
//     let baseCommand = 'nmap';
//     let options = [];

//     // Platform-specific adjustments
//     if (this.isWindows) {
//       // Windows-specific timeout handling
//       options.push('--host-timeout', '900s');
//     }

//     // Common options across all platforms
//     options.push('-Pn');
//     options.push('-T4');
//     options.push('-sV');
//     options.push('--version-intensity', '7');
//     options.push('-oX', '-');

//     // Privilege check considerations
//     const requiresPrivileges = !this.isWindows;

//     switch (scanType) {
//       case 'quick':
//         options.push('-F');
//         if (this.isLinux && requiresPrivileges) {
//           options.push('-sT');
//         } else {
//           options.push('-sS'); // TCP connect scan (no privileges needed)
//         }
//         break;
//       case 'comprehensive':
//         if (this.isLinux && requiresPrivileges) {
//           options.push('-sT');
//           options.push('-p-');
//           options.push('-A');
//         } else {
//           options.push('-sS');
//           options.push('--top-ports', '1000'); // Limit ports on non-Linux
//         }
//         break;
//       case 'stealth':
//         if (this.isLinux && requiresPrivileges) {
//           options.push('-sT');
//           options.push('-T2');
//         } else {
//           options.push('-sS');
//           options.push('-T3'); // Stealth not fully supported without privileges
//         }
//         options.push('--top-ports', '1000');
//         break;
//       case 'udp':
//         if (this.isLinux && requiresPrivileges) {
//           options.push('-sU');
//         } else {
//           // UDP scanning requires privileges, fallback to TCP
//           console.warn('UDP scan requires root/admin privileges. Falling back to TCP scan.');
//           options.push('-sS');
//         }
//         options.push('--top-ports', '100'); // Reduced for UDP
//         break;
//       case 'vulnerability':
//         if (this.isLinux && requiresPrivileges) {
//           options.push('-sT');
//         } else {
//           options.push('-sS');
//         }
//         options.push('--top-ports', '1000');
//         if (includeVulnScripts) {
//           options.push('--script', 'vuln,safe,discovery');
//         }
//         break;
//       default:
//         if (this.isLinux && requiresPrivileges) {
//           options.push('-sT');
//         } else {
//           options.push('-sS');
//         }
//         options.push('--top-ports', '1000');
//     }

//     // Add vulnerability scripts for Linux only (better script support)
//     if (includeVulnScripts && scanType !== 'vulnerability' && this.isLinux) {
//       options.push('--script', 'vulners');
//     }

//     options.push(ip);
//     return `${baseCommand} ${options.join(' ')}`;
//   }

//   executeNmapCommand(command, timeout, onProgress) {
//     return new Promise((resolve, reject) => {
//       const execOptions = {
//         timeout,
//         maxBuffer: 1024 * 1024 * 10
//       };

//       // Windows-specific shell option
//       if (this.isWindows) {
//         execOptions.shell = 'cmd.exe';
//       }

//       const process = exec(command, execOptions, (error, stdout, stderr) => {
//         if (error) {
//           if (error.killed && error.signal === 'SIGTERM') {
//             reject(new Error(`Scan timeout after ${timeout / 1000} seconds`));
//           } else if (error.code === 127 || error.code === 'ENOENT') {
//             reject(new Error('Nmap command not found. Please ensure nmap is installed and in PATH.'));
//           } else if (error.message && error.message.includes('Permission denied')) {
//             reject(new Error('Permission denied. Nmap may require elevated privileges (sudo/admin) for certain scan types.'));
//           } else {
//             reject(new Error(`Nmap execution failed: ${error.message}`));
//           }
//           return;
//         }
//         if (stderr && stderr.trim()) {
//           console.warn('Nmap stderr:', stderr);
//         }
//         resolve(stdout);
//       });

//       let progressPercent = 10;
//       if (process.stdout) {
//         process.stdout.on('data', (data) => {
//           const output = data.toString();
//           if (output.includes('Scanning')) {
//             progressPercent = Math.min(progressPercent + 5, 60);
//             if (onProgress) onProgress(progressPercent, 'Scanning ports...');
//           } else if (output.includes('Service detection')) {
//             progressPercent = 50;
//             if (onProgress) onProgress(progressPercent, 'Detecting services...');
//           } else if (output.includes('NSE')) {
//             progressPercent = 60;
//             if (onProgress) onProgress(progressPercent, 'Running vulnerability scripts...');
//           }
//         });
//       }
//     });
//   }

//   async enhanceResultsWithVulnerabilities(scanResults, targetIP, onProgress) {
//     if (!scanResults || scanResults.length === 0) {
//       return [{
//         targetIP,
//         port: null,
//         state: 'no-results',
//         vulnerabilityScore: 0,
//         vulnerabilities: [],
//         detectionDetails: [],
//         confidence: 0,
//         scannedAt: new Date(),
//         scanMetadata: {
//           totalVulnerabilities: 0,
//           highestSeverity: 'None',
//           riskLevel: 'Unknown'
//         }
//       }];
//     }

//     const enhancedResults = [];
//     const totalResults = scanResults.length;

//     for (let i = 0; i < scanResults.length; i++) {
//       const result = scanResults[i];
//       if (onProgress) {
//         const progress = 80 + Math.floor((i / totalResults) * 15);
//         onProgress(progress, `Analyzing vulnerabilities for port ${result.port}...`);
//       }
//       try {
//         const vulnAnalysis = await vulnerabilityDetection.analyzeScan(result);
//         const enhancedResult = {
//           ...result,
//           targetIP,
//           vulnerabilityScore: vulnAnalysis.vulnerabilityScore || 0,
//           vulnerabilities: vulnAnalysis.vulnerabilities || [],
//           detectionDetails: vulnAnalysis.detectionDetails || [],
//           confidence: vulnAnalysis.confidence || 0,
//           detectionMethods: vulnAnalysis.detectionMethods || [],
//           scanEnhancement: vulnAnalysis.scanEnhancement,
//           scannedAt: new Date(),
//           scanMetadata: {
//             totalVulnerabilities: (vulnAnalysis.detectionDetails || []).length,
//             highestSeverity: this.getHighestSeverity(vulnAnalysis.detectionDetails || []),
//             riskLevel: this.calculateRiskLevel(
//               vulnAnalysis.vulnerabilityScore || 0, 
//               vulnAnalysis.confidence || 0
//             )
//           }
//         };
//         enhancedResults.push(enhancedResult);
//       } catch (error) {
//         console.error(`Error analyzing vulnerabilities for port ${result.port}:`, error);
//         enhancedResults.push({
//           ...result,
//           targetIP,
//           vulnerabilityScore: 0,
//           vulnerabilities: [],
//           detectionDetails: [],
//           confidence: 0,
//           error: error.message,
//           scannedAt: new Date()
//         });
//       }
//     }
//     return enhancedResults;
//   }

//   getHighestSeverity(vulnerabilities) {
//     if (!vulnerabilities || vulnerabilities.length === 0) return 'None';
//     const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
//     for (const severity of severityOrder) {
//       if (vulnerabilities.some(v => v.severity === severity)) return severity;
//     }
//     return 'Unknown';
//   }

//   calculateRiskLevel(vulnerabilityScore, confidence) {
//     if (vulnerabilityScore === 0) return 'Low';
//     const adjustedScore = vulnerabilityScore * (confidence / 100);
//     if (adjustedScore >= 8.0) return 'Critical';
//     if (adjustedScore >= 6.0) return 'High';
//     if (adjustedScore >= 4.0) return 'Medium';
//     return 'Low';
//   }

//   async pingTest(ip) {
//     return new Promise((resolve) => {
//       const pingCommand = this.isWindows 
//         ? `ping -n 1 -w 3000 ${ip}` 
//         : `ping -c 1 -W 3 ${ip}`;
      
//       const successPattern = this.isWindows 
//         ? /Reply from|Received = 1/i
//         : /1 received/;

//       exec(pingCommand, { timeout: 5000 }, (error, stdout) => {
//         resolve(!error && successPattern.test(stdout));
//       });
//     });
//   }

//   getScanStats() {
//     return {
//       activeScanCount: this.activeScanCount,
//       maxConcurrentScans: this.maxConcurrentScans,
//       canStartNewScan: this.activeScanCount < this.maxConcurrentScans,
//       platform: this.platform,
//       nmapAvailable: this.nmapAvailable
//     };
//   }

//   validateIP(ip) {
//     const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
//     if (!ipRegex.test(ip)) return false;
//     return ip.split('.').every(octet => {
//       const num = parseInt(octet, 10);
//       return num >= 0 && num <= 255;
//     });
//   }

//   async runBatchScan(ipList, options = {}) {
//     const results = [];
//     const errors = [];
//     const { maxConcurrent = 2, onProgress } = options;

//     const validIPs = ipList.filter(ip => {
//       if (!this.validateIP(ip)) {
//         errors.push({ ip, error: 'Invalid IP address format' });
//         return false;
//       }
//       return true;
//     });

//     if (validIPs.length === 0) {
//       throw new Error('No valid IP addresses provided');
//     }

//     for (let i = 0; i < validIPs.length; i += maxConcurrent) {
//       const batch = validIPs.slice(i, i + maxConcurrent);
//       if (onProgress) {
//         onProgress(
//           Math.floor((i / validIPs.length) * 100), 
//           `Processing batch ${Math.floor(i / maxConcurrent) + 1}`
//         );
//       }
//       const batchPromises = batch.map(async (ip) => {
//         try {
//           const result = await this.runNmapScan(ip, options);
//           return { ip, result, success: true };
//         } catch (error) {
//           return { ip, error: error.message, success: false };
//         }
//       });
//       const batchResults = await Promise.all(batchPromises);
//       batchResults.forEach(item => {
//         if (item.success) results.push(item); 
//         else errors.push(item);
//       });
//     }

//     return { results, errors };
//   }

//   getPlatformInfo() {
//     return {
//       platform: this.platform,
//       isLinux: this.isLinux,
//       isWindows: this.isWindows,
//       isMac: this.isMac,
//       nmapAvailable: this.nmapAvailable,
//       recommendations: this.getPlatformRecommendations()
//     };
//   }

//   getPlatformRecommendations() {
//     if (this.isWindows) {
//       return {
//         privilegeRequired: 'Run as Administrator for advanced scan types',
//         installGuide: 'Download from https://nmap.org/download.html',
//         limitations: 'Some scan types (SYN, UDP) require admin privileges'
//       };
//     } else if (this.isLinux) {
//       return {
//         privilegeRequired: 'Use sudo for SYN scans (-sS) and UDP scans',
//         installGuide: 'sudo apt-get install nmap (Debian/Ubuntu) or sudo yum install nmap (RHEL/CentOS)',
//         limitations: 'None - full nmap functionality available'
//       };
//     } else if (this.isMac) {
//       return {
//         privilegeRequired: 'Use sudo for advanced scan types',
//         installGuide: 'brew install nmap or download from https://nmap.org/download.html',
//         limitations: 'Some scan types require root privileges'
//       };
//     }
//     return {};
//   }
// }

// const scannerService = new ScannerService();

// module.exports = {
//   runNmapScan: (ip, onProgressOrOptions) => {
//     if (typeof onProgressOrOptions === 'function') {
//       return scannerService.runNmapScan(ip, { onProgress: onProgressOrOptions });
//     }
//     return scannerService.runNmapScan(ip, onProgressOrOptions || {});
//   },
//   runBatchScan: (ipList, options) => scannerService.runBatchScan(ipList, options),
//   getScanStats: () => scannerService.getScanStats(),
//   validateIP: (ip) => scannerService.validateIP(ip),
//   pingTest: (ip) => scannerService.pingTest(ip),
//   checkNmapAvailability: () => scannerService.checkNmapAvailability(),
//   getPlatformInfo: () => scannerService.getPlatformInfo()
// };


