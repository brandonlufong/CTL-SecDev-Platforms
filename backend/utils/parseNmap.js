const xml2js = require('xml2js');

/**
 * Nmap output parser.
 *
 * Primary path is XML (`-oX -`); a text fallback covers the rare case where the
 * XML is truncated. Per open port we extract service/version/CPE plus any CVEs
 * emitted by NSE vuln scripts (`vulners`, the `vuln` category, `vulscan`), with
 * their CVSS scores when present. Host-level data (OS guesses, host scripts) is
 * attached to every port row so callers can use it without a second pass.
 */

const CVE_RE = /CVE-\d{4}-\d{4,7}/gi;

/**
 * Pull structured CVEs from an NSE script's text output. `vulners`/`vulscan`
 * emit lines like:  "\tCVE-2019-6111\t5.8\thttps://vulners.com/cve/CVE-2019-6111"
 * Returns [{ cve, cvssScore }] with cvssScore null when not parseable.
 */
function extractCvesFromScriptText(text) {
  if (!text) return [];
  const found = new Map();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const cveMatch = line.match(/CVE-\d{4}-\d{4,7}/i);
    if (!cveMatch) continue;
    const cve = cveMatch[0].toUpperCase();
    // First float after the CVE on the same line is (almost always) the CVSS.
    const after = line.slice(line.indexOf(cveMatch[0]) + cveMatch[0].length);
    const scoreMatch = after.match(/(\d{1,2}\.\d)/);
    const cvssScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    if (!found.has(cve) || (cvssScore != null && found.get(cve) == null)) {
      found.set(cve, cvssScore);
    }
  }
  return Array.from(found, ([cve, cvssScore]) => ({ cve, cvssScore }));
}

function normalizeScripts(scriptNode) {
  if (!scriptNode) return [];
  return Array.isArray(scriptNode) ? scriptNode : [scriptNode];
}

function parseHostLevel(host) {
  const info = { os: [], hostScripts: [], hostname: null };

  // OS matches
  const osmatch = host.os && host.os.osmatch;
  if (osmatch) {
    const matches = Array.isArray(osmatch) ? osmatch : [osmatch];
    info.os = matches.map(o => ({
      name: o.$ && o.$.name,
      accuracy: o.$ && parseInt(o.$.accuracy, 10)
    })).filter(o => o.name);
  }

  // Hostname
  const hn = host.hostnames && host.hostnames.hostname;
  if (hn) {
    const first = Array.isArray(hn) ? hn[0] : hn;
    info.hostname = first && first.$ && first.$.name;
  }

  // Host-level scripts (e.g. smb-vuln-*)
  const hs = host.hostscript && host.hostscript.script;
  normalizeScripts(hs).forEach(s => {
    if (!s.$) return;
    const out = s._ || s.$.output || '';
    info.hostScripts.push({ id: s.$.id, output: out, cves: extractCvesFromScriptText(out) });
  });

  return info;
}

async function parseNmapXml(xmlOutput) {
  const parser = new xml2js.Parser({ explicitArray: false });

  try {
    const result = await parser.parseStringPromise(xmlOutput);
    let host = result?.nmaprun?.host;
    if (!host) return [];
    // Multiple hosts (CIDR/range) -> flatten.
    const hosts = Array.isArray(host) ? host : [host];
    const rows = [];

    for (const h of hosts) {
      const hostInfo = parseHostLevel(h);
      const ports = h.ports?.port;
      if (!ports) continue;
      const portArray = Array.isArray(ports) ? ports : [ports];

      for (const port of portArray) {
        const portInfo = port.$ || {};
        const state = port.state?.$ || {};
        const serviceNode = port.service || {};
        const service = serviceNode.$ || {};

        // <cpe> is a CHILD element of <service>, not an attribute.
        let cpe = '';
        if (serviceNode.cpe) {
          cpe = Array.isArray(serviceNode.cpe) ? serviceNode.cpe[0] : serviceNode.cpe;
        }

        // Collect CVEs from any port script (vulners, vuln, vulscan, ...).
        // nmap stores the human-readable text in the `output` ATTRIBUTE.
        const scriptVulns = [];
        let scriptOutput = '';
        normalizeScripts(port.script).forEach(script => {
          if (!script.$) return;
          const out = script._ || script.$.output || '';
          if (out) scriptOutput += `[${script.$.id}]\n${out}\n`;
          extractCvesFromScriptText(out).forEach(v => scriptVulns.push(v));
        });

        // De-dupe CVEs, keep best-known CVSS.
        const cveMap = new Map();
        scriptVulns.forEach(({ cve, cvssScore }) => {
          if (!cveMap.has(cve) || (cvssScore != null && cveMap.get(cve) == null)) {
            cveMap.set(cve, cvssScore);
          }
        });

        rows.push({
          port: parseInt(portInfo.portid, 10) || 0,
          protocol: portInfo.protocol || 'tcp',
          state: state.state || 'unknown',
          service: service.name || 'unknown',
          product: service.product || '',
          version: service.version || '',
          extraInfo: service.extrainfo || '',
          cpe,
          // Kept as plain CVE strings for backward-compat with vulnerabilityDetection.
          vulnerabilities: Array.from(cveMap.keys()),
          // Structured CVEs (with CVSS) for richer correlation.
          scriptVulns: Array.from(cveMap, ([cve, cvssScore]) => ({ cve, cvssScore })),
          scriptOutput,
          confidence: parseInt(service.conf, 10) || 0,
          host: {
            ip: (h.address && (Array.isArray(h.address) ? h.address[0].$?.addr : h.address.$?.addr)) || null,
            hostname: hostInfo.hostname,
            os: hostInfo.os,
            hostScripts: hostInfo.hostScripts
          }
        });
      }
    }

    return rows;
  } catch (error) {
    console.error('[parseNmap] XML parse failed, using text fallback:', error.message);
    return parseNmapText(xmlOutput);
  }
}

