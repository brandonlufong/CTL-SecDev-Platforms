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
const { verifyToken } = require('../middleware/authMiddleware'); // Auth middleware
const Asset = require('../models/Asset'); // Adjust path if needed
const ping = require('ping');

// Asset routes
router.get('/', verifyToken, assetController.getAssets);
router.get('/search', verifyToken, assetController.searchAssets);

// Import / export, bulk ops, dedupe, discovery (Workstream C).
// Declared BEFORE '/:id' so static paths aren't captured as an :id param.
router.get('/export', verifyToken, assetController.exportAssetsCsv);
router.post('/import', verifyToken, assetController.importAssetsCsv);
router.patch('/bulk', verifyToken, assetController.bulkUpdateAssets);
router.get('/duplicates', verifyToken, assetController.findDuplicateAssets);
router.post('/discover', verifyToken, assetController.discoverSubnet);
router.post('/promote', verifyToken, assetController.promoteHosts);

router.get('/:id', verifyToken, assetController.getAssetById);
router.post('/', verifyToken, assetController.createAsset);
router.put('/:id', verifyToken, assetController.updateAsset);
router.delete('/:id', verifyToken, assetController.deleteAsset);
router.post('/ping', verifyToken, assetController.pingAssets);

// Geolocation routes
router.get('/location', verifyToken, assetController.getAssetsByLocation);
router.get('/geo-stats', verifyToken, assetController.getGeoStats);
router.post('/bulk-enrich', verifyToken, assetController.bulkEnrichAssets);
router.post('/update-stale-geo', verifyToken, assetController.updateStaleGeoData);

module.exports = router;
