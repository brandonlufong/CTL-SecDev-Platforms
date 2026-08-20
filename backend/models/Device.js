const mongoose = require('mongoose');

const NetworkDevicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ip: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          // Validate IPv4
          return /^(\d{1,3}\.){3}\d{1,3}$/.test(v);
        },
        message: props => `${props.value} is not a valid IPv4 address!`,
      },
    },
    deviceCategory: {
      type: String,
      enum: ['Router', 'Switch', 'Hub', 'Modem', 'Bridge', 'Gateway', 'Access Point'],
      default: 'Router',
    },
    deviceType: {
      type: String,
      enum: ['Physical', 'Virtual'],
      default: 'Physical',
    },
    nos: {
      type: String,
      // enum: ['Windows Server 2019', 'Ubuntu 20.04', 'CentOS 8', 'Red Hat Enterprise Linux 8'],
    },
    manufacturer: { type: String, trim: true },
    model: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Online', 'Offline', 'Maintenance'],
      default: 'Online',
    },
    state: {
      type: String,
      enum: ['Active', 'Passive'],
      default: 'Active',
    },
    exposure: {
      type: String,
      enum: ['Private', 'Public'],
      default: 'Private',
    },
    // ---- Enterprise asset context (Workstream C) ----
    criticality: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low', 'Informational'],
      default: 'Medium',
      index: true,
    },
    environment: {
      type: String,
      enum: ['Production', 'Staging', 'Development', 'Testing', 'DR', 'Unknown'],
      default: 'Production',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    businessOwner: { type: String, trim: true },
    detectedSoftware: [
      {
        port: Number,
        protocol: String,
        service: String,
        product: String,
        version: String,
        cpe: String,
        lastSeen: { type: Date, default: Date.now },
      },
    ],
    activeProtocols: {
      type: [String],
      default: ['HTTP', 'HTTPS'],
    },
    memory: { type: String, trim: true }, // Example: '16 GB'
    storageCapacity: { type: String, trim: true }, // Example: '500 GB'
    cpuCapacity: { type: String, trim: true }, // Example: '8 cores'
    hostDepartment: { type: String, trim: true },
    serverAdministrator: { type: String, trim: true },
    description: { type: String, trim: true },
    owner: { type: String, trim: true },
    lastScanDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', NetworkDevicSchema);
