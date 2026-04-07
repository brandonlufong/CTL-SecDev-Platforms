const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  toggleUserStatus,
  getUserStats,
  getRolesAndPermissions,
  createRole,
  updateRole,
  deleteRole
} = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  checkPermission,
  checkRole,
  checkAnyPermission
} = require('../middleware/rbacMiddleware');

// Apply authentication middleware to all routes
router.use(verifyToken);

// User management routes
router.get('/users/stats', 
  checkPermission('user:read'), 
  getUserStats
);

router.get('/users/roles-permissions', 
  checkPermission('user:read'), 
  getRolesAndPermissions
);

router.get('/users', 
  checkPermission('user:read'), 
  getAllUsers
);

router.get('/users/:id', 
  checkPermission('user:read'), 
  getUserById
);

router.post('/users', 
  checkPermission('user:create'), 
  createUser
);

router.put('/users/:id', 
  checkPermission('user:update'), 
  updateUser
);

router.delete('/users/:id', 
  checkPermission('user:delete'), 
  deleteUser
);

router.post('/users/:id/reset-password', 
  checkPermission('user:update'), 
  resetPassword
);

router.patch('/users/:id/toggle-status', 
  checkPermission('user:update'), 
  toggleUserStatus
);

// System management routes (admin and super_admin only)
router.get('/system/info', 
  checkRole('admin'), 
  async (req, res) => {
    try {
      const os = require('os');
      const fs = require('fs');
      const path = require('path');
      
      const systemInfo = {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length,
        nodeVersion: process.version,
        appVersion: require('../../package.json').version,
        environment: process.env.NODE_ENV || 'development'
      };

      res.json(systemInfo);
    } catch (error) {
      console.error('Get system info error:', error);
      res.status(500).json({ message: 'Failed to fetch system information', error: error.message });
    }
  }
);

router.get('/system/logs', 
  checkPermission('system:monitor'), 
  async (req, res) => {
    try {
      const { lines = 100 } = req.query;
      
      // This is a basic implementation. In production, you'd want to use a proper logging system
      const logs = [
        { timestamp: new Date(), level: 'info', message: 'System running normally' },
        { timestamp: new Date(Date.now() - 60000), level: 'info', message: 'User authentication successful' },
        { timestamp: new Date(Date.now() - 120000), level: 'warning', message: 'High memory usage detected' }
      ];

      res.json({ logs });
    } catch (error) {
      console.error('Get system logs error:', error);
      res.status(500).json({ message: 'Failed to fetch system logs', error: error.message });
    }
  }
);

// Configuration management
router.get('/config', 
  checkPermission('system:config'), 
  async (req, res) => {
    try {
      const config = {
        maxConcurrentScans: process.env.MAX_CONCURRENT_SCANS || 3,
        defaultScanTimeout: process.env.DEFAULT_SCAN_TIMEOUT || 600000,
        sessionTimeout: process.env.SESSION_TIMEOUT || 3600000,
        passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS || 5,
        lockoutDuration: process.env.LOCKOUT_DURATION || 900000
      };

      res.json(config);
    } catch (error) {
      console.error('Get config error:', error);
      res.status(500).json({ message: 'Failed to fetch configuration', error: error.message });
    }
  }
);

router.put('/config', 
  checkPermission('system:config'), 
  async (req, res) => {
    try {
      const { maxConcurrentScans, defaultScanTimeout, sessionTimeout } = req.body;
      
      // In a real implementation, you'd update environment variables or a config file
      // For now, just return success
      res.json({ message: 'Configuration updated successfully' });
    } catch (error) {
      console.error('Update config error:', error);
      res.status(500).json({ message: 'Failed to update configuration', error: error.message });
    }
  }
);

// Role management routes
router.post('/roles', 
  checkPermission('system:config'), 
  createRole
);

router.put('/roles/:roleName', 
  checkPermission('system:config'), 
  updateRole
);

router.delete('/roles/:roleName', 
  checkPermission('system:config'), 
  deleteRole
);

module.exports = router;
