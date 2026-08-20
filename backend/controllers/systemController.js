const systemMonitor = require('../services/systemMonitor');
const { getScanStats } = require('../services/scannerService');
const ScheduledScan = require('../models/ScheduledScan');
const enrichmentQueue = require('../services/enrichmentQueue');
const mongoose = require('mongoose');

/**
 * Consolidated system health/status (Workstream E). Surfaces the pieces the
 * ops/health page needs that weren't previously exposed together: live system
 * monitor status, the scanner's real capabilities (nmap version, privileges,
 * installed scripts, warnings), and the scan scheduler state.
 */
exports.health = async (req, res) => {
  try {
    const monitor = typeof systemMonitor.getSystemStatus === 'function'
      ? systemMonitor.getSystemStatus()
      : {};
    const scanner = getScanStats();

    const [scheduleCount, enabledCount, dueSoon] = await Promise.all([
      ScheduledScan.countDocuments({}),
      ScheduledScan.countDocuments({ enabled: true }),
      ScheduledScan.find({ enabled: true }).sort({ nextRun: 1 }).limit(5).select('name nextRun lastStatus'),
    ]);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      },
      monitor,
      scanner,   // nmapAvailable, nmapVersion, privileged, scripts, warnings, availableScanTypes
      scheduler: {
        totalSchedules: scheduleCount,
        enabled: enabledCount,
        upcoming: dueSoon,
      },
      enrichment: enrichmentQueue.stats(),
      process: {
        node: process.version,
        platform: process.platform,
        memoryMB: Math.round(process.memoryUsage().rss / 1048576),
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
