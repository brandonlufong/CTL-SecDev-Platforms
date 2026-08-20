/**
 * Lightweight compliance mapping (Workstream D).
 *
 * Maps a finding to the control families it most directly relates to across
 * common frameworks (PCI-DSS, ISO/IEC 27001, CIS Controls v8). This is a
 * pragmatic heuristic — enough to drive coverage dashboards and audit exports,
 * not a certified control mapping.
 */

const PLAINTEXT_SERVICES = ['telnet', 'ftp', 'http', 'rlogin', 'rsh', 'tftp', 'snmp', 'pop3', 'imap'];
const DB_SERVICES = ['mysql', 'mariadb', 'postgresql', 'mongodb', 'redis', 'mssql', 'oracle', 'ms-sql'];
const REMOTE_ADMIN = ['ssh', 'rdp', 'ms-wbt-server', 'vnc', 'telnet'];

function tagsFor(finding = {}) {
  const service = String(finding.service || '').toLowerCase();
  const title = String(finding.title || '').toLowerCase();
  const port = finding.port;
  const tags = new Set();

  // Every vulnerability is in scope for baseline vuln-management controls.
  tags.add('ISO-27001:A.12.6.1');   // Management of technical vulnerabilities
  tags.add('CIS:7');                 // Continuous Vulnerability Management

  // Unencrypted transmission.
  if (PLAINTEXT_SERVICES.includes(service) || /cleartext|plaintext|unencrypted|weak cipher|sslv|tls\s?1\.0|tls\s?1\.1/.test(title)) {
    tags.add('PCI-DSS:4.2.1');       // Strong cryptography in transit
    tags.add('ISO-27001:A.8.24');    // Use of cryptography
    tags.add('CIS:3');               // Data Protection
  }

  // Exposed databases / data stores.
  if (DB_SERVICES.includes(service)) {
    tags.add('PCI-DSS:1.3');         // Restrict inbound/outbound to CDE
    tags.add('CIS:4');               // Secure Configuration
  }

  // Remote administration surfaces.
  if (REMOTE_ADMIN.includes(service) || [22, 3389, 5900].includes(port)) {
    tags.add('CIS:4');               // Secure Configuration
    tags.add('ISO-27001:A.8.20');    // Networks security
  }

  // Certificate / TLS posture.
  if (/certificate|cert expired|self-signed|hsts|security header/.test(title)) {
    tags.add('PCI-DSS:4.2.1');
    tags.add('CIS:3');
  }

  // Actively exploited / patchable.
  if (finding.knownExploited || finding.exploitAvailable || finding.severity === 'Critical' || finding.severity === 'High') {
    tags.add('PCI-DSS:6.3.1');       // Identify & rank vulnerabilities
    tags.add('PCI-DSS:6.3.3');       // Install security patches
  }

  return Array.from(tags);
}

/** All framework families we can emit (for coverage dashboards). */
function frameworks() {
  return ['PCI-DSS', 'ISO-27001', 'CIS'];
}

module.exports = { tagsFor, frameworks };
