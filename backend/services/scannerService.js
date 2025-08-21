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

  buildNmapCommand(ip, scanType, includeVulnScripts) {
    let baseCommand = 'nmap';
    let options = [];

    options.push('-Pn');
    options.push('-T4');
    options.push('-sV');
    options.push('--version-intensity', '7');
    options.push('-oX', '-');

    switch (scanType) {
      case 'quick':
        options.push('-F');
        options.push('-sS');
        break;
      case 'comprehensive':
        options.push('-sS');
        options.push('-p-');
        options.push('-A');
        break;
      case 'stealth':
        options.push('-sS');
        options.push('-T2');
        options.push('--top-ports', '1000');
        break;
      case 'udp':
        options.push('-sU');
        options.push('--top-ports', '1000');
        break;
      case 'vulnerability':
        options.push('-sS');
        options.push('--top-ports', '1000');
        if (includeVulnScripts) options.push('--script', 'vuln,safe,discovery');
        break;
      default:
        options.push('-sS');
        options.push('--top-ports', '1000');
    }

    if (includeVulnScripts && scanType !== 'vulnerability') {
      // options.push('--script', 'vulners,vulscan');
      options.push('--script', 'vulners');
    }

    options.push(ip);
    return `${baseCommand} ${options.join(' ')}`;
  }

  executeNmapCommand(command, timeout, onProgress) {
    return new Promise((resolve, reject) => {
      const process = exec(command, {
        timeout,
        maxBuffer: 1024 * 1024 * 10
      }, (error, stdout, stderr) => {
        if (error) {
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
      exec(`ping -c 1 -W 3 ${ip}`, (error, stdout) => {
        resolve(!error && stdout.includes('1 received'));
      });
    });
  }

  getScanStats() {
    return {
      activeScanCount: this.activeScanCount,
      maxConcurrentScans: this.maxConcurrentScans,
      canStartNewScan: this.activeScanCount < this.maxConcurrentScans
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
        if (item.success) results.push(item); else errors.push(item);
      });
    }

    return { results, errors };
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
  pingTest: (ip) => scannerService.pingTest(ip)
};

