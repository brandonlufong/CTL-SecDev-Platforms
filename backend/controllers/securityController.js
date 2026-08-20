const Asset = require('../models/Asset');
const Device = require('../models/Device');
const { checkHost, checkTls } = require('../services/tlsCheckService');

/**
 * Security posture endpoints (Workstream D): TLS/cert + HTTP header checks that
 * complement nmap scans.
 */

// POST /api/security/tls-check  { host, ports? }
exports.tlsCheck = async (req, res) => {
  try {
    const { host, ports } = req.body;
    if (!host) return res.status(400).json({ message: 'host is required' });
    const result = await checkHost(host, Array.isArray(ports) && ports.length ? ports : [443, 80]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'TLS check failed', error: err.message });
  }
};

// GET /api/security/tls-check/:assetId  -> resolve asset/device IP then check
exports.tlsCheckTarget = async (req, res) => {
  try {
    let target = await Asset.findById(req.params.assetId);
    if (!target) target = await Device.findById(req.params.assetId);
    if (!target) return res.status(404).json({ message: 'Target not found' });
    const result = await checkHost(target.ip, [443, 80]);
    res.json({ target: { id: target._id, name: target.name, ip: target.ip }, ...result });
  } catch (err) {
    res.status(500).json({ message: 'TLS check failed', error: err.message });
  }
};

module.exports.tlsCheckRaw = checkTls;
