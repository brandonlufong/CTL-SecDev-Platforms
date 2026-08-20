import React, { useState, useEffect, useCallback } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import {
  FaShieldVirus, FaExclamationTriangle, FaBug, FaClock, FaFileDownload,
  FaFileCsv, FaSyncAlt, FaFireAlt, FaChartBar,
} from 'react-icons/fa';
import {
  getOverview, getTrends, getExposure, openReport, exportVulnerabilitiesCsv,
} from '../api/platformApi';
import { useT } from '../context/LanguageContext';
import '../styles/theme.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const SEV_COLORS = { Critical: '#b42318', High: '#d92d20', Medium: '#b54708', Low: '#475467' };

function riskColor(score) {
  if (score >= 9) return '#b42318';
  if (score >= 7) return '#d92d20';
  if (score >= 4) return '#b54708';
  return '#475467';
}

const Kpi = ({ n, label, accent, icon }) => (
  <div className="vm-kpi">
    <div className="vm-kpi-accent" style={{ background: accent || 'var(--vm-primary)' }} />
    <div className="vm-kpi-n" style={{ color: accent }}>{n}</div>
    <div className="vm-kpi-l">{icon} {label}</div>
  </div>
);

const SEVS = ['Critical', 'High', 'Medium', 'Low'];
const CRITS = ['Critical', 'High', 'Medium', 'Low', 'Informational'];

