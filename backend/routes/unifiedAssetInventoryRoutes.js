const express = require('express');
const router = express.Router();
const unifiedAssetInventoryController = require('../controllers/unifiedAssetInventoryController');
const protect = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Dashboard and Overview
router.get('/dashboard', protect, checkPermission('asset:view'), unifiedAssetInventoryController.getUnifiedInventoryDashboard);
router.get('/analytics', protect, checkPermission('asset:view'), unifiedAssetInventoryController.getInventoryAnalytics);

// Unified Asset Search and Filtering
router.get('/search', protect, checkPermission('asset:view'), unifiedAssetInventoryController.searchUnifiedAssets);

// Asset Discovery
router.post('/discovery/start', protect, checkPermission('asset:create'), unifiedAssetInventoryController.startDiscovery);
router.get('/discovery/status', protect, checkPermission('asset:view'), unifiedAssetInventoryController.getDiscoveryStatus);
router.post('/discovery/cancel', protect, checkPermission('asset:create'), unifiedAssetInventoryController.cancelDiscovery);

// Asset Classification (for server assets only)
router.get('/classification/:assetId', protect, checkPermission('asset:view'), unifiedAssetInventoryController.getAssetClassification);
router.put('/classification/:assetId', protect, checkPermission('asset:edit'), unifiedAssetInventoryController.updateAssetClassification);
router.post('/classification/auto-classify', protect, checkPermission('asset:edit'), unifiedAssetInventoryController.autoClassifyAssets);

// Categories and Tags
router.get('/categories', protect, checkPermission('asset:view'), unifiedAssetInventoryController.getCategories);
router.get('/tags', protect, checkPermission('asset:view'), unifiedAssetInventoryController.getTags);

// Initialization
router.post('/initialize', protect, checkPermission('asset:edit'), unifiedAssetInventoryController.initializeDefaults);

module.exports = router;
