const { AssetCategory, AssetTag, AssetClassification, AssetGroup } = require('../models/AssetClassification');
const Asset = require('../models/Asset');
const { createLogger } = require('../utils/logger');

const classificationLogger = createLogger('asset-classification');

class AssetClassificationService {
  constructor() {
    this.defaultCategories = [
      {
        name: 'Servers',
        description: 'Physical and virtual servers',
        icon: 'fa-server',
        color: '#007bff',
        criticality: 'high',
        level: 0
      },
      {
        name: 'Workstations',
        description: 'Desktop and laptop computers',
        icon: 'fa-desktop',
        color: '#28a745',
        criticality: 'medium',
        level: 0
      },
      {
        name: 'Network Devices',
        description: 'Routers, switches, firewalls',
        icon: 'fa-network-wired',
        color: '#17a2b8',
        criticality: 'high',
        level: 0
      },
      {
        name: 'Databases',
        description: 'Database servers and instances',
        icon: 'fa-database',
        color: '#dc3545',
        criticality: 'critical',
        level: 0
      },
      {
        name: 'Applications',
        description: 'Software applications and services',
        icon: 'fa-cube',
        color: '#fd7e14',
        criticality: 'medium',
        level: 0
      },
      {
        name: 'Storage',
        description: 'Storage systems and arrays',
        icon: 'fa-hdd',
        color: '#6f42c1',
        criticality: 'high',
        level: 0
      },
      {
        name: 'Cloud Resources',
        description: 'Cloud-based assets and services',
        icon: 'fa-cloud',
        color: '#20c997',
        criticality: 'high',
        level: 0
      }
    ];

    this.defaultTags = [
      { name: 'production', category: 'environment', color: '#dc3545' },
      { name: 'staging', category: 'environment', color: '#fd7e14' },
      { name: 'development', category: 'environment', color: '#6c757d' },
      { name: 'critical', category: 'purpose', color: '#dc3545' },
      { name: 'backup', category: 'purpose', color: '#17a2b8' },
      { name: 'test', category: 'purpose', color: '#28a745' },
      { name: 'pci-dss', category: 'compliance', color: '#dc3545' },
      { name: 'hipaa', category: 'compliance', color: '#dc3545' },
      { name: 'gdpr', category: 'compliance', color: '#fd7e14' },
      { name: 'dmz', category: 'security', color: '#dc3545' },
      { name: 'internal', category: 'security', color: '#28a745' },
      { name: 'external', category: 'security', color: '#dc3545' }
    ];
  }

