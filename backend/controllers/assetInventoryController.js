const Asset = require('../models/Asset');
const { AssetCategory, AssetTag, AssetClassification, AssetGroup } = require('../models/AssetClassification');
const assetDiscoveryService = require('../services/assetDiscoveryService');
const assetClassificationService = require('../services/assetClassificationService');
const { createLogger } = require('../utils/logger');

const inventoryLogger = createLogger('asset-inventory');

// Get comprehensive inventory dashboard data
exports.getInventoryDashboard = async (req, res) => {
  try {
    const [
      totalAssets,
      onlineAssets,
      offlineAssets,
      maintenanceAssets,
      assetTypes,
      classificationStats,
      recentAssets,
      criticalAssets,
      complianceStats,
      geoDistribution,
      riskDistribution
    ] = await Promise.all([
      Asset.countDocuments(),
      Asset.countDocuments({ status: 'Online' }),
      Asset.countDocuments({ status: 'Offline' }),
      Asset.countDocuments({ status: 'Maintenance' }),
      Asset.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      assetClassificationService.getClassificationStats(),
      Asset.find().sort({ createdAt: -1 }).limit(5).select('name ip type status createdAt'),
      AssetClassification.find({ criticality: 'critical' })
        .populate('asset', 'name ip type status')
        .populate('category', 'name')
        .limit(10),
      AssetClassification.aggregate([
        { $group: { _id: '$complianceStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Asset.aggregate([
        { $match: { 'geoLocation.country': { $ne: 'Unknown' } } },
        { $group: { _id: '$geoLocation.country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AssetClassification.aggregate([
        { $bucket: {
          groupBy: '$riskScore',
          boundaries: [0, 25, 50, 75, 100],
          default: 'other',
          output: {
            count: { $sum: 1 },
            assets: { $push: '$asset' }
          }
        }},
        { $lookup: { from: 'assets', localField: 'assets', foreignField: '_id', as: 'assetDetails' } },
        { $project: { count: 1, assetDetails: { $slice: ['$assetDetails', 3] } } }
      ])
    ]);

    const dashboardData = {
      overview: {
        totalAssets,
        onlineAssets,
        offlineAssets,
        maintenanceAssets,
        healthPercentage: totalAssets > 0 ? ((onlineAssets / totalAssets) * 100).toFixed(1) : 0
      },
      assetTypes,
      classification: classificationStats,
      recentAssets,
      criticalAssets,
      compliance: complianceStats,
      geoDistribution,
      riskDistribution,
      scanStatus: assetDiscoveryService.getScanStatus()
    };

    res.json(dashboardData);
  } catch (error) {
    inventoryLogger.error('Failed to get inventory dashboard', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to load inventory dashboard', error: error.message });
  }
};

// Advanced search with multiple filters
exports.searchAssets = async (req, res) => {
  try {
    const {
      query = '',
      type,
      status,
      category,
      tags,
      criticality,
      complianceStatus,
      riskScoreMin,
      riskScoreMax,
      country,
      city,
      exposure,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build search query
    const searchQuery = {};

    // Text search across multiple fields
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

    // Basic asset filters
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

    // Get assets matching basic criteria
    let assets = await Asset.find(searchQuery)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get asset IDs for classification filtering
    const assetIds = assets.map(asset => asset._id);

    // Build classification query
    const classificationQuery = { asset: { $in: assetIds } };
    if (category) classificationQuery.category = { $in: Array.isArray(category) ? category : [category] };
    if (tags && tags.length > 0) {
      classificationQuery.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    }
    if (criticality) classificationQuery.criticality = { $in: Array.isArray(criticality) ? criticality : [criticality] };
    if (complianceStatus) classificationQuery.complianceStatus = { $in: Array.isArray(complianceStatus) ? complianceStatus : [complianceStatus] };
    
    if (riskScoreMin !== undefined || riskScoreMax !== undefined) {
      classificationQuery.riskScore = {};
      if (riskScoreMin !== undefined) classificationQuery.riskScore.$gte = parseInt(riskScoreMin);
      if (riskScoreMax !== undefined) classificationQuery.riskScore.$lte = parseInt(riskScoreMax);
    }

    // Get classifications
    const classifications = await AssetClassification.find(classificationQuery)
      .populate('category', 'name icon color')
      .populate('tags', 'name color category');

    // Create classification map
    const classificationMap = new Map();
    classifications.forEach(cls => {
      classificationMap.set(cls.asset.toString(), cls);
    });

    // Filter assets based on classification criteria
    let filteredAssets = assets;
    if (category || tags || criticality || complianceStatus || riskScoreMin !== undefined || riskScoreMax !== undefined) {
      filteredAssets = assets.filter(asset => classificationMap.has(asset._id.toString()));
    }

    // Combine asset data with classification data
    const enrichedAssets = filteredAssets.map(asset => {
      const classification = classificationMap.get(asset._id.toString());
      return {
        ...asset.toObject(),
        classification: classification ? {
          category: classification.category,
          tags: classification.tags,
          criticality: classification.criticality,
          riskScore: classification.riskScore,
          complianceStatus: classification.complianceStatus,
          businessImpact: classification.businessImpact,
          technicalImpact: classification.technicalImpact
        } : null
      };
    });

    // Get total count for pagination
    const totalAssets = await Asset.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalAssets / limit);

    res.json({
      assets: enrichedAssets,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalAssets,
        limit: parseInt(limit)
      },
      filters: {
        query,
        type,
        status,
        category,
        tags,
        criticality,
        complianceStatus,
        riskScoreMin,
        riskScoreMax,
        country,
        city,
        exposure,
        dateFrom,
        dateTo
      }
    });
  } catch (error) {
    inventoryLogger.error('Failed to search assets', {
      details: { error: error.message, query: req.query }
    });
    res.status(500).json({ message: 'Failed to search assets', error: error.message });
  }
};

// Start asset discovery scan
exports.startDiscovery = async (req, res) => {
  try {
    const { networkRange, options = {} } = req.body;

    if (!networkRange) {
      return res.status(400).json({ message: 'Network range is required' });
    }

    // Check if scan is already running
    const scanStatus = assetDiscoveryService.getScanStatus();
    if (scanStatus.isScanning) {
      return res.status(409).json({ message: 'Discovery scan is already in progress' });
    }

    // Start discovery in background
    assetDiscoveryService.discoverNetworkRange(networkRange, options)
      .then(async (result) => {
        if (result.success) {
          // Auto-import discovered assets
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

// Get discovery scan status
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

// Cancel discovery scan
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

// Get asset classification data
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

// Update asset classification
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

// Get classification categories
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

// Get tags
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

// Create category
exports.createCategory = async (req, res) => {
  try {
    const categoryData = req.body;
    const userId = req.user.id;

    const category = await assetClassificationService.createCategory(categoryData, userId);
    
    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    inventoryLogger.error('Failed to create category', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
};

// Create tag
exports.createTag = async (req, res) => {
  try {
    const tagData = req.body;
    const userId = req.user.id;

    const tag = await assetClassificationService.createTag(tagData, userId);
    
    res.status(201).json({
      message: 'Tag created successfully',
      tag
    });
  } catch (error) {
    inventoryLogger.error('Failed to create tag', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to create tag', error: error.message });
  }
};

// Get asset groups
exports.getAssetGroups = async (req, res) => {
  try {
    const groups = await AssetGroup.find({ isActive: true })
      .populate('owner', 'username email')
      .populate('assets', 'name ip type status')
      .sort({ name: 1 });

    res.json(groups);
  } catch (error) {
    inventoryLogger.error('Failed to get asset groups', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to get asset groups', error: error.message });
  }
};

// Create asset group
exports.createAssetGroup = async (req, res) => {
  try {
    const groupData = req.body;
    const userId = req.user.id;

    const group = await assetClassificationService.createAssetGroup(groupData, userId);
    
    res.status(201).json({
      message: 'Asset group created successfully',
      group
    });
  } catch (error) {
    inventoryLogger.error('Failed to create asset group', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to create asset group', error: error.message });
  }
};

// Auto-classify assets
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

// Initialize default classifications
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

// Get inventory analytics
exports.getInventoryAnalytics = async (req, res) => {
  try {
    const { timeframe = '30d', metric } = req.query;
    
    const analytics = await this.generateInventoryAnalytics(timeframe, metric);
    
    res.json(analytics);
  } catch (error) {
    inventoryLogger.error('Failed to get inventory analytics', {
      details: { error: error.message }
    });
    res.status(500).json({ message: 'Failed to get inventory analytics', error: error.message });
  }
};

// Generate inventory analytics
exports.generateInventoryAnalytics = async (timeframe = '30d', metric = 'all') => {
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
      // Asset growth over time
      analytics.metrics.assetGrowth = await Asset.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: now } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]);
    }

    if (metric === 'all' || metric === 'statusChanges') {
      // Status changes over time
      analytics.metrics.statusChanges = await Asset.aggregate([
        { $match: { updatedAt: { $gte: startDate, $lte: now } } },
        { $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.date': 1, '_id.status': 1 } }
      ]);
    }

    if (metric === 'all' || metric === 'riskTrends') {
      // Risk score trends
      analytics.metrics.riskTrends = await AssetClassification.aggregate([
        { $match: { lastAssessed: { $gte: startDate, $lte: now } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastAssessed' } },
          avgRiskScore: { $avg: '$riskScore' },
          maxRiskScore: { $max: '$riskScore' },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]);
    }

    if (metric === 'all' || metric === 'complianceTrends') {
      // Compliance trends
      analytics.metrics.complianceTrends = await AssetClassification.aggregate([
        { $match: { lastAssessed: { $gte: startDate, $lte: now } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastAssessed' } },
          complianceStatus: '$complianceStatus',
          count: { $sum: 1 }
        }},
        { $sort: { '_id': 1, 'complianceStatus': 1 } }
      ]);
    }

    return analytics;
  } catch (error) {
    inventoryLogger.error('Failed to generate inventory analytics', {
      details: { error: error.message, timeframe, metric }
    });
    throw error;
  }
};
