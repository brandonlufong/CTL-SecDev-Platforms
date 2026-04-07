const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Access policies endpoints
router.get('/policies', verifyToken, checkPermission('system:config'), accessController.getAccessPolicies);
router.put('/policies/:category', verifyToken, checkPermission('system:config'), accessController.updateAccessPolicies);

// User access management endpoints
router.get('/users', verifyToken, checkPermission('user:read'), accessController.getUsersWithRoles);
router.put('/users/:id/role', verifyToken, checkPermission('user:update'), accessController.updateUserRole);
router.get('/users/:id/permissions', verifyToken, checkPermission('user:read'), accessController.getUserPermissions);
router.put('/users/:id/permissions', verifyToken, checkPermission('user:update'), accessController.updateUserPermissions);
router.put('/users/:id/lock', verifyToken, checkPermission('user:update'), accessController.toggleUserLock);

// Audit logs endpoints
router.get('/audit-logs', verifyToken, checkPermission('system:monitor'), accessController.getAuditLogs);

// Access validation endpoints
router.post('/validate-password', verifyToken, accessController.validatePassword);
router.post('/check-access', verifyToken, accessController.checkAccess);

// Statistics endpoint
router.get('/statistics', verifyToken, checkPermission('system:monitor'), accessController.getAccessStatistics);

module.exports = router;
