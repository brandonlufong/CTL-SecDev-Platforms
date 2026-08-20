const Asset = require('../models/Asset');
const Device = require('../models/Device');
const Vulnerability = require('../models/Vulnerability');
const ScheduledScan = require('../models/ScheduledScan');

/**
 * Backup / restore of the core inventory + findings (Workstream E).
 * Users are intentionally NOT exported (they hold password hashes).
 */

const COLLECTIONS = {
  assets: Asset,
  devices: Device,
  vulnerabilities: Vulnerability,
  scheduledScans: ScheduledScan,
};

// GET /api/system/backup -> downloadable JSON snapshot
exports.backup = async (req, res) => {
  try {
    const data = {};
    for (const [key, Model] of Object.entries(COLLECTIONS)) {
      data[key] = await Model.find().lean();
    }
    const payload = {
      meta: { generatedAt: new Date().toISOString(), version: 1, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) },
      data,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="camtelvm-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ message: 'Backup failed', error: err.message });
  }
};

// POST /api/system/restore  { data, mode? }  mode: 'upsert' (default) | 'dry-run'
exports.restore = async (req, res) => {
  try {
    const body = req.body?.data ? req.body : { data: req.body };
    const data = body.data || {};
    const dryRun = body.mode === 'dry-run';
    const summary = {};

    for (const [key, Model] of Object.entries(COLLECTIONS)) {
      const records = Array.isArray(data[key]) ? data[key] : [];
      let upserted = 0;
      if (!dryRun) {
        for (const rec of records) {
          if (!rec._id) { await Model.create(rec); upserted++; continue; }
          await Model.updateOne({ _id: rec._id }, { $set: rec }, { upsert: true });
          upserted++;
        }
      }
      summary[key] = { provided: records.length, upserted: dryRun ? 0 : upserted };
    }

    res.json({ message: dryRun ? 'Dry-run complete' : 'Restore complete', mode: dryRun ? 'dry-run' : 'upsert', summary });
  } catch (err) {
    res.status(500).json({ message: 'Restore failed', error: err.message });
  }
};
