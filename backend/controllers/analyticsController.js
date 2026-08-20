const Vulnerability = require('../models/Vulnerability');
const Asset = require('../models/Asset');
const Device = require('../models/Device');
const sla = require('../utils/sla');

/**
 * Analytics & monitoring (Workstream F): real aggregations over the vulnerability
 * register and asset inventory — severity/risk posture, trends, MTTR, KEV
 * exposure, top risky assets — plus a printable executive HTML report.
 */

const OPEN = { status: { $nin: Array.from(sla.CLOSED_STATUSES) } };

// GET /api/analytics/overview
exports.overview = async (req, res) => {
  try {
    const now = new Date();
    const [
      totalVulns, bySeverity, byStatus, openCount, kevOpen,
      breached, riskAgg, remediated, assetCount, deviceCount, topAssets
    ] = await Promise.all([
      Vulnerability.countDocuments({}),
      Vulnerability.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Vulnerability.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Vulnerability.countDocuments(OPEN),
      Vulnerability.countDocuments({ ...OPEN, knownExploited: true }),
      Vulnerability.countDocuments({ ...OPEN, dueDate: { $lt: now } }),
      Vulnerability.aggregate([{ $match: OPEN }, { $group: { _id: null, avgRisk: { $avg: { $ifNull: ['$riskScore', 0] } }, maxRisk: { $max: { $ifNull: ['$riskScore', 0] } } } }]),
      Vulnerability.find({ remediatedDate: { $ne: null }, firstDetected: { $ne: null } }, 'firstDetected remediatedDate'),
      Asset.countDocuments({}),
      Device.countDocuments({}),
      Vulnerability.aggregate([
        { $match: { ...OPEN, asset: { $ne: null } } },
        { $group: { _id: '$asset', findings: { $sum: 1 }, maxRisk: { $max: { $ifNull: ['$riskScore', 0] } }, kev: { $sum: { $cond: ['$knownExploited', 1, 0] } } } },
        { $sort: { maxRisk: -1, findings: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'assets', localField: '_id', foreignField: '_id', as: 'asset' } },
        { $unwind: '$asset' },
        { $project: { _id: 1, findings: 1, maxRisk: 1, kev: 1, name: '$asset.name', ip: '$asset.ip', criticality: '$asset.criticality' } },
      ]),
    ]);

    const mttrDays = remediated.length
      ? Math.round(remediated.reduce((s, v) => s + sla.daysBetween(v.firstDetected, v.remediatedDate), 0) / remediated.length)
      : null;

    const sevMap = Object.fromEntries(bySeverity.map(s => [s._id, s.count]));

    res.json({
      totals: { vulnerabilities: totalVulns, open: openCount, assets: assetCount, devices: deviceCount },
      severity: {
        Critical: sevMap.Critical || 0, High: sevMap.High || 0,
        Medium: sevMap.Medium || 0, Low: sevMap.Low || 0,
      },
      status: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
      exploitability: { kevOpen, slaBreached: breached },
      risk: { avg: riskAgg[0]?.avgRisk ? Math.round(riskAgg[0].avgRisk * 10) / 10 : 0, max: riskAgg[0]?.maxRisk || 0 },
      meanTimeToRemediateDays: mttrDays,
      topRiskyAssets: topAssets,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build overview', error: err.message });
  }
};

// GET /api/analytics/trends?days=30
exports.trends = async (req, res) => {
  try {
    const days = Math.min(365, parseInt(req.query.days || '30', 10));
    const since = new Date(Date.now() - days * 86400000);
    const fmt = { $dateToString: { format: '%Y-%m-%d', date: '$d' } };

    const [discovered, remediated] = await Promise.all([
      Vulnerability.aggregate([
        { $match: { firstDetected: { $gte: since } } },
        { $project: { d: '$firstDetected' } },
        { $group: { _id: fmt, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Vulnerability.aggregate([
        { $match: { remediatedDate: { $gte: since } } },
        { $project: { d: '$remediatedDate' } },
        { $group: { _id: fmt, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Build a continuous day series so the chart has no gaps.
    const series = [];
    const dMap = Object.fromEntries(discovered.map(x => [x._id, x.count]));
    const rMap = Object.fromEntries(remediated.map(x => [x._id, x.count]));
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      series.push({ date: day, discovered: dMap[day] || 0, remediated: rMap[day] || 0 });
    }
    res.json({ days, series });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build trends', error: err.message });
  }
};

// GET /api/analytics/exposure  -> severity x asset-criticality + by environment
exports.exposure = async (req, res) => {
  try {
    const matrix = await Vulnerability.aggregate([
      { $match: { ...OPEN, asset: { $ne: null } } },
      { $lookup: { from: 'assets', localField: 'asset', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $group: { _id: { severity: '$severity', criticality: '$a.criticality' }, count: { $sum: 1 } } },
    ]);
    const byEnv = await Vulnerability.aggregate([
      { $match: { ...OPEN, asset: { $ne: null } } },
      { $lookup: { from: 'assets', localField: 'asset', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $group: { _id: '$a.environment', findings: { $sum: 1 }, kev: { $sum: { $cond: ['$knownExploited', 1, 0] } } } },
      { $sort: { findings: -1 } },
    ]);
    res.json({ matrix, byEnvironment: byEnv });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build exposure', error: err.message });
  }
};

// GET /api/analytics/compliance -> open findings grouped by mapped control family
exports.compliance = async (req, res) => {
  try {
    const rows = await Vulnerability.aggregate([
      { $match: { ...OPEN, complianceTags: { $exists: true, $ne: [] } } },
      { $unwind: '$complianceTags' },
      { $group: { _id: '$complianceTags', findings: { $sum: 1 }, kev: { $sum: { $cond: ['$knownExploited', 1, 0] } } } },
      { $sort: { findings: -1 } },
    ]);
    // Roll up per framework (prefix before the colon).
    const byFramework = {};
    rows.forEach(r => {
      const fw = String(r._id).split(':')[0];
      byFramework[fw] = (byFramework[fw] || 0) + r.findings;
    });
    res.json({ controls: rows, byFramework });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build compliance view', error: err.message });
  }
};

// GET /api/analytics/report  -> printable executive HTML (browser -> Print to PDF)
exports.report = async (req, res) => {
  try {
    const now = new Date();
    const [sev, openCount, kevOpen, breached, top] = await Promise.all([
      Vulnerability.aggregate([{ $match: OPEN }, { $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Vulnerability.countDocuments(OPEN),
      Vulnerability.countDocuments({ ...OPEN, knownExploited: true }),
      Vulnerability.countDocuments({ ...OPEN, dueDate: { $lt: now } }),
      Vulnerability.find(OPEN).sort({ riskScore: -1 }).limit(15).populate('asset', 'name ip').populate('device', 'name ip'),
    ]);
    const sevMap = Object.fromEntries(sev.map(s => [s._id, s.count]));
    const rows = top.map(v => {
      const t = v.asset || v.device;
      return `<tr><td>${esc(v.title)}</td><td>${esc(v.cve || '')}</td><td class="sev ${v.severity}">${v.severity}</td>
        <td>${v.riskScore ?? ''}</td><td>${v.knownExploited ? 'YES' : ''}</td><td>${esc(t?.name || '')} (${esc(t?.ip || '')})</td>
        <td>${v.dueDate ? new Date(v.dueDate).toISOString().slice(0, 10) : ''}</td></tr>`;
    }).join('');

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Vulnerability Executive Report</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:40px;color:#1a2233}
  h1{margin:0 0 4px} .sub{color:#667085;margin-bottom:24px}
  .kpis{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:28px}
  .kpi{border:1px solid #e4e7ec;border-radius:12px;padding:16px 20px;min-width:130px}
  .kpi .n{font-size:28px;font-weight:700} .kpi .l{color:#667085;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee}
  th{background:#f9fafb} .sev{font-weight:600}
  .Critical{color:#b42318}.High{color:#d92d20}.Medium{color:#b54708}.Low{color:#475467}
  @media print{.noprint{display:none}}
</style></head><body>
  <h1>Vulnerability Executive Report</h1>
  <div class="sub">Generated ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
  <div class="kpis">
    <div class="kpi"><div class="n">${openCount}</div><div class="l">Open findings</div></div>
    <div class="kpi"><div class="n" style="color:#b42318">${sevMap.Critical || 0}</div><div class="l">Critical</div></div>
    <div class="kpi"><div class="n" style="color:#d92d20">${sevMap.High || 0}</div><div class="l">High</div></div>
    <div class="kpi"><div class="n" style="color:#7a2e0e">${kevOpen}</div><div class="l">Known-exploited (KEV)</div></div>
    <div class="kpi"><div class="n" style="color:#b54708">${breached}</div><div class="l">SLA breached</div></div>
  </div>
  <h2>Top ${top.length} by risk</h2>
  <table><thead><tr><th>Title</th><th>CVE</th><th>Severity</th><th>Risk</th><th>KEV</th><th>Asset</th><th>Due</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7">No open findings.</td></tr>'}</tbody></table>
  <p class="noprint" style="margin-top:24px;color:#667085">Tip: use your browser's Print → Save as PDF.</p>
</body></html>`);
  } catch (err) {
    res.status(500).json({ message: 'Failed to build report', error: err.message });
  }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
