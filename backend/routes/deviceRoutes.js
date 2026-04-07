const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { verifyToken } = require('../middleware/authMiddleware'); // Auth middleware
const NetworkDevice = require('../models/Device'); // Adjust path if needed
const ping = require('ping');

router.use(verifyToken);

// Device routes
router.get('/', deviceController.getDevices);
router.get('/search', deviceController.searchDevices);
router.post('/', deviceController.createDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);
router.post('/ping', verifyToken, deviceController.pingDevices);

module.exports = router;