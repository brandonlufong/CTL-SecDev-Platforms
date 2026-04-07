const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const assetDiscoveryController = require('../controllers/assetDiscoveryController');

// Detect current network configuration
router.get('/detect', verifyToken, (req, res) => {
  console.log('/detect route called');
  
  // Simple test to bypass controller
  res.json({
    success: true,
    message: 'Network detection endpoint working',
    data: {
      interfaces: [],
      defaultGateway: '192.168.1.1',
      dnsServers: ['8.8.8.8'],
      networkRanges: [],
      recommendedRanges: [],
      commonRanges: []
    }
  });
});

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
