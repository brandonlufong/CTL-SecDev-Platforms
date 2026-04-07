const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class NetworkDetectionService {
  constructor() {
    this.logger = {
      info: (message, meta = {}) => console.log(`[INFO] network-detection: ${message}`, meta),
      error: (message, meta = {}) => console.error(`[ERROR] network-detection: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] network-detection: ${message}`, meta)
    };
  }

  /**
   * Get local network interfaces and their configurations
   */
  async getLocalNetworkInterfaces() {
    try {
      const interfaces = os.networkInterfaces();
      const activeInterfaces = [];

      for (const [name, configs] of Object.entries(interfaces)) {
        // Filter out internal and non-IPv4 interfaces
        const ipv4Configs = configs.filter(config => 
          config.family === 'IPv4' && 
          !config.internal &&
          config.address !== '127.0.0.1'
        );

        if (ipv4Configs.length > 0) {
          activeInterfaces.push({
            name,
            configs: ipv4Configs
          });
        }
      }

      this.logger.info('Found active network interfaces', {
        details: { count: activeInterfaces.length, interfaces: activeInterfaces }
      });

      return activeInterfaces;
    } catch (error) {
      this.logger.error('Failed to get network interfaces', {
        details: { error: error.message }
      });
      return [];
    }
  }

  /**
   * Calculate network range from IP and subnet mask
   */
  calculateNetworkRange(ip, netmask) {
    try {
      const ipParts = ip.split('.').map(Number);
      const maskParts = netmask.split('.').map(Number);
      
      // Calculate network address
      const networkParts = ipParts.map((part, index) => part & maskParts[index]);
      const networkAddress = networkParts.join('.');

      // Calculate broadcast address
      const invertedMaskParts = maskParts.map(part => 255 - part);
      const broadcastParts = networkParts.map((part, index) => part | invertedMaskParts[index]);
      const broadcastAddress = broadcastParts.join('.');

      // Count bits in subnet mask for CIDR notation
      const cidr = maskParts.reduce((count, part) => {
        return count + part.toString(2).split('1').length - 1;
      }, 0);

      return {
        network: networkAddress,
        broadcast: broadcastAddress,
        cidr: `${networkAddress}/${cidr}`,
        ip: ip,
        netmask: netmask,
        cidrNumber: cidr
      };
    } catch (error) {
      this.logger.error('Failed to calculate network range', {
        details: { ip, netmask, error: error.message }
      });
      return null;
    }
  }

  /**
   * Get default gateway for network routing
   */
  async getDefaultGateway() {
    try {
      let command;
      
      if (process.platform === 'win32') {
        command = 'ipconfig | findstr "Default Gateway"';
      } else if (process.platform === 'darwin') {
        command = 'netstat -rn | grep default';
      } else {
        command = 'ip route | grep default';
      }

      const { stdout } = await execPromise(command);
      
      if (process.platform === 'win32') {
        const match = stdout.match(/Default Gateway.*: (\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
      } else {
        const match = stdout.match(/default\s+(\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
      }
    } catch (error) {
      this.logger.error('Failed to get default gateway', {
        details: { error: error.message }
      });
      return null;
    }
  }

  /**
   * Get DNS servers
   */
  async getDNSServers() {
    try {
      let command;
      
      if (process.platform === 'win32') {
        command = 'nslookup localhost';
      } else {
        command = 'cat /etc/resolv.conf | grep nameserver';
      }

      const { stdout } = await execPromise(command);
      const dnsServers = [];
      
      if (process.platform === 'win32') {
        const matches = stdout.match(/Server:\s*(\d+\.\d+\.\d+\.\d+)/g);
        if (matches) {
          matches.forEach(match => {
            const ip = match.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ip) dnsServers.push(ip[1]);
          });
        }
      } else {
        const lines = stdout.split('\n');
        lines.forEach(line => {
          const match = line.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
          if (match) dnsServers.push(match[1]);
        });
      }

      return dnsServers;
    } catch (error) {
      this.logger.error('Failed to get DNS servers', {
        details: { error: error.message }
      });
      return [];
    }
  }

  /**
   * Detect current network configuration and suggest scan ranges
   */
  async detectNetworkConfiguration() {
    try {
      this.logger.info('Starting network configuration detection');

      const interfaces = await this.getLocalNetworkInterfaces();
      const defaultGateway = await this.getDefaultGateway();
      const dnsServers = await this.getDNSServers();

      const networkRanges = [];

      for (const interfaceInfo of interfaces) {
        for (const config of interfaceInfo.configs) {
          const networkRange = this.calculateNetworkRange(config.address, config.netmask);
          
          if (networkRange) {
            networkRanges.push({
              interface: interfaceInfo.name,
              ...networkRange,
              isPrimary: config.address === defaultGateway || 
                       (defaultGateway && this.isInSameNetwork(config.address, defaultGateway, config.netmask))
            });
          }
        }
      }

      // Sort by priority (primary interfaces first)
      networkRanges.sort((a, b) => b.isPrimary - a.isPrimary);

      const result = {
        interfaces: interfaces,
        defaultGateway: defaultGateway,
        dnsServers: dnsServers,
        networkRanges: networkRanges,
        recommendedRanges: this.getRecommendedScanRanges(networkRanges),
        timestamp: new Date()
      };

      this.logger.info('Network configuration detected successfully', {
        details: { 
          interfaces: interfaces.length,
          networkRanges: networkRanges.length,
          defaultGateway,
          dnsServers: dnsServers.length
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to detect network configuration', {
        details: { error: error.message }
      });
      return null;
    }
  }

  /**
   * Check if two IPs are in the same network
   */
  isInSameNetwork(ip1, ip2, netmask) {
    try {
      const ip1Parts = ip1.split('.').map(Number);
      const ip2Parts = ip2.split('.').map(Number);
      const maskParts = netmask.split('.').map(Number);

      for (let i = 0; i < 4; i++) {
        if ((ip1Parts[i] & maskParts[i]) !== (ip2Parts[i] & maskParts[i])) {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get recommended scan ranges based on network size
   */
  getRecommendedScanRanges(networkRanges) {
    const recommendations = [];

    for (const range of networkRanges) {
      const recommendation = {
        ...range,
        scanStrategy: this.getScanStrategy(range.cidrNumber),
        estimatedHosts: this.estimateHosts(range.cidrNumber),
        scanTime: this.estimateScanTime(range.cidrNumber)
      };
      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Determine scan strategy based on network size
   */
  getScanStrategy(cidr) {
    if (cidr <= 24) {
      return 'full'; // Scan entire network for small networks
    } else if (cidr <= 20) {
      return 'sampled'; // Sample scan for medium networks
    } else {
      return 'targeted'; // Targeted scan for large networks
    }
  }

  /**
   * Estimate number of hosts in CIDR range
   */
  estimateHosts(cidr) {
    return Math.pow(2, 32 - cidr) - 2; // Subtract network and broadcast addresses
  }

  /**
   * Estimate scan time based on network size
   */
  estimateScanTime(cidr) {
    const hosts = this.estimateHosts(cidr);
    const avgTimePerHost = 0.1; // 100ms per host average
    const totalSeconds = hosts * avgTimePerHost;
    
    if (totalSeconds < 60) {
      return `${Math.round(totalSeconds)} seconds`;
    } else if (totalSeconds < 3600) {
      return `${Math.round(totalSeconds / 60)} minutes`;
    } else {
      return `${Math.round(totalSeconds / 3600)} hours`;
    }
  }

  /**
   * Get common network ranges for home/office environments
   */
  getCommonNetworkRanges() {
    return [
      { cidr: '192.168.1.0/24', type: 'home', description: 'Typical home network' },
      { cidr: '192.168.0.0/24', type: 'home', description: 'Alternative home network' },
      { cidr: '192.168.10.0/24', type: 'office', description: 'Small office network' },
      { cidr: '10.0.0.0/24', type: 'enterprise', description: 'Enterprise network' },
      { cidr: '172.16.0.0/24', type: 'enterprise', description: 'Private enterprise network' },
      { cidr: '192.168.100.0/24', type: 'office', description: 'Office network segment' }
    ];
  }

  /**
   * Validate if a network range is reachable
   */
  async validateNetworkRange(networkRange) {
    try {
      // Extract network address from CIDR
      const [networkAddress] = networkRange.split('/');
      
      // Try to ping the network address (or gateway)
      const command = process.platform === 'win32' 
        ? `ping -n 1 ${networkAddress}`
        : `ping -c 1 ${networkAddress}`;

      await execPromise(command, { timeout: 5000 });
      
      return {
        reachable: true,
        networkRange,
        message: 'Network is reachable'
      };
    } catch (error) {
      return {
        reachable: false,
        networkRange,
        message: 'Network may not be reachable'
      };
    }
  }
}

module.exports = new NetworkDetectionService();
