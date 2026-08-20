/**
 * Shared risk helpers.
 *
 * The vulnerability database computes a base riskScore from CVSS x EPSS x KEV
 * (see services/vulnerabilityDatabase.js#computeRiskScore). Asset criticality is
 * layered on here because only the caller that persists a finding knows which
 * asset it belongs to.
 */

const CRITICALITY_FACTOR = {
  Critical: 1.3,
  High: 1.15,
  Medium: 1.0,
  Low: 0.85,
  Informational: 0.7
};

function criticalityFactor(level) {
  return CRITICALITY_FACTOR[level] != null ? CRITICALITY_FACTOR[level] : 1.0;
}

/**
 * Blend a finding's base risk with the criticality of the asset it affects.
 * Result stays within 0..10.
 */
function finalRiskScore(baseRisk, assetCriticality) {
  const base = typeof baseRisk === 'number' ? baseRisk : 0;
  return Math.round(Math.min(10, base * criticalityFactor(assetCriticality)) * 10) / 10;
}

/** Coarse risk band for UI grouping. */
function riskLevel(score) {
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  if (score > 0) return 'Low';
  return 'Informational';
}

module.exports = { criticalityFactor, finalRiskScore, riskLevel, CRITICALITY_FACTOR };
