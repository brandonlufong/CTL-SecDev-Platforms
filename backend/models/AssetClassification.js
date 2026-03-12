const mongoose = require('mongoose');

// Asset Category Schema
const AssetCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetCategory',
    default: null
  },
  level: {
    type: Number,
    default: 0 // 0 for root categories
  },
  icon: {
    type: String,
    default: 'fa-server'
  },
  color: {
    type: String,
    default: '#007bff'
  },
  criticality: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  complianceRequired: {
    type: Boolean,
    default: false
  },
  retentionPeriod: {
    type: Number, // in days
    default: 2555 // 7 years default
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Asset Tag Schema
const AssetTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: '#6c757d'
  },
  category: {
    type: String,
    enum: ['environment', 'purpose', 'security', 'compliance', 'custom'],
    default: 'custom'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Asset Classification Schema (links assets to categories and tags)
const AssetClassificationSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    unique: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetCategory',
    required: true
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetTag'
  }],
  criticality: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  businessImpact: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  technicalImpact: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  complianceStatus: {
    type: String,
    enum: ['compliant', 'non-compliant', 'pending', 'exempt'],
    default: 'pending'
  },
  lastAssessed: {
    type: Date,
    default: Date.now
  },
  assessedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  },
  customAttributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, { timestamps: true });

// Asset Group Schema
const AssetGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['manual', 'dynamic', 'hybrid'],
    default: 'manual'
  },
  criteria: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  assets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset'
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes for performance
AssetCategorySchema.index({ name: 1 });
AssetCategorySchema.index({ parent: 1 });
AssetCategorySchema.index({ level: 1 });
AssetCategorySchema.index({ isActive: 1 });

AssetTagSchema.index({ name: 1 });
AssetTagSchema.index({ category: 1 });
AssetTagSchema.index({ isActive: 1 });
AssetTagSchema.index({ usageCount: -1 });

AssetClassificationSchema.index({ asset: 1 });
AssetClassificationSchema.index({ category: 1 });
AssetClassificationSchema.index({ criticality: 1 });
AssetClassificationSchema.index({ riskScore: -1 });
AssetClassificationSchema.index({ complianceStatus: 1 });

AssetGroupSchema.index({ name: 1 });
AssetGroupSchema.index({ owner: 1 });
AssetGroupSchema.index({ isActive: 1 });
AssetGroupSchema.index({ type: 1 });

// Virtual fields
AssetCategorySchema.virtual('subcategories', {
  ref: 'AssetCategory',
  localField: '_id',
  foreignField: 'parent'
});

AssetCategorySchema.virtual('assetCount', {
  ref: 'AssetClassification',
  localField: '_id',
  foreignField: 'category',
  count: true
});

AssetGroupSchema.virtual('assetCount', {
  ref: 'Asset',
  localField: 'assets',
  foreignField: '_id',
  count: true
});

// Methods
AssetCategorySchema.methods.getFullPath = async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parent) {
    current = await mongoose.model('AssetCategory').findById(current.parent);
    if (current) {
      path.unshift(current.name);
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

AssetClassificationSchema.methods.calculateRiskScore = function() {
  const criticalityWeights = {
    'critical': 40,
    'high': 30,
    'medium': 20,
    'low': 10
  };
  
  const impactWeights = {
    'critical': 30,
    'high': 25,
    'medium': 15,
    'low': 5
  };
  
  const criticalityScore = criticalityWeights[this.criticality] || 20;
  const businessImpactScore = impactWeights[this.businessImpact] || 15;
  const technicalImpactScore = impactWeights[this.technicalImpact] || 15;
  
  this.riskScore = Math.min(100, criticalityScore + businessImpactScore + technicalImpactScore);
  return this.riskScore;
};

AssetGroupSchema.methods.updateDynamicAssets = async function() {
  if (this.type === 'dynamic' || this.type === 'hybrid') {
    const Asset = mongoose.model('Asset');
    const AssetClassification = mongoose.model('AssetClassification');
    
    let query = {};
    
    // Build query from criteria
    if (this.criteria.category) {
      const classifications = await AssetClassification.find({ category: this.criteria.category });
      query._id = { $in: classifications.map(c => c.asset) };
    }
    
    if (this.criteria.tags) {
      const classifications = await AssetClassification.find({ 
        tags: { $in: this.criteria.tags } 
      });
      if (query._id) {
        query._id.$in = [...new Set([...query._id.$in, ...classifications.map(c => c.asset)])];
      } else {
        query._id = { $in: classifications.map(c => c.asset) };
      }
    }
    
    if (this.criteria.status) {
      query.status = this.criteria.status;
    }
    
    if (this.criteria.type) {
      query.type = { $in: this.criteria.type };
    }
    
    const assets = await Asset.find(query);
    this.assets = assets.map(a => a._id);
    this.lastUpdated = new Date();
    
    await this.save();
  }
};

// Pre-save middleware
AssetTagSchema.pre('save', function(next) {
  if (this.isNew && !this.usageCount) {
    this.usageCount = 0;
  }
  next();
});

AssetClassificationSchema.pre('save', function(next) {
  if (this.isModified('criticality') || this.isModified('businessImpact') || this.isModified('technicalImpact')) {
    this.calculateRiskScore();
  }
  next();
});

AssetGroupSchema.pre('save', function(next) {
  if (this.isNew && !this.lastUpdated) {
    this.lastUpdated = new Date();
  }
  next();
});

module.exports = {
  AssetCategory: mongoose.model('AssetCategory', AssetCategorySchema),
  AssetTag: mongoose.model('AssetTag', AssetTagSchema),
  AssetClassification: mongoose.model('AssetClassification', AssetClassificationSchema),
  AssetGroup: mongoose.model('AssetGroup', AssetGroupSchema)
};
