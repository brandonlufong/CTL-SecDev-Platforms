const xml2js = require('xml2js');
const Asset = require('../models/Asset');
const Vulnerability = require('../models/Vulnerability');
const { tagsFor } = require('../utils/compliance');
const { criticalityFactor } = require('../utils/risk');

/**
 * Import findings from other scanners (Nessus .nessus v2, OpenVAS/Greenbone XML).
 * Upserts the host as an Asset (by IP) and creates de-duplicated Vulnerability
 * records — so CamtelVM can act as the central register for multiple tools
 * (DefectDojo-style consolidation).
 */

const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const sevFromScore = (n) => (n >= 9 ? 'Critical' : n >= 7 ? 'High' : n >= 4 ? 'Medium' : n > 0 ? 'Low' : 'Low');
// Nessus risk_factor / numeric severity → our scale
const NESSUS_SEV = { '4': 'Critical', '3': 'High', '2': 'Medium', '1': 'Low', '0': 'Low' };

function detectFormat(content) {
  // Nessus is uniquely identified by its client-data root or ReportHost nodes.
  if (/NessusClientData_v2|<ReportHost\b/.test(content)) return 'nessus';
  // OpenVAS/Greenbone: result/nvt nodes or the OMP response wrapper.
  if (/get_results_response|<results\b|<result\b|<nvt\b|openvas|greenbone/i.test(content)) return 'openvas';
  if (/<report\b/i.test(content)) return 'openvas';
  return null;
}

async function parseNessus(xml) {
  const doc = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(xml);
  const report = doc?.NessusClientData_v2?.Report || doc?.Report;
  const out = [];
  for (const host of arr(report?.ReportHost)) {
    const props = arr(host?.HostProperties?.tag).reduce((m, t) => { if (t?.$?.name) m[t.$.name] = t._; return m; }, {});
    const ip = props['host-ip'] || host?.$?.name;
    for (const item of arr(host?.ReportItem)) {
      const a = item.$ || {};
      const sev = NESSUS_SEV[a.severity] || 'Low';
      if (a.severity === '0') continue; // skip informational
      const cve = arr(item.cve)[0] || null;
      const cvss = parseFloat(item.cvss3_base_score || item.cvss_base_score) || null;
      out.push({
        ip,
        title: a.pluginName || item.plugin_name || (cve ? `${cve}` : 'Finding'),
        cve,
        severity: cvss ? sevFromScore(cvss) : sev,
        cvssScore: cvss,
        description: item.description || item.synopsis || '',
        remediation: item.solution || '',
        port: a.port && a.port !== '0' ? Number(a.port) : null,
        service: a.svc_name || '',
        references: arr(item.see_also).join(' ').split(/\s+/).filter(u => /^https?:/.test(u)).slice(0, 6),
      });
    }
  }
  return out;
}

