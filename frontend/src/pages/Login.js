import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const result = await login(formData.email, formData.password);
    if (result.success) { navigate('/'); } else { setError(result.message || 'Login failed'); }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">🍔</div>
        <h2>Welcome back!</h2>
        <p className="auth-subtitle">Sign in to your FoodOrder account</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email address</label>
            <input type="email" id="email" name="email" className="form-control"
              value={formData.email} onChange={handleChange}
              required placeholder="your@email.com" autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input type="password" id="password" name="password" className="form-control"
              value={formData.password} onChange={handleChange}
              required placeholder="Enter your password" autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', padding: '13px', marginTop: 4 }} disabled={loading}>
            {loading ? '⏳ Signing in...' : '🔑 Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'right', marginTop: 8, marginBottom: 4 }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: '#a5b4fc' }}>
            Forgot password?
          </Link>
        </div>
        <div className="auth-divider">or</div>
        <div className="auth-link">
          Don't have an account? <Link to="/register">Create one free</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;