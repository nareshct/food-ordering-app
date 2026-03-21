import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';

const N = '#1a202c'; const S = '#718096'; const M = '#a0aec0';

// Defined outside Profile so React never remounts it on re-render (fixes focus loss)
const OtpInput = ({value, onChange}) => (
  <input type="text" className="form-control" placeholder="• • • • • •"
    value={value} onChange={onChange} maxLength={6}
    autoComplete="one-time-code"
    inputMode="numeric"
    style={{letterSpacing:'0.3em',fontSize:20,textAlign:'center',fontWeight:800}} />
);

const Profile = () => {
  const { user, updateProfile, loadUser } = useAuth();
  const [editing, setEditing]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [message, setMessage]           = useState({ type:'', text:'' });
  const [showPwd, setShowPwd]           = useState(false);
  const [pwdData, setPwdData]           = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [loyaltyData, setLoyaltyData]   = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [addresses, setAddresses]       = useState([]);
  const [showAddAddr, setShowAddAddr]   = useState(false);
  const [newAddr, setNewAddr]           = useState({ label:'', street:'', city:'', state:'', zipCode:'' });
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [showPhoneChange, setShowPhoneChange] = useState(false);
  const [emailData, setEmailData]       = useState({ newEmail:'', otp:'', step:'input' });
  const [phoneData, setPhoneData]       = useState({ phone:'', confirmPhone:'', otp:'', step:'input' });
  const [contactMsg, setContactMsg]     = useState({ type:'', text:'' });
  const [contactLoading, setContactLoading] = useState(false);

  // Refs for edit form — uncontrolled so typing is instant, no re-render per keystroke
  const nameRef   = useRef(null);
  const streetRef = useRef(null);
  const cityRef   = useRef(null);
  const stateRef  = useRef(null);
  const zipRef    = useRef(null);

  useEffect(() => {
    if (user) setLoyaltyData({ points: user.loyaltyPoints||0, tier: user.loyaltyTier||'Bronze', total: user.totalPointsEarned||0, history: user.pointsHistory||[] });
  }, [user]);

  useEffect(() => {
    const onFocus = () => { if (loadUser) loadUser(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadUser]);

  // ── Socket: instantly update loyalty points when order is delivered ──────────
  useEffect(() => {
    if (!user) return;
    let socket;
    try {
      const { io } = require('socket.io-client');
      const uid = user._id || user.id;
      socket = io(config.API_URL, { transports: ['websocket', 'polling'] });
      socket.on('connect', () => socket.emit('joinUserRoom', uid));
      socket.on('pointsEarned', (data) => {
        // Instantly update the displayed loyalty data — no API call needed
        setLoyaltyData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            points: data.total,
            tier:   data.tier || prev.tier,
            total:  (prev.total || 0) + data.points,
            history: [
              { points: data.points, description: data.message?.replace('🏆 ','') || 'Points earned', date: new Date().toISOString(), type: 'earned' },
              ...(prev.history || [])
            ]
          };
        });
        // Also refresh AuthContext so other pages stay in sync
        if (loadUser) loadUser();
      });
    } catch {}
    return () => { if (socket) socket.disconnect(); };
  }, [user, loadUser]);

  // ── Address book ────────────────────────────────────────────────────────────
  const saveAddresses = (list) => { localStorage.setItem('savedAddresses', JSON.stringify(list)); setAddresses(list); };

  useEffect(() => {
    if (!user) return;
    try {
      let list = JSON.parse(localStorage.getItem('savedAddresses') || '[]');

      // ── Deduplicate: keep only ONE isProfileDefault entry ────────────────────
      let seenDefault = false;
      list = list.filter(a => {
        if (a.isProfileDefault) {
          if (seenDefault) return false; // remove extra defaults
          seenDefault = true;
        }
        return true;
      });

      if (user.address?.street) {
        const defaultIdx = list.findIndex(a => a.isProfileDefault);
        if (defaultIdx >= 0) {
          // Sync the single default entry to the current profile address
          list[defaultIdx] = { ...list[defaultIdx], street:user.address.street, city:user.address.city, state:user.address.state||'', zipCode:user.address.zipCode||'' };
        } else {
          // No default yet — create one at the top
          list = [{ id:'default', label:'Home', street:user.address.street, city:user.address.city, state:user.address.state||'', zipCode:user.address.zipCode||'', isProfileDefault:true }, ...list];
        }
      }

      localStorage.setItem('savedAddresses', JSON.stringify(list));
      setAddresses(list);
    } catch { setAddresses([]); }
  }, [user]);

  const handleAddAddress = () => {
    if (!newAddr.label || !newAddr.street || !newAddr.city) { setMessage({ type:'error', text:'Label, street and city are required' }); return; }
    saveAddresses([...addresses, { ...newAddr, id: Date.now() }]);
    setNewAddr({ label:'', street:'', city:'', state:'', zipCode:'' });
    setShowAddAddr(false);
    setMessage({ type:'success', text:'Address saved!' });
  };

  const handleDeleteAddress = (id) => {
    if (!window.confirm('Remove this address?')) return;
    saveAddresses(addresses.filter(a => a.id !== id));
  };

  const handleSetDefault = async (addr) => {
    const result = await updateProfile({ address:{ street:addr.street, city:addr.city, state:addr.state, zipCode:addr.zipCode, country:'India' }, phone:user.phone });
    if (result.success) {
      const list = JSON.parse(localStorage.getItem('savedAddresses') || '[]');
      // Clear all isProfileDefault flags, then set only the chosen one by id
      saveAddresses(list.map(a => ({ ...a, isProfileDefault: a.id === addr.id })));
      await loadUser();
      setMessage({ type:'success', text:`"${addr.label}" set as default!` });
    }
  };

  // ── Edit profile — reads from refs, no re-render per keystroke ──────────────
  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true); setMessage({ type:'', text:'' });
    const name    = nameRef.current?.value   ?? '';
    const street  = streetRef.current?.value ?? '';
    const city    = cityRef.current?.value   ?? '';
    const state   = stateRef.current?.value  ?? '';
    const zipCode = zipRef.current?.value    ?? '';
    try {
      const result = await updateProfile({ name, address:{ street, city, state, zipCode, country: user.address?.country||'India' } });
      if (result.success) {
        // Update (or replace) the default address entry in localStorage
        const list = JSON.parse(localStorage.getItem('savedAddresses') || '[]');
        const hasDefault = list.some(a => a.isProfileDefault);
        if (hasDefault) {
          // Replace the existing default entry with the new address
          const updated = list.map(a => a.isProfileDefault
            ? { ...a, street, city, state, zipCode }
            : a
          );
          localStorage.setItem('savedAddresses', JSON.stringify(updated));
        } else if (street && city) {
          // No default yet — add one
          const newEntry = { id:'default', label:'Home', street, city, state, zipCode, isProfileDefault:true };
          localStorage.setItem('savedAddresses', JSON.stringify([newEntry, ...list]));
        }
        setMessage({ type:'success', text:'Profile updated!' }); setEditing(false); await loadUser();
      }
      else setMessage({ type:'error', text: result.message || 'Failed' });
    } catch { setMessage({ type:'error', text:'Failed to update' }); }
    finally { setLoading(false); }
  };

  // ── Password ────────────────────────────────────────────────────────────────
  const handlePwdChange  = e => setPwdData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePwdSubmit  = async e => {
    e.preventDefault(); setLoading(true); setMessage({ type:'', text:'' });
    if (pwdData.newPassword !== pwdData.confirmPassword) { setMessage({ type:'error', text:'Passwords do not match' }); setLoading(false); return; }
    if (pwdData.newPassword.length < 6) { setMessage({ type:'error', text:'Min 6 characters' }); setLoading(false); return; }
    try {
      const token = localStorage.getItem('token');
      await axios.put(config.getApiUrl(config.endpoints.auth + '/updatepassword'), { currentPassword:pwdData.currentPassword, newPassword:pwdData.newPassword }, { headers:{'Authorization':`Bearer ${token}`} });
      setMessage({ type:'success', text:'Password updated!' }); setPwdData({ currentPassword:'', newPassword:'', confirmPassword:'' }); setShowPwd(false);
    } catch (err) { setMessage({ type:'error', text: err.response?.data?.message || 'Failed' }); }
    finally { setLoading(false); }
  };

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingAvatar(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData(); fd.append('image', file);
      const res = await axios.post(config.getApiUrl('/api/upload/avatar'), fd, { headers:{'Authorization':`Bearer ${token}`,'Content-Type':'multipart/form-data'} });
      await updateProfile({ avatar: res.data.imageUrl }); await loadUser();
      setMessage({ type:'success', text:'Profile photo updated!' });
    } catch (err) { setMessage({ type:'error', text:'Upload failed: ' + (err.response?.data?.message || err.message) }); }
    finally { setUploadingAvatar(false); }
  };

  // ── Email change (OTP to new email) ─────────────────────────────────────────
  const handleSendEmailOtp = async () => {
    const re = /\S+@\S+\.\S+/;
    if (!emailData.newEmail || !re.test(emailData.newEmail)) { setContactMsg({type:'error',text:'Enter a valid email address'}); return; }
    setContactLoading(true); setContactMsg({type:'',text:''});
    try {
      const token = localStorage.getItem('token');
      await axios.post(config.getApiUrl('/api/users/send-email-otp'), { newEmail:emailData.newEmail }, { headers:{'Authorization':`Bearer ${token}`} });
      setEmailData(p => ({...p, step:'verify'}));
      setContactMsg({type:'success', text:`OTP sent to ${emailData.newEmail} — check your new inbox`});
    } catch (err) { setContactMsg({type:'error', text:err.response?.data?.message||'Failed to send OTP'}); }
    finally { setContactLoading(false); }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailData.otp.length < 6) { setContactMsg({type:'error',text:'Enter the 6-digit OTP'}); return; }
    setContactLoading(true); setContactMsg({type:'',text:''});
    try {
      const token = localStorage.getItem('token');
      await axios.put(config.getApiUrl('/api/users/update-email'), { otp:emailData.otp }, { headers:{'Authorization':`Bearer ${token}`} });
      setContactMsg({type:'success',text:'Email updated! Please log in again with your new email.'});
      setEmailData({newEmail:'',otp:'',step:'input'}); setShowEmailChange(false); await loadUser();
    } catch (err) { setContactMsg({type:'error',text:err.response?.data?.message||'Incorrect OTP'}); }
    finally { setContactLoading(false); }
  };

  // ── Phone change (OTP to current email) ─────────────────────────────────────
  const handleSendPhoneOtp = async () => {
    if (phoneData.phone.length < 10) { setContactMsg({type:'error',text:'Enter a valid 10-digit phone number'}); return; }
    if (phoneData.phone !== phoneData.confirmPhone) { setContactMsg({type:'error',text:'Phone numbers do not match'}); return; }
    if (phoneData.phone === user.phone) { setContactMsg({type:'error',text:'New number is the same as your current number'}); return; }
    setContactLoading(true); setContactMsg({type:'',text:''});
    try {
      const token = localStorage.getItem('token');
      await axios.post(config.getApiUrl('/api/users/verify-phone'), { phone:phoneData.phone }, { headers:{'Authorization':`Bearer ${token}`} });
      setPhoneData(p => ({...p, step:'verify'}));
      setContactMsg({type:'success',text:`OTP sent to ${user.email}`});
    } catch (err) { setContactMsg({type:'error',text:err.response?.data?.message||'Failed to send OTP'}); }
    finally { setContactLoading(false); }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneData.otp.length < 6) { setContactMsg({type:'error',text:'Enter the 6-digit OTP'}); return; }
    setContactLoading(true); setContactMsg({type:'',text:''});
    try {
      const token = localStorage.getItem('token');
      await axios.put(config.getApiUrl('/api/users/verify-phone'), { otp:phoneData.otp }, { headers:{'Authorization':`Bearer ${token}`} });
      setContactMsg({type:'success',text:'Phone number updated successfully!'});
      setPhoneData({phone:'',confirmPhone:'',otp:'',step:'input'}); setShowPhoneChange(false); await loadUser();
    } catch (err) { setContactMsg({type:'error',text:err.response?.data?.message||'Incorrect OTP'}); }
    finally { setContactLoading(false); }
  };

  if (!user) return <div className="page-wrapper" style={{textAlign:'center',paddingTop:160}}><div className="spinner"/></div>;

  const initials  = user.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?';
  const roleLabel = { customer:'👤 Customer', restaurant_owner:'🏪 Restaurant Owner', admin:'👨‍💼 Admin' };
  const TIER_STYLE = {
    Bronze:   {bg:'#fef3c7',color:'#92400e',border:'#fde68a',icon:'🥉'},
    Silver:   {bg:'#f1f5f9',color:'#475569',border:'#cbd5e1',icon:'🥈'},
    Gold:     {bg:'#fffbeb',color:'#b45309',border:'#fcd34d',icon:'🥇'},
    Platinum: {bg:'#f5f3ff',color:'#5b21b6',border:'#c4b5fd',icon:'💎'},
  };
  const card = { background:'white', borderRadius:16, boxShadow:'0 2px 8px rgba(26,26,46,0.07)', border:'1px solid #e2e6f0', overflow:'hidden', marginBottom:16 };
  const Field = ({label,value}) => (
    <div>
      <div style={{fontSize:11,fontWeight:700,color:M,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>{label}</div>
      <div style={{fontSize:15,color:value?N:M,fontStyle:value?'normal':'italic'}}>{value||'Not provided'}</div>
    </div>
  );


  return (
    <div className="page-wrapper">
      <div className="container" style={{maxWidth:760}}>
        <div style={{marginBottom:24}}>
          <h1 style={{margin:0,fontSize:28,fontWeight:800,letterSpacing:'-0.02em',color:N}}>My Profile</h1>
          <p style={{margin:'4px 0 0',color:S,fontSize:14}}>Manage your account information</p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type==='success'?'success':'error'}`} style={{marginBottom:20}}>
            {message.type==='success'?'✅':'❌'} {message.text}
          </div>
        )}

        {/* ── Profile card ── */}
        <div style={card}>
          {/* Header */}
          <div style={{background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',padding:'32px 28px',display:'flex',alignItems:'center',gap:20,flexWrap:'wrap',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 80% 50%,rgba(102,126,234,0.2) 0%,transparent 60%)',pointerEvents:'none'}}/>
            <label style={{width:76,height:76,borderRadius:'50%',overflow:'hidden',border:'3px solid rgba(255,255,255,0.3)',cursor:'pointer',flexShrink:0,position:'relative',zIndex:1,display:'block'}} title="Click to change photo">
              {user.avatar
                ? <img src={user.avatar} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#667eea,#764ba2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:800,color:'white'}}>{initials}</div>
              }
              <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.2s',borderRadius:'50%'}}
                onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                <span style={{color:'white',fontSize:20}}>{uploadingAvatar?'⏳':'📷'}</span>
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{display:'none'}} disabled={uploadingAvatar}/>
            </label>
            <div style={{position:'relative',zIndex:1}}>
              <div style={{color:'white',fontSize:22,fontWeight:800,letterSpacing:'-0.02em'}}>{user.name}</div>
              <div style={{color:'rgba(255,255,255,0.55)',fontSize:14,marginTop:2}}>{user.email}</div>
              <div style={{marginTop:10}}>
                <span style={{background:'rgba(255,107,53,0.2)',color:'#ff6b35',border:'1px solid rgba(255,107,53,0.3)',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700}}>
                  {roleLabel[user.role]||user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{padding:'24px 28px'}}>
            {!editing ? (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px 28px',marginBottom:20}}>
                  <Field label="Full Name"    value={user.name}/>
                  <Field label="Email"        value={user.email}/>
                  <Field label="Phone"        value={user.phone}/>
                  <Field label="Member Since" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : null}/>
                </div>
                <div style={{borderTop:'1px solid #f0f2f8',paddingTop:20,marginBottom:24}}>
                  <div style={{fontSize:11,fontWeight:700,color:M,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>📍 Delivery Address</div>
                  {user.address?.street
                    ? <div style={{fontSize:15,color:N,lineHeight:1.7}}>{user.address.street}<br/>{[user.address.city,user.address.state,user.address.zipCode].filter(Boolean).join(', ')}<br/>{user.address.country}</div>
                    : <div style={{fontSize:15,color:M,fontStyle:'italic'}}>No address provided</div>
                  }
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>setEditing(true)} className="btn btn-primary">✏️ Edit Profile</button>
                  <button onClick={()=>setShowPwd(!showPwd)} className="btn btn-outline">🔒 Change Password</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-control" ref={nameRef} defaultValue={user.name||''} required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Street Address</label>
                  <input type="text" className="form-control" ref={streetRef} defaultValue={user.address?.street||''} placeholder="123 Main Street"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input type="text" className="form-control" ref={cityRef} defaultValue={user.address?.city||''} placeholder="Chennai"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" className="form-control" ref={stateRef} defaultValue={user.address?.state||''} placeholder="Tamil Nadu"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP Code</label>
                    <input type="text" className="form-control" ref={zipRef} defaultValue={user.address?.zipCode||''} placeholder="600001"/>
                  </div>
                </div>
                <div style={{display:'flex',gap:10,marginTop:8}}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Saving...':'✓ Save Changes'}</button>
                  <button type="button" className="btn btn-outline" onClick={()=>{setEditing(false);setMessage({type:'',text:''});}}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Change Password ── */}
        {showPwd && (
          <div style={card}>
            <div style={{padding:'24px 28px'}}>
              <h3 style={{margin:'0 0 20px',fontSize:18,fontWeight:700,color:N}}>🔒 Change Password</h3>
              <form onSubmit={handlePwdSubmit}>
                <div className="form-group"><label className="form-label">Current Password *</label><input type="password" name="currentPassword" className="form-control" value={pwdData.currentPassword} onChange={handlePwdChange} required/></div>
                <div className="form-group"><label className="form-label">New Password *</label><input type="password" name="newPassword" className="form-control" value={pwdData.newPassword} onChange={handlePwdChange} required minLength="6"/><small style={{color:M,fontSize:12}}>Minimum 6 characters</small></div>
                <div className="form-group"><label className="form-label">Confirm Password *</label><input type="password" name="confirmPassword" className="form-control" value={pwdData.confirmPassword} onChange={handlePwdChange} required/></div>
                <div style={{display:'flex',gap:10,marginTop:8}}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Updating...':'✓ Update Password'}</button>
                  <button type="button" className="btn btn-outline" onClick={()=>{setShowPwd(false);setPwdData({currentPassword:'',newPassword:'',confirmPassword:''});setMessage({type:'',text:''});}}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Loyalty Points ── */}
        {user.role === 'customer' && loyaltyData && (() => {
          const ts = TIER_STYLE[loyaltyData.tier] || TIER_STYLE.Bronze;
          const tiers = [['Bronze',0],['Silver',500],['Gold',1500],['Platinum',5000]];
          const curIdx = tiers.findIndex(([t]) => t === loyaltyData.tier);
          const next = tiers[curIdx + 1];
          return (
            <div style={card}>
              <div style={{padding:'24px 28px'}}>
                <h3 style={{margin:'0 0 20px',fontSize:18,fontWeight:700,color:N}}>🏆 Loyalty Points</h3>
                <div style={{background:ts.bg,border:`1.5px solid ${ts.border}`,borderRadius:14,padding:'18px 22px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                  <div>
                    <div style={{fontSize:13,color:ts.color,fontWeight:700,marginBottom:4}}>{ts.icon} {loyaltyData.tier} Member</div>
                    <div style={{fontSize:32,fontWeight:900,color:ts.color,letterSpacing:'-0.02em'}}>{loyaltyData.points} pts</div>
                    <div style={{fontSize:13,color:ts.color,opacity:0.7,marginTop:4}}>= ₹{(loyaltyData.points*0.1).toFixed(0)} discount available</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:12,color:ts.color,opacity:0.7}}>Lifetime earned</div>
                    <div style={{fontSize:20,fontWeight:800,color:ts.color}}>{loyaltyData.total} pts</div>
                  </div>
                </div>
                {next ? (() => {
                  const pct = Math.min(((loyaltyData.total - tiers[curIdx][1]) / (next[1] - tiers[curIdx][1])) * 100, 100);
                  return (
                    <div style={{marginBottom:20}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:600,color:S,marginBottom:6}}>
                        <span>{loyaltyData.tier}</span><span>{next[0]} ({next[1]-loyaltyData.total} pts away)</span>
                      </div>
                      <div style={{height:8,background:'#e2e6f0',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#667eea,#764ba2)',borderRadius:4,transition:'width 0.4s'}}/>
                      </div>
                    </div>
                  );
                })() : <div style={{fontSize:13,color:'#5b21b6',fontWeight:700,textAlign:'center',padding:10,background:'#f5f3ff',borderRadius:8,marginBottom:20}}>💎 You've reached the highest tier!</div>}
                <div style={{background:'#f7f8fc',borderRadius:10,padding:'14px 16px',marginBottom:loyaltyData.history.length?20:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:M,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>How it works</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {[['💰 Earn','₹10 spent = 1 point'],['🎁 Redeem','100 pts = ₹10 off'],['🥉 Silver','500 pts'],['🥇 Gold','1500 pts']].map(([l,v])=>(
                      <div key={l} style={{fontSize:13,color:N}}><span style={{fontWeight:700}}>{l}:</span> {v}</div>
                    ))}
                  </div>
                </div>
                {loyaltyData.history.length > 0 && (
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:M,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Recent Activity</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:200,overflowY:'auto'}}>
                      {[...loyaltyData.history].reverse().slice(0,8).map((h,i)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,padding:'10px 12px',background:h.action==='earned'?'#ecfdf5':'#fff7ed',borderRadius:8,border:`1px solid ${h.action==='earned'?'#6ee7b7':'#fdba74'}`}}>
                          <span style={{color:'#4a5568'}}>{h.description}</span>
                          <span style={{fontWeight:800,color:h.action==='earned'?'#065f46':'#9a3412'}}>{h.action==='earned'?'+':''}{h.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Contact Details ── */}
        {['customer','restaurant_owner'].includes(user.role) && (
          <div style={card}>
            <div style={{padding:'20px 28px',borderBottom:'1px solid #f0f2f8'}}>
              <h3 style={{margin:0,fontSize:18,fontWeight:700,color:N}}>📧 Contact Details</h3>
              <p style={{margin:'4px 0 0',fontSize:13,color:S}}>Email and phone changes require OTP verification</p>
            </div>
            <div style={{padding:'16px 28px'}}>
              {contactMsg.text && (
                <div style={{padding:'10px 14px',borderRadius:10,marginBottom:14,background:contactMsg.type==='success'?'#ecfdf5':'#fef2f2',border:`1px solid ${contactMsg.type==='success'?'#6ee7b7':'#fca5a5'}`,color:contactMsg.type==='success'?'#065f46':'#991b1b',fontSize:13,fontWeight:600}}>
                  {contactMsg.type==='success'?'✅':'❌'} {contactMsg.text}
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
                <div style={{background:'#f7f8fc',borderRadius:12,padding:'14px 16px',border:'1px solid #e2e6f0'}}>
                  <div style={{fontSize:11,fontWeight:700,color:M,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Email Address</div>
                  <div style={{fontSize:14,fontWeight:700,color:N,marginBottom:10,wordBreak:'break-all'}}>{user.email}</div>
                  <button onClick={()=>{setShowEmailChange(!showEmailChange);setShowPhoneChange(false);setContactMsg({type:'',text:''});setEmailData({newEmail:'',otp:'',step:'input'});}} className="btn btn-outline btn-sm">✏️ Change</button>
                </div>
                <div style={{background:'#f7f8fc',borderRadius:12,padding:'14px 16px',border:'1px solid #e2e6f0'}}>
                  <div style={{fontSize:11,fontWeight:700,color:M,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Phone Number</div>
                  <div style={{fontSize:14,fontWeight:700,color:N,marginBottom:10}}>{user.phone||<span style={{color:M,fontStyle:'italic'}}>Not set</span>}</div>
                  <button onClick={()=>{setShowPhoneChange(!showPhoneChange);setShowEmailChange(false);setContactMsg({type:'',text:''});setPhoneData({phone:'',confirmPhone:'',otp:'',step:'input'});}} className="btn btn-outline btn-sm">✏️ Change</button>
                </div>
              </div>

              {showEmailChange && (
                <div style={{background:'#f7f8fc',borderRadius:12,padding:'18px',border:'1px solid #e2e6f0',marginBottom:12}}>
                  <div style={{fontWeight:700,fontSize:15,color:N,marginBottom:14}}>✉️ Change Email Address</div>
                  {emailData.step === 'input' ? (
                    <>
                      <div className="form-group">
                        <label className="form-label">New Email Address *</label>
                        <input type="email" className="form-control" placeholder="new@example.com" value={emailData.newEmail} onChange={e=>setEmailData(p=>({...p,newEmail:e.target.value}))}/>
                      </div>
                      <div style={{fontSize:12,color:'#92400e',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'9px 12px',marginBottom:12}}>
                        📧 OTP will be sent to <strong>{emailData.newEmail||'your new email'}</strong> to verify you own it.
                      </div>
                      <div style={{display:'flex',gap:10}}>
                        <button className="btn btn-primary" onClick={handleSendEmailOtp} disabled={contactLoading||!emailData.newEmail}>{contactLoading?'Sending...':'📤 Send OTP'}</button>
                        <button className="btn btn-outline" onClick={()=>{setShowEmailChange(false);setContactMsg({type:'',text:''});}}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{background:'#ecfdf5',borderRadius:10,padding:'12px 16px',marginBottom:14,border:'1px solid #6ee7b7',fontSize:13,color:'#065f46'}}>
                        ✅ OTP sent to <strong>{emailData.newEmail}</strong> — enter the code to confirm
                      </div>
                      <div className="form-group">
                        <label className="form-label">Enter 6-digit OTP *</label>
                        <OtpInput value={emailData.otp} onChange={e=>setEmailData(p=>({...p,otp:e.target.value.replace(/[^0-9]/g,'')}))}/>
                      </div>
                      <div style={{display:'flex',gap:10}}>
                        <button className="btn btn-primary" onClick={handleVerifyEmailOtp} disabled={contactLoading||emailData.otp.length<6}>{contactLoading?'Verifying...':'✓ Verify & Update'}</button>
                        <button className="btn btn-outline" onClick={()=>setEmailData(p=>({...p,step:'input',otp:''}))}>← Resend OTP</button>
                        <button className="btn btn-outline" onClick={()=>{setShowEmailChange(false);setContactMsg({type:'',text:''});}}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {showPhoneChange && (
                <div style={{background:'#f7f8fc',borderRadius:12,padding:'18px',border:'1px solid #e2e6f0'}}>
                  <div style={{fontWeight:700,fontSize:15,color:N,marginBottom:14}}>📱 Change Phone Number</div>
                  {phoneData.step === 'input' ? (
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label className="form-label">New Phone Number *</label>
                          <input type="tel" className="form-control" placeholder="10-digit number" value={phoneData.phone} onChange={e=>setPhoneData(p=>({...p,phone:e.target.value.replace(/[^0-9]/g,'')}))} maxLength={10}/>
                        </div>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label className="form-label">Confirm Phone Number *</label>
                          <input type="tel" className="form-control" placeholder="Re-enter to confirm" value={phoneData.confirmPhone}
                            onChange={e=>setPhoneData(p=>({...p,confirmPhone:e.target.value.replace(/[^0-9]/g,'')}))}
                            maxLength={10} style={{borderColor:phoneData.confirmPhone.length>0?(phoneData.confirmPhone===phoneData.phone?'#10b981':'#ef4444'):'',outline:'none'}}/>
                          {phoneData.confirmPhone.length>0 && phoneData.confirmPhone!==phoneData.phone && <div style={{fontSize:11,color:'#ef4444',marginTop:4,fontWeight:600}}>⚠️ Numbers don't match</div>}
                          {phoneData.confirmPhone.length===10 && phoneData.confirmPhone===phoneData.phone && <div style={{fontSize:11,color:'#10b981',marginTop:4,fontWeight:600}}>✅ Numbers match</div>}
                        </div>
                      </div>
                      <div style={{fontSize:12,color:S,marginBottom:12,background:'#eff6ff',borderRadius:8,padding:'9px 12px',border:'1px solid #bfdbfe'}}>
                        📧 OTP will be sent to <strong>{user.email}</strong> to verify this change.<br/>
                        ⚠️ Double-check — wrong numbers can't receive delivery updates.
                      </div>
                      <div style={{display:'flex',gap:10}}>
                        <button className="btn btn-primary" onClick={handleSendPhoneOtp} disabled={contactLoading||phoneData.phone.length<10||phoneData.confirmPhone!==phoneData.phone}>{contactLoading?'Sending OTP...':'📤 Send OTP'}</button>
                        <button className="btn btn-outline" onClick={()=>{setShowPhoneChange(false);setContactMsg({type:'',text:''});}}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{background:'#ecfdf5',borderRadius:10,padding:'12px 16px',marginBottom:14,border:'1px solid #6ee7b7',fontSize:13,color:'#065f46'}}>
                        ✅ OTP sent to <strong>{user.email}</strong> — verifying <strong>{phoneData.phone}</strong>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Enter 6-digit OTP *</label>
                        <OtpInput value={phoneData.otp} onChange={e=>setPhoneData(p=>({...p,otp:e.target.value.replace(/[^0-9]/g,'')}))}/>
                      </div>
                      <div style={{display:'flex',gap:10}}>
                        <button className="btn btn-primary" onClick={handleVerifyPhoneOtp} disabled={contactLoading||phoneData.otp.length<6}>{contactLoading?'Verifying...':'✓ Verify & Update'}</button>
                        <button className="btn btn-outline" onClick={()=>setPhoneData(p=>({...p,step:'input',otp:'',confirmPhone:''}))}>← Resend OTP</button>
                        <button className="btn btn-outline" onClick={()=>{setShowPhoneChange(false);setContactMsg({type:'',text:''});}}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Address Book ── */}
        {user.role === 'customer' && (
          <div style={card}>
            <div style={{padding:'20px 28px',borderBottom:'1px solid #f0f2f8',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{margin:0,fontSize:18,fontWeight:700,color:N}}>📍 Address Book</h3>
              <button onClick={()=>setShowAddAddr(!showAddAddr)} className="btn btn-primary btn-sm">+ Add Address</button>
            </div>
            <div style={{padding:'16px 28px'}}>
              {showAddAddr && (
                <div style={{background:'#f7f8fc',borderRadius:12,padding:'18px',marginBottom:16,border:'1px solid #e2e6f0'}}>
                  <div style={{fontWeight:700,fontSize:14,color:N,marginBottom:14}}>New Address</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Label *</label><input type="text" className="form-control" placeholder='"Home", "Office"' value={newAddr.label} onChange={e=>setNewAddr(p=>({...p,label:e.target.value}))}/></div>
                    <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Street *</label><input type="text" className="form-control" placeholder="123 Main St" value={newAddr.street} onChange={e=>setNewAddr(p=>({...p,street:e.target.value}))}/></div>
                    <div className="form-group"><label className="form-label">City *</label><input type="text" className="form-control" placeholder="Chennai" value={newAddr.city} onChange={e=>setNewAddr(p=>({...p,city:e.target.value}))}/></div>
                    <div className="form-group"><label className="form-label">State</label><input type="text" className="form-control" placeholder="Tamil Nadu" value={newAddr.state} onChange={e=>setNewAddr(p=>({...p,state:e.target.value}))}/></div>
                    <div className="form-group"><label className="form-label">ZIP</label><input type="text" className="form-control" placeholder="600001" value={newAddr.zipCode} onChange={e=>setNewAddr(p=>({...p,zipCode:e.target.value}))}/></div>
                  </div>
                  <div style={{display:'flex',gap:10,marginTop:8}}>
                    <button className="btn btn-primary" onClick={handleAddAddress}>✓ Save Address</button>
                    <button className="btn btn-outline" onClick={()=>{setShowAddAddr(false);setNewAddr({label:'',street:'',city:'',state:'',zipCode:''});}}>Cancel</button>
                  </div>
                </div>
              )}
              {addresses.length === 0 && !showAddAddr ? (
                <div style={{textAlign:'center',padding:'24px',color:M}}>No saved addresses yet. Add one above!</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {addresses.map(addr => {
                    const isDef = user.address?.street === addr.street && user.address?.city === addr.city;
                    return (
                      <div key={addr.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',background:isDef?'rgba(102,126,234,0.06)':'#f7f8fc',borderRadius:12,border:`1.5px solid ${isDef?'#667eea':'#e2e6f0'}`}}>
                        <div style={{fontSize:22}}>📍</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:14,color:N,display:'flex',alignItems:'center',gap:8}}>
                            {addr.label}
                            {isDef && <span style={{background:'rgba(102,126,234,0.15)',color:'#667eea',padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700}}>Default</span>}
                          </div>
                          <div style={{fontSize:13,color:S,marginTop:2}}>{addr.street}, {addr.city}{addr.state?', '+addr.state:''}{addr.zipCode?' '+addr.zipCode:''}</div>
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          {!isDef && <button className="btn btn-outline btn-sm" onClick={()=>handleSetDefault(addr)}>Set Default</button>}
                          <button onClick={()=>handleDeleteAddress(addr.id)} style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Profile;