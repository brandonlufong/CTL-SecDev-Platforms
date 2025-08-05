// // services/scannerService.js
// const { exec } = require('child_process');

// const runNmapScan = (ip) => {
//   return new Promise((resolve, reject) => {
//     const cmd = `nmap -sV ${ip} -oX -`; // XML output
//     exec(cmd, { timeout: 15000 }, (err, stdout) => {
//       if (err) return reject(err);
//       resolve(stdout);
//     });
//   });
// };

// module.exports = { runNmapScan };
// const { exec } = require('child_process');
// const parseNmapOutput = require('../utils/parseNmap'); // We'll write this next

// exports.runNmapScan = (ip) => {
//   return new Promise((resolve, reject) => {
//     const cmd = `nmap -sS -Pn ${ip}`; // TCP SYN scan, no ping

//     exec(cmd, (err, stdout, stderr) => {
//       if (err) {
//         console.error(`nmap error for IP ${ip}:`, stderr);
//         return reject(stderr);
//       }

//       const results = parseNmapOutput(stdout, ip);
//       resolve(results);
//     });
//   });
// };
// const { exec } = require('child_process');
// const parseNmapOutput = require('../utils/parseNmap');

// exports.runNmapScan = (ip, onProgress) => {
//   return new Promise((resolve, reject) => {
//     // Optionally: call onProgress with start message
//     if (onProgress) onProgress(0, `Starting scan for ${ip}`);

//     const cmd = `nmap -sS -Pn ${ip}`; // TCP SYN scan, no ping

//     exec(cmd, (err, stdout, stderr) => {
//       if (err) {
//         console.error(`nmap error for IP ${ip}:`, stderr);
//         return reject(stderr);
//       }

//       if (onProgress) onProgress(100, `Completed scan for ${ip}`);

//       const results = parseNmapOutput(stdout, ip);
//       resolve(results);
//     });
//   });
// };
const { exec } = require('child_process');
const parseNmapOutput = require('../utils/parseNmap');
const vulnerabilityDetection = require('./vulnerabilityDetection');

/**
 * Enhanced Scanner Service with comprehensive vulnerability detection
 */
class ScannerService {
  constructor() {
    this.defaultTimeout = 300000; // 5 minutes
    this.maxConcurrentScans = 3;
    this.activeScanCount = 0;
  }

