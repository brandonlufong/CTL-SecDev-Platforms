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
