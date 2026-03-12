const mongoose = require('mongoose');

const performanceMetricSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    index: true
  },
  assetName: {
    type: String,
    required: true,
    index: true
  },
  assetIP: {
    type: String,
    required: true,
    index: true
  },
  metricType: {
    type: String,
    enum: ['ping', 'packet_loss', 'response_time', 'uptime', 'bandwidth', 'jitter'],
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    enum: ['ms', '%', 'Mbps', 'bytes', 'packets'],
    required: true
  },
  status: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'critical', 'offline'],
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  duration: {
    type: Number, // Duration of measurement in ms
    default: 0
  },
  samples: {
    type: Number, // Number of samples taken
    default: 1
  },
  metadata: {
    min: Number,
    max: Number,
    avg: Number,
    stddev: Number,
    packetsSent: Number,
    packetsReceived: Number,
    errors: [String],
    measurementMethod: {
      type: String,
      enum: ['icmp', 'tcp', 'http', 'https', 'custom'],
      default: 'icmp'
    },
    targetPort: Number,
    timeout: Number
  },
  alerts: {
    thresholdExceeded: {
      type: Boolean,
      default: false
    },
    alertLevel: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info'
    },
    alertMessage: String
  }
}, {
  timestamps: true,
  // Optimize for time-series data
  collection: 'performancemetrics'
});

// Compound indexes for efficient queries
performanceMetricSchema.index({ asset: 1, metricType: 1, timestamp: -1 });
performanceMetricSchema.index({ assetIP: 1, metricType: 1, timestamp: -1 });
performanceMetricSchema.index({ metricType: 1, status: 1, timestamp: -1 });
performanceMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

// TTL index for data retention (keep 30 days of detailed data)
performanceMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Static methods for aggregation
performanceMetricSchema.statics.getLatestMetrics = async function(assetId) {
  return this.aggregate([
    { $match: { asset: new mongoose.Types.ObjectId(assetId) } },
    { $sort: { timestamp: -1 } },
    { $group: {
      _id: '$metricType',
      latest: { $first: '$$ROOT' }
    }},
    { $replaceRoot: { newRoot: '$latest' } }
  ]);
};

performanceMetricSchema.statics.getMetricsByTimeRange = async function(assetId, metricType, startTime, endTime) {
  return this.find({
    asset: new mongoose.Types.ObjectId(assetId),
    metricType,
    timestamp: { $gte: startTime, $lte: endTime }
  }).sort({ timestamp: 1 });
};

performanceMetricSchema.statics.getAggregatedMetrics = async function(assetId, metricType, interval = '5m', limit = 100) {
  const intervalMap = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400
  };
  
  const seconds = intervalMap[interval] || 300;
  
  return this.aggregate([
    {
      $match: {
        asset: new mongoose.Types.ObjectId(assetId),
        metricType,
        timestamp: { $gte: new Date(Date.now() - seconds * limit * 1000) }
      }
    },
    {
      $group: {
        _id: {
          $toDate: {
            $subtract: [
              { $toLong: '$timestamp' },
              { $mod: [{ $toLong: '$timestamp' }, seconds * 1000] }
            ]
          }
        },
        avg: { $avg: '$value' },
        min: { $min: '$value' },
        max: { $max: '$value' },
        count: { $sum: 1 },
        timestamp: { $first: '$timestamp' },
        status: { $last: '$status' }
      }
    },
    { $sort: { timestamp: 1 } },
    { $limit: limit }
  ]);
};

performanceMetricSchema.statics.getUptimeStats = async function(assetId, timeRange = '24h') {
  const timeRanges = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000,
    '30d': 2592000000
  };
  
  const startTime = new Date(Date.now() - (timeRanges[timeRange] || 86400000));
  
  const uptimeMetrics = await this.find({
    asset: new mongoose.Types.ObjectId(assetId),
    metricType: 'uptime',
    timestamp: { $gte: startTime }
  }).sort({ timestamp: 1 });
  
  if (uptimeMetrics.length === 0) return { uptime: 0, downtime: 0, availability: 0 };
  
  let totalUptime = 0;
  let totalDowntime = 0;
  
  for (let i = 0; i < uptimeMetrics.length; i++) {
    const current = uptimeMetrics[i];
    const next = uptimeMetrics[i + 1];
    
    const timeDiff = next ? 
      new Date(next.timestamp) - new Date(current.timestamp) : 
      new Date() - new Date(current.timestamp);
    
    if (current.value >= 95) { // Consider 95%+ as uptime
      totalUptime += timeDiff;
    } else {
      totalDowntime += timeDiff;
    }
  }
  
  const totalTime = totalUptime + totalDowntime;
  const availability = totalTime > 0 ? (totalUptime / totalTime) * 100 : 0;
  
  return {
    uptime: Math.round(totalUptime / 1000), // in seconds
    downtime: Math.round(totalDowntime / 1000), // in seconds
    availability: availability.toFixed(2),
    timeRange
  };
};

// Instance methods
performanceMetricSchema.methods.getStatusColor = function() {
  const colors = {
    excellent: '#28a745',
    good: '#20c997',
    fair: '#ffc107',
    poor: '#fd7e14',
    critical: '#dc3545',
    offline: '#6c757d'
  };
  return colors[this.status] || '#6c757d';
};

performanceMetricSchema.methods.getFormattedValue = function() {
  switch (this.unit) {
    case 'ms':
      return `${this.value.toFixed(2)}ms`;
    case '%':
      return `${this.value.toFixed(1)}%`;
    case 'Mbps':
      return `${this.value.toFixed(2)} Mbps`;
    case 'bytes':
      return `${(this.value / 1024 / 1024).toFixed(2)} MB`;
    case 'packets':
      return `${this.value} packets`;
    default:
      return `${this.value}`;
  }
};

module.exports = mongoose.model('PerformanceMetric', performanceMetricSchema);
