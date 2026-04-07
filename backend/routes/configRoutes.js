// ========================================
// backend/routes/configRoutes.js
// ========================================
const express = require('express');
const router = express.Router();
const config = require('../config/config');
const configController = require('../controllers/configController');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

/**
 * GET /api/config
 * Returns client-safe configuration
 * This endpoint can be public or protected based on your needs
 */
router.get('/', (req, res) => {
  try {
    const clientConfig = config.getClientConfig();
    res.json({
      success: true,
      config: clientConfig
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration'
    });
  }
});

/**
 * GET /api/config/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// System Settings Routes (Protected)
// ========================================

router.use(verifyToken);

// System configuration endpoints
router.get('/system', checkPermission('system:config'), configController.getSystemConfig);
router.put('/system/:category', checkPermission('system:config'), configController.updateSystemConfig);
router.get('/status', checkPermission('system:monitor'), configController.getSystemStatus);
router.post('/restart/:service', checkPermission('system:config'), configController.restartService);

// Backup endpoints
router.post('/backup', verifyToken, checkPermission('system:backup'), configController.createBackup);
router.get('/backups', verifyToken, checkPermission('system:backup'), configController.getBackupList);
router.post('/restore/:fileName', verifyToken, checkPermission('system:backup'), configController.restoreBackup);

// System logs endpoints
router.get('/logs', verifyToken, checkPermission('system:monitor'), configController.getSystemLogs);
router.delete('/logs/:level', verifyToken, checkPermission('system:config'), configController.clearSystemLogs);

// System activity endpoint
router.get('/activity', verifyToken, checkPermission('system:monitor'), configController.getRecentActivity);

module.exports = router;