function Heatmap({ matrix }) {
  const lookup = {};
  let max = 0;
  matrix.forEach((m) => {
    const key = `${m._id.severity}|${m._id.criticality}`;
    lookup[key] = m.count;
    if (m.count > max) max = m.count;
  });
  const cellBg = (count) => {
    if (!count) return 'var(--vm-surface-2)';
    const t = Math.min(1, 0.15 + (count / (max || 1)) * 0.85);
    return `rgba(180, 35, 24, ${t})`; // scale toward critical-red by density
  };
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table className="vm-table" style={{ tableLayout: 'fixed', minWidth: 520 }}>
        <thead>
          <tr>
            <th style={{ width: 130 }}>Asset criticality ↓ / Severity →</th>
            {SEVS.map((s) => <th key={s} style={{ textAlign: 'center' }}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {CRITS.map((c) => (
            <tr key={c}>
              <td style={{ fontWeight: 600 }}>{c}</td>
              {SEVS.map((s) => {
                const n = lookup[`${s}|${c}`] || 0;
                return (
                  <td key={s} style={{ textAlign: 'center', background: cellBg(n), color: n && (n / (max || 1)) > 0.5 ? '#fff' : 'var(--vm-text)', fontWeight: n ? 700 : 400, borderRadius: 6 }}>
                    {n || '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const t = useT();
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [exposure, setExposure] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [o, t, e] = await Promise.all([getOverview(), getTrends(days), getExposure()]);
      setOverview(o); setTrends(t); setExposure(e);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading && !overview) {
    return <div className="vm-page" style={{ padding: 40 }}><p style={{ color: 'var(--vm-text-muted)' }}>Loading analytics…</p></div>;
  }
  if (error) {
    return (
      <div className="vm-page" style={{ padding: 40 }}>
        <div className="vm-card" style={{ borderColor: 'var(--vm-high)' }}>
          <strong style={{ color: 'var(--vm-high)' }}>Could not load analytics.</strong>
          <div style={{ color: 'var(--vm-text-muted)', marginTop: 6 }}>{error}</div>
          <button className="vm-badge ghost" style={{ marginTop: 12, cursor: 'pointer' }} onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  const sev = overview?.severity || {};
  const trendSeries = trends?.series || [];

  const doughnut = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [sev.Critical || 0, sev.High || 0, sev.Medium || 0, sev.Low || 0],
      backgroundColor: [SEV_COLORS.Critical, SEV_COLORS.High, SEV_COLORS.Medium, SEV_COLORS.Low],
      borderWidth: 0,
    }],
  };

  const lineData = {
    labels: trendSeries.map(p => p.date.slice(5)),
    datasets: [
      { label: 'Discovered', data: trendSeries.map(p => p.discovered), borderColor: '#d92d20', backgroundColor: 'rgba(217,45,32,.12)', fill: true, tension: .3 },
      { label: 'Remediated', data: trendSeries.map(p => p.remediated), borderColor: '#067647', backgroundColor: 'rgba(6,118,71,.12)', fill: true, tension: .3 },
    ],
  };

  const envData = {
    labels: (exposure?.byEnvironment || []).map(e => e._id || 'Unknown'),
    datasets: [
      { label: 'Findings', data: (exposure?.byEnvironment || []).map(e => e.findings), backgroundColor: '#2f6bff' },
      { label: 'Known-exploited', data: (exposure?.byEnvironment || []).map(e => e.kev), backgroundColor: '#7a2e0e' },
    ],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8891a5' } } },
    scales: { x: { ticks: { color: '#8891a5' } }, y: { ticks: { color: '#8891a5' }, beginAtZero: true } },
  };

  return (
    <div className="vm-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 className="vm-page-title"><FaChartBar /> {t('Security Analytics')}</h1>
          <p className="vm-section-sub" style={{ margin: 0 }}>Risk posture, remediation trends and exposure across your estate</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="vm-badge ghost" style={{ cursor: 'pointer' }} onClick={load} title="Refresh"><FaSyncAlt /> Refresh</button>
          <button className="vm-badge ghost" style={{ cursor: 'pointer' }} onClick={() => { setBusy(true); exportVulnerabilitiesCsv().finally(() => setBusy(false)); }} disabled={busy}><FaFileCsv /> Export CSV</button>
          <button className="vm-badge" style={{ cursor: 'pointer', background: 'var(--vm-primary)', color: '#fff' }} onClick={openReport}><FaFileDownload /> Report</button>
        </div>
      </div>

      <div className="vm-kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi n={overview?.totals?.open ?? 0} label={<><FaBug /> Open findings</>} accent="var(--vm-primary)" />
        <Kpi n={sev.Critical || 0} label={<><FaExclamationTriangle /> Critical</>} accent={SEV_COLORS.Critical} />
        <Kpi n={sev.High || 0} label={<><FaShieldVirus /> High</>} accent={SEV_COLORS.High} />
        <Kpi n={overview?.exploitability?.kevOpen ?? 0} label={<><FaFireAlt /> Known-exploited</>} accent="var(--vm-kev)" />
        <Kpi n={overview?.exploitability?.slaBreached ?? 0} label={<><FaClock /> SLA breached</>} accent={SEV_COLORS.Medium} />
        <Kpi n={overview?.meanTimeToRemediateDays ?? '—'} label="Mean time to remediate (d)" accent="var(--vm-success)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="vm-card">
          <div className="vm-section-title">Discovered vs Remediated</div>
          <div className="vm-section-sub">
            Last{' '}
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ background: 'var(--vm-surface-2)', color: 'var(--vm-text)', border: '1px solid var(--vm-border)', borderRadius: 6, padding: '2px 6px' }}>
              <option value={7}>7</option><option value={30}>30</option><option value={90}>90</option>
            </select>{' '}days
          </div>
          <div style={{ height: 260 }}><Line data={lineData} options={chartOpts} /></div>
        </div>
        <div className="vm-card">
          <div className="vm-section-title">Severity mix</div>
          <div className="vm-section-sub">Open findings by severity</div>
          <div style={{ height: 260 }}><Doughnut data={doughnut} options={{ ...chartOpts, scales: {} }} /></div>
        </div>
      </div>

      {/* Severity x asset-criticality heatmap */}
      <div className="vm-card" style={{ marginBottom: 16 }}>
        <div className="vm-section-title">Exposure heatmap</div>
        <div className="vm-section-sub">Open findings by severity × asset criticality — focus top-left first</div>
        <Heatmap matrix={exposure?.matrix || []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <div className="vm-card">
          <div className="vm-section-title">Exposure by environment</div>
          <div className="vm-section-sub">Findings and known-exploited counts</div>
          <div style={{ height: 260 }}><Bar data={envData} options={chartOpts} /></div>
        </div>
        <div className="vm-card">
          <div className="vm-section-title">Top risky assets</div>
          <div className="vm-section-sub">Highest blended risk (CVSS × EPSS × KEV × criticality)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="vm-table">
              <thead><tr><th>Asset</th><th>IP</th><th>Crit.</th><th>Findings</th><th>KEV</th><th>Max risk</th></tr></thead>
              <tbody>
                {(overview?.topRiskyAssets || []).map(a => (
                  <tr key={a._id}>
                    <td>{a.name}</td>
                    <td style={{ color: 'var(--vm-text-muted)' }}>{a.ip}</td>
                    <td><span className="vm-badge ghost">{a.criticality}</span></td>
                    <td>{a.findings}</td>
                    <td>{a.kev > 0 ? <span className="vm-badge kev">{a.kev}</span> : '—'}</td>
                    <td>
                      <span className="vm-risk">
                        <span className="vm-risk-bar"><span className="vm-risk-fill" style={{ width: `${(a.maxRisk / 10) * 100}%`, background: riskColor(a.maxRisk) }} /></span>
                        <strong style={{ color: riskColor(a.maxRisk) }}>{a.maxRisk}</strong>
                      </span>
                    </td>
                  </tr>
                ))}
                {(!overview?.topRiskyAssets || overview.topRiskyAssets.length === 0) && (
                  <tr><td colSpan={6} style={{ color: 'var(--vm-text-muted)' }}>No open findings yet — run a scan to populate analytics.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
