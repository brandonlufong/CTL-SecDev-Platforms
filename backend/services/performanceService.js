const EventEmitter = require('events');
const ping = require('ping');
const net = require('net');
const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const PerformanceMetric = require('../models/PerformanceMetric');
const Asset = require('../models/Asset');

class PerformanceService extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.monitoringJobs = new Map(); // assetId -> monitoring job
    this.assetStates = new Map(); // assetId -> current state
    this.metricsBuffer = new Map(); // assetId -> buffered metrics
    this.bufferFlushInterval = 5000; // Flush metrics every 5 seconds
    this.lastFlush = Date.now();
    
    // Configuration
    this.config = {
      defaultTimeout: 5000,
      defaultInterval: 30000, // 30 seconds (not 2 seconds as requested)
      maxRetries: 3,
      bufferSize: 100,
      alertThresholds: {
        ping: { warning: 100, critical: 500 },
        packetLoss: { warning: 5, critical: 20 },
        responseTime: { warning: 1000, critical: 5000 },
        uptime: { warning: 95, critical: 90 }
      }
    };
    
    // Start buffer flush interval
    this.startBufferFlush();
  }

  /**
   * Start performance monitoring for all assets
   */
  async startMonitoring() {
    if (this.isRunning) {
      console.log('⚠️ Performance monitoring is already running');
      return;
    }

    try {
      console.log('🚀 Starting network performance monitoring...');
      
      // Get all active assets
      const assets = await Asset.find({ status: 'Online' });
      
      if (assets.length === 0) {
        console.log('ℹ️ No active assets found for monitoring');
        return;
      }

      // Start monitoring for each asset
      for (const asset of assets) {
        await this.startAssetMonitoring(asset);
      }

      this.isRunning = true;
      console.log(`✅ Started monitoring ${assets.length} assets`);
      
      // Emit monitoring started event
      this.emit('monitoring:started', { assetCount: assets.length });
      
    } catch (error) {
      console.error('❌ Failed to start performance monitoring:', error);
      this.emit('monitoring:error', { error: error.message });
    }
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring() {
    if (!this.isRunning) {
      console.log('⚠️ Performance monitoring is not running');
      return;
    }

    console.log('🛑 Stopping network performance monitoring...');

    // Clear all monitoring jobs
    for (const [assetId, job] of this.monitoringJobs) {
      if (job.interval) {
        clearInterval(job.interval);
      }
    }

    // Flush remaining metrics
    await this.flushMetricsBuffer();

    this.monitoringJobs.clear();
    this.assetStates.clear();
    this.isRunning = false;

    console.log('✅ Performance monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Start monitoring a specific asset
   */
  async startAssetMonitoring(asset) {
    const assetId = asset._id.toString();
    
    if (this.monitoringJobs.has(assetId)) {
      console.log(`⚠️ Asset ${asset.name} is already being monitored`);
      return;
    }

    console.log(`📡 Starting monitoring for asset: ${asset.name} (${asset.ip})`);

    // Initialize asset state
    this.assetStates.set(assetId, {
      asset,
      lastPing: null,
      consecutiveFailures: 0,
      isOnline: false,
      metrics: {
        ping: [],
        packetLoss: [],
        responseTime: [],
        uptime: []
      }
    });

    // Create monitoring job
    const monitoringJob = {
      asset,
      interval: null,
      lastRun: null,
      runCount: 0
    };

    // Start interval-based monitoring (event-driven approach)
    monitoringJob.interval = setInterval(async () => {
      await this.runAssetCheck(assetId);
    }, this.config.defaultInterval);

    this.monitoringJobs.set(assetId, monitoringJob);
    
    // Run initial check immediately
    await this.runAssetCheck(assetId);
    
    this.emit('asset:monitoring:started', { assetId, assetName: asset.name });
  }

  /**
   * Stop monitoring a specific asset
   */
  async stopAssetMonitoring(assetId) {
    const job = this.monitoringJobs.get(assetId);
    
    if (!job) {
      console.log(`⚠️ Asset ${assetId} is not being monitored`);
      return;
    }

    if (job.interval) {
      clearInterval(job.interval);
    }

    this.monitoringJobs.delete(assetId);
    this.assetStates.delete(assetId);
    
    console.log(`⏹️ Stopped monitoring for asset: ${assetId}`);
    this.emit('asset:monitoring:stopped', { assetId });
  }

  /**
   * Run comprehensive check for an asset
   */
  async runAssetCheck(assetId) {
    const job = this.monitoringJobs.get(assetId);
    const state = this.assetStates.get(assetId);
    
    if (!job || !state) {
      console.error(`❌ Monitoring job or state not found for asset ${assetId}`);
      return;
    }

    job.lastRun = new Date();
    job.runCount++;

    try {
      // Run all performance checks in parallel
      const [pingResult, packetLossResult, responseTimeResult] = await Promise.allSettled([
        this.measurePing(state.asset),
        this.measurePacketLoss(state.asset),
        this.measureResponseTime(state.asset)
      ]);

      // Process results
      const results = {
        ping: pingResult.status === 'fulfilled' ? pingResult.value : null,
        packetLoss: packetLossResult.status === 'fulfilled' ? packetLossResult.value : null,
        responseTime: responseTimeResult.status === 'fulfilled' ? responseTimeResult.value : null
      };

      // Update asset state
      await this.updateAssetState(assetId, results);
      
      // Calculate and store uptime
      await this.calculateUptime(assetId);
      
      // Emit real-time update event
      this.emit('asset:metrics:updated', {
        assetId,
        assetName: state.asset.name,
        timestamp: new Date(),
        metrics: results
      });

    } catch (error) {
      console.error(`❌ Asset check failed for ${state.asset.name}:`, error);
      
      // Mark as offline
      await this.markAssetOffline(assetId, error.message);
    }
  }

  /**
   * Measure ping latency using ICMP
   */
  async measurePing(asset) {
    try {
      const result = await ping.promise.probe(asset.ip, {
        timeout: this.config.defaultTimeout / 1000,
        extra: ['-c', '4'] // Send 4 packets
      });

      if (!result.alive) {
        throw new Error('Host unreachable');
      }

      const pingMs = parseFloat(result.time);
      const status = this.getPingStatus(pingMs);
      
      const metric = {
        asset: asset._id,
        assetName: asset.name,
        assetIP: asset.ip,
        metricType: 'ping',
        value: pingMs,
        unit: 'ms',
        status,
        duration: result.time * 1000,
        samples: 4,
        metadata: {
          min: parseFloat(result.min) || pingMs,
          max: parseFloat(result.max) || pingMs,
          avg: pingMs,
          stddev: parseFloat(result.stddev) || 0,
          packetsSent: 4,
          packetsReceived: result.packetsReceived || 4,
          measurementMethod: 'icmp',
          timeout: this.config.defaultTimeout
        }
      };

      this.bufferMetric(asset._id.toString(), metric);
      return metric;

    } catch (error) {
      throw new Error(`Ping failed: ${error.message}`);
    }
  }

  /**
   * Measure packet loss
   */
  async measurePacketLoss(asset) {
    try {
      const packetsToSend = 10;
      let packetsReceived = 0;
      const results = [];

      for (let i = 0; i < packetsToSend; i++) {
        try {
          const result = await ping.promise.probe(asset.ip, {
            timeout: 1 // 1 second timeout for individual packets
          });
          
          if (result.alive) {
            packetsReceived++;
            results.push(parseFloat(result.time));
          }
        } catch (error) {
          // Packet lost, continue
        }
      }

      const packetLossPercent = ((packetsToSend - packetsReceived) / packetsToSend) * 100;
      const status = this.getPacketLossStatus(packetLossPercent);
      
      const metric = {
        asset: asset._id,
        assetName: asset.name,
        assetIP: asset.ip,
        metricType: 'packet_loss',
        value: packetLossPercent,
        unit: '%',
        status,
        duration: packetsToSend * 1000,
        samples: packetsToSend,
        metadata: {
          min: Math.min(...results),
          max: Math.max(...results),
          avg: results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0,
          stddev: this.calculateStdDev(results),
          packetsSent: packetsToSend,
          packetsReceived,
          measurementMethod: 'icmp',
          timeout: this.config.defaultTimeout
        }
      };

      this.bufferMetric(asset._id.toString(), metric);
      return metric;

    } catch (error) {
      throw new Error(`Packet loss measurement failed: ${error.message}`);
    }
  }

  /**
   * Measure response time (HTTP/TCP)
   */
  async measureResponseTime(asset) {
    try {
      const startTime = performance.now();
      
      // Try HTTP first, then TCP fallback
      let responseTime;
      let method = 'http';
      
      try {
        responseTime = await this.measureHTTPResponseTime(asset);
      } catch (error) {
        // Fallback to TCP
        responseTime = await this.measureTCPResponseTime(asset);
        method = 'tcp';
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const status = this.getResponseTimeStatus(responseTime);
      
      const metric = {
        asset: asset._id,
        assetName: asset.name,
        assetIP: asset.ip,
        metricType: 'response_time',
        value: responseTime,
        unit: 'ms',
        status,
        duration: totalTime,
        samples: 1,
        metadata: {
          measurementMethod: method,
          targetPort: method === 'tcp' ? 80 : 443,
          timeout: this.config.defaultTimeout
        }
      };

      this.bufferMetric(asset._id.toString(), metric);
      return metric;

    } catch (error) {
      throw new Error(`Response time measurement failed: ${error.message}`);
    }
  }

  /**
   * Measure HTTP response time
   */
  async measureHTTPResponseTime(asset) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      const req = http.get(`http://${asset.ip}`, (res) => {
        const endTime = performance.now();
        resolve(endTime - startTime);
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(this.config.defaultTimeout, () => {
        req.destroy();
        reject(new Error('HTTP request timeout'));
      });
    });
  }

  /**
   * Measure TCP response time
   */
  async measureTCPResponseTime(asset, port = 80) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const socket = new net.Socket();
      
      socket.setTimeout(this.config.defaultTimeout);
      
      socket.on('connect', () => {
        const endTime = performance.now();
        socket.destroy();
        resolve(endTime - startTime);
      });

      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('TCP connection timeout'));
      });

      socket.connect(port, asset.ip);
    });
  }

  /**
   * Calculate uptime percentage for an asset
   */
  async calculateUptime(assetId) {
    const state = this.assetStates.get(assetId);
    if (!state) return;

    try {
      // Get uptime metrics for the last 24 hours
      const uptimeStats = await PerformanceMetric.getUptimeStats(assetId, '24h');
      
      const uptimePercent = uptimeStats.availability;
      const status = this.getUptimeStatus(uptimePercent);
      
      const metric = {
        asset: state.asset._id,
        assetName: state.asset.name,
        assetIP: state.asset.ip,
        metricType: 'uptime',
        value: uptimePercent,
        unit: '%',
        status,
        duration: 0,
        samples: 1,
        metadata: {
          uptime: uptimeStats.uptime,
          downtime: uptimeStats.downtime,
          timeRange: '24h',
          measurementMethod: 'calculated'
        }
      };

      this.bufferMetric(assetId, metric);
      return metric;

    } catch (error) {
      console.error(`❌ Uptime calculation failed for asset ${assetId}:`, error);
    }
  }

  /**
   * Update asset state with new metrics
   */
  async updateAssetState(assetId, results) {
    const state = this.assetStates.get(assetId);
    if (!state) return;

    // Update consecutive failures counter
    const hasSuccessfulResult = Object.values(results).some(result => 
      result && result.value !== null && !isNaN(result.value)
    );

    if (hasSuccessfulResult) {
      state.consecutiveFailures = 0;
      state.isOnline = true;
    } else {
      state.consecutiveFailures++;
      if (state.consecutiveFailures >= 3) {
        state.isOnline = false;
      }
    }

    // Update last ping time
    if (results.ping) {
      state.lastPing = new Date();
    }

    // Store metrics in state (keep last 10 for trend analysis)
    Object.keys(results).forEach(metricType => {
      if (results[metricType]) {
        if (!state.metrics[metricType]) {
          state.metrics[metricType] = [];
        }
        state.metrics[metricType].push(results[metricType]);
        
        // Keep only last 10 metrics
        if (state.metrics[metricType].length > 10) {
          state.metrics[metricType].shift();
        }
      }
    });

    // Update asset status in database if changed
    const newStatus = state.isOnline ? 'Online' : 'Offline';
    if (state.asset.status !== newStatus) {
      await Asset.findByIdAndUpdate(assetId, { status: newStatus });
      state.asset.status = newStatus;
      
      this.emit('asset:status:changed', {
        assetId,
        assetName: state.asset.name,
        oldStatus: state.asset.status,
        newStatus
      });
    }
  }

  /**
   * Mark asset as offline
   */
  async markAssetOffline(assetId, errorMessage) {
    const state = this.assetStates.get(assetId);
    if (!state) return;

    state.isOnline = false;
    state.consecutiveFailures++;

    // Create offline metric
    const offlineMetric = {
      asset: state.asset._id,
      assetName: state.asset.name,
      assetIP: state.asset.ip,
      metricType: 'ping',
      value: 9999,
      unit: 'ms',
      status: 'offline',
      duration: 0,
      samples: 1,
      metadata: {
        errors: [errorMessage],
        measurementMethod: 'icmp',
        timeout: this.config.defaultTimeout
      }
    };

    this.bufferMetric(assetId, offlineMetric);

    // Update asset status
    if (state.asset.status !== 'Offline') {
      await Asset.findByIdAndUpdate(assetId, { status: 'Offline' });
      state.asset.status = 'Offline';
      
      this.emit('asset:status:changed', {
        assetId,
        assetName: state.asset.name,
        oldStatus: 'Online',
        newStatus: 'Offline',
        error: errorMessage
      });
    }
  }

  /**
   * Buffer metric for batch insertion
   */
  bufferMetric(assetId, metric) {
    if (!this.metricsBuffer.has(assetId)) {
      this.metricsBuffer.set(assetId, []);
    }

    const buffer = this.metricsBuffer.get(assetId);
    buffer.push(metric);

    // Check if buffer should be flushed
    if (buffer.length >= this.config.bufferSize) {
      this.flushMetricsBuffer();
    }
  }

  /**
   * Flush metrics buffer to database
   */
  async flushMetricsBuffer() {
    if (this.metricsBuffer.size === 0) return;

    try {
      const allMetrics = [];
      
      // Collect all buffered metrics
      for (const [assetId, buffer] of this.metricsBuffer) {
        allMetrics.push(...buffer);
        buffer.length = 0; // Clear buffer
      }

      if (allMetrics.length > 0) {
        // Bulk insert metrics
        await PerformanceMetric.insertMany(allMetrics, { ordered: false });
        
        this.lastFlush = Date.now();
        console.log(`📊 Flushed ${allMetrics.length} performance metrics to database`);
        
        this.emit('metrics:flushed', { count: allMetrics.length });
      }

    } catch (error) {
      console.error('❌ Failed to flush metrics buffer:', error);
      this.emit('metrics:flush:error', { error: error.message });
    }
  }

  /**
   * Start buffer flush interval
   */
  startBufferFlush() {
    setInterval(() => {
      if (Date.now() - this.lastFlush >= this.bufferFlushInterval) {
        this.flushMetricsBuffer();
      }
    }, this.bufferFlushInterval);
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus() {
    const assetStatuses = [];
    
    for (const [assetId, job] of this.monitoringJobs) {
      const state = this.assetStates.get(assetId);
      assetStatuses.push({
        assetId,
        assetName: job.asset.name,
        assetIP: job.asset.ip,
        isOnline: state?.isOnline || false,
        lastRun: job.lastRun,
        runCount: job.runCount,
        consecutiveFailures: state?.consecutiveFailures || 0
      });
    }

    return {
      isRunning: this.isRunning,
      monitoredAssets: this.monitoringJobs.size,
      assetStatuses,
      bufferSize: Array.from(this.metricsBuffer.values()).reduce((sum, buffer) => sum + buffer.length, 0),
      lastFlush: this.lastFlush
    };
  }

  /**
   * Get latest metrics for an asset
   */
  async getLatestMetrics(assetId) {
    try {
      return await PerformanceMetric.getLatestMetrics(assetId);
    } catch (error) {
      console.error(`❌ Failed to get latest metrics for asset ${assetId}:`, error);
      return [];
    }
  }

  /**
   * Get metrics for time range
   */
  async getMetricsByTimeRange(assetId, metricType, startTime, endTime) {
    try {
      return await PerformanceMetric.getMetricsByTimeRange(assetId, metricType, startTime, endTime);
    } catch (error) {
      console.error(`❌ Failed to get metrics for asset ${assetId}:`, error);
      return [];
    }
  }

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(assetId, metricType, interval = '5m', limit = 100) {
    try {
      return await PerformanceMetric.getAggregatedMetrics(assetId, metricType, interval, limit);
    } catch (error) {
      console.error(`❌ Failed to get aggregated metrics for asset ${assetId}:`, error);
      return [];
    }
  }

  /**
   * Get uptime statistics
   */
  async getUptimeStats(assetId, timeRange = '24h') {
    try {
      return await PerformanceMetric.getUptimeStats(assetId, timeRange);
    } catch (error) {
      console.error(`❌ Failed to get uptime stats for asset ${assetId}:`, error);
      return { uptime: 0, downtime: 0, availability: 0 };
    }
  }

  // Helper methods for status determination
  getPingStatus(pingMs) {
    if (pingMs < 50) return 'excellent';
    if (pingMs < 100) return 'good';
    if (pingMs < 200) return 'fair';
    if (pingMs < 500) return 'poor';
    return 'critical';
  }

  getPacketLossStatus(packetLossPercent) {
    if (packetLossPercent === 0) return 'excellent';
    if (packetLossPercent < 1) return 'good';
    if (packetLossPercent < 5) return 'fair';
    if (packetLossPercent < 20) return 'poor';
    return 'critical';
  }

  getResponseTimeStatus(responseTime) {
    if (responseTime < 200) return 'excellent';
    if (responseTime < 500) return 'good';
    if (responseTime < 1000) return 'fair';
    if (responseTime < 5000) return 'poor';
    return 'critical';
  }

  getUptimeStatus(uptimePercent) {
    if (uptimePercent >= 99.9) return 'excellent';
    if (uptimePercent >= 99) return 'good';
    if (uptimePercent >= 95) return 'fair';
    if (uptimePercent >= 90) return 'poor';
    return 'critical';
  }

  calculateStdDev(values) {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }
}

// Singleton instance
const performanceService = new PerformanceService();

module.exports = performanceService;
