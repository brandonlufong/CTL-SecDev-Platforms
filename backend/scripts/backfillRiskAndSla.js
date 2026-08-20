/*
 * One-time backfill for findings created before Workstreams B/D.
 *   - sets riskScore from cvssScore (x asset criticality) where missing
 *   - stamps firstDetected + dueDate via the model's pre-save hook
 * Idempotent; safe to run multiple times.
 *
 * Usage:  node scripts/backfillRiskAndSla.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Vulnerability = require('../models/Vulnerability');
const Asset = require('../models/Asset');
const Device = require('../models/Device');
const { finalRiskScore } = require('../utils/risk');
const { tagsFor } = require('../utils/compliance');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Backfilling…');

  const vulns = await Vulnerability.find();
  let updated = 0;

  for (const v of vulns) {
    let criticality = 'Medium';
    if (v.asset) { const a = await Asset.findById(v.asset).select('criticality'); if (a) criticality = a.criticality; }
    else if (v.device) { const d = await Device.findById(v.device).select('criticality'); if (d) criticality = d.criticality; }

    // Base risk from CVSS when riskScore is unset.
    if (!v.riskScore || v.riskScore === 0) {
      const base = typeof v.cvssScore === 'number' ? v.cvssScore : 0;
      v.riskScore = finalRiskScore(base, criticality);
    }
    // Compliance tags (derive from what the finding stores).
    if (!v.complianceTags || v.complianceTags.length === 0) {
      v.complianceTags = tagsFor({
        severity: v.severity, title: v.title,
        knownExploited: v.knownExploited, exploitAvailable: v.exploitAvailable,
      });
    }
    // Saving triggers the pre-save hook -> firstDetected + dueDate get set.
    await v.save();
    updated++;
  }

  console.log(`Backfilled ${updated} vulnerabilities.`);
  await mongoose.connection.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
