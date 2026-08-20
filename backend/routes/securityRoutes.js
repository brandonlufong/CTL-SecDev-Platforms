const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/securityController');

router.use(verifyToken);
router.post('/tls-check', ctrl.tlsCheck);
router.get('/tls-check/:assetId', ctrl.tlsCheckTarget);

module.exports = router;
