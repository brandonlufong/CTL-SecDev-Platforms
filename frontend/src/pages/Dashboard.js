import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
} from 'chart.js';
import {
  FaServer, FaNetworkWired, FaExclamationTriangle, FaBug, FaFireAlt, FaClock,
  FaSync, FaCheckCircle, FaTimesCircle, FaShieldAlt,
} from 'react-icons/fa';
import { getOverview, getSystemHealth } from '../api/platformApi';
import { useT } from '../context/LanguageContext';
import '../styles/theme.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale);

const SEV_COLORS = { Critical: '#b42318', High: '#d92d20', Medium: '#b54708', Low: '#475467' };
const riskColor = (v) => (v >= 9 ? '#b42318' : v >= 7 ? '#d92d20' : v >= 4 ? '#b54708' : '#475467');

const Tile = ({ n, label, accent, icon, onClick }) => (
  <div className="vm-kpi" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
    <div className="vm-kpi-accent" style={{ background: accent || 'var(--vm-primary)' }} />
    <div className="vm-kpi-n" style={{ color: accent }}>{n}</div>
    <div className="vm-kpi-l">{icon} {label}</div>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const t = useT();
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [o, h] = await Promise.all([getOverview(), getSystemHealth().catch(() => null)]);
      setOverview(o); setHealth(h);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !overview) return <div className="vm-page" style={{ padding: 40 }}><p style={{ color: 'var(--vm-text-muted)' }}>Loading dashboard…</p></div>;
  if (error) return <div className="vm-page" style={{ padding: 40 }}><div className="vm-card" style={{ borderColor: 'var(--vm-high)', color: 'var(--vm-high)' }}>{error} <button className="vm-badge ghost" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={load}>Retry</button></div></div>;

  const sev = overview?.severity || {};
  const scanner = health?.scanner;
  const doughnut = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{ data: [sev.Critical || 0, sev.High || 0, sev.Medium || 0, sev.Low || 0], backgroundColor: Object.values(SEV_COLORS), borderWidth: 0 }],
  };

  return (
    <div className="vm-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="vm-page-title"><FaShieldAlt /> {t('Security Overview')}</h1>
          <p className="vm-section-sub" style={{ margin: 0 }}>Estate-wide risk posture at a glance</p>
        </div>
        <button className="vm-badge ghost" style={{ cursor: 'pointer' }} onClick={load}><FaSync /> Refresh</button>
      </div>

      <div className="vm-kpi-grid" style={{ marginBottom: 20 }}>
        <Tile n={overview?.totals?.assets ?? 0} label={<><FaServer /> Assets</>} accent="var(--vm-primary)" onClick={() => navigate('/servers')} />
        <Tile n={overview?.totals?.devices ?? 0} label={<><FaNetworkWired /> Devices</>} accent="var(--vm-primary)" onClick={() => navigate('/devices')} />
        <Tile n={overview?.totals?.open ?? 0} label={<><FaBug /> Open findings</>} accent="#475467" onClick={() => navigate('/vulnerabilities')} />
        <Tile n={sev.Critical || 0} label={<><FaExclamationTriangle /> Critical</>} accent={SEV_COLORS.Critical} onClick={() => navigate('/vulnerabilities?severity=Critical')} />
        <Tile n={overview?.exploitability?.kevOpen ?? 0} label={<><FaFireAlt /> Known-exploited</>} accent="#7a2e0e" onClick={() => navigate('/vulnerabilities')} />
        <Tile n={overview?.exploitability?.slaBreached ?? 0} label={<><FaClock /> SLA breached</>} accent={SEV_COLORS.Medium} onClick={() => navigate('/vulnerabilities')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: 16 }}>
        <div className="vm-card">
          <div className="vm-section-title">Severity mix</div>
          <div className="vm-section-sub">Open findings</div>
          <div style={{ height: 220 }}><Doughnut data={doughnut} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8891a5' } } } }} /></div>
        </div>
        <div className="vm-card">
          <div className="vm-section-title">Top risky assets</div>
          <div className="vm-section-sub">Highest blended risk (CVSS × EPSS × KEV × criticality)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="vm-table">
              <thead><tr><th>Asset</th><th>IP</th><th>Crit.</th><th>Findings</th><th>KEV</th><th>Risk</th></tr></thead>
              <tbody>
                {(overview?.topRiskyAssets || []).slice(0, 6).map(a => (
                  <tr key={a._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/vulnerabilities')}>
                    <td>{a.name}</td><td style={{ color: 'var(--vm-text-muted)' }}>{a.ip}</td>
                    <td><span className="vm-badge ghost">{a.criticality}</span></td>
                    <td>{a.findings}</td><td>{a.kev > 0 ? <span className="vm-badge kev">{a.kev}</span> : '—'}</td>
                    <td><strong style={{ color: riskColor(a.maxRisk || 0) }}>{a.maxRisk ?? '—'}</strong></td>
                  </tr>
                ))}
                {(!overview?.topRiskyAssets || overview.topRiskyAssets.length === 0) && <tr><td colSpan={6} style={{ color: 'var(--vm-text-muted)' }}>No findings yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Scanner / system health */}
      <div className="vm-card">
        <div className="vm-section-title">Scanner & system health</div>
        <div className="vm-section-sub">Live capability probe from the backend</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
          <HealthItem ok={scanner?.nmapAvailable} label={scanner ? `nmap ${scanner.nmapVersion || ''}` : 'nmap'} sub={scanner?.nmapAvailable ? 'available' : 'not found'} />
          <HealthItem ok={scanner?.privileged} label="Raw sockets" sub={scanner?.privileged ? scanner.privilegeMethod : 'connect-scan only'} warnOnly />
          <HealthItem ok={health?.database?.state === 'connected'} label="Database" sub={health?.database?.state || '—'} />
          <HealthItem ok={(health?.scheduler?.enabled ?? 0) >= 0} label="Scheduler" sub={`${health?.scheduler?.enabled ?? 0} active`} warnOnly />
          <HealthItem ok={scanner?.scripts?.vulners} label="vulners NSE" sub={scanner?.scripts?.vulners ? 'installed' : 'fallback'} warnOnly />
        </div>
        {scanner?.warnings?.length > 0 && (
          <div style={{ marginTop: 12, color: 'var(--vm-medium)', fontSize: 13 }}>
            {scanner.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

const HealthItem = ({ ok, label, sub, warnOnly }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {ok ? <FaCheckCircle color="#067647" /> : <FaTimesCircle color={warnOnly ? '#b54708' : '#d92d20'} />}
    <div>
      <div style={{ fontWeight: 600, color: 'var(--vm-text)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--vm-text-muted)' }}>{sub}</div>
    </div>
  </div>
);
