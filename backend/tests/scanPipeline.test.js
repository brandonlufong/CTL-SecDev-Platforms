/*
 * Scan-pipeline regression tests (no network, no DB).
 * Run:  npm test    (from backend/)
 *
 * Covers the cross-platform scan rewrite (Workstream A) and the vuln DB
 * contract/KEV/EPSS/risk fixes (Workstream B).
 */
const path = require('path');
const parseNmapOutput = require(path.join(__dirname, '..', 'utils', 'parseNmap'));
const { _service } = require(path.join(__dirname, '..', 'services', 'scannerService'));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } }

(async () => {
  console.log('\n== buildNmapArgs ==');
  const capsPriv = { privileged: true, scripts: { vulners: true, vulscan: false, vuln: true } };
  const capsNoPriv = { privileged: false, scripts: { vulners: false, vulscan: false, vuln: true } };

  let a = _service.buildNmapArgs('10.0.0.5', 'quick', true, capsPriv);
  ok(a.includes('-sS') && a.includes('-F'), 'quick+priv uses -sS -F');
  ok(a[a.length - 1] === '10.0.0.5', 'target is last argv element (no shell interpolation)');
  ok(a.includes('-oX') && a[a.indexOf('-oX') + 1] === '-', 'XML to stdout');
  ok(a.includes('--stats-every'), 'stats-every present for progress');

  ok(_service.buildNmapArgs('10.0.0.5', 'quick', true, capsNoPriv).includes('-sT'), 'quick+noPriv falls back to -sT');
  ok(_service.buildNmapArgs('10.0.0.5', 'comprehensive', true, capsPriv).includes('-O'), 'comprehensive+priv adds -O');
  ok(!_service.buildNmapArgs('10.0.0.5', 'comprehensive', true, capsNoPriv).includes('-O'), 'comprehensive+noPriv omits -O');

  a = _service.buildNmapArgs('10.0.0.5', 'vulnerability', true, capsPriv);
  ok(a[a.indexOf('--script') + 1] === 'vulners', 'vuln scan uses vulners when installed');
  a = _service.buildNmapArgs('10.0.0.5', 'vulnerability', true, capsNoPriv);
  ok(a[a.indexOf('--script') + 1] === 'vuln', 'vuln scan falls back to vuln category');
  ok(!a.includes('unsafe=1'), 'never emits --script-args unsafe=1');

  let threw = false;
  try { _service.buildNmapArgs('10.0.0.5', 'udp', true, capsNoPriv); } catch (_) { threw = true; }
  ok(threw, 'udp without privileges throws a clear error');

  console.log('\n== validateIP ==');
  ok(_service.validateIP('192.168.1.1'), 'accepts single IPv4');
  ok(_service.validateIP('10.0.0.0/24'), 'accepts CIDR');
  ok(_service.validateIP('10.0.0.1-50'), 'accepts hyphen range');
  ok(_service.validateIP('fe80::1'), 'accepts IPv6');
  ok(!_service.validateIP('not-an-ip'), 'rejects non-ip string');

  console.log('\n== parseNmap (XML + vulners NSE) ==');
  const xml = `<?xml version="1.0"?>
<nmaprun scanner="nmap">
<host><status state="up"/><address addr="10.0.0.5" addrtype="ipv4"/>
<hostnames><hostname name="web01"/></hostnames>
<ports>
<port protocol="tcp" portid="22"><state state="open"/>
  <service name="ssh" product="OpenSSH" version="7.6p1" conf="10">
    <cpe>cpe:/a:openbsd:openssh:7.6p1</cpe></service>
  <script id="vulners" output="cpe:/a:openbsd:openssh:7.6p1:
    CVE-2019-6111  5.8  https://vulners.com/cve/CVE-2019-6111
    CVE-2018-15919  5.0  https://vulners.com/cve/CVE-2018-15919"/>
</port>
</ports>
<os><osmatch name="Linux 4.x" accuracy="95"/></os>
</host>
</nmaprun>`;

  const rows = await parseNmapOutput(xml);
  const ssh = rows.find(r => r.port === 22);
  ok(ssh && ssh.service === 'ssh' && ssh.product === 'OpenSSH', 'ssh service/product parsed');
  ok(ssh && ssh.vulnerabilities.includes('CVE-2019-6111'), 'CVE strings extracted from vulners');
  ok(ssh && ssh.scriptVulns.some(v => v.cve === 'CVE-2019-6111' && v.cvssScore === 5.8), 'CVSS parsed from vulners');
  ok(ssh && ssh.host && ssh.host.os[0].name === 'Linux 4.x', 'host OS match attached');
  ok(ssh && ssh.cpe.includes('openssh'), 'service CPE (child element) parsed');

  console.log('\n== vuln DB: KEV fetched once + risk scoring (mocked axios) ==');
  const axios = require('axios');
  const counts = {};
  axios.get = async (url, opts) => {
    const key = url.includes('known_exploited') ? 'KEV' : url.includes('epss') ? 'EPSS' : 'other';
    counts[key] = (counts[key] || 0) + 1;
    if (key === 'KEV') return { data: { vulnerabilities: [{ cveID: 'CVE-2019-6111' }] } };
    if (key === 'EPSS') {
      const cves = ((opts && opts.params && opts.params.cve) || '').split(',');
      return { data: { data: cves.map(c => ({ cve: c, epss: c === 'CVE-2019-6111' ? '0.75' : '0.02' })) } };
    }
    return { data: [] };
  };
  // Fresh require after mock (module caches axios ref at call time, so clear its cache).
  delete require.cache[require.resolve(path.join(__dirname, '..', 'services', 'vulnerabilityDatabase'))];
  const db = require(path.join(__dirname, '..', 'services', 'vulnerabilityDatabase'));
  let first;
  for (let i = 0; i < 5; i++) {
    const r = await db.enrichCves([{ cve: 'CVE-2019-6111', cvssScore: 5.8 }, { cve: 'CVE-2021-99999', cvssScore: 9.8 }]);
    if (i === 0) first = r;
  }
  ok(counts.KEV === 1, `KEV fetched exactly once across 5 enrichments (got ${counts.KEV})`);
  const kevVuln = first.find(v => v.cve === 'CVE-2019-6111');
  ok(kevVuln && kevVuln.knownExploited === true, 'KEV flag applied');
  ok(kevVuln && kevVuln.epssScore === 0.75, 'EPSS score applied');
  ok(kevVuln && kevVuln.riskScore > 8, 'riskScore boosted by KEV + high EPSS');

  console.log(`\n${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
