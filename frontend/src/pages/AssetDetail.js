import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Tab, Button } from 'react-bootstrap';
import {
  FaServer, FaArrowLeft, FaBug, FaFireAlt, FaShieldAlt, FaHistory, FaSyncAlt,
  FaExternalLinkAlt, FaMicrochip,
} from 'react-icons/fa';
import {
  getAssetById, getVulnerabilities, tlsCheckTarget, getScanHistory, getScanDelta,
} from '../api/platformApi';
import '../styles/theme.css';

const sevClass = (s) => ({ Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' }[s] || 'info');
const riskColor = (v) => (v >= 9 ? '#b42318' : v >= 7 ? '#d92d20' : v >= 4 ? '#b54708' : '#475467');

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [vulns, setVulns] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tls, setTls] = useState(null);
  const [tlsLoading, setTlsLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [delta, setDelta] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([getAssetById(id), getVulnerabilities()]);
      setData(d);
      setVulns((Array.isArray(v) ? v : []).filter(x => (x.asset?._id || x.asset) === id));
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const runTls = async () => { setTlsLoading(true); try { setTls(await tlsCheckTarget(id)); } catch (e) { setTls({ error: e.message }); } finally { setTlsLoading(false); } };
  const loadHistory = useCallback(async () => {
    try {
      const [h, dl] = await Promise.all([getScanHistory('asset', id), getScanDelta('asset', id)]);
      setHistory(h); setDelta(dl);
    } catch (e) { /* ignore */ }
  }, [id]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const openFindings = useMemo(() => vulns.filter(v => !['Resolved', 'Closed', 'Remediated', 'Mitigated', 'False Positive', 'Not Applicable', 'Duplicate', 'Wont Fix'].includes(v.status)).sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)), [vulns]);

  if (loading && !data) return <div className="vm-page" style={{ padding: 24 }}><p style={{ color: 'var(--vm-text-muted)' }}>Loading asset…</p></div>;
  if (error) return <div className="vm-page" style={{ padding: 24 }}><div className="vm-card" style={{ borderColor: 'var(--vm-high)', color: 'var(--vm-high)' }}>{error} <button className="vm-badge ghost" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={load}>Retry</button></div></div>;

  const a = data.asset;
  const s = data.summary;

  return (
    <div className="vm-page" style={{ padding: 24 }}>
      <button className="vm-badge ghost" style={{ cursor: 'pointer', marginBottom: 12 }} onClick={() => navigate(-1)}><FaArrowLeft /> Back</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="vm-page-title"><FaServer /> {a.name}</h1>
          <p className="vm-section-sub" style={{ margin: 0 }}>
            <code>{a.ip}</code> · {a.type} · <span className="vm-badge ghost">{a.criticality}</span> <span className="vm-badge ghost">{a.environment}</span>
            {a.status && <span className={`vm-badge ${a.status === 'Online' ? 'low' : 'ghost'}`} style={{ marginLeft: 6 }}>{a.status}</span>}
          </p>
        </div>
        <button className="vm-badge ghost" style={{ cursor: 'pointer' }} onClick={load}><FaSyncAlt /> Refresh</button>
      </div>

      {/* KPI strip */}
      <div className="vm-kpi-grid" style={{ marginBottom: 16 }}>
        <div className="vm-kpi"><div className="vm-kpi-n">{s.openFindings}</div><div className="vm-kpi-l"><FaBug /> Open findings</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: '#b42318' }}>{s.severity.Critical}</div><div className="vm-kpi-l">Critical</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: '#d92d20' }}>{s.severity.High}</div><div className="vm-kpi-l">High</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: riskColor(s.maxRisk) }}>{s.maxRisk || '—'}</div><div className="vm-kpi-l">Max risk</div></div>
      </div>

      <div className="vm-card" style={{ padding: 16 }}>
        <Tabs activeKey={tab} onSelect={k => setTab(k)} className="mb-3">
          <Tab eventKey="overview" title="Overview">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Field label="Operating system">{a.os || '—'}</Field>
              <Field label="Owner / dept">{a.businessOwner || a.owner || a.hostDepartment || '—'}</Field>
              <Field label="Tags">{(a.tags || []).length ? a.tags.map(t => <span key={t} className="vm-badge ghost" style={{ marginRight: 4 }}>{t}</span>) : '—'}</Field>
              <Field label="Exposure">{a.exposure || '—'}</Field>
              <Field label="Last scan">{a.lastScanDate ? new Date(a.lastScanDate).toLocaleString() : 'Never'}</Field>
              <Field label="Manufacturer / model">{[a.manufacturer, a.model].filter(Boolean).join(' ') || '—'}</Field>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={mLabel}><FaMicrochip /> Detected software ({(a.detectedSoftware || []).length})</div>
              {(a.detectedSoftware || []).length === 0 ? <div style={{ color: 'var(--vm-text-muted)' }}>No software fingerprint yet — run a scan.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="vm-table"><thead><tr><th>Port</th><th>Service</th><th>Product</th><th>Version</th><th>CPE</th></tr></thead>
                    <tbody>{a.detectedSoftware.map((sw, i) => (
                      <tr key={i}><td>{sw.port}/{sw.protocol}</td><td>{sw.service}</td><td>{sw.product || '—'}</td><td>{sw.version || '—'}</td><td style={{ color: 'var(--vm-text-muted)', fontSize: 12 }}>{sw.cpe || '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </Tab>

          <Tab eventKey="findings" title={`Findings (${openFindings.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table className="vm-table"><thead><tr><th>Finding</th><th>Severity</th><th>Risk</th><th>EPSS</th><th>Status</th></tr></thead>
                <tbody>
                  {openFindings.map(v => (
                    <tr key={v._id}>
                      <td>{v.title} {v.knownExploited && <span className="vm-badge kev"><FaFireAlt /> KEV</span>}<div style={{ fontSize: 12, color: 'var(--vm-text-muted)' }}>{v.cve}</div></td>
                      <td><span className={`vm-badge ${sevClass(v.severity)}`}>{v.severity}</span></td>
                      <td><strong style={{ color: riskColor(v.riskScore || 0) }}>{v.riskScore ?? '—'}</strong></td>
                      <td>{v.epssScore != null ? `${Math.round(v.epssScore * 100)}%` : '—'}</td>
                      <td>{v.status}</td>
                    </tr>
                  ))}
                  {openFindings.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--vm-text-muted)', padding: 16 }}>No open findings. 🎉</td></tr>}
                </tbody>
              </table>
            </div>
            <button className="vm-badge ghost" style={{ cursor: 'pointer', marginTop: 10 }} onClick={() => navigate('/vulnerabilities')}>Open in Vulnerabilities <FaExternalLinkAlt size={11} /></button>
          </Tab>

          <Tab eventKey="posture" title="Security posture">
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={mLabel}><FaShieldAlt /> TLS / HTTP header check</div>
                <Button size="sm" onClick={runTls} disabled={tlsLoading}>{tlsLoading ? 'Checking…' : 'Run check'}</Button>
              </div>
              {tls?.error && <div style={{ color: 'var(--vm-high)' }}>{tls.error}</div>}
              {tls && !tls.error && (
                <>
                  {tls.tls && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={mLabel}>Certificate (443)</div>
                      {tls.tls.ok ? <div>Issuer <strong>{tls.tls.issuer || '—'}</strong> · expires <strong>{tls.tls.validTo || '—'}</strong> ({tls.tls.daysToExpiry} days) · {tls.tls.protocol}</div> : <div style={{ color: 'var(--vm-text-muted)' }}>{tls.tls.error}</div>}
                    </div>
                  )}
                  {(tls.findings || []).length > 0 ? (
                    <table className="vm-table"><thead><tr><th>Severity</th><th>Issue</th><th>Source</th></tr></thead>
                      <tbody>{tls.findings.map((f, i) => <tr key={i}><td><span className={`vm-badge ${sevClass(f.severity)}`}>{f.severity}</span></td><td>{f.issue}</td><td style={{ color: 'var(--vm-text-muted)' }}>{f.source}</td></tr>)}</tbody>
                    </table>
                  ) : <div style={{ color: 'var(--vm-success)' }}>No TLS/header issues found.</div>}
                </>
              )}
              {!tls && !tlsLoading && <div style={{ color: 'var(--vm-text-muted)' }}>Run a live TLS + security-header check against this host.</div>}
            </div>
          </Tab>

          <Tab eventKey="history" title="Scan history">
            {delta?.comparable && (
              <div className="vm-card" style={{ marginBottom: 12, background: 'var(--vm-surface-2)' }}>
                <div style={mLabel}><FaHistory /> Drift since previous scan</div>
                <div>New open ports: <strong>{delta.newPorts.length}</strong> {delta.newPorts.map(p => <span key={p.port} className="vm-badge high" style={{ marginRight: 4 }}>{p.port} {p.service}</span>)}</div>
                <div>Closed ports: <strong>{delta.closedPorts.length}</strong> {delta.closedPorts.map(p => <span key={p.port} className="vm-badge ghost" style={{ marginRight: 4 }}>{p.port} {p.service}</span>)}</div>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="vm-table"><thead><tr><th>Scan</th><th>Open ports</th><th>Services</th><th>Vulns</th></tr></thead>
                <tbody>
                  {(history?.sessions || []).map((se, i) => (
                    <tr key={i}><td>{new Date(se.at).toLocaleString()}</td><td>{se.openPorts}</td><td style={{ color: 'var(--vm-text-muted)' }}>{(se.services || []).slice(0, 6).join(', ')}</td><td>{se.vulnerabilities}</td></tr>
                  ))}
                  {(!history?.sessions || history.sessions.length === 0) && <tr><td colSpan={4} style={{ color: 'var(--vm-text-muted)', padding: 16 }}>No scan history yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div><div style={mLabel}>{label}</div><div style={{ color: 'var(--vm-text)' }}>{children}</div></div>
);
const mLabel = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--vm-text-muted)', marginBottom: 4 };
