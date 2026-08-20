const axios = require('axios');

/**
 * Outbound notification / ticketing hooks (Workstream D).
 *
 * Fires a webhook (TICKET_WEBHOOK_URL) when high-priority findings appear — the
 * generic JSON payload works with Slack/Teams/Jira-automation/n8n/webhook
 * receivers. Optionally emits a Socket.IO event for the in-app notification
 * center. All sends are best-effort and never throw into the scan path.
 */

const WEBHOOK_URL = process.env.TICKET_WEBHOOK_URL || '';

function isHighPriority(v) {
  return v.severity === 'Critical' || v.severity === 'High' || v.knownExploited || (v.riskScore || 0) >= 7;
}

async function notifyNewFindings(vulns, io) {
  const important = (vulns || []).filter(isHighPriority);
  if (important.length === 0) return;

  const payload = {
    type: 'new_findings',
    count: important.length,
    generatedAt: new Date().toISOString(),
    findings: important.slice(0, 25).map(v => ({
      title: v.title,
      cve: v.cve,
      severity: v.severity,
      riskScore: v.riskScore,
      knownExploited: v.knownExploited,
      asset: v.asset ? String(v.asset) : undefined,
      device: v.device ? String(v.device) : undefined,
    })),
  };

  // In-app notification
  try { if (io) io.emit('newFindings', payload); } catch (_) { /* ignore */ }

  // External webhook
  if (WEBHOOK_URL) {
    try {
      await axios.post(WEBHOOK_URL, payload, { timeout: 8000 });
      console.log(`[notify] webhook sent for ${important.length} finding(s)`);
    } catch (err) {
      console.warn('[notify] webhook failed:', err.message);
    }
  }
}

module.exports = { notifyNewFindings, isHighPriority };
