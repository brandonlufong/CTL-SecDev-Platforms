const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const protect = require('../middleware/authMiddleware'); // Auth middleware
const NetworkDevice = require('../models/Device'); // Adjust path if needed
const ping = require('ping');

// Device routes
router.get('/', protect, deviceController.getDevices);
router.get('/search', protect, deviceController.searchDevices);
router.post('/', protect, deviceController.createDevice);
router.put('/:id', protect, deviceController.updateDevice);
router.delete('/:id', protect, deviceController.deleteDevice);
// routes/devices.js
router.post('/ping', protect, deviceController.pingDevices);

module.exports = router;