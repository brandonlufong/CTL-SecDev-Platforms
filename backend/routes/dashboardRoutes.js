const express = require('express');
const router = express.Router();
const { getDashboardSummary } = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Dashboard summary requires dashboard:read permission
router.get('/summary', verifyToken, checkPermission('dashboard:read'), getDashboardSummary);

module.exports = router;
