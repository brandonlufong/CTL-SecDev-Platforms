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
      required: true,
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

module.exports = mongoose.model('ScanResult', scanResultSchema);

