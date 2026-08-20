const mongoose = require('mongoose');

/**
 * A recurring scan definition. Dependency-light: instead of cron we store the
 * frequency (minutes) and a computed nextRun; services/scanScheduler.js wakes
 * every minute and runs anything due. Also supports run-now via the API.
 */
const scheduledScanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // What to scan.
    targetSpec: {
      type: {
        type: String,
        enum: ['asset', 'device', 'all-assets', 'all-devices', 'all'],
        required: true,
      },
      ids: [{ type: mongoose.Schema.Types.ObjectId }],
    },
    scanType: {
      type: String,
      enum: ['quick', 'comprehensive', 'stealth', 'udp', 'vulnerability'],
      default: 'quick',
    },
    frequencyMinutes: { type: Number, default: 1440, min: 5 }, // default daily
    // Human-readable recurrence preset (once/hourly/daily/weekly/monthly/custom),
    // used for display; frequencyMinutes remains the source of truth for timing.
    recurrence: { type: String, default: 'daily' },
    // OpenVAS-style "first run" time — the schedule won't fire before this.
    startAt: { type: Date, default: null },
    // Run a single time then auto-disable (Greenbone "once").
    runOnce: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    lastRun: { type: Date, default: null },
    lastStatus: { type: String, default: 'never' }, // never | running | success | error
    lastSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    runCount: { type: Number, default: 0 },
    nextRun: { type: Date, default: () => new Date() }, // run soon after creation
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

scheduledScanSchema.index({ enabled: 1, nextRun: 1 });

module.exports = mongoose.model('ScheduledScan', scheduledScanSchema);
