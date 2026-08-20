// const Asset = require('../models/Asset');

// exports.getAll = async (req, res) => {
//   const assets = await Asset.find({ createdBy: req.user.id });
//   res.json(assets);
// };

// exports.create = async (req, res) => {
//   const asset = await Asset.create({ ...req.body, createdBy: req.user.id });
//   res.status(201).json(asset);
// };

// exports.update = async (req, res) => {
//   const asset = await Asset.findOneAndUpdate(
//     { _id: req.params.id, createdBy: req.user.id },
//     req.body,
//     { new: true }
//   );
//   res.json(asset);
// };

// exports.remove = async (req, res) => {
//   await Asset.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
//   res.json({ message: 'Asset deleted' });
// };
const Asset = require('../models/Asset');
const ping = require('ping');
const isReachable = require('is-reachable'); // More reliable reachability check
const net = require('net');
const geoEnrichmentMiddleware = require('../middleware/geoEnrichment');

// Get all assets
exports.getAssets = async (req, res) => {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching assets.' });
  }
};

// Get a single asset with its open-finding rollup (for the detail page)
exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const Vulnerability = require('../models/Vulnerability');
    const sla = require('../utils/sla');
    const openFilter = { asset: asset._id, status: { $nin: Array.from(sla.CLOSED_STATUSES) } };
    const [findings, severityAgg] = await Promise.all([
      Vulnerability.countDocuments(openFilter),
      Vulnerability.aggregate([
        { $match: openFilter },
        { $group: { _id: '$severity', count: { $sum: 1 }, maxRisk: { $max: { $ifNull: ['$riskScore', 0] } } } },
      ]),
    ]);
    const sev = Object.fromEntries(severityAgg.map(s => [s._id, s.count]));
    const maxRisk = severityAgg.reduce((m, s) => Math.max(m, s.maxRisk || 0), 0);

    res.json({
      asset,
      summary: {
        openFindings: findings,
        severity: { Critical: sev.Critical || 0, High: sev.High || 0, Medium: sev.Medium || 0, Low: sev.Low || 0 },
        maxRisk,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load asset', error: err.message });
  }
};

// Create new asset
exports.createAsset = async (req, res) => {
  try {
    const newAsset = new Asset(req.body);
    await newAsset.save();
    
    // Enrich with geolocation data asynchronously (non-blocking)
    geoEnrichmentMiddleware.enrichAsset(newAsset)
      .catch(error => console.error('❌ Geo enrichment failed:', error));
    
    res.status(201).json(newAsset);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

// Update asset
exports.updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    
    // Enrich with geolocation data if IP was updated
    if (req.body.ip && req.body.ip !== asset.ip) {
      geoEnrichmentMiddleware.enrichAsset(asset)
        .catch(error => console.error('❌ Geo enrichment failed:', error));
    }
    
    res.json(asset);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
};

// Delete asset
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error while deleting asset.' });
  }
};

// Search/filter assets
exports.searchAssets = async (req, res) => {
  const query = req.query.q || '';
  try {
    const results = await Asset.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { ip: { $regex: query, $options: 'i' } },
        { type: { $regex: query, $options: 'i' } },
        { serverType: { $regex: query, $options: 'i' } },
        { manufacturer: { $regex: query, $options: 'i' } },
        { os: { $regex: query, $options: 'i' } },
        { status: { $regex: query, $options: 'i' } },
        { hostDepartment: { $regex: query, $options: 'i' } },
        { serverAdministrator: { $regex: query, $options: 'i' } },
        { owner: { $regex: query, $options: 'i' } },
        { state: { $regex: query, $options: 'i' } },
        { exposure: { $regex: query, $options: 'i' } },
        { activeProtocols: { $elemMatch: { $regex: query, $options: 'i' } } },
        { wsType: { $regex: query, $options: 'i' } },
        { dbType: { $regex: query, $options: 'i' } },
        // Add geolocation fields to search
        { 'geoLocation.country': { $regex: query, $options: 'i' } },
        { 'geoLocation.city': { $regex: query, $options: 'i' } },
        { 'geoLocation.isp': { $regex: query, $options: 'i' } },
        { 'geoLocation.asnOrganization': { $regex: query, $options: 'i' } },
      ],
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error during search.' });
  }
};

