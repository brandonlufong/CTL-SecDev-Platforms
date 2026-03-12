// const express = require('express');
// const router = express.Router();
// const protect = require('../middleware/authMiddleware');
// const ctrl = require('../controllers/assetController');

// router.use(protect);
// router.get('/', ctrl.getAll);
// router.post('/', ctrl.create);
// router.put('/:id', ctrl.update);
// router.delete('/:id', ctrl.remove);

// module.exports = router;
const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const protect = require('../middleware/authMiddleware'); // Auth middleware
const Asset = require('../models/Asset'); // Adjust path if needed
const ping = require('ping');

// Asset routes
router.get('/', protect, assetController.getAssets);
router.get('/search', protect, assetController.searchAssets);
router.post('/', protect, assetController.createAsset);
router.put('/:id', protect, assetController.updateAsset);
router.delete('/:id', protect, assetController.deleteAsset);
router.post('/ping', protect, assetController.pingAssets);

// Geolocation routes
router.get('/location', protect, assetController.getAssetsByLocation);
router.get('/geo-stats', protect, assetController.getGeoStats);
router.post('/bulk-enrich', protect, assetController.bulkEnrichAssets);
router.post('/update-stale-geo', protect, assetController.updateStaleGeoData);

module.exports = router;
