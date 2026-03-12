const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const protect = require('../middleware/authMiddleware');

// Monitoring control endpoints
router.get('/status', protect, performanceController.getMonitoringStatus);
router.post('/start', protect, performanceController.startMonitoring);
router.post('/stop', protect, performanceController.stopMonitoring);

// Asset-specific monitoring
router.post('/assets/:assetId/start', protect, performanceController.startAssetMonitoring);
router.post('/assets/:assetId/stop', protect, performanceController.stopAssetMonitoring);

// Metrics endpoints
router.get('/overview', protect, performanceController.getPerformanceOverview);
router.get('/stats', protect, performanceController.getPerformanceStats);
router.get('/alerts', protect, performanceController.getPerformanceAlerts);

// Asset metrics
router.get('/assets/:assetId/latest', protect, performanceController.getLatestMetrics);
router.get('/assets/:assetId/metrics/:metricType', protect, performanceController.getMetricsByTimeRange);
router.get('/assets/:assetId/aggregated/:metricType', protect, performanceController.getAggregatedMetrics);
router.get('/assets/:assetId/uptime', protect, performanceController.getUptimeStats);
router.get('/assets/:assetId/trends/:metricType', protect, performanceController.getPerformanceTrends);
router.get('/assets/:assetId/export', protect, performanceController.exportPerformanceData);

module.exports = router;