function parseNmapText(output) {
  const lines = output.split('\n');
  const results = [];
  let inPortSection = false;

  for (let line of lines) {
    line = line.trim();

    if (line.startsWith('PORT') && line.includes('STATE') && line.includes('SERVICE')) {
      inPortSection = true;
      continue;
    }
    if (inPortSection && (line === '' || line.startsWith('Service detection') || line.startsWith('Nmap done'))) {
      inPortSection = false;
      continue;
    }

    if (inPortSection && /^[0-9]/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const [portProto, state, service, ...versionParts] = parts;
        const [port, protocol] = portProto.split('/');
        const versionInfo = versionParts.join(' ');

        const result = {
          port: parseInt(port, 10),
          protocol: protocol || 'tcp',
          state,
          service,
          product: '',
          version: '',
          extraInfo: '',
          cpe: '',
          vulnerabilities: [],
          scriptVulns: [],
          confidence: 0
        };

        if (versionInfo) {
          const productVersionMatch = versionInfo.match(/^([^0-9(]+?)\s+([0-9][^\s(]*)/);
          if (productVersionMatch) {
            result.product = productVersionMatch[1].trim();
            result.version = productVersionMatch[2].trim();
          } else {
            result.product = versionInfo.replace(/\([^)]*\)/g, '').trim();
          }
          const extraInfoMatch = versionInfo.match(/\(([^)]+)\)/);
          if (extraInfoMatch) result.extraInfo = extraInfoMatch[1];
          const cpeMatch = versionInfo.match(/cpe:\/[^\s)]+/i);
          if (cpeMatch) result.cpe = cpeMatch[0];
        }

        results.push(result);
      }
    }

    if (line.includes('CVE-')) {
      const cveMatches = line.match(CVE_RE);
      if (cveMatches && results.length > 0) {
        const last = results[results.length - 1];
        cveMatches.forEach(cve => {
          const up = cve.toUpperCase();
          if (!last.vulnerabilities.includes(up)) {
            last.vulnerabilities.push(up);
            last.scriptVulns.push({ cve: up, cvssScore: null });
          }
        });
      }
    }
  }

  return results;
}

function generateCPE(serviceInfo) {
  const { product, version, service } = serviceInfo;
  if (!product) return '';
  const cpeProduct = product.toLowerCase().replace(/\s+/g, '_');
  const cpeVersion = version || '*';
  let cpePart = 'a';
  if (['ssh', 'http', 'https', 'ftp', 'smtp', 'mysql'].includes(service)) cpePart = 'a';
  return `cpe:/${cpePart}:${cpeProduct}:${cpeProduct}:${cpeVersion}`;
}

module.exports = async function parseNmapOutput(output) {
  if (!output) return [];
  if (output.includes('<?xml') || output.includes('<nmaprun')) {
    return await parseNmapXml(output);
  }
  const results = parseNmapText(output);
  return results.map(result => {
    if (!result.cpe && result.product) result.cpe = generateCPE(result);
    return result;
  });
};

module.exports.parseNmapXml = parseNmapXml;
module.exports.parseNmapText = parseNmapText;
module.exports.generateCPE = generateCPE;
module.exports.extractCvesFromScriptText = extractCvesFromScriptText;
