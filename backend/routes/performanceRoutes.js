const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const { verifyToken } = require('../middleware/authMiddleware');

// Monitoring control endpoints
router.get('/status', verifyToken, performanceController.getMonitoringStatus);
router.post('/start', verifyToken, performanceController.startMonitoring);
router.post('/stop', verifyToken, performanceController.stopMonitoring);

// Asset-specific monitoring
router.post('/assets/:assetId/start', verifyToken, performanceController.startAssetMonitoring);
router.post('/assets/:assetId/stop', verifyToken, performanceController.stopAssetMonitoring);

// Metrics endpoints
router.get('/overview', verifyToken, performanceController.getPerformanceOverview);
router.get('/stats', verifyToken, performanceController.getPerformanceStats);
router.get('/alerts', verifyToken, performanceController.getPerformanceAlerts);

// Asset metrics
router.get('/assets/:assetId/latest', verifyToken, performanceController.getLatestMetrics);
router.get('/assets/:assetId/metrics/:metricType', verifyToken, performanceController.getMetricsByTimeRange);
router.get('/assets/:assetId/aggregated/:metricType', verifyToken, performanceController.getAggregatedMetrics);
router.get('/assets/:assetId/uptime', verifyToken, performanceController.getUptimeStats);
router.get('/assets/:assetId/trends/:metricType', verifyToken, performanceController.getPerformanceTrends);
router.get('/assets/:assetId/export', verifyToken, performanceController.exportPerformanceData);

module.exports = router;
