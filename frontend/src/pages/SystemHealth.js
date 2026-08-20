import React, { useEffect, useState, useCallback } from 'react';
import {
  FaHeartbeat, FaSyncAlt, FaCheckCircle, FaTimesCircle, FaDownload, FaDatabase,
  FaMicrochip, FaClock, FaBrain,
} from 'react-icons/fa';
import { getSystemHealth, downloadBackup } from '../api/platformApi';
import { useT } from '../context/LanguageContext';
import '../styles/theme.css';

const Item = ({ ok, warnOnly, label, sub }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    {ok ? <FaCheckCircle color="#067647" size={18} /> : <FaTimesCircle color={warnOnly ? '#b54708' : '#d92d20'} size={18} />}
    <div>
      <div style={{ fontWeight: 600, color: 'var(--vm-text)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--vm-text-muted)' }}>{sub}</div>
    </div>
  </div>
);

export default function SystemHealth() {
  const t = useT();
  const [h, setH] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setH(await getSystemHealth()); }
    catch (err) { setError(err?.response?.data?.message || err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // live refresh
    return () => clearInterval(t);
  }, [load]);

  if (loading && !h) return <div className="vm-page" style={{ padding: 40 }}><p style={{ color: 'var(--vm-text-muted)' }}>Loading system health…</p></div>;
  if (error) return <div className="vm-page" style={{ padding: 40 }}><div className="vm-card" style={{ borderColor: 'var(--vm-high)', color: 'var(--vm-high)' }}>{error} <button className="vm-badge ghost" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={load}>Retry</button></div></div>;

  const s = h?.scanner || {};
  const uptime = h?.uptimeSeconds || 0;
  const upStr = uptime > 3600 ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m` : `${Math.floor(uptime / 60)}m`;

  return (
    <div className="vm-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="vm-page-title"><FaHeartbeat /> {t('System Health')}</h1>
          <p className="vm-section-sub" style={{ margin: 0 }}>Live status of the scanner, database, scheduler and enrichment</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="vm-badge ghost" style={{ cursor: 'pointer' }} onClick={load}><FaSyncAlt /> Refresh</button>
          <button className="vm-badge" style={{ cursor: 'pointer', background: 'var(--vm-primary)', color: '#fff' }} onClick={() => downloadBackup()}><FaDownload /> Backup</button>
        </div>
      </div>

      <div className="vm-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: h?.status === 'ok' ? '#067647' : '#d92d20' }}>{h?.status === 'ok' ? 'OK' : 'ERR'}</div><div className="vm-kpi-l">Overall status</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n">{upStr}</div><div className="vm-kpi-l"><FaClock /> Uptime</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n">{h?.process?.memoryMB ?? '—'}</div><div className="vm-kpi-l"><FaMicrochip /> Memory (MB)</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n">{h?.scheduler?.enabled ?? 0}</div><div className="vm-kpi-l">Active schedules</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n">{h?.enrichment?.queued ?? 0}</div><div className="vm-kpi-l"><FaBrain /> Enrich queue</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="vm-card">
          <div className="vm-section-title">Core services</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            <Item ok={h?.database?.state === 'connected'} label={<><FaDatabase /> Database</>} sub={h?.database?.state} />
            <Item ok={h?.status === 'ok'} label="API" sub="responding" />
            <Item ok warnOnly={!h?.scheduler?.enabled} label="Scheduler" sub={`${h?.scheduler?.enabled ?? 0} active, ${h?.scheduler?.totalSchedules ?? 0} total`} />
            <Item ok={!h?.enrichment?.processing || h?.enrichment?.queued < 500} warnOnly label="Enrichment" sub={`${h?.enrichment?.queued ?? 0} queued, ${h?.enrichment?.inFlight ?? 0} in-flight`} />
          </div>
        </div>

        <div className="vm-card">
          <div className="vm-section-title">Scanner capabilities</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            <Item ok={s.nmapAvailable} label={`nmap ${s.nmapVersion || ''}`} sub={s.nmapAvailable ? s.nmapPath : 'not found — install nmap or set NMAP_PATH'} />
            <Item ok={s.privileged} warnOnly label="Raw sockets (SYN/UDP/OS)" sub={s.privileged ? s.privilegeMethod : 'connect-scan only — grant cap_net_raw for full scans'} />
            <Item ok={s.scripts?.vulners} warnOnly label="vulners NSE" sub={s.scripts?.vulners ? 'installed' : 'using built-in vuln fallback'} />
          </div>
          {s.warnings?.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--vm-surface-2)', fontSize: 13, color: 'var(--vm-medium)' }}>
              {s.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="vm-card">
        <div className="vm-section-title">Upcoming scheduled scans</div>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="vm-table">
            <thead><tr><th>Name</th><th>Next run</th><th>Last status</th></tr></thead>
            <tbody>
              {(h?.scheduler?.upcoming || []).map((u) => (
                <tr key={u._id}><td>{u.name}</td><td style={{ color: 'var(--vm-text-muted)' }}>{u.nextRun ? new Date(u.nextRun).toLocaleString() : '—'}</td><td>{u.lastStatus}</td></tr>
              ))}
              {(!h?.scheduler?.upcoming || h.scheduler.upcoming.length === 0) && <tr><td colSpan={3} style={{ color: 'var(--vm-text-muted)' }}>No schedules configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
