import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FaPlus, FaPlay, FaTrash, FaClock, FaSyncAlt, FaServer, FaNetworkWired,
  FaPen, FaTimes, FaChevronDown, FaChevronRight, FaCalendarAlt,
} from 'react-icons/fa';
import {
  listSchedules, createSchedule, deleteSchedule, runScheduleNow, updateSchedule,
  getAssets, getDevices,
} from '../api/platformApi';
import { useT } from '../context/LanguageContext';
import '../styles/theme.css';

const TARGET_TYPES = [
  { value: 'all', label: 'All online assets & devices' },
  { value: 'all-assets', label: 'All online assets' },
  { value: 'all-devices', label: 'All online devices' },
  { value: 'asset', label: 'Specific asset(s)…' },
  { value: 'device', label: 'Specific device(s)…' },
];
const SCAN_TYPES = ['quick', 'comprehensive', 'stealth', 'vulnerability'];
const isSpecific = (t) => t === 'asset' || t === 'device';

// OpenVAS/Greenbone-style recurrence presets → interval minutes.
const RECURRENCE = [
  { value: 'once', label: 'Once (single run)', minutes: 1440 },
  { value: 'hourly', label: 'Hourly', minutes: 60 },
  { value: 'daily', label: 'Daily', minutes: 1440 },
  { value: 'weekly', label: 'Weekly', minutes: 10080 },
  { value: 'monthly', label: 'Monthly (~30d)', minutes: 43200 },
  { value: 'custom', label: 'Custom interval…', minutes: null },
];
const recMinutes = (rec, custom) => {
  if (rec === 'custom') return Math.max(5, Number(custom) || 60);
  return (RECURRENCE.find(r => r.value === rec) || {}).minutes || 1440;
};

const statusBadge = (s) => {
  const map = { success: 'low', running: 'medium', error: 'high', never: 'ghost' };
  return <span className={`vm-badge ${map[s] || 'ghost'}`}>{s}</span>;
};

const emptyForm = {
  name: '', targetSpec: { type: 'all', ids: [] }, scanType: 'quick',
  recurrence: 'daily', frequencyMinutes: 1440, customMinutes: 60, startAt: '', enabled: true,
};

// ISO -> value for <input type="datetime-local">
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

