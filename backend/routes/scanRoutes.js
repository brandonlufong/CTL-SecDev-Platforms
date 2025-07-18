// routes/scanRoutes.js
const express = require('express');
const router = express.Router();
const { scanAsset, runQuickScan, getLatestScans, getScanProgress } = require('../controllers/scanController');
const protect = require('../middleware/authMiddleware');

router.post('/nmap', protect, scanAsset);
// GET latest scans
router.get('/latest', protect, getLatestScans);
// POST quick scan for all assets
router.post('/quick', protect, runQuickScan);
router.get('/progress', protect, getScanProgress);


module.exports = router;
