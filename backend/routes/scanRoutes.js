// routes/scanRoutes.js
const express = require('express');
const router = express.Router();
const {
  scanAsset,
  scanDevice,
  scanTarget,
  runQuickScan,
  getLatestScans,
  getScanProgress,
  testConnectivity,
  testBulkConnectivity,
  runBatchScan
} = require('../controllers/scanController');
const { verifyToken } = require('../middleware/authMiddleware');

// Single asset scan with enhanced vulnerability detection
router.post('/asset', verifyToken, scanAsset);

// Single asset scan with enhanced vulnerability detection
router.post('/device', verifyToken, scanDevice);

// Quick scan across all online assets
router.post('/quick', verifyToken, runQuickScan);

// Batch scan for multiple assets
router.post('/batch', verifyToken, runBatchScan);

// Get latest scan results
router.get('/latest', verifyToken, getLatestScans);

// Get current scan progress
router.get('/progress', verifyToken, getScanProgress);

// Test asset connectivity
router.get('/test/:assetId', verifyToken, testConnectivity);

// Test device connectivity
router.get('/test/:deviceId', verifyToken, testConnectivity);

// Test bulk connectivity
router.post('/test/bulk', verifyToken, testBulkConnectivity);

module.exports = router;
