const Asset = require('../models/Asset');
const { AssetClassification } = require('../models/AssetClassification');
const { createLogger } = require('../utils/logger');
const net = require('net');
const ping = require('ping');
const isReachable = require('is-reachable');

const monitoringLogger = createLogger('asset-monitoring');

class AssetMonitoringService {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.healthChecks = new Map(); // Store health check results
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      consecutiveFailures: 3,
      memoryUsage: 90,
      cpuUsage: 90
    };
    this.alerts = [];
  }

  // Start real-time monitoring
  start(intervalMinutes = 5) {
    if (this.isMonitoring) {
      monitoringLogger.warn('Asset monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    monitoringLogger.info(`Starting asset monitoring with ${intervalMinutes} minute intervals`);

    // Initial health check
    this.performHealthChecks();

    // Set up recurring monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, intervalMs);

    monitoringLogger.info('Asset monitoring started successfully');
  }

  // Stop monitoring
  stop() {
    if (!this.isMonitoring) {
      monitoringLogger.warn('Asset monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    monitoringLogger.info('Asset monitoring stopped');
  }

  // Perform health checks on all assets
  async performHealthChecks() {
    try {
      monitoringLogger.info('Performing asset health checks');

      const assets = await Asset.find({ status: { $ne: 'Maintenance' } });
      const healthCheckPromises = assets.map(asset => this.checkAssetHealth(asset));

      const results = await Promise.allSettled(healthCheckPromises);
      
      let healthyCount = 0;
      let unhealthyCount = 0;
      let warningCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const healthResult = result.value;
          this.healthChecks.set(assets[index]._id.toString(), healthResult);

          if (healthResult.status === 'healthy') {
            healthyCount++;
          } else if (healthResult.status === 'warning') {
            warningCount++;
          } else {
            unhealthyCount++;
          }

          // Check for alerts
          this.checkForAlerts(assets[index], healthResult);
        } else {
          monitoringLogger.error(`Health check failed for asset ${assets[index].name}`, {
            details: { error: result.reason.message }
          });
          unhealthyCount++;
        }
      });

      monitoringLogger.info('Health checks completed', {
        details: {
          totalAssets: assets.length,
          healthy: healthyCount,
          warnings: warningCount,
          unhealthy: unhealthyCount
        }
      });

      return {
        totalAssets: assets.length,
        healthy: healthyCount,
        warnings: warningCount,
        unhealthy: unhealthyCount,
        timestamp: new Date()
      };

    } catch (error) {
      monitoringLogger.error('Health check process failed', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Check individual asset health
  async checkAssetHealth(asset) {
    const startTime = Date.now();
    const healthResult = {
      assetId: asset._id,
      assetName: asset.name,
      assetIP: asset.ip,
      timestamp: new Date(),
      status: 'unknown',
      responseTime: 0,
      checks: {},
      consecutiveFailures: 0,
      alerts: []
    };

    try {
      // Get previous health check for consecutive failure tracking
      const previousHealth = this.healthChecks.get(asset._id.toString());
      if (previousHealth && previousHealth.status !== 'healthy') {
        healthResult.consecutiveFailures = previousHealth.consecutiveFailures + 1;
      }

      // Perform basic connectivity check
      const connectivityResult = await this.checkConnectivity(asset.ip);
      healthResult.checks.connectivity = connectivityResult;
      healthResult.responseTime = connectivityResult.responseTime;

      // Check common ports based on asset type
      const portChecks = await this.checkPorts(asset);
      healthResult.checks.ports = portChecks;

      // Determine overall health
      if (connectivityResult.reachable && portChecks.some(p => p.open)) {
        healthResult.status = 'healthy';
        
        // Update asset status in database if needed
        if (asset.status !== 'Online') {
          await Asset.findByIdAndUpdate(asset._id, { 
            status: 'Online',
            lastScanDate: new Date()
          });
        }
      } else if (connectivityResult.reachable) {
        healthResult.status = 'warning';
        healthResult.alerts.push('Asset reachable but no services responding');
        
        if (asset.status !== 'Maintenance') {
          await Asset.findByIdAndUpdate(asset._id, { 
            status: 'Maintenance',
            lastScanDate: new Date()
          });
        }
      } else {
        healthResult.status = 'unhealthy';
        healthResult.alerts.push('Asset not reachable');
        
        if (asset.status !== 'Offline') {
          await Asset.findByIdAndUpdate(asset._id, { 
            status: 'Offline',
            lastScanDate: new Date()
          });
        }
      }

      healthResult.duration = Date.now() - startTime;

    } catch (error) {
      healthResult.status = 'error';
      healthResult.alerts.push(`Health check error: ${error.message}`);
      healthResult.duration = Date.now() - startTime;
      
      monitoringLogger.error(`Health check error for asset ${asset.name}`, {
        details: { error: error.message }
      });
    }

    return healthResult;
  }

  // Check basic connectivity
  async checkConnectivity(ip, timeout = 5000) {
    const startTime = Date.now();
    
    try {
      // Try ICMP ping first
      const pingResult = await ping.promise.probe(ip, { timeout: timeout / 1000 });
      
      if (pingResult.alive) {
        return {
          reachable: true,
          method: 'icmp',
          responseTime: Date.now() - startTime,
          packetLoss: pingResult.packetLoss || 0
        };
      }

      // Fallback to TCP check on port 80
      const tcpReachable = await isReachable(`${ip}:80`);
      
      return {
        reachable: tcpReachable,
        method: 'tcp',
        responseTime: Date.now() - startTime,
        packetLoss: 0
      };

    } catch (error) {
      return {
        reachable: false,
        method: 'none',
        responseTime: Date.now() - startTime,
        packetLoss: 100,
        error: error.message
      };
    }
  }

  // Check common ports
  async checkPorts(asset) {
    const ports = this.getPortsForAssetType(asset.type);
    const portChecks = [];

    for (const port of ports) {
      const result = await this.checkSinglePort(asset.ip, port.port, port.timeout);
      portChecks.push({
        ...port,
        ...result
      });
    }

    return portChecks;
  }

  // Get ports to check based on asset type
  getPortsForAssetType(assetType) {
    const portMap = {
      'Server': [
        { port: 22, service: 'SSH', timeout: 3000 },
        { port: 80, service: 'HTTP', timeout: 3000 },
        { port: 443, service: 'HTTPS', timeout: 3000 },
        { port: 3389, service: 'RDP', timeout: 3000 }
      ],
      'Database': [
        { port: 3306, service: 'MySQL', timeout: 3000 },
        { port: 5432, service: 'PostgreSQL', timeout: 3000 },
        { port: 1433, service: 'MSSQL', timeout: 3000 },
        { port: 27017, service: 'MongoDB', timeout: 3000 }
      ],
      'Application': [
        { port: 80, service: 'HTTP', timeout: 3000 },
        { port: 443, service: 'HTTPS', timeout: 3000 },
        { port: 8080, service: 'HTTP-Alt', timeout: 3000 }
      ],
      'Network Device': [
        { port: 22, service: 'SSH', timeout: 3000 },
        { port: 23, service: 'Telnet', timeout: 3000 },
        { port: 80, service: 'HTTP', timeout: 3000 },
        { port: 443, service: 'HTTPS', timeout: 3000 }
      ]
    };

    return portMap[assetType] || portMap['Server'];
  }

  // Check single port
  async checkSinglePort(ip, port, timeout = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        resolve({
          open: true,
          responseTime: Date.now() - startTime
        });
        socket.destroy();
      });
      
      socket.on('timeout', () => {
        resolve({
          open: false,
          responseTime: timeout
        });
        socket.destroy();
      });
      
      socket.on('error', () => {
        resolve({
          open: false,
          responseTime: Date.now() - startTime
        });
        socket.destroy();
      });
      
      socket.connect(port, ip);
    });
  }

  // Check for alerts based on health results
  checkForAlerts(asset, healthResult) {
    const alerts = [];

    // Response time alert
    if (healthResult.responseTime > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `High response time: ${healthResult.responseTime}ms`,
        asset: asset._id,
        timestamp: new Date()
      });
    }

    // Consecutive failures alert
    if (healthResult.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
      alerts.push({
        type: 'availability',
        severity: 'critical',
        message: `Asset has been unhealthy for ${healthResult.consecutiveFailures} consecutive checks`,
        asset: asset._id,
        timestamp: new Date()
      });
    }

    // Add alerts to global alerts list
    alerts.forEach(alert => {
      this.alerts.push(alert);
      monitoringLogger.warn(`Alert generated for asset ${asset.name}`, {
        details: alert
      });
    });

    // Keep only recent alerts (last 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffTime);
  }

  // Get current monitoring status
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      healthChecks: Array.from(this.healthChecks.values()),
      recentAlerts: this.alerts.slice(-20), // Last 20 alerts
      alertThresholds: this.alertThresholds,
      totalAssets: this.healthChecks.size
    };
  }

  // Get asset health history
  async getAssetHealthHistory(assetId, hours = 24) {
    try {
      // This would typically come from a health logs collection
      // For now, return current health check data
      const currentHealth = this.healthChecks.get(assetId);
      
      if (!currentHealth) {
        return [];
      }

      // Simulate historical data (in production, this would come from database)
      const history = [];
      const now = new Date();
      
      for (let i = 0; i < hours; i++) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
        history.push({
          timestamp,
          status: currentHealth.status,
          responseTime: currentHealth.responseTime + Math.random() * 100 - 50,
          alerts: []
        });
      }

      return history.reverse();
    } catch (error) {
      monitoringLogger.error('Failed to get asset health history', {
        details: { error: error.message, assetId }
      });
      throw error;
    }
  }

  // Get monitoring statistics
  async getMonitoringStats() {
    try {
      const healthChecks = Array.from(this.healthChecks.values());
      
      const stats = {
        totalAssets: healthChecks.length,
        healthyAssets: healthChecks.filter(h => h.status === 'healthy').length,
        unhealthyAssets: healthChecks.filter(h => h.status === 'unhealthy').length,
        warningAssets: healthChecks.filter(h => h.status === 'warning').length,
        averageResponseTime: healthChecks.reduce((sum, h) => sum + h.responseTime, 0) / healthChecks.length || 0,
        recentAlerts: this.alerts.slice(-10),
        lastCheck: healthChecks.length > 0 ? Math.max(...healthChecks.map(h => h.timestamp)) : null
      };

      return stats;
    } catch (error) {
      monitoringLogger.error('Failed to get monitoring stats', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Update alert thresholds
  updateAlertThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    monitoringLogger.info('Alert thresholds updated', {
      details: this.alertThresholds
    });
  }

  // Clear alerts
  clearAlerts(assetId = null) {
    if (assetId) {
      this.alerts = this.alerts.filter(alert => alert.asset.toString() !== assetId);
    } else {
      this.alerts = [];
    }
    monitoringLogger.info('Alerts cleared', { details: { assetId } });
  }
}

// Create singleton instance
const assetMonitoringService = new AssetMonitoringService();

module.exports = assetMonitoringService;
