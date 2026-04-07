const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const assetDiscoveryController = require('../controllers/assetDiscoveryController_new');

// Detect current network configuration
router.get('/detect', verifyToken, assetDiscoveryController.detectNetwork);

// Get common network ranges
router.get('/common-ranges', verifyToken, assetDiscoveryController.getCommonRanges);

// Validate network range
router.get('/validate/:networkRange', verifyToken, assetDiscoveryController.validateNetworkRange);

// Start asset discovery
router.post('/start', verifyToken, assetDiscoveryController.startDiscovery);

// Get discovery status
router.get('/status', verifyToken, assetDiscoveryController.getDiscoveryStatus);

// Cancel discovery
router.post('/cancel', verifyToken, assetDiscoveryController.cancelDiscovery);

// Get discovery history
router.get('/history', verifyToken, assetDiscoveryController.getDiscoveryHistory);

// Import discovered assets
router.post('/import', verifyToken, assetDiscoveryController.importDiscoveredAssets);

module.exports = router;
