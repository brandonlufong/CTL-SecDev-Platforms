const performanceService = require('../services/performanceService');
const PerformanceMetric = require('../models/PerformanceMetric');
const Asset = require('../models/Asset');

/**
 * Get current monitoring status
 */
exports.getMonitoringStatus = async (req, res) => {
  try {
    const status = performanceService.getMonitoringStatus();
    res.json(status);
  } catch (error) {
    console.error('❌ Failed to get monitoring status:', error);
    res.status(500).json({ message: 'Failed to get monitoring status' });
  }
};

/**
 * Start performance monitoring
 */
exports.startMonitoring = async (req, res) => {
  try {
    await performanceService.startMonitoring();
    res.json({ message: 'Performance monitoring started successfully' });
  } catch (error) {
    console.error('❌ Failed to start monitoring:', error);
    res.status(500).json({ message: 'Failed to start performance monitoring' });
  }
};

/**
 * Stop performance monitoring
 */
exports.stopMonitoring = async (req, res) => {
  try {
    await performanceService.stopMonitoring();
    res.json({ message: 'Performance monitoring stopped successfully' });
  } catch (error) {
    console.error('❌ Failed to stop monitoring:', error);
    res.status(500).json({ message: 'Failed to stop performance monitoring' });
  }
};

/**
 * Get latest metrics for an asset
 */
exports.getLatestMetrics = async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    const metrics = await performanceService.getLatestMetrics(assetId);
    res.json(metrics);
  } catch (error) {
    console.error('❌ Failed to get latest metrics:', error);
    res.status(500).json({ message: 'Failed to get latest metrics' });
  }
};

/**
 * Get metrics for a specific time range
 */
exports.getMetricsByTimeRange = async (req, res) => {
  try {
    const { assetId, metricType } = req.params;
    const { startTime, endTime } = req.query;
    
    if (!assetId || !metricType) {
      return res.status(400).json({ message: 'Asset ID and metric type are required' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid time format' });
    }

    const metrics = await performanceService.getMetricsByTimeRange(assetId, metricType, start, end);
    res.json(metrics);
  } catch (error) {
    console.error('❌ Failed to get metrics by time range:', error);
    res.status(500).json({ message: 'Failed to get metrics by time range' });
  }
};

/**
 * Get aggregated metrics
 */
exports.getAggregatedMetrics = async (req, res) => {
  try {
    const { assetId, metricType } = req.params;
    const { interval = '5m', limit = 100 } = req.query;
    
    if (!assetId || !metricType) {
      return res.status(400).json({ message: 'Asset ID and metric type are required' });
    }

    const metrics = await performanceService.getAggregatedMetrics(assetId, metricType, interval, parseInt(limit));
    res.json(metrics);
  } catch (error) {
    console.error('❌ Failed to get aggregated metrics:', error);
    res.status(500).json({ message: 'Failed to get aggregated metrics' });
  }
};

/**
 * Get uptime statistics
 */
exports.getUptimeStats = async (req, res) => {
  try {
    const { assetId } = req.params;
    const { timeRange = '24h' } = req.query;
    
    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    const stats = await performanceService.getUptimeStats(assetId, timeRange);
    res.json(stats);
  } catch (error) {
    console.error('❌ Failed to get uptime stats:', error);
    res.status(500).json({ message: 'Failed to get uptime stats' });
  }
};

/**
 * Get performance overview for all assets
 */
exports.getPerformanceOverview = async (req, res) => {
  try {
    const assets = await Asset.find().select('_id name ip type status');
    
    const overview = await Promise.all(
      assets.map(async (asset) => {
        const latestMetrics = await performanceService.getLatestMetrics(asset._id);
        const uptimeStats = await performanceService.getUptimeStats(asset._id, '24h');
        
        return {
          asset: {
            id: asset._id,
            name: asset.name,
            ip: asset.ip,
            type: asset.type,
            status: asset.status
          },
          latestMetrics,
          uptime: uptimeStats,
          lastUpdated: latestMetrics.length > 0 ? 
            new Date(Math.max(...latestMetrics.map(m => new Date(m.timestamp)))) : 
            null
        };
      })
    );

    res.json(overview);
  } catch (error) {
    console.error('❌ Failed to get performance overview:', error);
    res.status(500).json({ message: 'Failed to get performance overview' });
  }
};

/**
 * Get performance statistics
 */
exports.getPerformanceStats = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Get overall statistics
    const totalAssets = await Asset.countDocuments();
    const onlineAssets = await Asset.countDocuments({ status: 'Online' });
    const offlineAssets = await Asset.countDocuments({ status: 'Offline' });
    
    // Get metrics statistics
    const metricsStats = await PerformanceMetric.aggregate([
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - this.parseTimeRange(timeRange))
          }
        }
      },
      {
        $group: {
          _id: '$metricType',
          count: { $sum: 1 },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          statusDistribution: {
            $push: '$status'
          }
        }
      }
    ]);

    // Calculate status distributions
    const statusStats = {};
    metricsStats.forEach(stat => {
      const statusCounts = {};
      stat.statusDistribution.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      statusStats[stat._id] = {
        count: stat.count,
        avg: stat.avg,
        min: stat.min,
        max: stat.max,
        statusDistribution: statusCounts
      };
    });

    // Get monitoring status
    const monitoringStatus = performanceService.getMonitoringStatus();

    res.json({
      assets: {
        total: totalAssets,
        online: onlineAssets,
        offline: offlineAssets,
        onlinePercentage: totalAssets > 0 ? ((onlineAssets / totalAssets) * 100).toFixed(2) : 0
      },
      metrics: statusStats,
      monitoring: monitoringStatus,
      timeRange
    });
  } catch (error) {
    console.error('❌ Failed to get performance stats:', error);
    res.status(500).json({ message: 'Failed to get performance stats' });
  }
};

