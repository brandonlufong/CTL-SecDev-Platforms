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
// routes/assets.js
router.post('/ping', protect, assetController.pingAssets);

module.exports = router;
