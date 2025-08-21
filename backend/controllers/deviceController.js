const Device = require('../models/Device');
const ping = require('ping');
const isReachable = require('is-reachable'); // More reliable reachability check
const net = require('net');

// Get all devices
exports.getDevices = async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });
    res.json(devices);
    console.log(devices)
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching devices.' });
  }
};

// Create new device
exports.createDevice = async (req, res) => {
  try {
    const newDevice = new Device(req.body);
    await newDevice.save();
    res.status(201).json(newDevice);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

// Update device
exports.updateDevice = async (req, res) => {
  try {
    const device = await Device.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    res.json(device);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

// Delete device
exports.deleteDevice = async (req, res) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error while deleting asset.' });
  }
};

// Search/filter devices
exports.searchDevices = async (req, res) => {
  const query = req.query.q || '';
  try {
    const results = await Device.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { ip: { $regex: query, $options: 'i' } },
        { deviceCategory: { $regex: query, $options: 'i' } },
        { deviceType: { $regex: query, $options: 'i' } },
        { manufacturer: { $regex: query, $options: 'i' } },
        { nos: { $regex: query, $options: 'i' } },
        { status: { $regex: query, $options: 'i' } },
        { hostDepartment: { $regex: query, $options: 'i' } },
        { serverAdministrator: { $regex: query, $options: 'i' } },
        { owner: { $regex: query, $options: 'i' } },
        { state: { $regex: query, $options: 'i' } },
        { exposure: { $regex: query, $options: 'i' } },
        { activeProtocols: { $elemMatch: { $regex: query, $options: 'i' } } },
        // { wsType: { $regex: query, $options: 'i' } },
        // { dbType: { $regex: query, $options: 'i' } },
      ],
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error during search.' });
  }
};

// Utility function for TCP connection check
const checkPort = (host, port, timeout = 10000) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let reachable = false;

    socket.setTimeout(timeout);
    socket.on('connect', () => {
      reachable = true;
      socket.destroy();
    });
    socket.on('timeout', () => {
      reachable = true;
      socket.destroy();
    });
    socket.on('error', () => {
      socket.destroy();
    });
    socket.on('close', () => {
      resolve(reachable);
    });
    socket.connect(port, host);
  });
};

// device status ping
exports.pingDevices = async (req, res) => {
  try {
    const devices = await Device.find();

    const updatedDevices = await Promise.all(
      devices.map(async (device) => {
        let reachable = false;

        try {
          // First, try ICMP ping
          const pingResult = await ping.promise.probe(device.ip, { timeout: 100 });
          reachable = pingResult.alive;

          // If ICMP fails, try TCP check as fallback
          if (!reachable) {
            reachable = await isReachable(`${device.ip}:80`); // Check port 80 (HTTP)
          }
        } catch (err) {
          console.error(`Error checking reachability for ${device.ip}:`, err);
        }

        const newStatus = reachable ? 'Online' : 'Offline';

        // Only update DB if status changed
        if (device.status !== newStatus) {
          device.status = newStatus;
          await device.save();
        }

        return device;
      })
    );

    res.json(updatedDevices);
  } catch (err) {
    console.error('Ping all devices failed:', err);
    res.status(500).json({ message: 'Failed to ping devices.' });
  }
};