// Get assets by geolocation
exports.getAssetsByLocation = async (req, res) => {
  try {
    const { country, city, isp } = req.query;
    
    const filter = {};
    if (country) filter['geoLocation.country'] = country;
    if (city) filter['geoLocation.city'] = city;
    if (isp) filter['geoLocation.isp'] = isp;
    
    const assets = await Asset.find(filter).sort({ createdAt: -1 });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching assets by location.' });
  }
};

// Get geolocation statistics
exports.getGeoStats = async (req, res) => {
  try {
    const stats = await geoEnrichmentMiddleware.getGeoStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error while fetching geolocation statistics.' });
  }
};

// Bulk enrich assets with geolocation
exports.bulkEnrichAssets = async (req, res) => {
  try {
    const assets = await Asset.find({
      $or: [
        { 'geoLocation.lastUpdated': { $exists: false } },
        { 'geoLocation.country': 'Unknown' }
      ]
    });

    if (assets.length === 0) {
      return res.json({ message: 'All assets already have geolocation data', enriched: 0 });
    }

    const enrichedAssets = await geoEnrichmentMiddleware.enrichAssets(assets);
    
    res.json({ 
      message: `Successfully enriched ${enrichedAssets.length} assets`, 
      enriched: enrichedAssets.length 
    });
  } catch (err) {
    console.error('Bulk enrichment failed:', err);
    res.status(500).json({ message: 'Failed to bulk enrich assets.' });
  }
};