  // Initialize default categories and tags
  async initializeDefaults(userId) {
    try {
      classificationLogger.info('Initializing default asset classifications');

      // Create default categories
      for (const categoryData of this.defaultCategories) {
        const existingCategory = await AssetCategory.findOne({ name: categoryData.name });
        if (!existingCategory) {
          await AssetCategory.create({
            ...categoryData,
            createdBy: userId
          });
          classificationLogger.info(`Created default category: ${categoryData.name}`);
        }
      }

      // Create default tags
      for (const tagData of this.defaultTags) {
        const existingTag = await AssetTag.findOne({ name: tagData.name });
        if (!existingTag) {
          await AssetTag.create({
            ...tagData,
            createdBy: userId
          });
          classificationLogger.info(`Created default tag: ${tagData.name}`);
        }
      }

      classificationLogger.info('Default classifications initialized successfully');
      return { success: true };

    } catch (error) {
      classificationLogger.error('Failed to initialize default classifications', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Create new category
  async createCategory(categoryData, userId) {
    try {
      // Set level based on parent
      if (categoryData.parent) {
        const parent = await AssetCategory.findById(categoryData.parent);
        if (parent) {
          categoryData.level = parent.level + 1;
        }
      } else {
        categoryData.level = 0;
      }

      categoryData.createdBy = userId;
      
      const category = await AssetCategory.create(categoryData);
      classificationLogger.info(`Created category: ${category.name}`);

      return category;
    } catch (error) {
      classificationLogger.error('Failed to create category', {
        details: { error: error.message, categoryData }
      });
      throw error;
    }
  }

  // Create new tag
  async createTag(tagData, userId) {
    try {
      tagData.createdBy = userId;
      tagData.name = tagData.name.toLowerCase().trim();
      
      const tag = await AssetTag.create(tagData);
      classificationLogger.info(`Created tag: ${tag.name}`);

      return tag;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Tag already exists');
      }
      classificationLogger.error('Failed to create tag', {
        details: { error: error.message, tagData }
      });
      throw error;
    }
  }

  // Classify asset
  async classifyAsset(assetId, classificationData, userId) {
    try {
      const asset = await Asset.findById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Check if asset is already classified
      const existingClassification = await AssetClassification.findOne({ asset: assetId });
      
      if (existingClassification) {
        // Update existing classification
        Object.assign(existingClassification, classificationData);
        existingClassification.assessedBy = userId;
        existingClassification.lastAssessed = new Date();
        
        if (classificationData.tags) {
          await this.updateTagUsage(classificationData.tags, existingClassification.tags);
        }
        
        await existingClassification.save();
        classificationLogger.info(`Updated classification for asset: ${asset.name}`);
        return existingClassification;
      } else {
        // Create new classification
        classificationData.asset = assetId;
        classificationData.assessedBy = userId;
        classificationData.lastAssessed = new Date();
        
        const classification = await AssetClassification.create(classificationData);
        
        // Update tag usage
        if (classificationData.tags) {
          await this.updateTagUsage(classificationData.tags, []);
        }
        
        classificationLogger.info(`Created classification for asset: ${asset.name}`);
        return classification;
      }
    } catch (error) {
      classificationLogger.error('Failed to classify asset', {
        details: { error: error.message, assetId, classificationData }
      });
      throw error;
    }
  }

  // Update tag usage counts
  async updateTagUsage(newTags, oldTags = []) {
    try {
      const newTagIds = newTags.map(tag => typeof tag === 'string' ? tag : tag._id);
      const oldTagIds = oldTags.map(tag => typeof tag === 'string' ? tag : tag._id);
      
      // Increment usage for new tags
      await AssetTag.updateMany(
        { _id: { $in: newTagIds } },
        { $inc: { usageCount: 1 } }
      );
      
      // Decrement usage for removed tags
      const removedTags = oldTagIds.filter(id => !newTagIds.includes(id));
      if (removedTags.length > 0) {
        await AssetTag.updateMany(
          { _id: { $in: removedTags } },
          { $inc: { usageCount: -1 } }
        );
      }
    } catch (error) {
      classificationLogger.error('Failed to update tag usage', {
        details: { error: error.message, newTags, oldTags }
      });
    }
  }

  // Get asset classification with full details
  async getAssetClassification(assetId) {
    try {
      const classification = await AssetClassification.findOne({ asset: assetId })
        .populate('category', 'name description icon color criticality')
        .populate('tags', 'name color category')
        .populate('assessedBy', 'username email')
        .populate('asset', 'name ip type status');

      if (!classification) {
        return null;
      }

      // Get category path
      const categoryPath = await classification.category.getFullPath();
      
      return {
        ...classification.toObject(),
        categoryPath,
        riskScore: classification.calculateRiskScore()
      };
    } catch (error) {
      classificationLogger.error('Failed to get asset classification', {
        details: { error: error.message, assetId }
      });
      throw error;
    }
  }

  // Get all categories with hierarchy
  async getCategoryHierarchy() {
    try {
      const categories = await AssetCategory.find({ isActive: true })
        .populate('parent', 'name')
        .sort({ level: 1, name: 1 });

      // Build hierarchy tree
      const categoryMap = new Map();
      const rootCategories = [];

      categories.forEach(category => {
        categoryMap.set(category._id.toString(), { ...category.toObject(), children: [] });
      });

      categories.forEach(category => {
        const categoryObj = categoryMap.get(category._id.toString());
        if (category.parent && categoryMap.has(category.parent._id.toString())) {
          categoryMap.get(category.parent._id.toString()).children.push(categoryObj);
        } else {
          rootCategories.push(categoryObj);
        }
      });

      return rootCategories;
    } catch (error) {
      classificationLogger.error('Failed to get category hierarchy', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Get popular tags
  async getPopularTags(limit = 20) {
    try {
      const tags = await AssetTag.find({ isActive: true })
        .sort({ usageCount: -1, name: 1 })
        .limit(limit);

      return tags;
    } catch (error) {
      classificationLogger.error('Failed to get popular tags', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Search assets by classification
  async searchAssetsByClassification(criteria) {
    try {
      const query = {};
      
      if (criteria.category) {
        query.category = criteria.category;
      }
      
      if (criteria.tags && criteria.tags.length > 0) {
        query.tags = { $in: criteria.tags };
      }
      
      if (criteria.criticality) {
        query.criticality = criteria.criticality;
      }
      
      if (criteria.complianceStatus) {
        query.complianceStatus = criteria.complianceStatus;
      }
      
      if (criteria.riskScoreMin !== undefined || criteria.riskScoreMax !== undefined) {
        query.riskScore = {};
        if (criteria.riskScoreMin !== undefined) {
          query.riskScore.$gte = criteria.riskScoreMin;
        }
        if (criteria.riskScoreMax !== undefined) {
          query.riskScore.$lte = criteria.riskScoreMax;
        }
      }

      const classifications = await AssetClassification.find(query)
        .populate('asset', 'name ip type status os manufacturer')
        .populate('category', 'name icon color')
        .populate('tags', 'name color')
        .sort({ 'asset.name': 1 });

      return classifications;
    } catch (error) {
      classificationLogger.error('Failed to search assets by classification', {
        details: { error: error.message, criteria }
      });
      throw error;
    }
  }

  // Create asset group
  async createAssetGroup(groupData, userId) {
    try {
      groupData.owner = userId;
      
      const group = await AssetGroup.create(groupData);
      
      // Update dynamic groups
      if (group.type === 'dynamic' || group.type === 'hybrid') {
        await group.updateDynamicAssets();
      }
      
      classificationLogger.info(`Created asset group: ${group.name}`);
      return group;
    } catch (error) {
      classificationLogger.error('Failed to create asset group', {
        details: { error: error.message, groupData }
      });
      throw error;
    }
  }

  // Get classification statistics
  async getClassificationStats() {
    try {
      const [
        totalAssets,
        classifiedAssets,
        categoryStats,
        criticalityStats,
        complianceStats,
        riskDistribution,
        tagStats
      ] = await Promise.all([
        Asset.countDocuments(),
        AssetClassification.countDocuments(),
        AssetClassification.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $lookup: { from: 'assetcategories', localField: '_id', foreignField: '_id', as: 'category' } },
          { $unwind: '$category' },
          { $project: { categoryName: '$category.name', count: 1, color: '$category.color' } },
          { $sort: { count: -1 } }
        ]),
        AssetClassification.aggregate([
          { $group: { _id: '$criticality', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        AssetClassification.aggregate([
          { $group: { _id: '$complianceStatus', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        AssetClassification.aggregate([
          { $bucket: {
            groupBy: '$riskScore',
            boundaries: [0, 25, 50, 75, 100],
            default: 'other',
            output: { count: { $sum: 1 } }
          }}
        ]),
        AssetTag.find({ isActive: true })
          .sort({ usageCount: -1 })
          .limit(10)
          .select('name usageCount color category')
      ]);

      return {
        totalAssets,
        classifiedAssets,
        classificationRate: totalAssets > 0 ? (classifiedAssets / totalAssets * 100).toFixed(1) : 0,
        categoryStats,
        criticalityStats,
        complianceStats,
        riskDistribution,
        popularTags: tagStats
      };
    } catch (error) {
      classificationLogger.error('Failed to get classification statistics', {
        details: { error: error.message }
      });
      throw error;
    }
  }

  // Auto-classify unclassified assets
  async autoClassifyAssets(userId) {
    try {
      classificationLogger.info('Starting auto-classification of assets');

      const unclassifiedAssets = await Asset.find({
        _id: { $nin: await AssetClassification.distinct('asset') }
      });

      const results = {
        processed: 0,
        classified: 0,
        skipped: 0,
        errors: []
      };

      for (const asset of unclassifiedAssets) {
        try {
          results.processed++;
          
          // Simple auto-classification logic
          let categoryId = null;
          let tags = [];
          let criticality = 'medium';

          // Determine category based on asset type and properties
          if (asset.type === 'Server') {
            const serverCategory = await AssetCategory.findOne({ name: 'Servers' });
            categoryId = serverCategory?._id;
          } else if (asset.type === 'Database') {
            const dbCategory = await AssetCategory.findOne({ name: 'Databases' });
            categoryId = dbCategory?._id;
            criticality = 'high';
          } else if (asset.type === 'Application') {
            const appCategory = await AssetCategory.findOne({ name: 'Applications' });
            categoryId = appCategory?._id;
          }

          // Add tags based on properties
          if (asset.exposure === 'Public') {
            const externalTag = await AssetTag.findOne({ name: 'external' });
            if (externalTag) tags.push(externalTag._id);
          } else {
            const internalTag = await AssetTag.findOne({ name: 'internal' });
            if (internalTag) tags.push(internalTag._id);
          }

          if (categoryId) {
            await this.classifyAsset(asset._id, {
              category: categoryId,
              tags,
              criticality,
              businessImpact: criticality,
              technicalImpact: criticality,
              notes: 'Auto-classified based on asset properties'
            }, userId);
            
            results.classified++;
          } else {
            results.skipped++;
          }

        } catch (error) {
          results.errors.push({
            assetId: asset._id,
            assetName: asset.name,
            error: error.message
          });
        }
      }

      classificationLogger.info('Auto-classification completed', {
        details: results
      });

      return results;
    } catch (error) {
      classificationLogger.error('Auto-classification failed', {
        details: { error: error.message }
      });
      throw error;
    }
  }
}

// Create singleton instance
const assetClassificationService = new AssetClassificationService();

module.exports = assetClassificationService;
