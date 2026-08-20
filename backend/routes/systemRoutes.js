const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/systemController');
const backup = require('../controllers/backupController');

router.use(verifyToken);
router.get('/health', ctrl.health);

// Backup / restore — gated on the system:backup permission (admins/super_admins).
router.get('/backup', checkPermission('system:backup'), backup.backup);
router.post('/restore', checkPermission('system:backup'), backup.restore);

module.exports = router;
