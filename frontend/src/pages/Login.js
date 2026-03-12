import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import config from '../config';
// import { Container, Form, Button, Alert } from 'react-bootstrap';

const Login = () => {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Save token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);  // 👈 Immediately update context
      // Redirect
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-100" style={{ maxWidth: 400 }}>
      <div className="card shadow p-4 w-100">
        <h2 className="text-center mb-3" style={{ 
          color: '#1594EA', 
          fontWeight: 'bold',
          fontSize: '1.5rem'
        }}>
          Let's get you in
        </h2>
        <p className="text-center mb-4" style={{ 
          color: '#6B7280',
          fontSize: '0.9rem'
        }}>
          Sign in to your account
        </p>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label>Email address</label>
            <input
              type="email"
              className="form-control"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <button 
            className="btn w-100" 
            type="submit"
            style={{
              backgroundColor: '#1594EA',
              borderColor: '#1594EA',
              color: '#fff'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#0D7FD6';
              e.target.style.borderColor = '#0D7FD6';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#1594EA';
              e.target.style.borderColor = '#1594EA';
            }}
          >
            Login
          </button>
        </form>
        <p className="mt-3 text-center">
          {/* Don't have an account? <Link to="/signup">Sign up</Link> */}
        </p>
      </div>
    </div>
  );
};

export default Login;