/**
 * Get performance alerts
 */
exports.getPerformanceAlerts = async (req, res) => {
  try {
    const { severity = 'all', limit = 50 } = req.query;
    
    const matchConditions = {
      'alerts.thresholdExceeded': true
    };
    
    if (severity !== 'all') {
      matchConditions['alerts.alertLevel'] = severity;
    }
    
    const alerts = await PerformanceMetric.find(matchConditions)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('asset', 'name ip type');

    res.json(alerts);
  } catch (error) {
    console.error('❌ Failed to get performance alerts:', error);
    res.status(500).json({ message: 'Failed to get performance alerts' });
  }
};

/**
 * Start monitoring specific asset
 */
exports.startAssetMonitoring = async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    await performanceService.startAssetMonitoring(asset);
    res.json({ message: `Started monitoring asset: ${asset.name}` });
  } catch (error) {
    console.error('❌ Failed to start asset monitoring:', error);
    res.status(500).json({ message: 'Failed to start asset monitoring' });
  }
};

/**
 * Stop monitoring specific asset
 */
exports.stopAssetMonitoring = async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    await performanceService.stopAssetMonitoring(assetId);
    res.json({ message: 'Stopped monitoring asset' });
  } catch (error) {
    console.error('❌ Failed to stop asset monitoring:', error);
    res.status(500).json({ message: 'Failed to stop asset monitoring' });
  }
};

/**
 * Get performance trends
 */
exports.getPerformanceTrends = async (req, res) => {
  try {
    const { assetId, metricType } = req.params;
    const { period = '7d', interval = '1h' } = req.query;
    
    if (!assetId || !metricType) {
      return res.status(400).json({ message: 'Asset ID and metric type are required' });
    }

    const trends = await performanceService.getAggregatedMetrics(assetId, metricType, interval, 100);
    
    // Calculate trend direction
    if (trends.length >= 2) {
      const recent = trends.slice(-10); // Last 10 data points
      const older = trends.slice(-20, -10); // Previous 10 data points
      
      const recentAvg = recent.reduce((sum, point) => sum + point.avg, 0) / recent.length;
      const olderAvg = older.length > 0 ? 
        older.reduce((sum, point) => sum + point.avg, 0) / older.length : recentAvg;
      
      const trend = recentAvg > olderAvg ? 'increasing' : 
                   recentAvg < olderAvg ? 'decreasing' : 'stable';
      
      res.json({
        trends,
        analysis: {
          trend,
          recentAverage: recentAvg,
          olderAverage: olderAvg,
          changePercent: olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100).toFixed(2) : 0
        }
      });
    } else {
      res.json({ trends, analysis: { trend: 'insufficient_data' } });
    }
  } catch (error) {
    console.error('❌ Failed to get performance trends:', error);
    res.status(500).json({ message: 'Failed to get performance trends' });
  }
};

/**
 * Export performance data
 */
exports.exportPerformanceData = async (req, res) => {
  try {
    const { assetId, metricType, format = 'json', timeRange = '24h' } = req.query;
    
    if (!assetId || !metricType) {
      return res.status(400).json({ message: 'Asset ID and metric type are required' });
    }

    const { startTime, endTime } = this.parseTimeRange(timeRange);
    const metrics = await performanceService.getMetricsByTimeRange(assetId, metricType, startTime, endTime);
    
    if (format === 'csv') {
      // Convert to CSV
      const csvHeader = 'Timestamp,Value,Unit,Status,Min,Max,Avg,Samples\n';
      const csvData = metrics.map(metric => 
        `${metric.timestamp},${metric.value},${metric.unit},${metric.status},${metric.metadata.min || ''},${metric.metadata.max || ''},${metric.metadata.avg || ''},${metric.samples}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="performance_${assetId}_${metricType}_${timeRange}.csv"`);
      res.send(csvHeader + csvData);
    } else {
      // Return JSON
      res.json({
        assetId,
        metricType,
        timeRange,
        startTime,
        endTime,
        data: metrics,
        exportedAt: new Date()
      });
    }
  } catch (error) {
    console.error('❌ Failed to export performance data:', error);
    res.status(500).json({ message: 'Failed to export performance data' });
  }
};

/**
 * Helper function to parse time range
 */
function parseTimeRange(timeRange) {
  const now = new Date();
  let startTime;
  
  switch (timeRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return { startTime, endTime: now };
}
