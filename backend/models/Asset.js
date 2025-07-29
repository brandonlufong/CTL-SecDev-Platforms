const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['Server', 'Database', 'Application', 'Network Device'],
      default: 'Server',
    },
    serverType: {
      type: String,
      enum: ['Physical', 'Virtual'],
      default: 'Physical',
    },
    dbType: {
      type: String,
      // enum: ['MySQL 8.0', 'PostgreSQL 13', 'MongoDB 5.0', 'Oracle 19c'],
      // default: 'MySQL 8.0',
    },
    wsType: {
      type: String,
      // enum: ['Apache 2.4', 'Nginx 1.18', 'IIS 10'],
      // default: 'Apache 2.4',
    },
    os: {
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
    activeProtocols: {
      type: [String],
      default: ['HTTP', 'HTTPS'],
    },
    memory: { type: String, trim: true }, // Example: '16 GB'
    diskSpace: { type: String, trim: true }, // Example: '500 GB'
    cpuCapacity: { type: String, trim: true }, // Example: '8 cores'
    hostDepartment: { type: String, trim: true },
    serverAdministrator: { type: String, trim: true },
    description: { type: String, trim: true },
    owner: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Asset', AssetSchema);
