// const { exec } = require('child_process');
// const parseNmapOutput = require('../utils/parseNmap');
// const vulnerabilityDetection = require('./vulnerabilityDetection');

// /**
//  * Enhanced Scanner Service with comprehensive vulnerability detection
//  */
// class ScannerService {
//   constructor() {
//     this.defaultTimeout = 300000; // 5 minutes
//     this.maxConcurrentScans = 3;
//     this.activeScanCount = 0;
//   }

//   /**
//    * Main scanning function with enhanced vulnerability detection
//    */
//   async runNmapScan(ip, options = {}) {
//     const {
//       onProgress,
//       scanType = 'comprehensive',
//       timeout = this.defaultTimeout,
//       includeVulnScripts = true
//     } = options;

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

//   buildNmapCommand(ip, scanType, includeVulnScripts) {
//     let baseCommand = 'nmap';
//     let options = [];

//     options.push('-Pn');
//     options.push('-T4');
//     options.push('-sV');
//     options.push('--version-intensity', '7');
//     options.push('-oX', '-');

//     switch (scanType) {
//       case 'quick':
//         options.push('-F');
//         options.push('-sS');
//         break;
//       case 'comprehensive':
//         options.push('-sS');
//         options.push('-p-');
//         options.push('-A');
//         break;
//       case 'stealth':
//         options.push('-sS');
//         options.push('-T2');
//         options.push('--top-ports', '1000');
//         break;
//       case 'udp':
//         options.push('-sU');
//         options.push('--top-ports', '1000');
//         break;
//       case 'vulnerability':
//         options.push('-sS');
//         options.push('--top-ports', '1000');
//         if (includeVulnScripts) options.push('--script', 'vuln,safe,discovery');
//         break;
//       default:
//         options.push('-sS');
//         options.push('--top-ports', '1000');
//     }

//     if (includeVulnScripts && scanType !== 'vulnerability') {
//       // options.push('--script', 'vulners,vulscan');
//       options.push('--script', 'vulners');
//     }

//     options.push(ip);
//     return `${baseCommand} ${options.join(' ')}`;
//   }

//   executeNmapCommand(command, timeout, onProgress) {
//     return new Promise((resolve, reject) => {
//       const process = exec(command, {
//         timeout,
//         maxBuffer: 1024 * 1024 * 10
//       }, (error, stdout, stderr) => {
//         if (error) {
//           if (error.killed && error.signal === 'SIGTERM') {
//             reject(new Error(`Scan timeout after ${timeout / 1000} seconds`));
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
//           vulnerabilityScore: vulnAnalysis.vulnerabilityScore,
//           vulnerabilities: vulnAnalysis.vulnerabilities,
//           detectionDetails: vulnAnalysis.detectionDetails,
//           confidence: vulnAnalysis.confidence,
//           detectionMethods: vulnAnalysis.detectionMethods,
//           scanEnhancement: vulnAnalysis.scanEnhancement,
//           scannedAt: new Date(),
//           scanMetadata: {
//             totalVulnerabilities: vulnAnalysis.detectionDetails.length,
//             highestSeverity: this.getHighestSeverity(vulnAnalysis.detectionDetails),
//             riskLevel: this.calculateRiskLevel(vulnAnalysis.vulnerabilityScore, vulnAnalysis.confidence)
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
//       exec(`ping -c 1 -W 3 ${ip}`, (error, stdout) => {
//         resolve(!error && stdout.includes('1 received'));
//       });
//     });
//   }

//   getScanStats() {
//     return {
//       activeScanCount: this.activeScanCount,
//       maxConcurrentScans: this.maxConcurrentScans,
//       canStartNewScan: this.activeScanCount < this.maxConcurrentScans
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
//         onProgress(Math.floor((i / validIPs.length) * 100), `Processing batch ${Math.floor(i / maxConcurrent) + 1}`);
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
//         if (item.success) results.push(item); else errors.push(item);
//       });
//     }

//     return { results, errors };
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
//   pingTest: (ip) => scannerService.pingTest(ip)
// };

/**2nd Version */

const { exec } = require('child_process');
const os = require('os');
const parseNmapOutput = require('../utils/parseNmap');
const vulnerabilityDetection = require('./vulnerabilityDetection');

/**
 * Enhanced Scanner Service with cross-platform support and comprehensive vulnerability detection
 */
class ScannerService {
  constructor() {
    this.defaultTimeout = 300000; // 5 minutes
    this.maxConcurrentScans = 3;
    this.activeScanCount = 0;
    this.platform = os.platform();
    this.isLinux = this.platform === 'linux';
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.nmapAvailable = null;
    // On Linux, many scan types require raw socket privileges. Detect if we're root.
    this.isRoot = typeof process.geteuid === 'function' ? process.geteuid() === 0 : false;
  }

  /**
   * Check if nmap is available on the system
   */
  async checkNmapAvailability() {
    if (this.nmapAvailable !== null) {
      return this.nmapAvailable;
    }

    return new Promise((resolve) => {
      const checkCommand = this.isWindows ? 'where nmap' : 'which nmap';
      exec(checkCommand, (error, stdout) => {
        this.nmapAvailable = !error && stdout.trim().length > 0;
        resolve(this.nmapAvailable);
      });
    });
  }

