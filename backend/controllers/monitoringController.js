const assetMonitoringService = require('../services/assetMonitoringService');

/**
 * Real-time asset monitoring (Asset Inventory → Monitoring tab).
 * Surfaces the health checks + alerts collected by assetMonitoringService.
 */

// GET /api/monitoring/status
exports.status = async (req, res) => {
  try {
    const status = assetMonitoringService.getMonitoringStatus();
    const checks = status.healthChecks || [];
    res.json({
      isMonitoring: status.isMonitoring,
      totalAssets: checks.length,
      summary: {
        healthy: checks.filter(h => h.status === 'healthy').length,
        warning: checks.filter(h => h.status === 'warning').length,
        unhealthy: checks.filter(h => h.status === 'unhealthy').length,
      },
      healthChecks: checks,
      recentAlerts: status.recentAlerts || [],
      alertThresholds: status.alertThresholds,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get monitoring status', error: err.message });
  }
};

// POST /api/monitoring/check  -> run health checks now
exports.checkNow = async (req, res) => {
  try {
    await assetMonitoringService.performHealthChecks();
    res.json({ message: 'Health checks triggered', status: assetMonitoringService.getMonitoringStatus() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to trigger health checks', error: err.message });
  }
};

// POST /api/monitoring/start  { intervalMinutes }
exports.start = async (req, res) => {
  try {
    const interval = parseInt(req.body?.intervalMinutes || '5', 10);
    assetMonitoringService.start(interval);
    res.json({ message: `Monitoring started (every ${interval}m)`, isMonitoring: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to start monitoring', error: err.message });
  }
};
