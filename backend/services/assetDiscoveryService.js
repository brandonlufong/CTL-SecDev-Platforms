const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const net = require('net');
const dns = require('dns');
const Asset = require('../models/Asset');
const { createLogger } = require('../utils/logger');

const discoveryLogger = createLogger('asset-discovery');

class AssetDiscoveryService {
  constructor() {
    this.isScanning = false;
    this.currentScan = null;
    this.discoveryQueue = [];
    this.scanResults = [];
  }

  // Network range discovery
  async discoverNetworkRange(networkRange, options = {}) {
    try {
      discoveryLogger.info('Starting network range discovery', {
        details: { networkRange, options }
      });

      this.isScanning = true;
      this.currentScan = {
        type: 'network-range',
        range: networkRange,
        startTime: new Date(),
        status: 'running'
      };

      const {
        ports = '22,23,53,80,135,139,443,445,993,995,1723,3389,5900',
        timeout = 5000,
        maxConcurrent = 50
      } = options;

      // Generate IP list from network range
      const ipList = this.generateIPList(networkRange);
      discoveryLogger.info(`Generated ${ipList.length} IPs to scan`);

      const discoveredAssets = [];
      const portList = ports.split(',').map(p => parseInt(p.trim()));

      // Scan IPs in batches
      for (let i = 0; i < ipList.length; i += maxConcurrent) {
        const batch = ipList.slice(i, i + maxConcurrent);
        const batchResults = await Promise.allSettled(
          batch.map(ip => this.scanSingleIP(ip, portList, timeout))
        );

        const validResults = batchResults
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);

        discoveredAssets.push(...validResults);

        // Update scan progress
        this.currentScan.progress = Math.round(((i + batch.length) / ipList.length) * 100);
        discoveryLogger.info(`Scan progress: ${this.currentScan.progress}%`);
      }

      this.currentScan.status = 'completed';
      this.currentScan.endTime = new Date();
      this.currentScan.assetsFound = discoveredAssets.length;

      discoveryLogger.info('Network discovery completed', {
        details: {
          totalScanned: ipList.length,
          assetsFound: discoveredAssets.length,
          duration: this.currentScan.endTime - this.currentScan.startTime
        }
      });

      return {
        success: true,
        scanId: this.currentScan.id,
        assets: discoveredAssets,
        summary: {
          totalScanned: ipList.length,
          assetsFound: discoveredAssets.length,
          scanDuration: this.currentScan.endTime - this.currentScan.startTime
        }
      };

    } catch (error) {
      discoveryLogger.error('Network discovery failed', {
        details: { error: error.message, networkRange }
      });
      
      this.currentScan.status = 'failed';
      this.currentScan.error = error.message;
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isScanning = false;
    }
  }

  // Scan single IP for open ports and services
  async scanSingleIP(ip, ports, timeout = 5000) {
    try {
      const results = {
        ip,
        hostname: null,
        openPorts: [],
        services: [],
        osGuess: null,
        status: 'offline'
      };

      // Resolve hostname
      try {
        results.hostname = await this.reverseDNSLookup(ip);
      } catch (error) {
        // Hostname resolution failed, continue with IP
      }

      // Scan ports
      const portScanResults = await Promise.allSettled(
        ports.map(port => this.checkPort(ip, port, timeout))
      );

      results.openPorts = portScanResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

      if (results.openPorts.length > 0) {
        results.status = 'online';
        
        // Service detection for open ports
        results.services = await Promise.allSettled(
          results.openPorts.map(port => this.detectService(ip, port))
        );

        results.services = results.services
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);

        // OS fingerprinting (basic)
        results.osGuess = await this.guessOS(ip, results.openPorts);
      }

      return results;

    } catch (error) {
      discoveryLogger.error(`Failed to scan IP ${ip}`, {
        details: { error: error.message }
      });
      return null;
    }
  }

  // Check if port is open
  async checkPort(ip, port, timeout = 5000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let isOpen = false;

      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        isOpen = true;
        socket.destroy();
      });
      
      socket.on('timeout', () => {
        socket.destroy();
      });
      
      socket.on('error', () => {
        socket.destroy();
      });
      
      socket.on('close', () => {
        resolve(isOpen ? port : null);
      });
      
      socket.connect(port, ip);
    });
  }

  // Detect service on port
  async detectService(ip, port) {
    try {
      const serviceMap = {
        21: 'FTP',
        22: 'SSH',
        23: 'Telnet',
        25: 'SMTP',
        53: 'DNS',
        80: 'HTTP',
        110: 'POP3',
        135: 'RPC',
        139: 'NetBIOS',
        143: 'IMAP',
        443: 'HTTPS',
        445: 'SMB',
        993: 'IMAPS',
        995: 'POP3S',
        1723: 'PPTP',
        3389: 'RDP',
        5900: 'VNC'
      };

      const serviceName = serviceMap[port] || `Unknown-${port}`;
      
      // Try to get service banner
      let banner = null;
      try {
        banner = await this.getServiceBanner(ip, port);
      } catch (error) {
        // Banner detection failed
      }

      return {
        port,
        service: serviceName,
        banner,
        detected: new Date()
      };

    } catch (error) {
      return null;
    }
  }

  // Get service banner
  async getServiceBanner(ip, port) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let banner = '';
      
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        socket.on('data', (data) => {
          banner += data.toString();
          socket.destroy();
          resolve(banner.trim());
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout'));
        });
        
        socket.on('error', () => {
          socket.destroy();
          reject(new Error('Connection error'));
        });
      });
      
      socket.on('error', () => {
        reject(new Error('Connection failed'));
      });
      
      socket.connect(port, ip);
    });
  }

  // Basic OS fingerprinting
  async guessOS(ip, openPorts) {
    try {
      // Simple heuristics based on open ports
      if (openPorts.includes(135) || openPorts.includes(445)) {
        return 'Windows';
      } else if (openPorts.includes(22)) {
        return 'Linux/Unix';
      } else if (openPorts.includes(80) || openPorts.includes(443)) {
        return 'Unknown (Web Server)';
      }
      
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  // Reverse DNS lookup
  async reverseDNSLookup(ip) {
    return new Promise((resolve, reject) => {
      dns.reverse(ip, (err, hostnames) => {
        if (err) {
          reject(err);
        } else {
          resolve(hostnames[0] || ip);
        }
      });
    });
  }

  // Generate IP list from network range
  generateIPList(networkRange) {
    const ips = [];
    
    // Support CIDR notation (e.g., 192.168.1.0/24)
    if (networkRange.includes('/')) {
      const [network, cidr] = networkRange.split('/');
      const baseIP = network.split('.').map(Number);
      const subnetBits = parseInt(cidr);
      const hostBits = 32 - subnetBits;
      const numHosts = Math.pow(2, hostBits);
      
      for (let i = 1; i < numHosts - 1; i++) {
        const ip = [...baseIP];
        ip[3] += i;
        
        // Handle overflow
        for (let j = 3; j > 0; j--) {
          if (ip[j] > 255) {
            ip[j] -= 256;
            ip[j - 1] += 1;
          }
        }
        
        ips.push(ip.join('.'));
      }
    } else {
      // Single IP or range
      ips.push(networkRange);
    }
    
    return ips;
  }

  // Import discovered assets into database
  async importDiscoveredAssets(discoveredAssets, options = {}) {
    try {
      discoveryLogger.info('Importing discovered assets', {
        details: { assetCount: discoveredAssets.length }
      });

      const {
        autoCreate = true,
        updateExisting = true,
        defaultCategory = 'Discovered'
      } = options;

      const importResults = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };

      for (const assetData of discoveredAssets) {
        try {
          // Check if asset already exists
          const existingAsset = await Asset.findOne({ ip: assetData.ip });
          
          if (existingAsset) {
            if (updateExisting) {
              // Update existing asset with new discovery data
              existingAsset.status = assetData.status;
              existingAsset.lastScanDate = new Date();
              existingAsset.activeProtocols = assetData.services.map(s => `${s.port}/${s.service}`);
              existingAsset.geoLocation.lastUpdated = new Date();
              
              await existingAsset.save();
              importResults.updated++;
            } else {
              importResults.skipped++;
            }
          } else if (autoCreate) {
            // Create new asset
            const newAsset = new Asset({
              name: assetData.hostname || `Asset-${assetData.ip}`,
              ip: assetData.ip,
              type: this.guessAssetType(assetData),
              status: assetData.status,
              os: assetData.osGuess,
              activeProtocols: assetData.services.map(s => `${s.port}/${s.service}`),
              description: `Auto-discovered asset via network scan`,
              lastScanDate: new Date(),
              discoverySource: 'network-scan',
              discoveryDate: new Date()
            });

            await newAsset.save();
            importResults.created++;
          } else {
            importResults.skipped++;
          }
        } catch (error) {
          importResults.errors.push({
            ip: assetData.ip,
            error: error.message
          });
        }
      }

      discoveryLogger.info('Asset import completed', {
        details: importResults
      });

      return importResults;

    } catch (error) {
      discoveryLogger.error('Asset import failed', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Guess asset type based on discovery data
  guessAssetType(assetData) {
    const { services, osGuess } = assetData;
    
    // Check for database servers
    const dbPorts = [3306, 5432, 1433, 27017, 1521, 6379];
    if (services.some(s => dbPorts.includes(s.port))) {
      return 'Database';
    }
    
    // Check for web servers
    const webPorts = [80, 443, 8080, 8443];
    if (services.some(s => webPorts.includes(s.port))) {
      return 'Application';
    }
    
    // Check for network devices
    if (osGuess.includes('Cisco') || osGuess.includes('Juniper')) {
      return 'Network Device';
    }
    
    // Default to Server
    return 'Server';
  }

  // Get current scan status
  getScanStatus() {
    return {
      isScanning: this.isScanning,
      currentScan: this.currentScan,
      queueLength: this.discoveryQueue.length
    };
  }

  // Cancel current scan
  cancelScan() {
    if (this.isScanning && this.currentScan) {
      this.currentScan.status = 'cancelled';
      this.currentScan.endTime = new Date();
      this.isScanning = false;
      
      discoveryLogger.info('Asset discovery scan cancelled');
      return true;
    }
    return false;
  }
}

// Create singleton instance
const assetDiscoveryService = new AssetDiscoveryService();

module.exports = assetDiscoveryService;