async function parseOpenvas(xml) {
  const doc = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(xml);
  // Handle both raw <report> and get_results_response wrappers.
  const results = doc?.get_results_response?.results?.result
    || doc?.report?.report?.results?.result
    || doc?.report?.results?.result
    || doc?.results?.result;
  const out = [];
  for (const r of arr(results)) {
    const ip = (typeof r.host === 'object' ? r.host._ : r.host) || r.host;
    const score = parseFloat(r.severity) || null;
    if (score != null && score <= 0) continue;
    const nvt = r.nvt || {};
    const cve = arr(nvt.cve).filter(c => /^CVE-/i.test(c))[0] || (/(CVE-\d{4}-\d{4,7})/i.exec(nvt.cve || '') || [])[1] || null;
    out.push({
      ip,
      title: nvt.name || r.name || (cve || 'Finding'),
      cve,
      severity: score ? sevFromScore(score) : (r.threat || 'Low'),
      cvssScore: score,
      description: r.description || '',
      remediation: (nvt.solution && (typeof nvt.solution === 'object' ? nvt.solution._ : nvt.solution)) || '',
      port: (() => { const p = /(\d+)\//.exec(r.port || ''); return p ? Number(p[1]) : null; })(),
      service: (/(\d+)\/(\w+)/.exec(r.port || '') || [])[2] || '',
      references: [],
    });
  }
  return out;
}

/**
 * Heuristic extractor for OpenVAS/Greenbone PDF reports. PDFs aren't structured
 * like XML, so we scan the extracted text: track the "current host" and nearest
 * severity/CVSS/title, and emit a finding whenever a CVE appears near a host.
 * Best-effort — findings without a CVE in the text may be missed.
 */
function parseOpenvasPdf(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let host = null, severity = null, cvss = null, title = null;
  const ipRe = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;
  const cveRe = /CVE-\d{4}-\d{4,7}/gi;
  const sevRe = /\b(Critical|High|Medium|Low)\b/;
  // Try several ways a CVSS score shows up: "CVSS: 9.8", "Severity: 9.8",
  // "9.8 (High)", or a bare "(9.8)".
  const cvssPatterns = [
    /CVSS[^0-9]{0,8}([0-9]{1,2}\.[0-9])/i,
    /Severity[:\s]+([0-9]{1,2}\.[0-9])/i,
    /([0-9]{1,2}\.[0-9])\s*\((?:Critical|High|Medium|Low)\)/i,
    /\(([0-9]{1,2}\.[0-9])\)/,
  ];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Explicit host label, or a line that is essentially just an IP heading.
    if (/^(Host|IP Address|IP)[:\s]/i.test(line) && ipRe.test(line)) { host = line.match(ipRe)[1]; continue; }
    if (ipRe.test(line) && line.replace(ipRe, '').replace(/[^\w]/g, '').length <= 3) host = line.match(ipRe)[1];

    for (const re of cvssPatterns) { const m = line.match(re); if (m) { cvss = parseFloat(m[1]); break; } }
    const sM = line.match(sevRe); if (sM) severity = sM[1];
    if (/^(NVT|Vulnerability|Name|Summary)[:\s]/i.test(line)) title = line.replace(/^(NVT|Vulnerability|Name|Summary)[:\s]+/i, '').trim().slice(0, 140);

    const cves = line.match(cveRe);
    if (cves && host) {
      for (const cve of new Set(cves.map(c => c.toUpperCase()))) {
        out.push({
          ip: host, cve, title: title || cve,
          severity: severity || (cvss ? sevFromScore(cvss) : 'Low'),
          cvssScore: cvss, description: '', remediation: '', port: null, service: '', references: [],
        });
      }
    }
  }
  // De-dupe by host+cve
  const seen = new Set();
  return out.filter(f => { const k = `${f.ip}|${f.cve}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Exposed for unit testing
exports._parseNessus = parseNessus;
exports._parseOpenvas = parseOpenvas;
exports._parseOpenvasPdf = parseOpenvasPdf;
exports._detectFormat = detectFormat;

// POST /api/import/scan   { format?, content }
exports.importScan = async (req, res) => {
  try {
    let content = req.body?.content;
    let format = req.body?.format;
    let findings;

    // Binary upload (PDF) arrives base64-encoded.
    if (req.body?.contentBase64) {
      const buf = Buffer.from(req.body.contentBase64, 'base64');
      if (buf.slice(0, 5).toString() === '%PDF-') {
        let pdfParse;
        try { pdfParse = require('pdf-parse'); }
        catch (e) { return res.status(500).json({ message: 'PDF support unavailable on the server (pdf-parse not installed).' }); }
        const parsed = await pdfParse(buf);
        findings = parseOpenvasPdf(parsed.text || '');
        format = 'openvas-pdf';
      } else {
        content = buf.toString('utf8'); // XML uploaded as base64
      }
    }

    if (!findings) {
      if (!content || content.length < 20) return res.status(400).json({ message: 'No scan content provided' });
      const fmt = (format && format !== 'auto') ? format : detectFormat(content);
      if (!fmt) return res.status(400).json({ message: 'Unrecognized format — specify nessus or openvas' });
      format = fmt;
      findings = fmt === 'nessus' ? await parseNessus(content) : await parseOpenvas(content);
    }
    if (findings.length === 0) return res.json({ message: 'No importable findings found', format, imported: 0, assetsTouched: 0 });

    const assetCache = new Map(); // ip -> asset
    let created = 0, updated = 0, newAssets = 0;

    for (const f of findings) {
      if (!f.ip) continue;
      let asset = assetCache.get(f.ip);
      if (!asset) {
        asset = await Asset.findOne({ ip: f.ip });
        if (!asset) { asset = await Asset.create({ name: f.ip, ip: f.ip, type: 'Server', description: `Imported from ${format}` }); newAssets++; }
        assetCache.set(f.ip, asset);
      }
      const base = typeof f.cvssScore === 'number' ? f.cvssScore : (f.severity === 'Critical' ? 9 : f.severity === 'High' ? 7.5 : f.severity === 'Medium' ? 5 : 2);
      const riskScore = Math.round(Math.min(10, base * criticalityFactor(asset.criticality)) * 10) / 10;
      const query = { $and: [{ $or: [{ cve: f.cve || '__none__' }, { title: f.title }] }, { asset: asset._id }] };
      const existing = await Vulnerability.findOne(query);
      const doc = {
        title: f.title, cve: f.cve || null, severity: f.severity,
        description: f.description, remediation: f.remediation, cvssScore: base, riskScore,
        references: f.references || [], asset: asset._id,
        affectedProducts: f.service ? [f.service] : [],
        complianceTags: tagsFor({ service: f.service, port: f.port, severity: f.severity, title: f.title }),
        discoveredDate: new Date(),
      };
      if (existing) {
        Object.assign(existing, doc);
        if (['Resolved', 'Closed'].includes(existing.status)) existing.status = 'Open';
        await existing.save(); updated++;
      } else {
        await Vulnerability.create({ ...doc, status: 'Open' }); created++;
      }
    }

    res.json({
      message: `Imported ${format} scan`, format,
      findings: findings.length, created, updated, newAssets,
      assetsTouched: assetCache.size,
    });
  } catch (err) {
    res.status(500).json({ message: 'Import failed', error: err.message });
  }
};