// Update stale geolocation data
exports.updateStaleGeoData = async (req, res) => {
  try {
    await geoEnrichmentMiddleware.updateStaleGeoData();
    res.json({ message: 'Stale geolocation data updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update stale geolocation data.' });
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

// assset status ping
exports.pingAssets = async (req, res) => {
  try {
    const assets = await Asset.find();

    const updatedAssets = await Promise.all(
      assets.map(async (asset) => {
        let reachable = false;

        try {
          // First, try ICMP ping
          const pingResult = await ping.promise.probe(asset.ip, { timeout: 100 });
          reachable = pingResult.alive;

          // If ICMP fails, try TCP check as fallback
          if (!reachable) {
            reachable = await isReachable(`${asset.ip}:80`); // Check port 80 (HTTP)
          }
        } catch (err) {
          console.error(`Error checking reachability for ${asset.ip}:`, err);
        }

        const newStatus = reachable ? 'Online' : 'Offline';

        // Only update DB if status changed
        if (asset.status !== newStatus) {
          asset.status = newStatus;
          await asset.save();
        }

        return asset;
      })
    );

    res.json(updatedAssets);
  } catch (err) {
    console.error('Ping all assets failed:', err);
    res.status(500).json({ message: 'Failed to ping assets.' });
  }
};

// ===========================================================================
// Workstream C — import/export, bulk ops, dedupe, subnet discovery
// ===========================================================================

const { discoverHosts } = require('../services/scannerService');

// Columns used for CSV import/export (kept simple and dependency-free).
const CSV_COLUMNS = [
  'name', 'ip', 'type', 'criticality', 'environment', 'tags', 'businessOwner',
  'status', 'exposure', 'os', 'owner', 'hostDepartment', 'serverAdministrator', 'description'
];

function toCsvValue(v) {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  // Minimal RFC-4180-ish parser (handles quoted fields + embedded commas/quotes).
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// GET /api/assets/export  -> text/csv download
exports.exportAssetsCsv = async (req, res) => {
  try {
    const assets = await Asset.find().sort({ name: 1 });
    const header = CSV_COLUMNS.join(',');
    const lines = assets.map(a => CSV_COLUMNS.map(col => toCsvValue(a[col])).join(','));
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Failed to export assets.', error: err.message });
  }
};

// POST /api/assets/import  { csv: "<raw csv text>" }  -> upsert by IP
exports.importAssetsCsv = async (req, res) => {
  try {
    const csv = req.body.csv || '';
    const rows = parseCsv(csv);
    if (rows.length < 2) return res.status(400).json({ message: 'CSV has no data rows.' });

    const header = rows[0].map(h => h.trim());
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 1; i < rows.length; i++) {
      const rec = {};
      header.forEach((h, idx) => { rec[h] = (rows[i][idx] || '').trim(); });
      if (!rec.ip || !rec.name) { results.skipped++; continue; }
      if (rec.tags) rec.tags = rec.tags.split('|').map(t => t.trim()).filter(Boolean);
      try {
        const existing = await Asset.findOne({ ip: rec.ip });
        if (existing) {
          Object.assign(existing, rec);
          await existing.save();
          results.updated++;
        } else {
          await Asset.create(rec);
          results.created++;
        }
      } catch (e) {
        results.errors.push({ ip: rec.ip, error: e.message });
      }
    }
    res.json({ message: 'Import complete', ...results });
  } catch (err) {
    res.status(500).json({ message: 'Failed to import assets.', error: err.message });
  }
};

// PATCH /api/assets/bulk  { ids: [...], update: { criticality, environment, tags, status, ... } }
exports.bulkUpdateAssets = async (req, res) => {
  try {
    const { ids, update } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const allowed = ['criticality', 'environment', 'tags', 'status', 'exposure', 'businessOwner', 'owner', 'hostDepartment'];
    const set = {};
    Object.keys(update || {}).forEach(k => { if (allowed.includes(k)) set[k] = update[k]; });
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided', allowed });
    }
    const result = await Asset.updateMany({ _id: { $in: ids } }, { $set: set });
    res.json({ message: 'Bulk update complete', matched: result.matchedCount, modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Bulk update failed', error: err.message });
  }
};

// GET /api/assets/duplicates  -> assets sharing an IP
exports.findDuplicateAssets = async (req, res) => {
  try {
    const dups = await Asset.aggregate([
      { $group: { _id: '$ip', count: { $sum: 1 }, ids: { $push: '$_id' }, names: { $push: '$name' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ duplicateGroups: dups.length, groups: dups });
  } catch (err) {
    res.status(500).json({ message: 'Failed to find duplicates', error: err.message });
  }
};

// POST /api/assets/discover  { target: "10.0.0.0/24" } -> live hosts (not yet saved)
exports.discoverSubnet = async (req, res) => {
  try {
    const { target } = req.body;
    if (!target) return res.status(400).json({ message: 'target (IP/CIDR/range) is required' });
    const hosts = await discoverHosts(target);
    // Flag which live hosts are already known assets.
    const known = await Asset.find({ ip: { $in: hosts.map(h => h.ip) } }, 'ip');
    const knownIps = new Set(known.map(a => a.ip));
    const enriched = hosts.map(h => ({ ...h, existingAsset: knownIps.has(h.ip) }));
    res.json({ target, total: enriched.length, newHosts: enriched.filter(h => !h.existingAsset).length, hosts: enriched });
  } catch (err) {
    res.status(500).json({ message: 'Host discovery failed', error: err.message });
  }
};

// POST /api/assets/promote  { hosts: [{ip, hostname, mac, vendor}], defaults: {criticality, environment, type} }
exports.promoteHosts = async (req, res) => {
  try {
    const { hosts, defaults = {} } = req.body;
    if (!Array.isArray(hosts) || hosts.length === 0) {
      return res.status(400).json({ message: 'hosts array is required' });
    }
    const created = [];
    for (const h of hosts) {
      if (!h.ip) continue;
      const exists = await Asset.findOne({ ip: h.ip });
      if (exists) continue;
      const asset = await Asset.create({
        name: h.hostname || h.ip,
        ip: h.ip,
        type: defaults.type || 'Server',
        criticality: defaults.criticality || 'Medium',
        environment: defaults.environment || 'Production',
        status: 'Online',
        description: h.vendor ? `Discovered host (${h.vendor})` : 'Discovered host',
      });
      geoEnrichmentMiddleware.enrichAsset(asset).catch(() => {});
      created.push(asset);
    }
    res.json({ message: `Promoted ${created.length} host(s) to assets`, created });
  } catch (err) {
    res.status(500).json({ message: 'Failed to promote hosts', error: err.message });
  }
};