  /**
   * Main scanning function with enhanced vulnerability detection
   */
  async runNmapScan(ip, options = {}) {
    const {
      onProgress,
      scanType = 'comprehensive',
      timeout = this.defaultTimeout,
      includeVulnScripts = true
    } = options;

    // Check concurrent scan limit
    if (this.activeScanCount >= this.maxConcurrentScans) {
      throw new Error('Maximum concurrent scans reached. Please wait for current scans to complete.');
    }

    this.activeScanCount++;

    try {
      if (onProgress) onProgress(0, `Initializing scan for ${ip}`);

      // Build Nmap command based on scan type
      const nmapCommand = this.buildNmapCommand(ip, scanType, includeVulnScripts);
      
      if (onProgress) onProgress(10, `Starting ${scanType} scan for ${ip}`);
      console.log(`Executing: ${nmapCommand}`);

      // Execute the scan
      const rawOutput = await this.executeNmapCommand(nmapCommand, timeout, onProgress);
      
      if (onProgress) onProgress(70, `Parsing scan results for ${ip}`);

      // Parse the output
      const parsedResults = await parseNmapOutput(rawOutput);
      
      if (onProgress) onProgress(80, `Analyzing vulnerabilities for ${ip}`);

      // Enhance each result with vulnerability analysis
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
   * Build Nmap command based on scan type and options
   */
  buildNmapCommand(ip, scanType, includeVulnScripts) {
    let baseCommand = 'nmap';
    let options = [];

    // Common options
    options.push('-Pn'); // Skip ping
    options.push('-T4'); // Aggressive timing
    options.push('-sV'); // Version detection
    options.push('--version-intensity', '7'); // More aggressive version detection
    options.push('-oX', '-'); // XML output to stdout

    switch (scanType) {
      case 'quick':
        options.push('-F'); // Fast scan (top 100 ports)
        options.push('-sS'); // SYN scan
        break;

      case 'comprehensive':
        options.push('-sS'); // SYN scan
        options.push('-p-'); // All ports (1-65535)
        options.push('-A'); // Aggressive scan (OS detection, version detection, script scanning, traceroute)
        break;

      case 'stealth':
        options.push('-sS'); // SYN scan
        options.push('-T2'); // Polite timing
        options.push('--top-ports', '1000');
        break;

      case 'udp':
        options.push('-sU'); // UDP scan
        options.push('--top-ports', '100');
        break;

      case 'vulnerability':
        options.push('-sS'); // SYN scan
        options.push('--top-ports', '1000');
        if (includeVulnScripts) {
          options.push('--script', 'vuln,safe,discovery');
        }
        break;

      default:
        // Default to comprehensive
        options.push('-sS');
        options.push('--top-ports', '1000');
    }

    // Add vulnerability detection scripts if requested
    if (includeVulnScripts && scanType !== 'vulnerability') {
      options.push('--script', 'vulners,vulscan');
    }

    // Add the target IP
    options.push(ip);

    return `${baseCommand} ${options.join(' ')}`;
  }

  /**
   * Execute Nmap command with progress tracking
   */
  executeNmapCommand(command, timeout, onProgress) {
    return new Promise((resolve, reject) => {
      const process = exec(command, { 
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
      }, (error, stdout, stderr) => {
        if (error) {
          // Check if it's a timeout error
          if (error.killed && error.signal === 'SIGTERM') {
            reject(new Error(`Scan timeout after ${timeout / 1000} seconds`));
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

      // Track progress based on Nmap output
      let progressPercent = 10;
      if (process.stdout) {
        process.stdout.on('data', (data) => {
          const output = data.toString();
          
          // Look for progress indicators in Nmap output
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

  /**
   * Enhance scan results with vulnerability analysis
   */
  async enhanceResultsWithVulnerabilities(scanResults, targetIP, onProgress) {
    const enhancedResults = [];
    const totalResults = scanResults.length;

    for (let i = 0; i < scanResults.length; i++) {
      const result = scanResults[i];
      
      if (onProgress) {
        const progress = 80 + Math.floor((i / totalResults) * 15);
        onProgress(progress, `Analyzing vulnerabilities for port ${result.port}...`);
      }

      try {
        // Perform vulnerability analysis
        const vulnAnalysis = await vulnerabilityDetection.analyzeScan(result);

        // Create enhanced result
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
            riskLevel: this.calculateRiskLevel(vulnAnalysis.vulnerabilityScore, vulnAnalysis.confidence)
          }
        };

        enhancedResults.push(enhancedResult);

      } catch (error) {
        console.error(`Error analyzing vulnerabilities for port ${result.port}:`, error);
        
        // Add result without vulnerability analysis
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

  /**
   * Get the highest severity level from vulnerability details
   */
  getHighestSeverity(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return 'None';

    const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
    
    for (const severity of severityOrder) {
      if (vulnerabilities.some(v => v.severity === severity)) {
        return severity;
      }
    }

    return 'Unknown';
  }

  /**
   * Calculate overall risk level based on vulnerability score and confidence
   */
  calculateRiskLevel(vulnerabilityScore, confidence) {
    if (vulnerabilityScore === 0) return 'Low';

    const adjustedScore = vulnerabilityScore * (confidence / 100);

    if (adjustedScore >= 8.0) return 'Critical';
    if (adjustedScore >= 6.0) return 'High';
    if (adjustedScore >= 4.0) return 'Medium';
    return 'Low';
  }

  /**
   * Run a quick connectivity test
   */
  async pingTest(ip) {
    return new Promise((resolve) => {
      exec(`ping -c 1 -W 3 ${ip}`, (error, stdout) => {
        resolve(!error && stdout.includes('1 received'));
      });
    });
  }

  /**
   * Get scan statistics
   */
  getScanStats() {
    return {
      activeScanCount: this.activeScanCount,
      maxConcurrentScans: this.maxConcurrentScans,
      canStartNewScan: this.activeScanCount < this.maxConcurrentScans
    };
  }

  /**
   * Validate IP address format
   */
  validateIP(ip) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    return ip.split('.').every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Run multiple scans in parallel (with concurrency control)
   */
  async runBatchScan(ipList, options = {}) {
    const results = [];
    const errors = [];
    const { maxConcurrent = 2, onProgress } = options;

    // Validate all IPs first
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

    // Process IPs in batches
    for (let i = 0; i < validIPs.length; i += maxConcurrent) {
      const batch = validIPs.slice(i, i + maxConcurrent);
      
      if (onProgress) {
        onProgress(Math.floor((i / validIPs.length) * 100), `Processing batch ${Math.floor(i / maxConcurrent) + 1}`);
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

// Export singleton instance
const scannerService = new ScannerService();

// Legacy export for backward compatibility
module.exports = {
  runNmapScan: (ip, onProgress) => scannerService.runNmapScan(ip, { onProgress }),
  runBatchScan: (ipList, options) => scannerService.runBatchScan(ipList, options),
  getScanStats: () => scannerService.getScanStats(),
  validateIP: (ip) => scannerService.validateIP(ip),
  pingTest: (ip) => scannerService.pingTest(ip)
};


// const { exec } = require('child_process');
// const parseNmapXml = require('../utils/parseNmap'); // You’ll create this next

// exports.runNmapScan = (ip) => {
//   return new Promise((resolve, reject) => {
//     const cmd = `nmap -sV --script vulners -oX - ${ip}`;

//     exec(cmd, async (err, stdout, stderr) => {
//       if (err) {
//         console.error(`Nmap error for IP ${ip}:`, stderr);
//         return reject(stderr);
//       }

//       try {
//         const parsedResults = await parseNmapXml(stdout, ip);
//         resolve(parsedResults);
//       } catch (e) {
//         console.error('Parse error:', e.message);
//         reject(e.message);
//       }
//     });
//   });
// };

