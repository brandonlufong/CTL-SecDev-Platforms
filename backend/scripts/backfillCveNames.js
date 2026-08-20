/*
 * Backfill human-readable NAMES for findings that currently show the CVE id as
 * their title. Looks up each CVE's NVD description + CWE and rewrites title /
 * description / references. Idempotent; throttled to respect NVD rate limits.
 *
 * Usage:  node scripts/backfillCveNames.js
 * (An NVD_API_KEY in .env greatly raises the rate limit.)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Vulnerability = require('../models/Vulnerability');
const vulnDb = require('../services/vulnerabilityDatabase');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const looksGeneric = (title, cve) => {
  if (!title) return true;
  const t = String(title);
  if (cve && t.toUpperCase().includes(String(cve).toUpperCase())) return true;
  return /detected by scan|reported by nmap|Security Vulnerability \(|vulnerability$/i.test(t);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const delay = process.env.NVD_API_KEY ? 700 : 6500; // NVD: 50/30s with key, 5/30s without
  console.log(`Connected. Backfilling CVE names (delay ${delay}ms/request)…`);

  const vulns = await Vulnerability.find({ cve: { $ne: null } });
  let updated = 0, skipped = 0, unknown = 0;

  for (const v of vulns) {
    if (!looksGeneric(v.title, v.cve)) { skipped++; continue; }
    try {
      const info = await vulnDb.describeCve(v.cve, { product: (v.affectedProducts || [])[0] || '' });
      if (info && info.title) {
        v.title = info.title;
        if (info.description) v.description = info.description;
        if (info.references?.length) v.references = info.references;
        if (info.cvssScore != null && !v.cvssScore) v.cvssScore = info.cvssScore;
        await v.save();
        updated++;
        process.stdout.write(`  ${v.cve} -> ${v.title.slice(0, 60)}\n`);
      } else {
        unknown++; // NVD doesn't know this CVE (e.g. reserved/fake id) — leave as is
      }
    } catch (e) {
      console.warn(`  ${v.cve}: ${e.message}`);
    }
    await sleep(delay);
  }

  console.log(`\nDone. ${updated} renamed, ${skipped} already named, ${unknown} unknown to NVD.`);
  await mongoose.connection.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
