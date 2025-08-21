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
  runBatchScan
} = require('../controllers/scanController');
const protect = require('../middleware/authMiddleware');

// Single asset scan with enhanced vulnerability detection
router.post('/asset', protect, scanAsset);

// Single asset scan with enhanced vulnerability detection
router.post('/device', protect, scanDevice);

// Quick scan across all online assets
router.post('/quick', protect, runQuickScan);

// Batch scan for multiple assets
router.post('/batch', protect, runBatchScan);

// Get latest scan results
router.get('/latest', protect, getLatestScans);

// Get current scan progress
router.get('/progress', protect, getScanProgress);

// Test asset connectivity
router.get('/test/:assetId', protect, testConnectivity);

module.exports = router;
