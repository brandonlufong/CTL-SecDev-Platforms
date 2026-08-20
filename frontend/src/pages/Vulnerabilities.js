import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Form, Tabs, Tab } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import {
  FaPlus, FaEdit, FaTrash, FaSyncAlt, FaBug, FaFireAlt, FaClock, FaFileCsv,
  FaExclamationTriangle, FaExternalLinkAlt, FaInfoCircle, FaShieldAlt, FaHistory, FaFileImport,
} from 'react-icons/fa';
import {
  getVulnerabilities, createVulnerability, updateVulnerability, deleteVulnerability,
  getAssets, getDevices, getUsers, setVulnStatus, assignVuln, addVulnNote, bulkVulnAction,
  exportVulnerabilitiesCsv, importScan,
} from '../api/platformApi';
import BsPagination from '../components/BsPagination';
import { useT } from '../context/LanguageContext';
import '../styles/theme.css';

// Full lifecycle from the Vulnerability model.
const STATUSES = ['Open', 'In Progress', 'Acknowledged', 'Under Review', 'Mitigated',
  'Remediated', 'Resolved', 'Closed', 'False Positive', 'Wont Fix', 'Duplicate', 'Not Applicable'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const OPEN_STATUSES = new Set(['Open', 'In Progress', 'Acknowledged', 'Under Review', 'Pending',
  'Reviewed', 'Escalated', 'Deferred']);

const sevClass = (s) => ({ Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' }[s] || 'info');
const riskColor = (v) => (v >= 9 ? '#b42318' : v >= 7 ? '#d92d20' : v >= 4 ? '#b54708' : '#475467');
const isBreached = (v) => OPEN_STATUSES.has(v.status) && v.dueDate && new Date(v.dueDate) < new Date();

const emptyForm = {
  title: '', severity: 'Medium', cvssScore: '', status: 'Open', asset: '', device: '',
  description: '', cve: '', discoveredDate: '', remediation: '', exploitAvailable: false, references: '',
};

export default function Vulnerabilities() {
  const location = useLocation();
  const t = useT();
  const [vulns, setVulns] = useState([]);
  const [assets, setAssets] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [kevOnly, setKevOnly] = useState(false);
  const [breachedOnly, setBreachedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Saved views (persisted filter presets)
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vm_vuln_views') || '[]'); } catch { return []; }
  });
  const persistViews = (views) => { setSavedViews(views); localStorage.setItem('vm_vuln_views', JSON.stringify(views)); };
  const saveCurrentView = () => {
    const name = window.prompt('Name this view:');
    if (!name || !name.trim()) return;
    const view = { name: name.trim(), severity, status, kevOnly, breachedOnly, search };
    persistViews([...savedViews.filter(v => v.name !== view.name), view]);
  };
  const applyView = (name) => {
    const v = savedViews.find(x => x.name === name);
    if (!v) return;
    setSeverity(v.severity || ''); setStatus(v.status || '');
    setKevOnly(!!v.kevOnly); setBreachedOnly(!!v.breachedOnly); setSearch(v.search || '');
  };
  const deleteView = (name) => persistViews(savedViews.filter(v => v.name !== name));

  // Selection + modal
  const [selected, setSelected] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Detail pane
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [noteText, setNoteText] = useState('');

  // Import (Nessus / OpenVAS)
  const [showImport, setShowImport] = useState(false);
  const [importFormat, setImportFormat] = useState('auto');
  const [importContent, setImportContent] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importIsPdf, setImportIsPdf] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name); setImportResult(null);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    setImportIsPdf(isPdf);
    const reader = new FileReader();
    if (isPdf) {
      reader.onload = () => setImportContent((String(reader.result || '').split(',')[1]) || ''); // base64 payload after the data: prefix
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => setImportContent(String(reader.result || ''));
      reader.readAsText(file);
    }
  };
  const runImport = async () => {
    if (!importContent.trim()) return;
    setImporting(true); setImportResult(null);
    try {
      const payload = importIsPdf
        ? { contentBase64: importContent, format: 'openvas-pdf' }
        : { content: importContent, format: importFormat === 'auto' ? undefined : importFormat };
      const res = await importScan(payload);
      setImportResult(res);
      await load();
    } catch (err) {
      setImportResult({ error: err?.response?.data?.message || err.message });
    } finally { setImporting(false); }
  };

  const userName = useCallback((id) => {
    if (!id) return null;
    const uid = typeof id === 'object' ? id._id : id;
    const u = users.find(x => x._id === uid);
    return u ? u.name : (typeof id === 'object' ? id.name : null);
  }, [users]);

  // Merge an API update while preserving populated asset/device/assignee refs.
  const mergeUpdated = (x, updated) => ({
    ...x, ...updated,
    asset: x.asset, device: x.device,
    assignedTo: (updated.assignedTo && typeof updated.assignedTo === 'object') ? updated.assignedTo : x.assignedTo,
  });
  const applyUpdate = (id, updated) => {
    setVulns(prev => prev.map(x => (x._id === id ? mergeUpdated(x, updated) : x)));
    setDetail(d => (d && d._id === id ? mergeUpdated(d, updated) : d));
  };
  const openDetail = (v) => { setDetail(v); setDetailTab('overview'); setNoteText(''); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, a, d, u] = await Promise.all([
        getVulnerabilities(), getAssets(), getDevices(), getUsers(),
      ]);
      setVulns(Array.isArray(v) ? v : (v.vulnerabilities || []));
      setAssets(Array.isArray(a) ? a : []);
      setDevices(Array.isArray(d) ? d : []);
      setUsers(Array.isArray(u) ? u : (u.users || []));
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load vulnerabilities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Deep-link ?severity= / ?status=
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('severity')) setSeverity(q.get('severity'));
    if (q.get('status')) setStatus(q.get('status'));
  }, [location.search]);

  const filtered = useMemo(() => {
    return vulns.filter(v => {
      if (severity && v.severity !== severity) return false;
      if (status && v.status !== status) return false;
      if (kevOnly && !v.knownExploited) return false;
      if (breachedOnly && !isBreached(v)) return false;
      if (search) {
        const t = `${v.title} ${v.cve || ''} ${v.asset?.name || ''} ${v.device?.name || ''} ${v.asset?.ip || ''}`.toLowerCase();
        if (!t.includes(search.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
  }, [vulns, severity, status, kevOnly, breachedOnly, search]);

  // Reset to first page whenever the filtered set changes.
  useEffect(() => { setPage(1); }, [search, severity, status, kevOnly, breachedOnly]);
  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const kpis = useMemo(() => ({
    total: vulns.length,
    open: vulns.filter(v => OPEN_STATUSES.has(v.status)).length,
    critical: vulns.filter(v => v.severity === 'Critical').length,
    kev: vulns.filter(v => v.knownExploited).length,
    breached: vulns.filter(isBreached).length,
  }), [vulns]);

  // ---- inline actions ----
  const changeStatus = async (v, newStatus) => {
    const updated = await setVulnStatus(v._id, newStatus);
    applyUpdate(v._id, updated);
  };
  const changeAssignee = async (v, userId) => {
    const updated = await assignVuln(v._id, userId);
    applyUpdate(v._id, updated);
  };
  const submitNote = async () => {
    if (!detail || !noteText.trim()) return;
    const updated = await addVulnNote(detail._id, noteText.trim());
    applyUpdate(detail._id, updated);
    setNoteText('');
  };
  const doBulk = async (payload) => {
    if (selected.size === 0) return;
    await bulkVulnAction({ ids: [...selected], ...payload });
    setSelected(new Set());
    load();
  };

  const toggleSel = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => (prev.size === filtered.length ? new Set() : new Set(filtered.map(v => v._id))));

  // ---- CRUD modal ----
  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (v) => {
    setEditId(v._id);
    setForm({
      title: v.title || '', severity: v.severity || 'Medium', cvssScore: v.cvssScore ?? '',
      status: v.status || 'Open', asset: v.asset?._id || v.asset || '', device: v.device?._id || v.device || '',
      description: v.description || '', cve: v.cve || '',
      discoveredDate: v.discoveredDate ? v.discoveredDate.slice(0, 10) : '',
      remediation: v.remediation || '', exploitAvailable: !!v.exploitAvailable,
      references: Array.isArray(v.references) ? v.references.join(', ') : (v.references || ''),
    });
    setShowModal(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        cvssScore: form.cvssScore === '' ? undefined : Number(form.cvssScore),
        references: form.references ? form.references.split(',').map(s => s.trim()).filter(Boolean) : [],
        asset: form.asset || undefined, device: form.device || undefined,
      };
      if (editId) await updateVulnerability(editId, payload);
      else await createVulnerability(payload);
      setShowModal(false);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally { setSubmitting(false); }
  };
  const remove = async (v) => { if (window.confirm(`Delete "${v.title}"?`)) { await deleteVulnerability(v._id); load(); } };

  if (loading && vulns.length === 0) {
    return <div className="vm-page" style={{ padding: 40 }}><p style={{ color: 'var(--vm-text-muted)' }}>Loading vulnerabilities…</p></div>;
  }

  return (
    <div className="vm-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="vm-page-title"><FaBug /> {t('Vulnerabilities')}</h1>
          <p className="vm-section-sub" style={{ margin: 0 }}>Risk-prioritized findings with remediation & SLA tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="vm-badge ghost" style={btn} onClick={load}><FaSyncAlt /> Refresh</button>
          <button className="vm-badge ghost" style={btn} onClick={() => { setShowImport(true); setImportResult(null); setImportContent(''); setImportFileName(''); }}><FaFileImport /> Import</button>
          <button className="vm-badge ghost" style={btn} onClick={() => exportVulnerabilitiesCsv()}><FaFileCsv /> Export</button>
          <button className="vm-badge" style={{ ...btn, background: 'var(--vm-primary)', color: '#fff' }} onClick={openCreate}><FaPlus /> Add</button>
        </div>
      </div>

      {error && <div className="vm-card" style={{ borderColor: 'var(--vm-high)', color: 'var(--vm-high)', marginBottom: 16 }}>{error}</div>}

      <div className="vm-kpi-grid" style={{ marginBottom: 16 }}>
        <div className="vm-kpi"><div className="vm-kpi-n">{kpis.open}</div><div className="vm-kpi-l">Open</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: '#b42318' }}>{kpis.critical}</div><div className="vm-kpi-l">Critical</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: '#7a2e0e' }}>{kpis.kev}</div><div className="vm-kpi-l"><FaFireAlt /> Known-exploited</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n" style={{ color: '#b54708' }}>{kpis.breached}</div><div className="vm-kpi-l"><FaClock /> SLA breached</div></div>
        <div className="vm-kpi"><div className="vm-kpi-n">{kpis.total}</div><div className="vm-kpi-l">Total</div></div>
      </div>

      {/* Filters */}
      <div className="vm-card" style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search title, CVE, asset…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={inp}>
          <option value="">All severities</option>{SEVERITIES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
          <option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <label style={chk}><input type="checkbox" checked={kevOnly} onChange={e => setKevOnly(e.target.checked)} /> KEV only</label>
        <label style={chk}><input type="checkbox" checked={breachedOnly} onChange={e => setBreachedOnly(e.target.checked)} /> SLA breached</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <select defaultValue="" onChange={e => { if (e.target.value) applyView(e.target.value); }} style={{ ...inp, padding: '6px 8px' }} title="Saved views">
            <option value="">Saved views…</option>
            {savedViews.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          <button className="vm-badge ghost" style={btn} onClick={saveCurrentView} title="Save current filters as a view">★ Save</button>
          {savedViews.length > 0 && (
            <button className="vm-badge ghost" style={{ ...btn, color: 'var(--vm-high)' }} title="Delete a saved view"
              onClick={() => { const n = window.prompt('Delete which view? (exact name)'); if (n) deleteView(n.trim()); }}>✕</button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="vm-card" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', background: 'var(--vm-primary-weak)' }}>
          <strong>{selected.size} selected</strong>
          <select onChange={e => e.target.value && doBulk({ status: e.target.value })} defaultValue="" style={inp}>
            <option value="" disabled>Set status…</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="vm-badge ghost" style={btn} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="vm-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="vm-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              <th>Finding</th><th>Severity</th><th>Risk</th><th>EPSS</th><th>Asset</th>
              <th>Status</th><th>Due / SLA</th><th>Owner</th><th></th>
            </tr>
          </thead>
          <tbody>
            {paged.map(v => {
              const target = v.asset || v.device;
              const breached = isBreached(v);
              return (
                <tr key={v._id}>
                  <td><input type="checkbox" checked={selected.has(v._id)} onChange={() => toggleSel(v._id)} /></td>
                  <td>
                    <div style={{ fontWeight: 600, cursor: 'pointer' }} className="vm-link" onClick={() => openDetail(v)} title="View details">{v.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--vm-text-muted)' }}>
                      {v.cve || 'no CVE'} {v.knownExploited && <span className="vm-badge kev" style={{ marginLeft: 6 }}><FaFireAlt /> KEV</span>}
                    </div>
                  </td>
                  <td><span className={`vm-badge ${sevClass(v.severity)}`}>{v.severity}</span></td>
                  <td>
                    <span className="vm-risk">
                      <span className="vm-risk-bar"><span className="vm-risk-fill" style={{ width: `${((v.riskScore || 0) / 10) * 100}%`, background: riskColor(v.riskScore || 0) }} /></span>
                      <strong style={{ color: riskColor(v.riskScore || 0) }}>{v.riskScore ?? '—'}</strong>
                    </span>
                  </td>
                  <td>{v.epssScore != null ? `${Math.round(v.epssScore * 100)}%` : '—'}</td>
                  <td>{target ? <>{target.name}<div style={{ fontSize: 12, color: 'var(--vm-text-muted)' }}>{target.ip}</div></> : '—'}</td>
                  <td>
                    <select value={v.status} onChange={e => changeStatus(v, e.target.value)} style={{ ...inp, padding: '4px 8px', fontSize: 13 }}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    {v.dueDate ? (
                      <span style={{ color: breached ? 'var(--vm-high)' : 'var(--vm-text-muted)', fontWeight: breached ? 700 : 400 }}>
                        {breached && <FaExclamationTriangle />} {new Date(v.dueDate).toISOString().slice(0, 10)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <select value={v.assignedTo?._id || v.assignedTo || ''} onChange={e => changeAssignee(v, e.target.value)} style={{ ...inp, padding: '4px 8px', fontSize: 13, maxWidth: 120 }}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="vm-badge ghost" style={iconBtn} onClick={() => openDetail(v)} title="Details"><FaInfoCircle /></button>
                    <button className="vm-badge ghost" style={iconBtn} onClick={() => openEdit(v)} title="Edit"><FaEdit /></button>
                    <button className="vm-badge ghost" style={{ ...iconBtn, color: 'var(--vm-high)' }} onClick={() => remove(v)} title="Delete"><FaTrash /></button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={10} style={{ color: 'var(--vm-text-muted)', padding: 24, textAlign: 'center' }}>No vulnerabilities match your filters.</td></tr>}
          </tbody>
        </table>
        <div style={{ padding: '0 0.5rem 0.5rem' }}>
          <BsPagination currentPage={page} totalItems={filtered.length} itemsPerPage={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="findings" />
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>{editId ? 'Edit' : 'Add'} vulnerability</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            <Form.Group className="mb-2"><Form.Label>Title</Form.Label>
              <Form.Control required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Form.Group>
            <div className="d-flex gap-2">
              <Form.Group className="mb-2 flex-fill"><Form.Label>Severity</Form.Label>
                <Form.Select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</Form.Select></Form.Group>
              <Form.Group className="mb-2 flex-fill"><Form.Label>CVSS</Form.Label>
                <Form.Control type="number" step="0.1" min="0" max="10" value={form.cvssScore} onChange={e => setForm({ ...form, cvssScore: e.target.value })} /></Form.Group>
              <Form.Group className="mb-2 flex-fill"><Form.Label>Status</Form.Label>
                <Form.Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</Form.Select></Form.Group>
            </div>
            <div className="d-flex gap-2">
              <Form.Group className="mb-2 flex-fill"><Form.Label>Asset</Form.Label>
                <Form.Select value={form.asset} onChange={e => setForm({ ...form, asset: e.target.value, device: '' })}>
                  <option value="">—</option>{assets.map(a => <option key={a._id} value={a._id}>{a.name} ({a.ip})</option>)}</Form.Select></Form.Group>
              <Form.Group className="mb-2 flex-fill"><Form.Label>Device</Form.Label>
                <Form.Select value={form.device} onChange={e => setForm({ ...form, device: e.target.value, asset: '' })}>
                  <option value="">—</option>{devices.map(d => <option key={d._id} value={d._id}>{d.name} ({d.ip})</option>)}</Form.Select></Form.Group>
            </div>
            <Form.Group className="mb-2"><Form.Label>CVE</Form.Label>
              <Form.Control value={form.cve} onChange={e => setForm({ ...form, cve: e.target.value })} placeholder="CVE-2024-…" /></Form.Group>
            <Form.Group className="mb-2"><Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Form.Group>
            <Form.Group className="mb-2"><Form.Label>Remediation</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.remediation} onChange={e => setForm({ ...form, remediation: e.target.value })} /></Form.Group>
            <Form.Check label="Exploit available" checked={form.exploitAvailable} onChange={e => setForm({ ...form, exploitAvailable: e.target.checked })} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : (editId ? 'Save' : 'Create')}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Detail pane (top-tool style: Overview / Remediation / References / Activity) */}
      {detail && (
        <Modal show={!!detail} onHide={() => setDetail(null)} size="lg" centered scrollable>
          <Modal.Header closeButton>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={`vm-badge ${sevClass(detail.severity)}`}>{detail.severity}</span>
                {detail.knownExploited && <span className="vm-badge kev"><FaFireAlt /> KEV</span>}
                <Modal.Title style={{ fontSize: 18 }}>{detail.title}</Modal.Title>
              </div>
              <div style={{ fontSize: 12, color: 'var(--vm-text-muted)', marginTop: 4 }}>{detail.cve || 'No CVE'}</div>
            </div>
          </Modal.Header>
          <Modal.Body>
            {/* Risk strip */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={mLabel}>Risk</div>
                <span className="vm-risk">
                  <span className="vm-risk-bar" style={{ width: 90 }}><span className="vm-risk-fill" style={{ width: `${((detail.riskScore || 0) / 10) * 100}%`, background: riskColor(detail.riskScore || 0) }} /></span>
                  <strong style={{ color: riskColor(detail.riskScore || 0) }}>{detail.riskScore ?? '—'}</strong>
                </span>
              </div>
              <div><div style={mLabel}>CVSS</div><strong>{detail.cvssScore ?? '—'}</strong></div>
              <div><div style={mLabel}>EPSS</div><strong>{detail.epssScore != null ? `${Math.round(detail.epssScore * 100)}%` : '—'}</strong></div>
              <div><div style={mLabel}>Exploited (KEV)</div><strong style={{ color: detail.knownExploited ? 'var(--vm-kev)' : 'inherit' }}>{detail.knownExploited ? 'Yes' : 'No'}</strong></div>
            </div>

            <Tabs activeKey={detailTab} onSelect={k => setDetailTab(k)} className="mb-3">
              <Tab eventKey="overview" title="Overview">
                <div style={metaGrid}>
                  <Field label="Status">
                    <select value={detail.status} onChange={e => changeStatus(detail, e.target.value)} style={{ ...inp, padding: '4px 8px' }}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Assignee">
                    <select value={detail.assignedTo?._id || detail.assignedTo || ''} onChange={e => changeAssignee(detail, e.target.value)} style={{ ...inp, padding: '4px 8px' }}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Affected target">{(detail.asset || detail.device) ? `${(detail.asset || detail.device).name} (${(detail.asset || detail.device).ip})` : '—'}</Field>
                  <Field label="Affected product">{(detail.affectedProducts || []).join(', ') || detail.cpeMatch || '—'}</Field>
                  <Field label="First detected">{detail.firstDetected ? new Date(detail.firstDetected).toLocaleString() : (detail.discoveredDate ? new Date(detail.discoveredDate).toLocaleString() : '—')}</Field>
                  <Field label="SLA due">
                    {detail.dueDate
                      ? <span style={{ color: isBreached(detail) ? 'var(--vm-high)' : 'inherit', fontWeight: isBreached(detail) ? 700 : 400 }}>{new Date(detail.dueDate).toLocaleDateString()}{isBreached(detail) ? ' (breached)' : ''}</span>
                      : '—'}
                  </Field>
                  <Field label="Compliance">
                    {(detail.complianceTags || []).length ? (detail.complianceTags.map(t => <span key={t} className="vm-badge ghost" style={{ marginRight: 4, marginBottom: 4 }}>{t}</span>)) : '—'}
                  </Field>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={mLabel}>Description</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{detail.description || 'No description available.'}</div>
                </div>
              </Tab>

              <Tab eventKey="remediation" title="Remediation">
                <div style={{ marginTop: 4 }}>
                  <div style={mLabel}><FaShieldAlt /> Recommended fix</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{detail.remediation || 'Review the vulnerability details and apply the vendor patch or mitigation.'}</div>
                  {(detail.knownExploited || detail.exploitAvailable) && (
                    <div className="vm-card" style={{ marginTop: 12, borderColor: 'var(--vm-kev)', color: 'var(--vm-kev)' }}>
                      <FaFireAlt /> This vulnerability is <strong>actively exploited / has a known exploit</strong> — prioritize remediation (accelerated SLA applies).
                    </div>
                  )}
                </div>
              </Tab>

              <Tab eventKey="references" title={`References (${(detail.references || []).length})`}>
                <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
                  {detail.cve && <li><a href={`https://nvd.nist.gov/vuln/detail/${detail.cve}`} target="_blank" rel="noreferrer">NVD — {detail.cve} <FaExternalLinkAlt size={11} /></a></li>}
                  {(detail.references || []).map((r, i) => (
                    <li key={i}><a href={r} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{r} <FaExternalLinkAlt size={11} /></a></li>
                  ))}
                  {(detail.references || []).length === 0 && !detail.cve && <li style={{ color: 'var(--vm-text-muted)' }}>No references.</li>}
                </ul>
              </Tab>

              <Tab eventKey="activity" title={`Activity (${(detail.notes || []).length})`}>
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note / comment…" style={{ ...inp, flex: 1 }} onKeyDown={e => e.key === 'Enter' && submitNote()} />
                    <Button onClick={submitNote} disabled={!noteText.trim()}><FaHistory /> Add</Button>
                  </div>
                  {(detail.notes || []).length === 0 && <div style={{ color: 'var(--vm-text-muted)' }}>No activity yet.</div>}
                  {(detail.notes || []).slice().reverse().map((n, i) => (
                    <div key={i} style={{ borderLeft: '2px solid var(--vm-border)', paddingLeft: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--vm-text-muted)' }}>{userName(n.by) || 'User'} · {n.at ? new Date(n.at).toLocaleString() : ''}</div>
                      <div>{n.text}</div>
                    </div>
                  ))}
                </div>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => { openEdit(detail); setDetail(null); }}><FaEdit /> Edit</Button>
            <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Import scan (Nessus / OpenVAS) */}
      <Modal show={showImport} onHide={() => setShowImport(false)} centered>
        <Modal.Header closeButton><Modal.Title><FaFileImport /> Import scan results</Modal.Title></Modal.Header>
        <Modal.Body>
          <p style={{ color: 'var(--vm-text-muted)', fontSize: 13 }}>
            Upload a <strong>Nessus (.nessus)</strong>, <strong>OpenVAS/Greenbone XML</strong>, or an
            <strong> OpenVAS/Greenbone PDF report</strong>. Hosts become assets and findings are added
            to the register (de-duplicated). PDF extraction is best-effort — XML is more accurate.
          </p>
          <div className="d-flex gap-2 mb-2">
            <Form.Select value={importFormat} onChange={e => setImportFormat(e.target.value)} style={{ maxWidth: 200 }} disabled={importIsPdf}>
              <option value="auto">Auto-detect format</option>
              <option value="nessus">Nessus (.nessus)</option>
              <option value="openvas">OpenVAS / Greenbone XML</option>
            </Form.Select>
            <Form.Control type="file" accept=".nessus,.xml,text/xml,.pdf,application/pdf" onChange={onImportFile} />
          </div>
          {importFileName && <div style={{ fontSize: 13, color: 'var(--vm-text-muted)' }}>Loaded: {importFileName} {importIsPdf && <span className="vm-badge ghost">PDF</span>}</div>}
          {importResult && (
            <div className="vm-card" style={{ marginTop: 12, borderColor: importResult.error ? 'var(--vm-high)' : 'var(--vm-border)' }}>
              {importResult.error
                ? <span style={{ color: 'var(--vm-high)' }}>{importResult.error}</span>
                : <span>Imported <strong>{importResult.format}</strong>: {importResult.findings} findings → <strong>{importResult.created}</strong> new, {importResult.updated} updated, {importResult.newAssets} new asset(s).</span>}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImport(false)}>Close</Button>
          <Button onClick={runImport} disabled={importing || !importContent.trim()}>{importing ? 'Importing…' : 'Import'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <div style={mLabel}>{label}</div>
    <div style={{ color: 'var(--vm-text)' }}>{children}</div>
  </div>
);

const inp = { background: 'var(--vm-surface-2)', color: 'var(--vm-text)', border: '1px solid var(--vm-border)', borderRadius: 8, padding: '8px 10px' };
const btn = { cursor: 'pointer' };
const iconBtn = { cursor: 'pointer', marginRight: 4 };
const chk = { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--vm-text-muted)', fontSize: 14 };
const mLabel = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--vm-text-muted)', marginBottom: 2 };
const metaGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 4 };
