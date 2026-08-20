const axios = require('axios');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const Vulnerability = require('../models/Vulnerability');
const { tagsFor } = require('../utils/compliance');
const { criticalityFactor } = require('../utils/risk');

/**
 * Optional scan-engine abstraction (Phase 4c).
 *
 * nmap is the built-in engine and is always available. Nessus and OpenVAS/
 * Greenbone are OPTIONAL: they light up only when configured via env, and if a
 * chosen engine is unconfigured or unreachable the caller falls back to nmap —
 * so a scan always has a working engine even if one backend is down.
 *
 * Nessus and OpenVAS produce vulnerability findings directly (not port lists to
 * enrich), so this module returns import-shaped findings and can persist them as
 * Vulnerabilities on the target, mirroring the multi-tool import path.
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sevFromScore = (n) => (n >= 9 ? 'Critical' : n >= 7 ? 'High' : n >= 4 ? 'Medium' : n > 0 ? 'Low' : 'Low');

// ---- Config (from env) ----
const NESSUS = {
  url: (process.env.NESSUS_URL || '').replace(/\/$/, ''),
  ak: process.env.NESSUS_ACCESS_KEY || '',
  sk: process.env.NESSUS_SECRET_KEY || '',
  policy: process.env.NESSUS_POLICY_UUID || '',
};
const GVM = {
  socket: process.env.GVM_SOCKET || '',          // e.g. /run/gvmd/gvmd.sock
  host: process.env.GVM_HOST || '',              // or TLS host
  port: process.env.GVM_PORT || '9390',
  user: process.env.GVM_USER || '',
  pass: process.env.GVM_PASSWORD || '',
  config: process.env.GVM_SCAN_CONFIG || 'daba56c8-73ec-11df-a475-002264764cea', // "Full and fast"
  scanner: process.env.GVM_SCANNER || '08b69003-5fc2-4037-a479-93b440211c73',     // OpenVAS Default
};

function engineConfig() {
  return {
    nmap: { available: true, kind: 'builtin' },
    nessus: { available: !!(NESSUS.url && NESSUS.ak && NESSUS.sk), kind: 'rest', url: NESSUS.url || null },
    openvas: { available: !!((GVM.socket || GVM.host) && GVM.user && GVM.pass), kind: 'gmp', host: GVM.host || GVM.socket || null },
  };
}

// ---- Nessus REST adapter ----
function nessusReq(path, method = 'get', data) {
  return axios({
    url: NESSUS.url + path, method, data,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 25000,
    headers: { 'X-ApiKeys': `accessKey=${NESSUS.ak}; secretKey=${NESSUS.sk}` },
  });
}

async function nessusTemplateUuid() {
  if (NESSUS.policy) return NESSUS.policy;
  const r = await nessusReq('/editor/scan/templates');
  const tpls = r.data?.templates || [];
  const pick = tpls.find(t => /basic/i.test(t.name)) || tpls.find(t => /advanced/i.test(t.name)) || tpls[0];
  if (!pick) throw new Error('No Nessus scan template found');
  return pick.uuid;
}

async function runNessusScan(ip, { onProgress } = {}) {
  if (!engineConfig().nessus.available) throw new Error('Nessus is not configured (set NESSUS_URL / NESSUS_ACCESS_KEY / NESSUS_SECRET_KEY)');
  if (onProgress) onProgress(5, 'Nessus: creating scan');
  const uuid = await nessusTemplateUuid();
  const create = await nessusReq('/scans', 'post', { uuid, settings: { name: `CamtelVM ${ip} ${Date.now()}`, enabled: false, text_targets: ip } });
  const scanId = create.data?.scan?.id;
  if (!scanId) throw new Error('Nessus did not return a scan id');
  await nessusReq(`/scans/${scanId}/launch`, 'post');

  let status = 'running';
  for (let i = 0; i < 720 && ['running', 'pending'].includes(status); i++) { // up to ~1h
    await sleep(5000);
    try { status = (await nessusReq(`/scans/${scanId}`)).data?.info?.status || status; } catch (_) {}
    if (onProgress) onProgress(Math.min(65, 10 + i), `Nessus: scanning (${status})`);
  }
  if (onProgress) onProgress(70, 'Nessus: exporting results');
  const exp = await nessusReq(`/scans/${scanId}/export`, 'post', { format: 'nessus' });
  const fileId = exp.data?.file;
  let est = 'loading';
  for (let i = 0; i < 60 && est !== 'ready'; i++) {
    await sleep(3000);
    est = (await nessusReq(`/scans/${scanId}/export/${fileId}/status`)).data?.status || est;
  }
  const dl = await nessusReq(`/scans/${scanId}/export/${fileId}/download`);
  const xml = typeof dl.data === 'string' ? dl.data : JSON.stringify(dl.data);
  return require('../controllers/importController')._parseNessus(xml);
}

// ---- OpenVAS / Greenbone adapter (via gvm-cli, experimental) ----
function gvmConn() {
  if (GVM.socket) return `socket --socketpath ${GVM.socket}`;
  return `tls --hostname ${GVM.host} --port ${GVM.port}`;
}
async function gvmXml(xml) {
  const conn = gvmConn();
  const cmd = `gvm-cli --gmp-username "${GVM.user}" --gmp-password "${GVM.pass}" ${conn} --xml '${xml.replace(/'/g, "'\\''")}'`;
  const { stdout } = await execAsync(cmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 50 });
  return stdout;
}

async function runOpenvasScan(ip, { onProgress } = {}) {
  if (!engineConfig().openvas.available) throw new Error('OpenVAS is not configured (set GVM_HOST/GVM_SOCKET + GVM_USER + GVM_PASSWORD)');
  // Requires the gvm-tools `gvm-cli` binary on PATH.
  try { await execAsync('gvm-cli --version', { timeout: 8000 }); }
  catch (_) { throw new Error('gvm-cli (gvm-tools) not found on the server — install gvm-tools to run live OpenVAS scans, or import the XML/PDF report instead'); }

  const xml2js = require('xml2js');
  const parse = (s) => new xml2js.Parser({ explicitArray: false }).parseStringPromise(s);
  const idOf = (r, tag) => r?.[tag]?.$?.id;

  if (onProgress) onProgress(5, 'OpenVAS: creating target');
  const tRes = await parse(await gvmXml(`<create_target><name>CamtelVM ${ip} ${Date.now()}</name><hosts>${ip}</hosts></create_target>`));
  const targetId = tRes.create_target_response?.$?.id;
  const cRes = await parse(await gvmXml(`<create_task><name>CamtelVM ${ip}</name><config id="${GVM.config}"/><target id="${targetId}"/><scanner id="${GVM.scanner}"/></create_task>`));
  const taskId = cRes.create_task_response?.$?.id;
  await gvmXml(`<start_task task_id="${taskId}"/>`);

  let done = false, reportId = null;
  for (let i = 0; i < 720 && !done; i++) {
    await sleep(5000);
    const st = await parse(await gvmXml(`<get_tasks task_id="${taskId}"/>`));
    const task = st.get_tasks_response?.task;
    const status = task?.status;
    reportId = task?.last_report?.report?.$?.id || reportId;
    if (onProgress) onProgress(Math.min(65, 10 + i), `OpenVAS: ${status} ${task?.progress || ''}%`);
    if (status === 'Done') done = true;
  }
  if (onProgress) onProgress(70, 'OpenVAS: fetching report');
  const rep = await gvmXml(`<get_reports report_id="${reportId}" format_id="a994b278-1f62-11e1-96ac-406186ea4fc5"/>`); // XML format
  return require('../controllers/importController')._parseOpenvas(rep);
}

// ---- Persist findings onto a target ----
async function persistFindings(findings, target, targetField) {
  let created = 0, updated = 0;
  const ref = { [targetField]: target._id };
  for (const f of findings) {
    const base = typeof f.cvssScore === 'number' ? f.cvssScore : (f.severity === 'Critical' ? 9 : f.severity === 'High' ? 7.5 : f.severity === 'Medium' ? 5 : 2);
    const riskScore = Math.round(Math.min(10, base * criticalityFactor(target.criticality)) * 10) / 10;
    const query = { $and: [{ $or: [{ cve: f.cve || '__none__' }, { title: f.title }] }, ref] };
    const doc = {
      title: f.title, cve: f.cve || null, severity: f.severity, description: f.description || '',
      remediation: f.remediation || '', cvssScore: base, riskScore, references: f.references || [],
      ...ref, affectedProducts: f.service ? [f.service] : [],
      complianceTags: tagsFor({ service: f.service, port: f.port, severity: f.severity, title: f.title }),
      discoveredDate: new Date(),
    };
    const existing = await Vulnerability.findOne(query);
    if (existing) { Object.assign(existing, doc); if (['Resolved', 'Closed'].includes(existing.status)) existing.status = 'Open'; await existing.save(); updated++; }
    else { await Vulnerability.create({ ...doc, status: 'Open' }); created++; }
  }
  return { created, updated };
}

async function runEngine(engine, ip, options = {}) {
  if (engine === 'nessus') return runNessusScan(ip, options);
  if (engine === 'openvas') return runOpenvasScan(ip, options);
  throw new Error(`Unknown engine ${engine}`);
}

module.exports = { engineConfig, runEngine, runNessusScan, runOpenvasScan, persistFindings, sevFromScore };
