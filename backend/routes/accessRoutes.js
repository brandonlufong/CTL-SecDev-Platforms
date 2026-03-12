const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const protect = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Access policies endpoints
router.get('/policies', protect, checkPermission('system:config'), accessController.getAccessPolicies);
router.put('/policies/:category', protect, checkPermission('system:config'), accessController.updateAccessPolicies);

// User access management endpoints
router.get('/users', protect, checkPermission('user:read'), accessController.getUsersWithRoles);
router.put('/users/:id/role', protect, checkPermission('user:update'), accessController.updateUserRole);
router.get('/users/:id/permissions', protect, checkPermission('user:read'), accessController.getUserPermissions);
router.put('/users/:id/permissions', protect, checkPermission('user:update'), accessController.updateUserPermissions);
router.put('/users/:id/lock', protect, checkPermission('user:update'), accessController.toggleUserLock);

// Audit logs endpoints
router.get('/audit-logs', protect, checkPermission('system:monitor'), accessController.getAuditLogs);

// Access validation endpoints
router.post('/validate-password', protect, accessController.validatePassword);
router.post('/check-access', protect, accessController.checkAccess);

// Statistics endpoint
router.get('/statistics', protect, checkPermission('system:monitor'), accessController.getAccessStatistics);

module.exports = router;
