const Vulnerability = require('../models/Vulnerability');
const sla = require('../utils/sla');

/**
 * Remediation workflow endpoints (Workstream D).
 *
 * These deliberately use doc.save() (not findByIdAndUpdate) so the model's
 * pre-save hook runs and stamps remediatedDate / dueDate correctly for MTTR.
 */

// PATCH /api/vulnerabilities/:id/status  { status }
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const vuln = await Vulnerability.findById(req.params.id);
    if (!vuln) return res.status(404).json({ message: 'Vulnerability not found' });

    const allowed = Vulnerability.schema.path('status').enumValues;
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status', allowed });
    }
    vuln.status = status;
    if (req.body.note) vuln.notes.push({ text: req.body.note, by: req.user.id });
    await vuln.save();
    res.json(vuln);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status', error: err.message });
  }
};

// PATCH /api/vulnerabilities/:id/assign  { userId }
exports.assign = async (req, res) => {
  try {
    const { userId } = req.body;
    const vuln = await Vulnerability.findById(req.params.id);
    if (!vuln) return res.status(404).json({ message: 'Vulnerability not found' });
    vuln.assignedTo = userId || null;
    await vuln.save();
    await vuln.populate('assignedTo', 'name email');
    res.json(vuln);
  } catch (err) {
    res.status(500).json({ message: 'Failed to assign', error: err.message });
  }
};

// POST /api/vulnerabilities/:id/notes  { text }
exports.addNote = async (req, res) => {
  try {
    if (!req.body.text) return res.status(400).json({ message: 'text is required' });
    const vuln = await Vulnerability.findById(req.params.id);
    if (!vuln) return res.status(404).json({ message: 'Vulnerability not found' });
    vuln.notes.push({ text: req.body.text, by: req.user.id });
    await vuln.save();
    res.json(vuln);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add note', error: err.message });
  }
};

// POST /api/vulnerabilities/bulk  { ids, status?, assignedTo?, complianceTags? }
exports.bulkAction = async (req, res) => {
  try {
    const { ids, status, assignedTo, complianceTags } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    // Load + save each so lifecycle hooks apply (status transitions matter).
    const vulns = await Vulnerability.find({ _id: { $in: ids } });
    for (const v of vulns) {
      if (status) v.status = status;
      if (assignedTo !== undefined) v.assignedTo = assignedTo || null;
      if (Array.isArray(complianceTags)) v.complianceTags = complianceTags;
      await v.save();
    }
    res.json({ message: `Updated ${vulns.length} finding(s)`, count: vulns.length });
  } catch (err) {
    res.status(500).json({ message: 'Bulk action failed', error: err.message });
  }
};

// GET /api/vulnerabilities/sla/summary
exports.slaSummary = async (req, res) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 86400000);
    const openFilter = { status: { $nin: Array.from(sla.CLOSED_STATUSES) } };

    const [open, breached, dueSoon, remediated] = await Promise.all([
      Vulnerability.countDocuments(openFilter),
      Vulnerability.countDocuments({ ...openFilter, dueDate: { $lt: now } }),
      Vulnerability.countDocuments({ ...openFilter, dueDate: { $gte: now, $lte: soon } }),
      Vulnerability.find({ remediatedDate: { $ne: null }, firstDetected: { $ne: null } }, 'firstDetected remediatedDate'),
    ]);

    const mttrDays = remediated.length
      ? Math.round(remediated.reduce((s, v) => s + sla.daysBetween(v.firstDetected, v.remediatedDate), 0) / remediated.length)
      : null;

    // SLA compliance = remediated within due window / all remediated.
    res.json({
      open,
      breached,
      dueSoon,
      remediatedTotal: remediated.length,
      meanTimeToRemediateDays: mttrDays,
      slaTargets: sla.SLA_DAYS,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build SLA summary', error: err.message });
  }
};

// GET /api/vulnerabilities/export  -> CSV
exports.exportCsv = async (req, res) => {
  try {
    const vulns = await Vulnerability.find()
      .populate('asset', 'name ip')
      .populate('device', 'name ip')
      .populate('assignedTo', 'name')
      .sort({ riskScore: -1 });

    const cols = ['title', 'cve', 'severity', 'status', 'cvssScore', 'epssScore', 'knownExploited',
      'riskScore', 'target', 'ip', 'assignedTo', 'discoveredDate', 'dueDate', 'slaBreached'];
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = vulns.map(v => {
      const targetDoc = v.asset || v.device;
      return [
        v.title, v.cve, v.severity, v.status, v.cvssScore, v.epssScore, v.knownExploited,
        v.riskScore, targetDoc?.name, targetDoc?.ip, v.assignedTo?.name,
        v.discoveredDate ? v.discoveredDate.toISOString().slice(0, 10) : '',
        v.dueDate ? v.dueDate.toISOString().slice(0, 10) : '',
        v.slaBreached,
      ].map(esc).join(',');
    });
    const csv = [cols.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vulnerabilities.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
};
