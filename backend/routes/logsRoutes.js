const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

router.use(verifyToken);

// Main logs endpoints
router.get('/', checkPermission('system:monitor'), logsController.getLogs);
router.get('/stats', checkPermission('system:monitor'), logsController.getLogStats);
router.delete('/clear/:level', checkPermission('system:config'), logsController.clearLogs);
router.get('/export', checkPermission('system:monitor'), logsController.exportLogs);
router.post('/archive', checkPermission('system:config'), logsController.archiveLogs);

// Service-specific logs
router.get('/service/:service', verifyToken, checkPermission('system:monitor'), logsController.getServiceLogs);

// Log details and search
router.get('/details/:id', verifyToken, checkPermission('system:monitor'), logsController.getLogDetails);
router.post('/search', verifyToken, checkPermission('system:monitor'), logsController.searchLogs);

// Analytics and real-time
router.get('/analytics', verifyToken, checkPermission('system:monitor'), logsController.getLogAnalytics);
router.get('/realtime', verifyToken, checkPermission('system:monitor'), logsController.getRealTimeLogs);

module.exports = router;
