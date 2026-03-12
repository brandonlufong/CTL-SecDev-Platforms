const Asset = require('../models/Asset');
const Device = require('../models/Device');
const { AssetCategory, AssetTag, AssetClassification, AssetGroup } = require('../models/AssetClassification');
const assetDiscoveryService = require('../services/assetDiscoveryService');
const assetClassificationService = require('../services/assetClassificationService');
const assetMonitoringService = require('../services/assetMonitoringService');
const { createLogger } = require('../utils/logger');

const inventoryLogger = createLogger('unified-asset-inventory');

// Get unified inventory dashboard data
exports.getUnifiedInventoryDashboard = async (req, res) => {
  try {
    // Get both assets and devices
    const [serverAssets, networkDevices] = await Promise.all([
      Asset.find().sort({ createdAt: -1 }),
      Device.find().sort({ createdAt: -1 })
    ]);

    // Calculate unified statistics
    const totalAssets = serverAssets.length + networkDevices.length;
    const onlineAssets = serverAssets.filter(a => a.status === 'Online').length + 
                         networkDevices.filter(d => d.status === 'Online').length;
    const offlineAssets = serverAssets.filter(a => a.status === 'Offline').length + 
                          networkDevices.filter(d => d.status === 'Offline').length;
    const maintenanceAssets = serverAssets.filter(a => a.status === 'Maintenance').length + 
                             networkDevices.filter(d => d.status === 'Maintenance').length;

    // Asset type distribution
    const assetTypes = [
      { _id: 'Servers', count: serverAssets.length },
      { _id: 'Network Devices', count: networkDevices.length }
    ];

    // Server-specific breakdown
    const serverBreakdown = serverAssets.reduce((acc, asset) => {
      const type = asset.type || 'Server';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Device breakdown
    const deviceBreakdown = networkDevices.reduce((acc, device) => {
      const category = device.deviceCategory || 'Router';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Geographic distribution
    const geoDistribution = [
      ...serverAssets.map(asset => ({ _id: asset.geoLocation?.country || 'Unknown', count: 1 })),
      ...networkDevices.map(device => ({ _id: device.geoLocation?.country || 'Unknown', count: 1 }))
    ].reduce((acc, item) => {
      const existing = acc.find(a => a._id === item._id);
      if (existing) {
        existing.count += item.count;
      } else {
        acc.push(item);
      }
      return acc;
    }, []);

    // Get classification stats (only for server assets)
    const classificationStats = await assetClassificationService.getClassificationStats();

    // Recent assets (both types)
    const recentAssets = [
      ...serverAssets.slice(0, 3).map(asset => ({ ...asset.toObject(), assetType: 'Server' })),
      ...networkDevices.slice(0, 3).map(device => ({ ...device.toObject(), assetType: 'Network Device' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    const dashboardData = {
      overview: {
        totalAssets,
        serverAssets: serverAssets.length,
        networkDevices: networkDevices.length,
        onlineAssets,
        offlineAssets,
        maintenanceAssets,
        healthPercentage: totalAssets > 0 ? ((onlineAssets / totalAssets) * 100).toFixed(1) : 0
      },
      assetTypes,
      serverBreakdown,
      deviceBreakdown,
      classification: classificationStats,
      recentAssets,
      geoDistribution: geoDistribution.slice(0, 10),
      scanStatus: assetDiscoveryService.getScanStatus(),
      monitoringStatus: assetMonitoringService.getMonitoringStatus()
    };

    res.json(dashboardData);
  } catch (error) {
    inventoryLogger.error('Failed to get unified inventory dashboard', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to load inventory dashboard', error: error.message });
  }
};

// Unified search across both assets and devices
exports.searchUnifiedAssets = async (req, res) => {
  try {
    const {
      query = '',
      assetType = 'all', // 'all', 'servers', 'devices'
      type,
      status,
      category,
      tags,
      criticality,
      complianceStatus,
      country,
      city,
      exposure,
      dateFrom,
      dateTo,
      page = 1,
      limit = 100,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    let results = [];
    let totalCount = 0;

    // Search server assets
    if (assetType === 'all' || assetType === 'servers') {
      const assetQuery = buildAssetQuery({
        query, type, status, category, tags, criticality, 
        complianceStatus, country, city, exposure, dateFrom, dateTo
      });

      const assets = await Asset.find(assetQuery)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

      const assetIds = assets.map(asset => asset._id);
      const classifications = await AssetClassification.find({ asset: { $in: assetIds } })
        .populate('category', 'name icon color')
        .populate('tags', 'name color category');

      const classificationMap = new Map();
      classifications.forEach(cls => {
        classificationMap.set(cls.asset.toString(), cls);
      });

      const enrichedAssets = assets.map(asset => ({
        ...asset.toObject(),
        assetType: 'Server',
        classification: classificationMap.get(asset._id.toString()) || null
      }));

      results.push(...enrichedAssets);
      totalCount += await Asset.countDocuments(assetQuery);
    }

    // Search network devices
    if (assetType === 'all' || assetType === 'devices') {
      const deviceQuery = buildDeviceQuery({
        query, status, country, city, exposure, dateFrom, dateTo
      });

      const devices = await Device.find(deviceQuery)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

      const enrichedDevices = devices.map(device => ({
        ...device.toObject(),
        assetType: 'Network Device',
        classification: null // Devices don't have classification yet
      }));

      results.push(...enrichedDevices);
      totalCount += await Device.countDocuments(deviceQuery);
    }

    // Sort combined results
    if (sortBy === 'name') {
      results.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + parseInt(limit));
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      assets: paginatedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalAssets: totalCount,
        limit: parseInt(limit)
      },
      filters: {
        query,
        assetType,
        type,
        status,
        category,
        tags,
        criticality,
        complianceStatus,
        country,
        city,
        exposure,
        dateFrom,
        dateTo
      }
    });
  } catch (error) {
    inventoryLogger.error('Failed to search unified assets', {
      details: { error: error.message, query: req.query }
    });
    res.status(500).json({ message: 'Failed to search assets', error: error.message });
  }
};

// Build query for assets
function buildAssetQuery(filters) {
  const { query, type, status, category, tags, criticality, complianceStatus, country, city, exposure, dateFrom, dateTo } = filters;
  
  const searchQuery = {};

  // Text search
  if (query) {
    searchQuery.$or = [
      { name: { $regex: query, $options: 'i' } },
      { ip: { $regex: query, $options: 'i' } },
      { manufacturer: { $regex: query, $options: 'i' } },
      { model: { $regex: query, $options: 'i' } },
      { os: { $regex: query, $options: 'i' } },
      { hostDepartment: { $regex: query, $options: 'i' } },
      { serverAdministrator: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ];
  }

  // Basic filters
  if (type) searchQuery.type = { $in: Array.isArray(type) ? type : [type] };
  if (status) searchQuery.status = { $in: Array.isArray(status) ? status : [status] };
  if (exposure) searchQuery.exposure = { $in: Array.isArray(exposure) ? exposure : [exposure] };

  // Geolocation filters
  if (country) searchQuery['geoLocation.country'] = { $in: Array.isArray(country) ? country : [country] };
  if (city) searchQuery['geoLocation.city'] = { $in: Array.isArray(city) ? city : [city] };

  // Date range filter
  if (dateFrom || dateTo) {
    searchQuery.createdAt = {};
    if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
  }

  return searchQuery;
}

// Build query for devices
function buildDeviceQuery(filters) {
  const { query, status, country, city, exposure, dateFrom, dateTo } = filters;
  
  const searchQuery = {};

  // Text search
  if (query) {
    searchQuery.$or = [
      { name: { $regex: query, $options: 'i' } },
      { ip: { $regex: query, $options: 'i' } },
      { manufacturer: { $regex: query, $options: 'i' } },
      { model: { $regex: query, $options: 'i' } },
      { nos: { $regex: query, $options: 'i' } },
      { hostDepartment: { $regex: query, $options: 'i' } },
      { serverAdministrator: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ];
  }

  // Basic filters
  if (status) searchQuery.status = { $in: Array.isArray(status) ? status : [status] };
  if (exposure) searchQuery.exposure = { $in: Array.isArray(exposure) ? exposure : [exposure] };

  // Geolocation filters
  if (country) searchQuery['geoLocation.country'] = { $in: Array.isArray(country) ? country : [country] };
  if (city) searchQuery['geoLocation.city'] = { $in: Array.isArray(city) ? city : [city] };

  // Date range filter
  if (dateFrom || dateTo) {
    searchQuery.createdAt = {};
    if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
  }

  return searchQuery;
}

// Get asset classification (only for server assets)
exports.getAssetClassification = async (req, res) => {
  try {
    const { assetId } = req.params;
    
    const classification = await assetClassificationService.getAssetClassification(assetId);
    
    if (!classification) {
      return res.status(404).json({ message: 'Asset classification not found' });
    }

    res.json(classification);
  } catch (error) {
    inventoryLogger.error('Failed to get asset classification', {
      details: { error: error.message, assetId: req.params.assetId }
    });
    res.status(500).json({ message: 'Failed to get asset classification', error: error.message });
  }
};

// Update asset classification (only for server assets)
exports.updateAssetClassification = async (req, res) => {
  try {
    const { assetId } = req.params;
    const classificationData = req.body;
    const userId = req.user.id;

    const classification = await assetClassificationService.classifyAsset(assetId, classificationData, userId);
    
    res.json({
      message: 'Asset classification updated successfully',
      classification
    });
  } catch (error) {
    inventoryLogger.error('Failed to update asset classification', {
      details: { error: error.message, assetId: req.params.assetId }
    });
    res.status(500).json({ message: 'Failed to update asset classification', error: error.message });
  }
};

// Get categories and tags
exports.getCategories = async (req, res) => {
  try {
    const categories = await assetClassificationService.getCategoryHierarchy();
    res.json(categories);
  } catch (error) {
    inventoryLogger.error('Failed to get categories', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to get categories', error: error.message });
  }
};

exports.getTags = async (req, res) => {
  try {
    const { limit = 50, category } = req.query;
    
    let query = { isActive: true };
    if (category) query.category = category;
    
    const tags = await AssetTag.find(query)
      .sort({ usageCount: -1, name: 1 })
      .limit(parseInt(limit));

    res.json(tags);
  } catch (error) {
    inventoryLogger.error('Failed to get tags', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to get tags', error: error.message });
  }
};

// Auto-classify assets (only server assets)
exports.autoClassifyAssets = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const results = await assetClassificationService.autoClassifyAssets(userId);
    
    res.json({
      message: 'Auto-classification completed',
      results
    });
  } catch (error) {
    inventoryLogger.error('Failed to auto-classify assets', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to auto-classify assets', error: error.message });
  }
};

// Initialize defaults
exports.initializeDefaults = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await assetClassificationService.initializeDefaults(userId);
    
    res.json({
      message: 'Default classifications initialized successfully',
      result
    });
  } catch (error) {
    inventoryLogger.error('Failed to initialize defaults', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to initialize defaults', error: error.message });
  }
};

// Discovery operations
exports.startDiscovery = async (req, res) => {
  try {
    const { networkRange, options = {} } = req.body;

    if (!networkRange) {
      return res.status(400).json({ message: 'Network range is required' });
    }

    const scanStatus = assetDiscoveryService.getScanStatus();
    if (scanStatus.isScanning) {
      return res.status(409).json({ message: 'Discovery scan is already in progress' });
    }

    // Start discovery in background
    assetDiscoveryService.discoverNetworkRange(networkRange, options)
      .then(async (result) => {
        if (result.success) {
          // Auto-import discovered assets (will be classified as servers by default)
          try {
            const importResult = await assetDiscoveryService.importDiscoveredAssets(result.assets, {
              autoCreate: true,
              updateExisting: true
            });
            inventoryLogger.info('Auto-import completed', { details: importResult });
          } catch (importError) {
            inventoryLogger.error('Auto-import failed', { details: { error: importError.message } });
          }
        }
      })
      .catch(error => {
        inventoryLogger.error('Discovery scan failed', { details: { error: error.message } });
      });

    res.json({
      message: 'Asset discovery scan started',
      scanId: assetDiscoveryService.currentScan?.id,
      networkRange
    });
  } catch (error) {
    inventoryLogger.error('Failed to start discovery', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to start discovery', error: error.message });
  }
};

exports.getDiscoveryStatus = async (req, res) => {
  try {
    const status = assetDiscoveryService.getScanStatus();
    res.json(status);
  } catch (error) {
    inventoryLogger.error('Failed to get discovery status', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to get discovery status', error: error.message });
  }
};

exports.cancelDiscovery = async (req, res) => {
  try {
    const cancelled = assetDiscoveryService.cancelScan();
    if (cancelled) {
      res.json({ message: 'Discovery scan cancelled successfully' });
    } else {
      res.status(404).json({ message: 'No active scan to cancel' });
    }
  } catch (error) {
    inventoryLogger.error('Failed to cancel discovery', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to cancel discovery', error: error.message });
  }
};

// Get analytics
exports.getInventoryAnalytics = async (req, res) => {
  try {
    const { timeframe = '30d', metric = 'all' } = req.query;
    
    const analytics = await generateUnifiedAnalytics(timeframe, metric);
    
    res.json(analytics);
  } catch (error) {
    inventoryLogger.error('Failed to get inventory analytics', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to get inventory analytics', error: error.message });
  }
};

// Generate unified analytics
async function generateUnifiedAnalytics(timeframe = '30d', metric = 'all') {
  try {
    const now = new Date();
    const startDate = new Date();
    
    // Set start date based on timeframe
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const analytics = {
      timeframe,
      startDate,
      endDate: now,
      metrics: {}
    };

    if (metric === 'all' || metric === 'assetGrowth') {
      // Asset growth over time (both types)
      const [assetGrowth, deviceGrowth] = await Promise.all([
        Asset.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: now } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        Device.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: now } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ])
      ]);

      analytics.metrics.assetGrowth = assetGrowth;
      analytics.metrics.deviceGrowth = deviceGrowth;
    }

    if (metric === 'all' || metric === 'statusChanges') {
      // Status changes over time
      const [assetStatusChanges, deviceStatusChanges] = await Promise.all([
        Asset.aggregate([
          { $match: { updatedAt: { $gte: startDate, $lte: now } } },
          { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, status: '$status' }, count: { $sum: 1 } } },
          { $sort: { '_id.date': 1, '_id.status': 1 } }
        ]),
        Device.aggregate([
          { $match: { updatedAt: { $gte: startDate, $lte: now } } },
          { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, status: '$status' }, count: { $sum: 1 } } },
          { $sort: { '_id.date': 1, '_id.status': 1 } }
        ])
      ]);

      analytics.metrics.statusChanges = { assetStatusChanges, deviceStatusChanges };
    }

    return analytics;
  } catch (error) {
    inventoryLogger.error('Failed to generate unified analytics', {
      details: { error: error.message, timeframe, metric }
    });
    throw error;
  }
}
