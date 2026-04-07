const express = require('express');
const router = express.Router();
const assetInventoryController = require('../controllers/assetInventoryController');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Dashboard and Overview
router.get('/dashboard', verifyToken, checkPermission('asset:view'), assetInventoryController.getInventoryDashboard);
router.get('/analytics', verifyToken, checkPermission('asset:view'), assetInventoryController.getInventoryAnalytics);

// Asset Search and Filtering
router.get('/search', verifyToken, checkPermission('asset:view'), assetInventoryController.searchAssets);

// Asset Discovery
router.post('/discovery/start', verifyToken, checkPermission('asset:create'), assetInventoryController.startDiscovery);
router.get('/discovery/status', verifyToken, checkPermission('asset:view'), assetInventoryController.getDiscoveryStatus);
router.post('/discovery/cancel', verifyToken, checkPermission('asset:create'), assetInventoryController.cancelDiscovery);

// Asset Classification
router.get('/classification/:assetId', verifyToken, checkPermission('asset:view'), assetInventoryController.getAssetClassification);
router.put('/classification/:assetId', verifyToken, checkPermission('asset:edit'), assetInventoryController.updateAssetClassification);
router.post('/classification/auto-classify', verifyToken, checkPermission('asset:edit'), assetInventoryController.autoClassifyAssets);

// Categories and Tags
router.get('/categories', verifyToken, checkPermission('asset:view'), assetInventoryController.getCategories);
router.post('/categories', verifyToken, checkPermission('asset:edit'), assetInventoryController.createCategory);
router.get('/tags', verifyToken, checkPermission('asset:view'), assetInventoryController.getTags);
router.post('/tags', verifyToken, checkPermission('asset:edit'), assetInventoryController.createTag);

// Asset Groups
router.get('/groups', verifyToken, checkPermission('asset:view'), assetInventoryController.getAssetGroups);
router.post('/groups', verifyToken, checkPermission('asset:edit'), assetInventoryController.createAssetGroup);

// Initialization
router.post('/initialize', verifyToken, checkPermission('asset:edit'), assetInventoryController.initializeDefaults);

module.exports = router;