  /**
   * Main scanning function with enhanced vulnerability detection
   */
  async runNmapScan(ip, options = {}) {
    const {
      onProgress,
      scanType = 'comprehensive',
      timeout = this.defaultTimeout,
      includeVulnScripts = true,
      fallbackMode = true
    } = options;

    // Check nmap availability
    const nmapExists = await this.checkNmapAvailability();
    if (!nmapExists) {
      const errorMsg = 'Nmap is not installed or not available in PATH. Please install nmap first.';
      if (onProgress) onProgress(0, errorMsg);
      
      if (fallbackMode) {
        return this.fallbackScan(ip, onProgress);
      }
      throw new Error(errorMsg);
    }

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
   * Fallback scan when nmap is not available
   */
  async fallbackScan(ip, onProgress) {
    if (onProgress) onProgress(10, 'Using fallback scan mode (basic connectivity test)');
    
    const isReachable = await this.pingTest(ip);
    
    if (onProgress) onProgress(100, 'Fallback scan completed');
    
    return [{
      targetIP: ip,
      port: null,
      state: isReachable ? 'host-up' : 'host-down',
      service: 'N/A',
      version: 'N/A',
      vulnerabilityScore: 0,
      vulnerabilities: [],
      detectionDetails: [],
      confidence: 0,
      scannedAt: new Date(),
      scanMetadata: {
        scanType: 'fallback',
        nmapAvailable: false,
        totalVulnerabilities: 0,
        highestSeverity: 'None',
        riskLevel: 'Unknown'
      }
    }];
  }

  buildNmapCommand(ip, scanType, includeVulnScripts) {
    let baseCommand = 'nmap';
    let options = [];

    // Platform-specific adjustments
    if (this.isWindows) {
      // Windows-specific timeout handling
      options.push('--host-timeout', '900s');
    }

    // Common options across all platforms
    options.push('-Pn');
    options.push('-T4');
    options.push('-sV');
    options.push('--version-intensity', '7');
    options.push('-oX', '-');

    // Privilege check considerations
    // Raw socket scans like -sS (SYN) and -sU (UDP) need root/admin privileges on Linux/macOS.
    const hasRawPrivileges = (this.isLinux || this.isMac) && this.isRoot;

    switch (scanType) {
      case 'quick':
        options.push('-F');
        options.push(hasRawPrivileges ? '-sS' : '-sT'); // Prefer SYN if privileged, else TCP connect
        break;
      case 'comprehensive':
        options.push(hasRawPrivileges ? '-sS' : '-sT');
        // All ports if possible; otherwise keep it sane
        options.push(hasRawPrivileges ? '-p-' : '--top-ports');
        if (!hasRawPrivileges) options.push('1000');
        // -A includes OS detection (-O) which needs raw sockets. Only include when privileged.
        if (hasRawPrivileges) options.push('-A');
        break;
      case 'stealth':
        options.push(hasRawPrivileges ? '-sS' : '-sT');
        options.push(hasRawPrivileges ? '-T2' : '-T3');
        options.push('--top-ports', '1000');
        break;
      case 'udp':
        if (hasRawPrivileges) {
          options.push('-sU');
          options.push('--top-ports', '100'); // Reduced for UDP
        } else {
          // UDP scanning requires privileges, fallback gracefully
          console.warn('UDP scan requires root/admin privileges. Falling back to TCP connect scan.');
          options.push('-sT');
          options.push('--top-ports', '100');
        }
        break;
      case 'vulnerability':
        options.push(hasRawPrivileges ? '-sS' : '-sT');
        options.push('--top-ports', '1000');
        if (includeVulnScripts) {
          options.push('--script', 'vuln,safe,discovery');
        }
        break;
      default:
        options.push(hasRawPrivileges ? '-sS' : '-sT');
        options.push('--top-ports', '1000');
    }

    // Add vulnerability scripts for Linux only (better script support)
    if (includeVulnScripts && scanType !== 'vulnerability' && this.isLinux) {
      options.push('--script', 'vulners');
    }

    options.push(ip);
    return `${baseCommand} ${options.join(' ')}`;
  }

  executeNmapCommand(command, timeout, onProgress) {
    return new Promise((resolve, reject) => {
      const execOptions = {
        timeout,
        maxBuffer: 1024 * 1024 * 10
      };

      // Windows-specific shell option
      if (this.isWindows) {
        execOptions.shell = 'cmd.exe';
      }

      const process = exec(command, execOptions, (error, stdout, stderr) => {
        if (error) {
          if (error.killed && error.signal === 'SIGTERM') {
            reject(new Error(`Scan timeout after ${timeout / 1000} seconds`));
          } else if (error.code === 127 || error.code === 'ENOENT') {
            reject(new Error('Nmap command not found. Please ensure nmap is installed and in PATH.'));
          } else if (error.message && error.message.includes('Permission denied')) {
            reject(new Error('Permission denied. Nmap may require elevated privileges (sudo/admin) for certain scan types.'));
          } else {
            reject(new Error(`Nmap execution failed: ${error.message}`));
          }
          return;
        }
        if (stderr && stderr.trim()) {
          console.warn('Nmap stderr:', stderr);
        }
        resolve(stdout);
      });

      let progressPercent = 10;
      if (process.stdout) {
        process.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Scanning')) {
            progressPercent = Math.min(progressPercent + 5, 60);
            if (onProgress) onProgress(progressPercent, 'Scanning ports...');
          } else if (output.includes('Service detection')) {
            progressPercent = 50;
            if (onProgress) onProgress(progressPercent, 'Detecting services...');
          } else if (output.includes('NSE')) {
            progressPercent = 60;
            if (onProgress) onProgress(progressPercent, 'Running vulnerability scripts...');
          }
        });
      }
    });
  }

  async enhanceResultsWithVulnerabilities(scanResults, targetIP, onProgress) {
    if (!scanResults || scanResults.length === 0) {
      return [{
        targetIP,
        port: null,
        state: 'no-results',
        vulnerabilityScore: 0,
        vulnerabilities: [],
        detectionDetails: [],
        confidence: 0,
        scannedAt: new Date(),
        scanMetadata: {
          totalVulnerabilities: 0,
          highestSeverity: 'None',
          riskLevel: 'Unknown'
        }
      }];
    }

    const enhancedResults = [];
    const totalResults = scanResults.length;

    for (let i = 0; i < scanResults.length; i++) {
      const result = scanResults[i];
      if (onProgress) {
        const progress = 80 + Math.floor((i / totalResults) * 15);
        onProgress(progress, `Analyzing vulnerabilities for port ${result.port}...`);
      }
      try {
        const vulnAnalysis = await vulnerabilityDetection.analyzeScan(result);
        const enhancedResult = {
          ...result,
          targetIP,
          vulnerabilityScore: vulnAnalysis.vulnerabilityScore || 0,
          vulnerabilities: vulnAnalysis.vulnerabilities || [],
          detectionDetails: vulnAnalysis.detectionDetails || [],
          confidence: vulnAnalysis.confidence || 0,
          detectionMethods: vulnAnalysis.detectionMethods || [],
          scanEnhancement: vulnAnalysis.scanEnhancement,
          scannedAt: new Date(),
          scanMetadata: {
            totalVulnerabilities: (vulnAnalysis.detectionDetails || []).length,
            highestSeverity: this.getHighestSeverity(vulnAnalysis.detectionDetails || []),
            riskLevel: this.calculateRiskLevel(
              vulnAnalysis.vulnerabilityScore || 0, 
              vulnAnalysis.confidence || 0
            )
          }
        };
        enhancedResults.push(enhancedResult);
      } catch (error) {
        console.error(`Error analyzing vulnerabilities for port ${result.port}:`, error);
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

  async pingTest(ip) {
    return new Promise((resolve) => {
      const pingCommand = this.isWindows 
        ? `ping -n 1 -w 3000 ${ip}` 
        : `ping -c 1 -W 3 ${ip}`;
      
      const successPattern = this.isWindows 
        ? /Reply from|Received = 1/i
        : /1 received/;

      exec(pingCommand, { timeout: 5000 }, (error, stdout) => {
        resolve(!error && successPattern.test(stdout));
      });
    });
  }

  getScanStats() {
    return {
      activeScanCount: this.activeScanCount,
      maxConcurrentScans: this.maxConcurrentScans,
      canStartNewScan: this.activeScanCount < this.maxConcurrentScans,
      platform: this.platform,
      nmapAvailable: this.nmapAvailable
    };
  }

  validateIP(ip) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    return ip.split('.').every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

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
          `Processing batch ${Math.floor(i / maxConcurrent) + 1}`
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
        if (item.success) results.push(item); 
        else errors.push(item);
      });
    }

    return { results, errors };
  }

  getPlatformInfo() {
    return {
      platform: this.platform,
      isLinux: this.isLinux,
      isWindows: this.isWindows,
      isMac: this.isMac,
      nmapAvailable: this.nmapAvailable,
      recommendations: this.getPlatformRecommendations()
    };
  }

  getPlatformRecommendations() {
    if (this.isWindows) {
      return {
        privilegeRequired: 'Run as Administrator for advanced scan types',
        installGuide: 'Download from https://nmap.org/download.html',
        limitations: 'Some scan types (SYN, UDP) require admin privileges'
      };
    } else if (this.isLinux) {
      return {
        privilegeRequired: 'Use sudo for SYN scans (-sS) and UDP scans',
        installGuide: 'sudo apt-get install nmap (Debian/Ubuntu) or sudo yum install nmap (RHEL/CentOS)',
        limitations: 'None - full nmap functionality available'
      };
    } else if (this.isMac) {
      return {
        privilegeRequired: 'Use sudo for advanced scan types',
        installGuide: 'brew install nmap or download from https://nmap.org/download.html',
        limitations: 'Some scan types require root privileges'
      };
    }
    return {};
  }
}

const scannerService = new ScannerService();

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
  checkNmapAvailability: () => scannerService.checkNmapAvailability(),
  getPlatformInfo: () => scannerService.getPlatformInfo()
};


