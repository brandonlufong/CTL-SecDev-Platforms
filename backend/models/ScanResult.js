// models/ScanResult.js
// const mongoose = require('mongoose');

// const scanResultSchema = new mongoose.Schema({
//   asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
//   scannedAt: { type: Date, default: Date.now },
//   logs: [
//     {
//       port: Number,
//       state: String,
//       service: String,
//     },
//   ],
//   scanType: { type: String, default: 'nmap' },
//   summary: { type: String },
// });

// module.exports = mongoose.model('ScanResult', scanResultSchema);
// const mongoose = require('mongoose');

// const scanResultSchema = new mongoose.Schema(
//   {
//     asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
//     port: Number,
//     state: String,
//     service: String,
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model('ScanResult', scanResultSchema);
// models/ScanResult.js
const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: false,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: false,
    },
    port: Number,
    protocol: String,
    state: String,
    service: String,
    product: String,
    version: String,
    extraInfo: String,
    cpe: String,
    scanType: {
      type: String,
      enum: ['quick', 'full', 'custom', 'comprehensive', 'stealth', 'udp', 'vulnerability'],
      default: 'quick',
    },
    vulnerabilityScore: {
      type: Number,
      min: 0,
      max: 10,
    },
    confidence: { type: Number, min: 0, max: 100 },
    detectionMethods: { type: [String], default: [] },
    scanEnhancement: { type: [String], default: [] },
    notes: String,
    scanCommand: String,
    rawOutput: String,
    scannedAt: {
      type: Date,
      default: Date.now,
    },
    vulnerabilities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vulnerability',
      },
    ],
  },
  { timestamps: true }
);

// Add custom validation to ensure at least one of asset or device is provided
scanResultSchema.pre('save', function(next) {
  if (!this.asset && !this.device) {
    const error = new Error('Either asset or device must be provided');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

// Add a virtual field to get the target (either asset or device)
scanResultSchema.virtual('target').get(function() {
  return this.asset || this.device;
});

// Add a virtual field to get the target type
scanResultSchema.virtual('targetType').get(function() {
  if (this.asset) return 'Asset';
  if (this.device) return 'Device';
  return null;
});

// Helper method to determine what type of scan result this is
scanResultSchema.methods.getTargetInfo = function() {
  if (this.asset) {
    return { id: this.asset, type: 'Asset', field: 'asset' };
  }
  if (this.device) {
    return { id: this.device, type: 'Device', field: 'device' };
  }
  return null;
};

// Static method to create scan result for asset
scanResultSchema.statics.createForAsset = function(assetId, scanData) {
  return new this({
    asset: assetId,
    device: null, // explicitly set to null
    ...scanData
  });
};

// Static method to create scan result for device
scanResultSchema.statics.createForDevice = function(deviceId, scanData) {
  return new this({
    asset: null, // explicitly set to null
    device: deviceId,
    ...scanData
  });
};

// Index for efficient querying
scanResultSchema.index({ asset: 1, scannedAt: -1 });
scanResultSchema.index({ device: 1, scannedAt: -1 });
scanResultSchema.index({ scannedAt: -1 });

module.exports = mongoose.model('ScanResult', scanResultSchema);

