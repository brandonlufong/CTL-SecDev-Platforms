const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/analyticsController');

router.use(verifyToken);
router.get('/overview', ctrl.overview);
router.get('/trends', ctrl.trends);
router.get('/exposure', ctrl.exposure);
router.get('/compliance', ctrl.compliance);
router.get('/report', ctrl.report);

module.exports = router;
