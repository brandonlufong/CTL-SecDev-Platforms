const cron = require('node-cron');
const performanceService = require('../services/performanceService');
const websocketService = require('../services/websocketService');

class PerformanceScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start all scheduled performance monitoring jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Performance scheduler is already running');
      return;
    }

    console.log('🚀 Starting Performance Monitoring Scheduler...');

    // Start performance monitoring service
    const startMonitoringJob = cron.schedule('*/30 * * * * *', async () => {
      // Run every 30 seconds (event-driven approach)
      try {
        if (!performanceService.isRunning) {
          await performanceService.startMonitoring();
        }
      } catch (error) {
        console.error('❌ Auto-start monitoring failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Health check job - every 5 minutes
    const healthCheckJob = cron.schedule('*/5 * * * *', async () => {
      console.log('🏥 Performance monitoring health check...');
      try {
        const status = performanceService.getMonitoringStatus();
        console.log(`📊 Monitoring ${status.monitoredAssets} assets, ${status.bufferSize} buffered metrics`);
        
        // Emit health status via WebSocket
        if (websocketService.isInitialized) {
          websocketService.broadcast({
            type: 'monitoring:health',
            data: {
              ...status,
              timestamp: new Date(),
              healthy: status.monitoredAssets > 0
            }
          });
        }
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Metrics cleanup job - daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Running daily metrics cleanup...');
      try {
        await this.cleanupOldMetrics();
      } catch (error) {
        console.error('❌ Metrics cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Performance report job - daily at 8 AM
    const reportJob = cron.schedule('0 8 * * *', async () => {
      console.log('📈 Generating daily performance report...');
      try {
        await this.generateDailyReport();
      } catch (error) {
        console.error('❌ Daily report generation failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // WebSocket stats job - every hour
    const websocketStatsJob = cron.schedule('0 * * * *', async () => {
      if (websocketService.isInitialized) {
        const stats = websocketService.getStats();
        console.log(`📡 WebSocket stats: ${stats.connectedClients} clients, ${stats.totalSubscriptions} subscriptions`);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs = [
      { name: 'start-monitoring', job: startMonitoringJob },
      { name: 'health-check', job: healthCheckJob },
      { name: 'cleanup', job: cleanupJob },
      { name: 'daily-report', job: reportJob },
      { name: 'websocket-stats', job: websocketStatsJob }
    ];

    // Start all jobs
    this.jobs.forEach(({ name, job }) => {
      job.start();
      console.log(`✅ Started scheduled job: ${name}`);
    });

    this.isRunning = true;
    console.log('✅ Performance Monitoring Scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Performance scheduler is not running');
      return;
    }

    console.log('🛑 Stopping Performance Monitoring Scheduler...');

    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`⏹️ Stopped scheduled job: ${name}`);
    });

    this.jobs = [];
    this.isRunning = false;
    console.log('✅ Performance Monitoring Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.jobs.length,
      jobs: this.jobs.map(({ name }) => name)
    };
  }

  /**
   * Run a specific job manually
   */
  async runJob(jobName) {
    const job = this.jobs.find(j => j.name === jobName);
    if (!job) {
      throw new Error(`Job '${jobName}' not found`);
    }

    console.log(`🏃 Manually running job: ${jobName}`);
    
    try {
      if (jobName === 'start-monitoring') {
        await performanceService.startMonitoring();
      } else if (jobName === 'health-check') {
        const status = performanceService.getMonitoringStatus();
        return status;
      } else if (jobName === 'cleanup') {
        await this.cleanupOldMetrics();
      } else if (jobName === 'daily-report') {
        await this.generateDailyReport();
      } else if (jobName === 'websocket-stats') {
        const stats = websocketService.getStats();
        return stats;
      }
      
      console.log(`✅ Successfully ran job: ${jobName}`);
      return { success: true, message: `Job '${jobName}' completed successfully` };
    } catch (error) {
      console.error(`❌ Failed to run job '${jobName}':`, error);
      throw error;
    }
  }

  /**
   * Clean up old metrics (older than 30 days)
   */
  async cleanupOldMetrics() {
    try {
      const PerformanceMetric = require('../models/PerformanceMetric');
      
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const result = await PerformanceMetric.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old performance metrics`);
      
      // Emit cleanup event
      if (websocketService.isInitialized) {
        websocketService.broadcast({
          type: 'metrics:cleanup',
          data: {
            deletedCount: result.deletedCount,
            cutoffDate,
            timestamp: new Date()
          }
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to cleanup old metrics:', error);
      throw error;
    }
  }

  /**
   * Generate daily performance report
   */
  async generateDailyReport() {
    try {
      const PerformanceMetric = require('../models/PerformanceMetric');
      const Asset = require('../models/Asset');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get asset statistics
      const totalAssets = await Asset.countDocuments();
      const onlineAssets = await Asset.countDocuments({ status: 'Online' });
      const offlineAssets = await Asset.countDocuments({ status: 'Offline' });
      
      // Get metrics statistics
      const metricsStats = await PerformanceMetric.aggregate([
        {
          $match: {
            timestamp: { $gte: yesterday, $lt: today }
          }
        },
        {
          $group: {
            _id: '$metricType',
            count: { $sum: 1 },
            avg: { $avg: '$value' },
            min: { $min: '$value' },
            max: { $max: '$value' }
          }
        }
      ]);

      // Get alerts
      const alerts = await PerformanceMetric.countDocuments({
        timestamp: { $gte: yesterday, $lt: today },
        'alerts.thresholdExceeded': true
      });

      const report = {
        date: yesterday.toISOString().split('T')[0],
        assets: {
          total: totalAssets,
          online: onlineAssets,
          offline: offlineAssets,
          availability: totalAssets > 0 ? ((onlineAssets / totalAssets) * 100).toFixed(2) : 0
        },
        metrics: metricsStats,
        alerts,
        generatedAt: new Date()
      };

      console.log('📈 Daily performance report generated:', {
        date: report.date,
        assets: report.assets,
        metricsCount: metricsStats.length,
        alerts
      });

      // Emit report via WebSocket
      if (websocketService.isInitialized) {
        websocketService.broadcast({
          type: 'daily:report',
          data: report
        });
      }

      return report;
    } catch (error) {
      console.error('❌ Failed to generate daily report:', error);
      throw error;
    }
  }

  /**
   * Initialize the performance monitoring system
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Performance Monitoring system...');
      
      // Start performance monitoring
      await performanceService.startMonitoring();
      
      // Start scheduler
      this.start();
      
      console.log('✅ Performance Monitoring system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Performance Monitoring system:', error);
      throw error;
    }
  }

  /**
   * Shutdown the performance monitoring system
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Performance Monitoring system...');
      
      // Stop scheduler
      this.stop();
      
      // Stop performance monitoring
      await performanceService.stopMonitoring();
      
      // Close WebSocket service
      if (websocketService.isInitialized) {
        websocketService.close();
      }
      
      console.log('✅ Performance Monitoring system shutdown complete');
    } catch (error) {
      console.error('❌ Failed to shutdown Performance Monitoring system:', error);
      throw error;
    }
  }
}

// Singleton instance
const performanceScheduler = new PerformanceScheduler();

module.exports = performanceScheduler;
