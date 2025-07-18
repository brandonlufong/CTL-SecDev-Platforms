// const mongoose = require('mongoose');

// const assetSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   ip: { type: String, required: true },
//   type: { type: String, enum: ['Server', 'Database', 'Application', 'Network Device'], default: 'Server' },
//   description: String,
//   owner: String,
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { timestamps: true });

// module.exports = mongoose.model('Asset', assetSchema);
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
    manufacturer: { type: String, trim: true },
    model: { type: String, trim: true },
    os: { type: String, trim: true },
    osVersion: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Online', 'Offline', 'Maintenance'],
      default: 'Online',
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
