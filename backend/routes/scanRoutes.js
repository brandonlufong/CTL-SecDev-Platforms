// routes/scanRoutes.js
const express = require('express');
const router = express.Router();
const {
  scanAsset,
  runQuickScan,
  getLatestScans,
  getScanProgress,
  testConnectivity,
  runBatchScan
} = require('../controllers/scanController');
const protect = require('../middleware/authMiddleware');

// Single asset scan with enhanced vulnerability detection
router.post('/asset', scanAsset);

// Quick scan across all online assets
router.post('/quick', runQuickScan);

// Batch scan for multiple assets
router.post('/batch', runBatchScan);

// Get latest scan results
router.get('/latest', getLatestScans);

// Get current scan progress
router.get('/progress', getScanProgress);

// Test asset connectivity
router.get('/test/:assetId', testConnectivity);

module.exports = router;
