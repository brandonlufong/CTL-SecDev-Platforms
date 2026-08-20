const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/monitoringController');

router.use(verifyToken);
router.get('/status', ctrl.status);
router.post('/check', ctrl.checkNow);
router.post('/start', ctrl.start);

module.exports = router;