export default function ScanScheduler() {
  const t = useT();
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const [s, a, d] = await Promise.all([listSchedules(), getAssets(), getDevices()]);
      setSchedules(s);
      setAssets(Array.isArray(a) ? a : []);
      setDevices(Array.isArray(d) ? d : []);
      setError(null);
    } catch (err) { setError(err?.response?.data?.message || err.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nameById = useMemo(() => {
    const m = {};
    assets.forEach(a => { m[a._id] = `${a.name} (${a.ip})`; });
    devices.forEach(d => { m[d._id] = `${d.name} (${d.ip})`; });
    return m;
  }, [assets, devices]);

  const setType = (type) => setForm(f => ({ ...f, targetSpec: { type, ids: [] } }));
  const setIds = (ids) => setForm(f => ({ ...f, targetSpec: { ...f.targetSpec, ids } }));
  const specificList = form.targetSpec.type === 'device' ? devices : assets;

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (s) => {
    setEditingId(s._id);
    setForm({
      name: s.name || '',
      targetSpec: { type: s.targetSpec?.type || 'all', ids: (s.targetSpec?.ids || []).map(String) },
      scanType: s.scanType || 'quick',
      recurrence: s.recurrence || (s.runOnce ? 'once' : 'custom'),
      frequencyMinutes: s.frequencyMinutes || 1440,
      customMinutes: s.frequencyMinutes || 60,
      startAt: toLocalInput(s.startAt),
      enabled: s.enabled !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please give the schedule a name.'); return; }
    if (isSpecific(form.targetSpec.type) && form.targetSpec.ids.length === 0) {
      setError(`Please select at least one ${form.targetSpec.type}.`); return;
    }
    const payload = {
      name: form.name,
      targetSpec: form.targetSpec,
      scanType: form.scanType,
      recurrence: form.recurrence,
      frequencyMinutes: recMinutes(form.recurrence, form.customMinutes),
      runOnce: form.recurrence === 'once',
      startAt: form.startAt || null,
      enabled: form.enabled,
    };
    setSaving(true);
    try {
      if (editingId) await updateSchedule(editingId, payload);
      else await createSchedule(payload);
      resetForm();
      await load();
    } catch (err) { setError(err?.response?.data?.message || err.message); }
    finally { setSaving(false); }
  };

  const toggle = async (s) => { await updateSchedule(s._id, { enabled: !s.enabled }); load(); };
  const runNow = async (s) => { await runScheduleNow(s._id); setTimeout(load, 1500); };
  const remove = async (s) => { if (window.confirm(`Delete schedule "${s.name}"?`)) { await deleteSchedule(s._id); if (editingId === s._id) resetForm(); load(); } };
  const toggleExpand = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const recurrenceLabel = (s) => {
    if (s.runOnce) return 'Once';
    const r = RECURRENCE.find(x => x.value === s.recurrence);
    if (r && r.value !== 'custom') return r.label.replace(/\s*\(.*\)/, '');
    const m = s.frequencyMinutes;
    return m % 1440 === 0 ? `Every ${m / 1440}d` : m % 60 === 0 ? `Every ${m / 60}h` : `Every ${m}m`;
  };
  const targetLabel = (spec) => {
    if (!spec) return '—';
    if (!isSpecific(spec.type)) return TARGET_TYPES.find(t => t.value === spec.type)?.label || spec.type;
    const names = (spec.ids || []).map(id => nameById[id]).filter(Boolean);
    return `${names.slice(0, 2).join(', ')}${(spec.ids || []).length > 2 ? ` +${spec.ids.length - 2}` : ''}` || `${(spec.ids || []).length} ${spec.type}(s)`;
  };

  return (
    <div className="vm-page" style={{ padding: 24 }}>
      <h1 className="vm-page-title"><FaClock /> {t('Scan Scheduler')}</h1>
      <p className="vm-section-sub">Automated scans — whole estate or specific targets, with start time and recurrence</p>

      {error && <div className="vm-card" style={{ borderColor: 'var(--vm-high)', marginBottom: 16, color: 'var(--vm-high)' }}>{error}</div>}

      <div className="vm-card" style={{ marginBottom: 20 }}>
        <div className="vm-section-title">{editingId ? 'Edit schedule' : 'New schedule'}</div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end', marginTop: 12 }}>
            <label style={lbl}>Name
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nightly quick scan" style={inp} />
            </label>
            <label style={lbl}>Target
              <select value={form.targetSpec.type} onChange={e => setType(e.target.value)} style={inp}>
                {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label style={lbl}>Scan type
              <select value={form.scanType} onChange={e => setForm({ ...form, scanType: e.target.value })} style={inp}>
                {SCAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={lbl}>Recurrence
              <select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })} style={inp}>
                {RECURRENCE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            {form.recurrence === 'custom' && (
              <label style={lbl}>Every (min)
                <input type="number" min={5} value={form.customMinutes} onChange={e => setForm({ ...form, customMinutes: Number(e.target.value) })} style={inp} />
              </label>
            )}
            <label style={lbl}><FaCalendarAlt /> First run (optional)
              <input type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} style={inp} />
            </label>
          </div>

          {isSpecific(form.targetSpec.type) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...lbl, marginBottom: 6 }}>
                {form.targetSpec.type === 'device' ? <><FaNetworkWired /> Select device(s)</> : <><FaServer /> Select asset(s)</>}
                <span style={{ marginLeft: 8 }}>({form.targetSpec.ids.length} selected — Ctrl/Cmd-click for multiple)</span>
              </div>
              <select multiple value={form.targetSpec.ids}
                onChange={e => setIds(Array.from(e.target.selectedOptions).map(o => o.value))}
                style={{ ...inp, height: 150, width: '100%' }}>
                {specificList.length === 0 && <option disabled>No {form.targetSpec.type}s available</option>}
                {specificList.map(t => (
                  <option key={t._id} value={t._id}>{t.name} — {t.ip}{t.criticality ? ` [${t.criticality}]` : ''}{t.status ? ` · ${t.status}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
            <button className="vm-badge" style={{ background: 'var(--vm-primary)', color: '#fff', cursor: 'pointer', height: 38 }} disabled={saving}>
              {editingId ? <><FaPen /> Save changes</> : <><FaPlus /> Add schedule</>}
            </button>
            {editingId && (
              <button type="button" className="vm-badge ghost" style={{ cursor: 'pointer', height: 38 }} onClick={resetForm}><FaTimes /> Cancel</button>
            )}
            <label style={{ ...lbl, flexDirection: 'row', marginLeft: 'auto' }}>
              <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Enabled
            </label>
          </div>
        </form>
      </div>

      <div className="vm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="vm-section-title">Schedules ({schedules.length})</div>
          <button className="vm-badge ghost" style={{ cursor: 'pointer' }} onClick={load}><FaSyncAlt /> Refresh</button>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="vm-table">
            <thead><tr><th style={{ width: 24 }}></th><th>Name</th><th>Target</th><th>Scan</th><th>Recurrence</th><th>Runs</th><th>Enabled</th><th>Last</th><th>Next run</th><th></th></tr></thead>
            <tbody>
              {schedules.map(s => {
                const open = expanded.has(s._id);
                return (
                  <React.Fragment key={s._id}>
                    <tr>
                      <td style={{ cursor: 'pointer' }} onClick={() => toggleExpand(s._id)}>{open ? <FaChevronDown /> : <FaChevronRight />}</td>
                      <td><strong>{s.name}</strong></td>
                      <td style={{ color: 'var(--vm-text-muted)' }}>{targetLabel(s.targetSpec)}</td>
                      <td>{s.scanType}</td>
                      <td>{recurrenceLabel(s)}</td>
                      <td>{s.runCount || 0}</td>
                      <td><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /></td>
                      <td>{statusBadge(s.lastStatus)}{s.lastSummary?.newVulnerabilities != null && <span style={{ color: 'var(--vm-text-muted)', marginLeft: 6 }}>+{s.lastSummary.newVulnerabilities}</span>}</td>
                      <td style={{ color: 'var(--vm-text-muted)' }}>{s.nextRun ? new Date(s.nextRun).toLocaleString() : (s.runOnce ? 'done' : '—')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="vm-badge ghost" style={{ cursor: 'pointer', marginRight: 4 }} onClick={() => runNow(s)} title="Run now"><FaPlay /></button>
                        <button className="vm-badge ghost" style={{ cursor: 'pointer', marginRight: 4 }} onClick={() => startEdit(s)} title="Edit"><FaPen /></button>
                        <button className="vm-badge ghost" style={{ cursor: 'pointer', color: 'var(--vm-high)' }} onClick={() => remove(s)} title="Delete"><FaTrash /></button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={10} style={{ background: 'var(--vm-surface-2)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: '4px 8px' }}>
                            <Detail label="First run">{s.startAt ? new Date(s.startAt).toLocaleString() : 'Immediately'}</Detail>
                            <Detail label="Last run">{s.lastRun ? new Date(s.lastRun).toLocaleString() : 'Never'}</Detail>
                            <Detail label="Interval">{s.frequencyMinutes} min{s.runOnce ? ' (once)' : ''}</Detail>
                            <Detail label="Total runs">{s.runCount || 0}</Detail>
                            <Detail label="Targets scanned (last)">{s.lastSummary?.targets ?? '—'}</Detail>
                            <Detail label="New vulns (last)">{s.lastSummary?.newVulnerabilities ?? '—'}</Detail>
                          </div>
                          {Array.isArray(s.lastSummary?.details) && s.lastSummary.details.length > 0 && (
                            <div style={{ padding: '4px 8px' }}>
                              <div style={{ fontSize: 12, color: 'var(--vm-text-muted)', marginBottom: 6 }}>Last run — per target</div>
                              <table className="vm-table" style={{ fontSize: 13 }}>
                                <thead><tr><th>Target</th><th>IP</th><th>Open ports</th><th>New vulns</th><th>Result</th></tr></thead>
                                <tbody>
                                  {s.lastSummary.details.map((d, i) => (
                                    <tr key={i}>
                                      <td>{d.target}</td><td style={{ color: 'var(--vm-text-muted)' }}>{d.ip}</td>
                                      <td>{d.openPorts ?? '—'}</td><td>{d.newVulnerabilities ?? '—'}</td>
                                      <td>{d.error ? <span className="vm-badge high">error</span> : <span className="vm-badge low">ok</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {schedules.length === 0 && <tr><td colSpan={10} style={{ color: 'var(--vm-text-muted)' }}>No schedules yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const Detail = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--vm-text-muted)' }}>{label}</div>
    <div style={{ color: 'var(--vm-text)', fontWeight: 600 }}>{children}</div>
  </div>
);

const inp = { background: 'var(--vm-surface-2)', color: 'var(--vm-text)', border: '1px solid var(--vm-border)', borderRadius: 8, padding: '8px 10px' };
const lbl = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--vm-text-muted)', flexWrap: 'wrap' };
