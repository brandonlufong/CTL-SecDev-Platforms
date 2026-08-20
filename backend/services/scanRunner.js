const Asset = require('../models/Asset');
const Device = require('../models/Device');
const ScanResult = require('../models/ScanResult');
const Vulnerability = require('../models/Vulnerability');
const { runNmapScan } = require('./scannerService');
const { criticalityFactor } = require('../utils/risk');
const { notifyNewFindings } = require('./notificationService');
const enrichmentQueue = require('./enrichmentQueue');
const { tagsFor } = require('../utils/compliance');

/**
 * Reusable "run a scan against one target and persist the results" routine.
 * Used by the scheduler (services/scanScheduler.js) and available for any
 * non-HTTP caller. Mirrors the persistence in controllers/scanController.js.
 *
 * @param {'asset'|'device'} targetType
 * @param {object} target  mongoose doc (must have _id, ip, criticality)
 * @param {object} opts    { scanType, onProgress }
 */
async function runAndPersist(targetType, target, opts = {}) {
  const scanType = opts.scanType || 'quick';
  const ref = targetType === 'asset' ? { asset: target._id } : { device: target._id };

  const scanResults = await runNmapScan(target.ip, {
    scanType,
    includeVulnScripts: true,
    onProgress: opts.onProgress,
  });

  const savedVulnIds = [];
  const createdVulnDocs = [];
  let newVulns = 0;

  for (const scanResult of scanResults) {
    const saved = await ScanResult.create({
      port: scanResult.port,
      protocol: scanResult.protocol,
      state: scanResult.state,
      service: scanResult.service,
      product: scanResult.product,
      version: scanResult.version,
      extraInfo: scanResult.extraInfo,
      cpe: scanResult.cpe,
      scanType,
      vulnerabilityScore: scanResult.vulnerabilityScore,
      confidence: scanResult.confidence,
      detectionMethods: scanResult.detectionMethods,
      scanEnhancement: scanResult.scanEnhancement,
      scannedAt: scanResult.scannedAt,
      ...ref,
      vulnerabilities: [],
    });

    const ids = [];
    for (const vd of (scanResult.detectionDetails || [])) {
      const query = { $and: [{ $or: [{ cve: vd.cve }, { title: vd.title }] }, ref] };
      let vuln = await Vulnerability.findOne(query);
      if (vuln) {
        vuln.severity = vd.severity || vuln.severity;
        vuln.cvssScore = vd.cvssScore || vuln.cvssScore;
        vuln.epssScore = vd.epssScore ?? vuln.epssScore;
        vuln.knownExploited = vd.knownExploited ?? vuln.knownExploited;
        vuln.riskScore = vd.riskScore || vuln.riskScore;
        vuln.scanResult = saved._id;
        vuln.discoveredDate = new Date();
        if (['Resolved', 'Closed'].includes(vuln.status)) vuln.status = 'Open';
        await vuln.save();
      } else {
        vuln = await Vulnerability.create({
          title: vd.title || `${vd.cve} - ${scanResult.service} vulnerability`,
          cve: vd.cve || null,
          severity: vd.severity || 'Medium',
          description: vd.description || 'Vulnerability detected during scheduled scan',
          cvssScore: vd.cvssScore || 0,
          epssScore: vd.epssScore ?? null,
          knownExploited: vd.knownExploited || false,
          riskScore: vd.riskScore || 0,
          remediation: vd.remediation || 'Review and apply security patches',
          exploitAvailable: vd.exploitAvailable || false,
          references: vd.references || [],
          discoveredDate: new Date(),
          status: 'Open',
          ...ref,
          scanResult: saved._id,
          cpeMatch: scanResult.cpe,
          affectedProducts: scanResult.product ? [scanResult.product] : [],
          complianceTags: tagsFor({ service: scanResult.service, port: scanResult.port, severity: vd.severity, knownExploited: vd.knownExploited, exploitAvailable: vd.exploitAvailable, title: vd.title }),
        });
        newVulns++;
        createdVulnDocs.push(vuln);
      }
      ids.push(vuln._id);
    }
    if (ids.length) { saved.vulnerabilities = ids; await saved.save(); savedVulnIds.push(...ids); }
  }

  // Apply criticality weighting once (non-compounding) + refresh software fingerprint.
  if (savedVulnIds.length) {
    const f = criticalityFactor(target.criticality);
    await Vulnerability.updateMany(
      { _id: { $in: savedVulnIds } },
      [{ $set: { riskScore: { $round: [{ $min: [10, { $multiply: [{ $ifNull: ['$riskScore', 0] }, f] }] }, 1] } } }]
    );
    enrichmentQueue.enqueue(savedVulnIds);
  }
  target.detectedSoftware = scanResults.filter(r => r.state === 'open').map(r => ({
    port: r.port, protocol: r.protocol, service: r.service,
    product: r.product, version: r.version, cpe: r.cpe, lastSeen: new Date(),
  }));
  target.lastScanDate = new Date();
  await target.save();

  // Fire ticketing/notification hooks for newly-created high-priority findings.
  if (createdVulnDocs.length) {
    notifyNewFindings(createdVulnDocs, opts.io).catch(() => {});
  }

  return {
    target: target.name,
    ip: target.ip,
    totalPorts: scanResults.length,
    openPorts: scanResults.filter(r => r.state === 'open').length,
    newVulnerabilities: newVulns,
  };
}

/** Resolve a scheduled-scan target spec into concrete target docs. */
async function resolveTargets(spec) {
  // spec: { type: 'asset'|'device'|'all-assets'|'all-devices'|'all', ids?: [] }
  if (spec.type === 'asset') return (await Asset.find({ _id: { $in: spec.ids || [] } })).map(t => ['asset', t]);
  if (spec.type === 'device') return (await Device.find({ _id: { $in: spec.ids || [] } })).map(t => ['device', t]);
  if (spec.type === 'all-assets') return (await Asset.find({ status: 'Online' })).map(t => ['asset', t]);
  if (spec.type === 'all-devices') return (await Device.find({ status: 'Online' })).map(t => ['device', t]);
  if (spec.type === 'all') {
    const a = (await Asset.find({ status: 'Online' })).map(t => ['asset', t]);
    const d = (await Device.find({ status: 'Online' })).map(t => ['device', t]);
    return [...a, ...d];
  }
  return [];
}

module.exports = { runAndPersist, resolveTargets };
