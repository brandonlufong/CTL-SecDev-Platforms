const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ['error', 'warn', 'info', 'debug'],
    index: true
  },
  service: {
    type: String,
    required: true,
    enum: ['application', 'database', 'auth', 'api', 'scan', 'system', 'security', 'network', 'asset-monitoring', 'asset-classification'],
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  user: {
    type: String,
    default: 'system'
  },
  ipAddress: {
    type: String,
    default: null
  },
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    default: 'info',
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  stackTrace: {
    type: String,
    default: null
  },
  requestId: {
    type: String,
    default: null
  },
  duration: {
    type: Number,
    default: null
  },
  statusCode: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
systemLogSchema.index({ timestamp: -1 });
systemLogSchema.index({ level: 1, timestamp: -1 });
systemLogSchema.index({ service: 1, timestamp: -1 });
systemLogSchema.index({ severity: 1, timestamp: -1 });

module.exports = mongoose.model('SystemLog', systemLogSchema);
