const express = require('express');
const router = express.Router();
const unifiedAssetInventoryController = require('../controllers/unifiedAssetInventoryController');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Dashboard and Overview
router.get('/dashboard', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.getUnifiedInventoryDashboard);
router.get('/analytics', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.getInventoryAnalytics);

// Unified Asset Search and Filtering
router.get('/search', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.searchUnifiedAssets);

// Asset Discovery
router.post('/discovery/start', verifyToken, checkPermission('asset:create'), unifiedAssetInventoryController.startDiscovery);
router.get('/discovery/status', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.getDiscoveryStatus);
router.post('/discovery/cancel', verifyToken, checkPermission('asset:create'), unifiedAssetInventoryController.cancelDiscovery);

// Asset Classification (for server assets only)
router.get('/classification/:assetId', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.getAssetClassification);
router.put('/classification/:assetId', verifyToken, checkPermission('asset:edit'), unifiedAssetInventoryController.updateAssetClassification);
router.post('/classification/auto-classify', verifyToken, checkPermission('asset:edit'), unifiedAssetInventoryController.autoClassifyAssets);

// Categories and Tags
router.get('/categories', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.getCategories);
router.get('/tags', verifyToken, checkPermission('asset:view'), unifiedAssetInventoryController.getTags);

// Initialization
router.post('/initialize', verifyToken, checkPermission('asset:edit'), unifiedAssetInventoryController.initializeDefaults);

module.exports = router;
