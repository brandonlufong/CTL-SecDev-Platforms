// models/ScanResult.js
const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    port: {
      type: Number,
      required: true,
    },
    protocol: {
      type: String,
      default: 'tcp',
    },
    state: {
      type: String,
      enum: ['open', 'closed', 'filtered', 'unfiltered', 'open|filtered', 'closed|filtered'],
      required: true,
    },
    service: {
      type: String,
      required: true,
    },
    product: String,
    version: String,
    extraInfo: String,
    cpe: String,
    scanType: {
      type: String,
      enum: ['quick', 'comprehensive', 'stealth', 'udp', 'vulnerability', 'custom'],
      default: 'quick',
    },
    vulnerabilityScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    detectionMethods: [{
      type: String,
      enum: ['direct_cve_detection', 'database_correlation', 'pattern_matching', 'service_specific']
    }],
    scanEnhancement: [String],
    notes: String,
    scanCommand: String,
    rawOutput: String,
    scriptOutput: String,
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
    // Metadata for quick access
    scanMetadata: {
      totalVulnerabilities: {
        type: Number,
        default: 0
      },
      highestSeverity: {
        type: String,
        enum: ['None', 'Informational', 'Low', 'Medium', 'High', 'Critical', 'Unknown'],
        default: 'None'
      },
      riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Low'
      }
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
scanResultSchema.index({ asset: 1, createdAt: -1 });
scanResultSchema.index({ port: 1, service: 1 });
scanResultSchema.index({ vulnerabilityScore: -1 });
scanResultSchema.index({ 'scanMetadata.riskLevel': 1 });

module.exports = mongoose.model('ScanResult', scanResultSchema);

