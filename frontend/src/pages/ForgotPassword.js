import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import './Auth.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  // step: 'email' | 'otp' | 'done'
  const [step, setStep]         = useState('email');
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const startTimer = () => {
    setResendTimer(60);
    const t = setInterval(() =>
      setResendTimer(p => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; }), 1000);
  };

  const handleOtpChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...otp]; n[i] = v; setOtp(n);
    if (v && i < 5) document.getElementById(`fp-otp-${i + 1}`)?.focus();
  };
  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0)
      document.getElementById(`fp-otp-${i - 1}`)?.focus();
  };

  // Step 1 — send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await axios.post(config.getApiUrl('/api/auth/forgot-password'), { email });
      setStep('otp');
      setSuccess('Reset code sent! Check your email.');
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally { setLoading(false); }
  };

  // Step 2 — verify OTP + new password
  const handleReset = async (e) => {
    e.preventDefault(); setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await axios.post(config.getApiUrl('/api/auth/reset-password'), {
        email, otp: otp.join(''), newPassword
      });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setError(''); setLoading(true);
    try {
      await axios.post(config.getApiUrl('/api/auth/forgot-password'), { email });
      setSuccess('New reset code sent!');
      setOtp(['', '', '', '', '', '']);
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend');
    } finally { setLoading(false); }
  };

  const steps = ['Your Email', 'Verify Code', 'New Password'];
  const stepIndex = step === 'email' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {steps.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i < stepIndex ? '#10b981' : i === stepIndex ? '#667eea' : 'rgba(255,255,255,0.1)',
                border: `2px solid ${i <= stepIndex ? 'transparent' : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: i <= stepIndex ? 'white' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s'
              }}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: i === stepIndex ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <div style={{ width: 24, height: 2, background: i < stepIndex ? '#10b981' : 'rgba(255,255,255,0.1)', borderRadius: 2 }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Email */}
        {step === 'email' && (
          <>
            <div className="auth-logo">🔑</div>
            <h2>Forgot Password?</h2>
            <p className="auth-subtitle">Enter your email and we'll send a reset code</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input type="email" className="form-control" value={email}
                  onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
              </div>
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }} disabled={loading}>
                {loading ? '⏳ Sending...' : '📧 Send Reset Code'}
              </button>
            </form>
            <div className="auth-link" style={{ marginTop: 16 }}>
              <Link to="/login">← Back to Login</Link>
            </div>
          </>
        )}

        {/* Step 2 — OTP + new password */}
        {step === 'otp' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📬</div>
              <h2 style={{ marginBottom: 8 }}>Check your email</h2>
              <p className="auth-subtitle">
                We sent a 6-digit code to<br />
                <strong style={{ color: '#a5b4fc' }}>{email}</strong>
              </p>
            </div>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            <form onSubmit={handleReset}>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                {otp.map((d, i) => (
                  <input key={i} id={`fp-otp-${i}`} type="text" inputMode="numeric"
                    maxLength={1} value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    style={{
                      width: 48, height: 58, textAlign: 'center',
                      fontSize: 24, fontWeight: 800, fontFamily: 'inherit',
                      border: `2px solid ${d ? '#667eea' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 12, outline: 'none',
                      background: d ? 'rgba(102,126,234,0.15)' : 'rgba(255,255,255,0.05)',
                      color: 'white', transition: 'all 0.15s'
                    }} />
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required minLength={6}
                  placeholder="Minimum 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-control" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required
                  placeholder="Re-enter new password" />
              </div>
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }} disabled={loading}>
                {loading ? '⏳ Resetting...' : '🔑 Reset Password'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
              {resendTimer > 0
                ? <span>Resend in <strong style={{ color: '#a5b4fc' }}>{resendTimer}s</strong></span>
                : <button onClick={handleResend} disabled={loading}
                    style={{ background: 'none', border: 'none', color: '#a5b4fc', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                    Resend Code
                  </button>
              }
            </div>
          </>
        )}

        {/* Step 3 — Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2>Password Reset!</h2>
            <p className="auth-subtitle">Your password has been updated successfully.</p>
            <button className="btn btn-primary" style={{ width: '100%', padding: '13px', marginTop: 16 }}
              onClick={() => navigate('/login')}>
              🔑 Go to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;
