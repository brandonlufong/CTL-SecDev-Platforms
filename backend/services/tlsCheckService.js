const tls = require('tls');
const http = require('http');
const https = require('https');

/**
 * Lightweight TLS + HTTP security posture checks (Workstream D), built on Node's
 * built-in tls/http modules — no external dependencies. Complements nmap by
 * flagging expiring/weak certificates and missing security headers.
 */

function checkTls(host, port = 443, timeout = 8000) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout },
      () => {
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;
        const authError = socket.authorizationError;
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({ host, port, ok: false, error: 'No certificate presented' });
        }
        const now = Date.now();
        const validTo = cert.valid_to ? new Date(cert.valid_to).getTime() : null;
        const daysToExpiry = validTo ? Math.round((validTo - now) / 86400000) : null;

        const findings = [];
        if (daysToExpiry != null && daysToExpiry < 0) findings.push({ severity: 'High', issue: 'Certificate expired' });
        else if (daysToExpiry != null && daysToExpiry <= 30) findings.push({ severity: 'Medium', issue: `Certificate expires in ${daysToExpiry} days` });
        if (!authorized && authError) findings.push({ severity: 'Medium', issue: `Certificate not trusted: ${authError}` });
        if (['TLSv1', 'TLSv1.1', 'SSLv3'].includes(protocol)) findings.push({ severity: 'High', issue: `Weak TLS protocol: ${protocol}` });

        resolve({
          host, port, ok: true,
          protocol,
          authorized,
          subject: cert.subject?.CN || null,
          issuer: cert.issuer?.O || cert.issuer?.CN || null,
          validFrom: cert.valid_from || null,
          validTo: cert.valid_to || null,
          daysToExpiry,
          findings,
        });
      }
    );
    socket.on('error', (err) => resolve({ host, port, ok: false, error: err.message }));
    socket.on('timeout', () => { socket.destroy(); resolve({ host, port, ok: false, error: 'timeout' }); });
  });
}

// Recommended HTTP security headers and the risk of their absence.
const SECURITY_HEADERS = {
  'strict-transport-security': 'Medium',
  'content-security-policy': 'Medium',
  'x-frame-options': 'Low',
  'x-content-type-options': 'Low',
  'referrer-policy': 'Low',
  'permissions-policy': 'Low',
};

function checkHeaders(host, port = 443, useHttps = true, timeout = 8000) {
  return new Promise((resolve) => {
    const lib = useHttps ? https : http;
    const req = lib.request(
      { host, port, method: 'HEAD', path: '/', timeout, rejectUnauthorized: false },
      (resp) => {
        const present = resp.headers;
        const missing = [];
        for (const [h, sev] of Object.entries(SECURITY_HEADERS)) {
          if (!present[h]) missing.push({ header: h, severity: sev });
        }
        const findings = missing.map(m => ({ severity: m.severity, issue: `Missing security header: ${m.header}` }));
        if (present['server']) findings.push({ severity: 'Low', issue: `Server banner exposed: ${present['server']}` });
        resolve({ host, port, statusCode: resp.statusCode, missingHeaders: missing.map(m => m.header), findings });
        resp.resume();
      }
    );
    req.on('error', (err) => resolve({ host, port, error: err.message, findings: [] }));
    req.on('timeout', () => { req.destroy(); resolve({ host, port, error: 'timeout', findings: [] }); });
    req.end();
  });
}

/** Full posture check for a host: TLS on 443 + headers on the given web ports. */
async function checkHost(host, ports = [443, 80]) {
  const out = { host, tls: null, http: [], findings: [] };
  if (ports.includes(443)) {
    out.tls = await checkTls(host, 443);
    if (out.tls.findings) out.findings.push(...out.tls.findings.map(f => ({ ...f, source: 'tls:443' })));
  }
  for (const p of ports.filter(p => p === 80 || p === 8080 || p === 443)) {
    const h = await checkHeaders(host, p, p === 443);
    out.http.push(h);
    if (h.findings) out.findings.push(...h.findings.map(f => ({ ...f, source: `http:${p}` })));
  }
  return out;
}

module.exports = { checkTls, checkHeaders, checkHost };
