const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/importController');

// Body size is handled by the global express.json({ limit: '50mb' }) in server.js.
router.use(verifyToken);
router.post('/scan', ctrl.importScan);

module.exports = router;
