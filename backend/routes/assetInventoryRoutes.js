const express = require('express');
const router = express.Router();
const assetInventoryController = require('../controllers/assetInventoryController');
const protect = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Dashboard and Overview
router.get('/dashboard', protect, checkPermission('asset:view'), assetInventoryController.getInventoryDashboard);
router.get('/analytics', protect, checkPermission('asset:view'), assetInventoryController.getInventoryAnalytics);

// Asset Search and Filtering
router.get('/search', protect, checkPermission('asset:view'), assetInventoryController.searchAssets);

// Asset Discovery
router.post('/discovery/start', protect, checkPermission('asset:create'), assetInventoryController.startDiscovery);
router.get('/discovery/status', protect, checkPermission('asset:view'), assetInventoryController.getDiscoveryStatus);
router.post('/discovery/cancel', protect, checkPermission('asset:create'), assetInventoryController.cancelDiscovery);

// Asset Classification
router.get('/classification/:assetId', protect, checkPermission('asset:view'), assetInventoryController.getAssetClassification);
router.put('/classification/:assetId', protect, checkPermission('asset:edit'), assetInventoryController.updateAssetClassification);
router.post('/classification/auto-classify', protect, checkPermission('asset:edit'), assetInventoryController.autoClassifyAssets);

// Categories and Tags
router.get('/categories', protect, checkPermission('asset:view'), assetInventoryController.getCategories);
router.post('/categories', protect, checkPermission('asset:edit'), assetInventoryController.createCategory);
router.get('/tags', protect, checkPermission('asset:view'), assetInventoryController.getTags);
router.post('/tags', protect, checkPermission('asset:edit'), assetInventoryController.createTag);

// Asset Groups
router.get('/groups', protect, checkPermission('asset:view'), assetInventoryController.getAssetGroups);
router.post('/groups', protect, checkPermission('asset:edit'), assetInventoryController.createAssetGroup);

// Initialization
router.post('/initialize', protect, checkPermission('asset:edit'), assetInventoryController.initializeDefaults);

module.exports = router;
