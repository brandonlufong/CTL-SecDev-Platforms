import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaShieldAlt, FaEnvelope, FaLock, FaArrowRight } from 'react-icons/fa';
import config from '../config';
import '../styles/theme.css';

const Login = () => {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vm-card" style={{ width: '100%', maxWidth: 420, padding: '2.25rem', overflow: 'hidden', position: 'relative' }}>
      {/* Brand accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--vm-gradient)' }} />

      {/* Logo mark */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: 'var(--vm-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          boxShadow: '0 10px 22px -8px rgba(21,148,234,.6)',
        }}>
          <FaShieldAlt size={26} />
        </div>
      </div>

      <h1 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--vm-text)', margin: '0 0 4px' }}>
        Welcome back
      </h1>
      <p style={{ textAlign: 'center', color: 'var(--vm-text-muted)', fontSize: '0.9rem', margin: '0 0 24px' }}>
        Sign in to the Camtel Vulnerability Manager
      </p>

      {error && (
        <div style={{ background: 'rgba(217,45,32,.08)', color: 'var(--vm-high)', border: '1px solid rgba(217,45,32,.2)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={fieldLabel}>Email address</label>
        <div style={fieldWrap}>
          <FaEnvelope style={fieldIcon} />
          <input type="email" name="email" value={form.email} onChange={handleChange} required
            placeholder="you@camtel.cm" style={fieldInput} autoFocus />
        </div>

        <label style={fieldLabel}>Password</label>
        <div style={fieldWrap}>
          <FaLock style={fieldIcon} />
          <input type="password" name="password" value={form.password} onChange={handleChange} required
            placeholder="••••••••" style={fieldInput} />
        </div>

        <button type="submit" disabled={loading} style={{
          width: '100%', marginTop: 8, padding: '12px 16px', border: 'none', borderRadius: 10,
          background: 'var(--vm-gradient)', color: '#fff', fontWeight: 600, fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
          boxShadow: '0 12px 24px -10px rgba(21,148,234,.65)',
          opacity: loading ? 0.7 : 1, transition: 'transform .2s var(--vm-ease), opacity .2s',
        }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translateY(1px)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          {loading ? 'Signing in…' : <>Sign in <FaArrowRight size={13} /></>}
        </button>
      </form>

      <p style={{ textAlign: 'center', color: 'var(--vm-text-muted)', fontSize: 12, margin: '20px 0 0' }}>
        Protected access · CAMTEL Security
      </p>
    </div>
  );
};

const fieldLabel = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--vm-text-muted)', margin: '0 0 6px' };
const fieldWrap = { position: 'relative', marginBottom: 16 };
const fieldIcon = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--vm-text-muted)', fontSize: 14 };
const fieldInput = {
  width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10,
  border: '1px solid var(--vm-border)', background: 'var(--vm-surface-2)', color: 'var(--vm-text)',
  fontSize: 15, outline: 'none',
};

export default Login;
