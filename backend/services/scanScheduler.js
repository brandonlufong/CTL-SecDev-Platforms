const ScheduledScan = require('../models/ScheduledScan');
const { runAndPersist, resolveTargets } = require('./scanRunner');

/**
 * Lightweight recurring-scan scheduler (Workstream D/E).
 *
 * No external cron dependency: wakes every minute, runs any enabled schedule
 * whose nextRun is due, then reschedules. Concurrency is bounded by the
 * scanner service itself (MAX_CONCURRENT_SCANS).
 */
class ScanScheduler {
  constructor() {
    this.timer = null;
    this.running = false;
    this.busy = new Set(); // schedule ids currently executing
  }

  start(tickSeconds = 60) {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => this.tick().catch(e => console.error('[scheduler] tick error:', e.message)), tickSeconds * 1000);
    console.log(`[scheduler] started (tick ${tickSeconds}s)`);
    // Run one tick shortly after boot.
    setTimeout(() => this.tick().catch(() => {}), 5000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  async tick() {
    const now = new Date();
    const due = await ScheduledScan.find({ enabled: true, nextRun: { $lte: now } });
    for (const sched of due) {
      if (this.busy.has(String(sched._id))) continue;
      this.runSchedule(sched).catch(e => console.error(`[scheduler] ${sched.name} failed:`, e.message));
    }
  }

  async runSchedule(sched) {
    this.busy.add(String(sched._id));
    sched.lastStatus = 'running';
    await sched.save();
    console.log(`[scheduler] running "${sched.name}" (${sched.scanType})`);

    try {
      const targets = await resolveTargets(sched.targetSpec);
      const summaries = [];
      for (const [type, target] of targets) {
        try {
          summaries.push(await runAndPersist(type, target, { scanType: sched.scanType }));
        } catch (e) {
          summaries.push({ target: target.name, ip: target.ip, error: e.message });
        }
      }
      sched.lastStatus = 'success';
      sched.lastSummary = {
        targets: targets.length,
        newVulnerabilities: summaries.reduce((s, x) => s + (x.newVulnerabilities || 0), 0),
        details: summaries.slice(0, 50),
      };
    } catch (e) {
      sched.lastStatus = 'error';
      sched.lastSummary = { error: e.message };
    } finally {
      sched.lastRun = new Date();
      sched.runCount = (sched.runCount || 0) + 1;
      if (sched.runOnce) {
        // Greenbone "once": fire a single time then auto-disable.
        sched.enabled = false;
        sched.nextRun = null;
      } else {
        sched.nextRun = new Date(Date.now() + sched.frequencyMinutes * 60000);
      }
      await sched.save();
      this.busy.delete(String(sched._id));
      console.log(`[scheduler] "${sched.name}" -> ${sched.lastStatus}; next ${sched.nextRun ? sched.nextRun.toISOString() : '(once, disabled)'}`);
    }
  }

  /** Trigger a schedule immediately (used by the run-now endpoint). */
  async runNow(scheduleId) {
    const sched = await ScheduledScan.findById(scheduleId);
    if (!sched) throw new Error('Schedule not found');
    if (this.busy.has(String(sched._id))) throw new Error('Schedule already running');
    this.runSchedule(sched);
    return { started: true, name: sched.name };
  }
}

module.exports = new ScanScheduler();
