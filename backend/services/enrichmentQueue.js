const Vulnerability = require('../models/Vulnerability');
const Asset = require('../models/Asset');
const Device = require('../models/Device');
const vulnDb = require('./vulnerabilityDatabase');
const { criticalityFactor } = require('../utils/risk');
const sla = require('../utils/sla');

/**
 * Background CVE enrichment (Workstream B — "move enrichment off the scan's
 * critical path"). Scans persist findings immediately with whatever the fast
 * local path produced; this queue then refreshes each finding's EPSS/KEV (and
 * recomputes riskScore with asset criticality) asynchronously, so a scan never
 * blocks on external APIs. A periodic sweep also re-enriches open findings on a
 * schedule because EPSS scores and the CISA KEV catalog change over time.
 */
class EnrichmentQueue {
  constructor() {
    this.queue = [];
    this.inFlight = new Set();
    this.processing = false;
    this.concurrency = 3;
    this.enrichedAt = new Map(); // id -> ts (avoid re-enriching too often)
    this.minReenrichMs = 6 * 60 * 60 * 1000; // 6h
  }

  enqueue(ids = []) {
    for (const id of ids) {
      const key = String(id);
      if (!this.inFlight.has(key) && !this.queue.includes(key)) this.queue.push(key);
    }
    this._kick();
  }

  _kick() { if (!this.processing) this._run().catch(e => console.error('[enrich] run error:', e.message)); }

  async _run() {
    this.processing = true;
    while (this.queue.length) {
      const batch = this.queue.splice(0, this.concurrency);
      batch.forEach(id => this.inFlight.add(id));
      await Promise.all(batch.map(id => this._enrichOne(id)
        .catch(e => console.warn(`[enrich] ${id}:`, e.message))
        .finally(() => this.inFlight.delete(id))));
    }
    this.processing = false;
  }

  async _enrichOne(id) {
    const last = this.enrichedAt.get(id);
    if (last && Date.now() - last < this.minReenrichMs) return;

    const v = await Vulnerability.findById(id);
    if (!v) return;
    this.enrichedAt.set(id, Date.now());
    if (!v.cve) return;

    const context = { product: (v.affectedProducts && v.affectedProducts[0]) || '' };
    const [enriched] = await vulnDb.enrichCves([{ cve: v.cve, cvssScore: v.cvssScore }], context);
    if (!enriched) return;

    let crit = 'Medium';
    if (v.asset) { const a = await Asset.findById(v.asset).select('criticality'); if (a) crit = a.criticality; }
    else if (v.device) { const d = await Device.findById(v.device).select('criticality'); if (d) crit = d.criticality; }

    // Upgrade a generic / CVE-code title to the real NVD name.
    if (enriched.title && looksGeneric(v.title, v.cve)) v.title = enriched.title;
    if (enriched.description && isThinDescription(v.description)) v.description = enriched.description;
    if (enriched.references?.length && (!v.references || v.references.length <= 1)) v.references = enriched.references;

    v.epssScore = enriched.epssScore ?? v.epssScore;
    v.knownExploited = enriched.knownExploited ?? v.knownExploited;
    if (enriched.knownExploited) v.exploitAvailable = true;
    const base = enriched.riskScore ?? v.riskScore ?? 0;
    v.riskScore = Math.round(Math.min(10, base * criticalityFactor(crit)) * 10) / 10;
    await v.save();
  }

  /**
   * Periodic re-enrichment of open findings so EPSS/KEV stay current. Kept small
   * per tick to avoid hammering external APIs.
   */
  startPeriodicSweep(intervalMinutes = 720, batch = 100) {
    if (this._sweepTimer) return;
    const tick = async () => {
      try {
        const open = await Vulnerability.find({ status: { $nin: Array.from(sla.CLOSED_STATUSES) }, cve: { $ne: null } })
          .sort({ updatedAt: 1 }).limit(batch).select('_id');
        if (open.length) {
          console.log(`[enrich] periodic sweep: queueing ${open.length} finding(s)`);
          this.enqueue(open.map(v => v._id));
        }
      } catch (e) { console.warn('[enrich] sweep error:', e.message); }
    };
    this._sweepTimer = setInterval(tick, intervalMinutes * 60000);
    setTimeout(tick, 30000); // first sweep shortly after boot
    console.log(`[enrich] periodic sweep every ${intervalMinutes}m`);
  }

  stats() {
    return { queued: this.queue.length, inFlight: this.inFlight.size, processing: this.processing };
  }
}

// A title is "generic" when it's empty, contains the raw CVE id, or is one of
// our placeholder phrasings — i.e. not yet a real vulnerability name.
function looksGeneric(title, cve) {
  if (!title) return true;
  const t = String(title);
  if (cve && t.toUpperCase().includes(String(cve).toUpperCase())) return true;
  return /detected by scan|reported by nmap|Security Vulnerability \(|vulnerability$/i.test(t);
}
function isThinDescription(desc) {
  if (!desc) return true;
  return desc.length < 40 || /reported by nmap|detected during|Vulnerability detected/i.test(desc);
}

module.exports = new EnrichmentQueue();
