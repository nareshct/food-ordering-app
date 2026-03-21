import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const { loadUser, updateProfile } = useAuth();

  // step: 'form' | 'otp' | 'address' | 'restaurant_info'
  const [step, setStep] = useState('form');

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'customer'
  });

  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Address step state (customer)
  const [address, setAddress] = useState({
    street: '', city: '', state: '', zipCode: '', phone: ''
  });
  const [addressLoading, setAddressLoading] = useState(false);

  // Restaurant info step state (restaurant owner)
  const [restaurantInfo, setRestaurantInfo] = useState({
    phone: '', street: '', city: '', state: '', zipCode: ''
  });
  const [restaurantInfoLoading, setRestaurantInfoLoading] = useState(false);

  const { name, email, password, confirmPassword, role } = formData;

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAddressChange = (e) =>
    setAddress({ ...address, [e.target.name]: e.target.value });

  const handleRestaurantInfoChange = (e) =>
    setRestaurantInfo({ ...restaurantInfo, [e.target.name]: e.target.value });

  // ── OTP box handlers ──────────────────────────────────────────────────────
  const handleOtpChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...otp]; n[i] = v; setOtp(n);
    if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };
  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0)
      document.getElementById(`otp-${i - 1}`)?.focus();
  };

  const startTimer = () => {
    setResendTimer(60);
    const t = setInterval(() =>
      setResendTimer(p => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; }), 1000);
  };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await axios.post(config.getApiUrl('/api/auth/send-otp'), { name, email, password, role });
      setStep('otp');
      setSuccess(`OTP sent to ${email}`);
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault(); setError('');
    const val = otp.join('');
    if (val.length < 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await axios.post(config.getApiUrl('/api/auth/verify-otp'), { email, otp: val });
      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        await loadUser();
        // Customers → ask for address. Owners → go to dashboard directly
        if (role === 'customer') {
          setStep('address');
          setError(''); setSuccess('');
        } else {
          setStep('restaurant_info');
          setError(''); setSuccess('');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally { setLoading(false); }
  };

  // ── Step 3: Save address ──────────────────────────────────────────────────
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressLoading(true);
    try {
      await updateProfile({
        phone: address.phone,
        address: {
          street:  address.street,
          city:    address.city,
          state:   address.state,
          zipCode: address.zipCode,
          country: 'India'
        }
      });
      // Reload so Checkout picks up the saved address
      await loadUser();
      navigate('/');
    } catch {
      navigate('/');
    } finally { setAddressLoading(false); }
  };

  // ── Step 3: Save restaurant owner contact info ───────────────────────────
  const handleSaveRestaurantInfo = async (e) => {
    e.preventDefault();
    setRestaurantInfoLoading(true);
    try {
      await updateProfile({
        phone: restaurantInfo.phone,
        address: {
          street:  restaurantInfo.street,
          city:    restaurantInfo.city,
          state:   restaurantInfo.state,
          zipCode: restaurantInfo.zipCode,
          country: 'India'
        }
      });
      await loadUser();
      navigate('/dashboard');
    } catch {
      // Even if save fails, go to dashboard — they can update from profile
      navigate('/dashboard');
    } finally { setRestaurantInfoLoading(false); }
  };

  const handleResend = async () => {
    setError(''); setLoading(true);
    try {
      await axios.post(config.getApiUrl('/api/auth/resend-otp'), { email });
      setSuccess('New OTP sent!');
      setOtp(['', '', '', '', '', '']);
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally { setLoading(false); }
  };

  // ── Shared step indicator ─────────────────────────────────────────────────
  const steps = role === 'customer'
    ? ['Details', 'Verify OTP', 'Your Address']
    : ['Details', 'Verify OTP', 'Restaurant Info'];

  const stepIndex = step === 'form' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: (step === 'address' || step === 'restaurant_info') ? 500 : 460 }}>

        {/* Step indicator — shown on all steps */}
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

        {/* ── Step 1: Registration Form ── */}
        {step === 'form' && (
          <>
            <div className="auth-logo">🍔</div>
            <h2>Create Account</h2>
            <p className="auth-subtitle">Join thousands of food lovers</p>
            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ marginBottom: 20 }}>
              <label className="form-label">I want to</label>
              <div className="role-selector">
                <div className={`role-option${role === 'customer' ? ' active' : ''}`}
                  onClick={() => setFormData({ ...formData, role: 'customer' })}>
                  <div className="role-option-icon">🍽️</div>
                  <div className="role-option-label">Order Food</div>
                </div>
                <div className={`role-option${role === 'restaurant_owner' ? ' active' : ''}`}
                  onClick={() => setFormData({ ...formData, role: 'restaurant_owner' })}>
                  <div className="role-option-icon">🏪</div>
                  <div className="role-option-label">Sell Food</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" name="name" className="form-control" value={name} onChange={handleChange} required placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" name="email" className="form-control" value={email} onChange={handleChange} required placeholder="your@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" name="password" className="form-control" value={password} onChange={handleChange} required minLength="6" placeholder="Minimum 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" name="confirmPassword" className="form-control" value={confirmPassword} onChange={handleChange} required placeholder="Re-enter password" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '13px' }} disabled={loading}>
                {loading ? '⏳ Sending OTP...' : '📧 Send Verification OTP'}
              </button>
            </form>
            <div className="auth-link">Already have an account? <Link to="/login">Sign In</Link></div>
          </>
        )}

        {/* ── Step 2: OTP ── */}
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

            <form onSubmit={handleVerifyOtp}>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
                {otp.map((d, i) => (
                  <input key={i} id={`otp-${i}`} type="text" inputMode="numeric"
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
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '13px' }} disabled={loading}>
                {loading ? '⏳ Verifying...' : '✅ Verify & Create Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
              {resendTimer > 0
                ? <span>Resend in <strong style={{ color: '#a5b4fc' }}>{resendTimer}s</strong></span>
                : <button onClick={handleResend} disabled={loading}
                    style={{ background: 'none', border: 'none', color: '#a5b4fc', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                    Resend OTP
                  </button>
              }
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setStep('form'); setError(''); setSuccess(''); setOtp(['','','','','','']); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                ← Back to registration
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Address (customers only) ── */}
        {step === 'address' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📍</div>
              <h2 style={{ marginBottom: 8 }}>Your Delivery Address</h2>
              <p className="auth-subtitle">
                Set your default address for fast checkout.<br />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>You can change this anytime from your profile.</span>
              </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSaveAddress}>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input type="tel" name="phone" className="form-control" value={address.phone}
                  onChange={handleAddressChange} required placeholder="9876543210" />
              </div>
              <div className="form-group">
                <label className="form-label">Street Address *</label>
                <input type="text" name="street" className="form-control" value={address.street}
                  onChange={handleAddressChange} required placeholder="123 Main Street, Apt 4B" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input type="text" name="city" className="form-control" value={address.city}
                    onChange={handleAddressChange} required placeholder="Chennai" />
                </div>
                <div className="form-group">
                  <label className="form-label">State *</label>
                  <input type="text" name="state" className="form-control" value={address.state}
                    onChange={handleAddressChange} required placeholder="Tamil Nadu" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">ZIP Code *</label>
                <input type="text" name="zipCode" className="form-control" value={address.zipCode}
                  onChange={handleAddressChange} required placeholder="600001" />
              </div>

              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', padding: '13px', marginTop: 4 }}
                disabled={addressLoading}>
                {addressLoading ? '⏳ Saving...' : '🏠 Save Address & Continue'}
              </button>
            </form>

            {/* Skip option */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => navigate('/')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline' }}>
                Skip for now, I'll add it later
              </button>
            </div>
          </>
        )}


        {/* ── Step 3: Restaurant Info (restaurant owners only) ── */}
        {step === 'restaurant_info' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🏪</div>
              <h2 style={{ marginBottom: 8 }}>Your Restaurant Details</h2>
              <p className="auth-subtitle">
                Add your contact info so customers can reach you.<br />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>You can update this anytime from your profile.</span>
              </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSaveRestaurantInfo}>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input type="tel" name="phone" className="form-control"
                  value={restaurantInfo.phone} onChange={handleRestaurantInfoChange}
                  required placeholder="9876543210" />
              </div>
              <div className="form-group">
                <label className="form-label">Street Address *</label>
                <input type="text" name="street" className="form-control"
                  value={restaurantInfo.street} onChange={handleRestaurantInfoChange}
                  required placeholder="123 Main Street" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input type="text" name="city" className="form-control"
                    value={restaurantInfo.city} onChange={handleRestaurantInfoChange}
                    required placeholder="Chennai" />
                </div>
                <div className="form-group">
                  <label className="form-label">State *</label>
                  <input type="text" name="state" className="form-control"
                    value={restaurantInfo.state} onChange={handleRestaurantInfoChange}
                    required placeholder="Tamil Nadu" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">ZIP Code *</label>
                <input type="text" name="zipCode" className="form-control"
                  value={restaurantInfo.zipCode} onChange={handleRestaurantInfoChange}
                  required placeholder="600001" />
              </div>

              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', padding: '13px', marginTop: 4 }}
                disabled={restaurantInfoLoading}>
                {restaurantInfoLoading ? '⏳ Saving...' : '🏪 Save & Go to Dashboard'}
              </button>
            </form>

            {/* Skip option */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => navigate('/dashboard')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline' }}>
                Skip for now, I'll add it later
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default Register;