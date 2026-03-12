const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const protect = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Main logs endpoints
router.get('/', protect, checkPermission('system:monitor'), logsController.getLogs);
router.get('/stats', protect, checkPermission('system:monitor'), logsController.getLogStats);
router.delete('/clear/:level', protect, checkPermission('system:config'), logsController.clearLogs);
router.get('/export', protect, checkPermission('system:monitor'), logsController.exportLogs);
router.post('/archive', protect, checkPermission('system:config'), logsController.archiveLogs);

// Service-specific logs
router.get('/service/:service', protect, checkPermission('system:monitor'), logsController.getServiceLogs);

// Log details and search
router.get('/details/:id', protect, checkPermission('system:monitor'), logsController.getLogDetails);
router.post('/search', protect, checkPermission('system:monitor'), logsController.searchLogs);

// Analytics and real-time
router.get('/analytics', protect, checkPermission('system:monitor'), logsController.getLogAnalytics);
router.get('/realtime', protect, checkPermission('system:monitor'), logsController.getRealTimeLogs);

module.exports = router;
