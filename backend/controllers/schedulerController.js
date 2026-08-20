const ScheduledScan = require('../models/ScheduledScan');
const scheduler = require('../services/scanScheduler');

exports.list = async (req, res) => {
  try {
    const schedules = await ScheduledScan.find().sort({ createdAt: -1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: 'Failed to list schedules', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, targetSpec, scanType, frequencyMinutes, enabled, recurrence, startAt, runOnce } = req.body;
    if (!name || !targetSpec || !targetSpec.type) {
      return res.status(400).json({ message: 'name and targetSpec.type are required' });
    }
    // First run honors startAt when it's in the future; otherwise start shortly.
    const start = startAt ? new Date(startAt) : null;
    const nextRun = (start && start.getTime() > Date.now()) ? start : new Date(Date.now() + 60000);

    const sched = await ScheduledScan.create({
      name, targetSpec, scanType, frequencyMinutes, enabled,
      recurrence, startAt: start, runOnce: !!runOnce,
      createdBy: req.user?.id,
      nextRun,
    });
    res.status(201).json(sched);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create schedule', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const allowed = ['name', 'targetSpec', 'scanType', 'frequencyMinutes', 'enabled', 'recurrence', 'startAt', 'runOnce'];
    const set = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) set[k] = req.body[k]; });
    // Re-arm a schedule that was toggled back on, or whose start time moved.
    if (set.startAt) {
      const start = new Date(set.startAt);
      set.nextRun = (start.getTime() > Date.now()) ? start : new Date(Date.now() + 60000);
    } else if (set.enabled === true) {
      const existing = await ScheduledScan.findById(req.params.id).select('nextRun');
      if (!existing?.nextRun) set.nextRun = new Date(Date.now() + 60000);
    }
    const sched = await ScheduledScan.findByIdAndUpdate(req.params.id, set, { new: true, runValidators: true });
    if (!sched) return res.status(404).json({ message: 'Schedule not found' });
    res.json(sched);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update schedule', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const sched = await ScheduledScan.findByIdAndDelete(req.params.id);
    if (!sched) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete schedule', error: err.message });
  }
};

exports.runNow = async (req, res) => {
  try {
    const result = await scheduler.runNow(req.params.id);
    res.json({ message: `Started "${result.name}"`, ...result });
  } catch (err) {
    res.status(400).json({ message: 'Failed to run schedule', error: err.message });
  }
};
