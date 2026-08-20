/**
 * Remediation SLA policy.
 *
 * Default time-to-remediate targets by severity (calendar days). Overridable via
 * env, e.g. SLA_CRITICAL_DAYS=5. These drive dueDate and SLA-breach reporting.
 */
const SLA_DAYS = {
  Critical: parseInt(process.env.SLA_CRITICAL_DAYS || '7', 10),
  High: parseInt(process.env.SLA_HIGH_DAYS || '15', 10),
  Medium: parseInt(process.env.SLA_MEDIUM_DAYS || '30', 10),
  Low: parseInt(process.env.SLA_LOW_DAYS || '90', 10),
  Informational: parseInt(process.env.SLA_INFO_DAYS || '180', 10),
};

// Statuses that mean the finding is no longer an open exposure.
const CLOSED_STATUSES = new Set([
  'Resolved', 'Remediated', 'Mitigated', 'Closed', 'False Positive',
  'Not Applicable', 'Duplicate', 'Wont Fix',
]);

// Statuses that represent completed remediation (used for MTTR).
const REMEDIATED_STATUSES = new Set(['Resolved', 'Remediated', 'Mitigated', 'Closed']);

// Actively-exploited criticals/highs get an accelerated SLA (industry practice:
// "critical + exploitable within 48 hours"). Overridable via SLA_EXPLOITED_HOURS.
const EXPLOITED_HOURS = parseInt(process.env.SLA_EXPLOITED_HOURS || '48', 10);

function slaDays(severity) {
  return SLA_DAYS[severity] != null ? SLA_DAYS[severity] : SLA_DAYS.Medium;
}

/**
 * @param {string} severity
 * @param {Date}   from
 * @param {object} [opts]  { exploited: boolean } — KEV or known exploit available
 */
function dueDateFor(severity, from = new Date(), opts = {}) {
  const d = new Date(from);
  if (opts.exploited && (severity === 'Critical' || severity === 'High')) {
    d.setHours(d.getHours() + EXPLOITED_HOURS);
    return d;
  }
  d.setDate(d.getDate() + slaDays(severity));
  return d;
}

function isClosed(status) { return CLOSED_STATUSES.has(status); }
function isRemediated(status) { return REMEDIATED_STATUSES.has(status); }

/** Milliseconds -> whole days. */
function daysBetween(a, b) {
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
}

module.exports = { SLA_DAYS, slaDays, dueDateFor, isClosed, isRemediated, daysBetween, CLOSED_STATUSES, REMEDIATED_STATUSES };
