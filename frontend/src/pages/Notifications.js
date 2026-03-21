import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TYPE_CFG = {
  orderStatusUpdate: { icon:'📦', color:'#1e40af', bg:'#eff6ff', border:'#93c5fd' },
  pointsEarned:      { icon:'⭐', color:'#92400e', bg:'#fffbeb', border:'#fde68a' },
  orderPlaced:       { icon:'🛒', color:'#065f46', bg:'#ecfdf5', border:'#6ee7b7' },
  promoCode:         { icon:'🎟️', color:'#5b21b6', bg:'#f5f3ff', border:'#c4b5fd' },
};

// Notifications stored in localStorage so they persist across page visits
const STORAGE_KEY = 'foodorder_notifications';

const loadNotifs = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const saveNotifs = (notifs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, 50))); // keep last 50
};

export const addNotification = (type, message, data = {}) => {
  const notifs = loadNotifs();
  // Deduplicate: for promo codes, use code as key; for others use type+orderId+status
  const dupKey = type === 'promoCode'
    ? 'promoCode_' + (data.code||'')
    : type + '_' + (data.orderId||'') + '_' + (data.status||data.total||'');
  // Promos: don't show same code twice ever; others: 5s window
  const isDup = type === 'promoCode'
    ? notifs.some(n => n.dedupKey === dupKey)
    : notifs.some(n => n.dedupKey === dupKey && Date.now() - new Date(n.time).getTime() < 5000);
  if (isDup) return;
  notifs.unshift({ id: Date.now(), dedupKey: dupKey, type, message, data, time: new Date().toISOString(), read: false });
  saveNotifs(notifs);
};

const Notifications = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [notifs, setNotifs] = useState(loadNotifs());

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
  }, [isAuthenticated, navigate]);

  // Poll localStorage every 2s so page stays fresh without a second socket connection
  // (socket events are already written by OrderDetail.js to avoid duplicates)
  useEffect(() => {
    const interval = setInterval(() => setNotifs(loadNotifs()), 2000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }));
    setNotifs(updated);
    saveNotifs(updated);
  };

  const clearAll = () => {
    if (!window.confirm('Clear all notifications?')) return;
    setNotifs([]);
    saveNotifs([]);
  };

  const markRead = (id) => {
    const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifs(updated);
    saveNotifs(updated);
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 700 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:800, letterSpacing:'-0.02em', color:'#1a202c' }}>
              🔔 Notifications
            </h1>
            <p style={{ margin:'4px 0 0', color:'#718096', fontSize:14 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="btn btn-outline btn-sm">✓ Mark all read</button>
            )}
            {notifs.length > 0 && (
              <button onClick={clearAll} className="btn btn-danger btn-sm">🗑️ Clear all</button>
            )}
          </div>
        </div>

        {notifs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <h3>No notifications yet</h3>
            <p>Order status updates, loyalty points and more will appear here.</p>
            <Link to="/restaurants" className="btn btn-primary">Start Ordering</Link>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {notifs.map(n => {
              const cfg = TYPE_CFG[n.type] || TYPE_CFG.orderStatusUpdate;
              return (
                <div key={n.id} onClick={() => markRead(n.id)}
                  style={{ background:'white', borderRadius:14, padding:'16px 20px', border:`1.5px solid ${n.read ? '#e2e6f0' : cfg.border}`, boxShadow: n.read ? '0 1px 4px rgba(26,26,46,0.05)' : '0 4px 16px rgba(26,26,46,0.1)', display:'flex', alignItems:'flex-start', gap:14, cursor:'pointer', transition:'all 0.15s', opacity: n.read ? 0.7 : 1 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:cfg.bg, border:`1px solid ${cfg.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight: n.read ? 500 : 700, color:'#1a202c', marginBottom:4, lineHeight:1.4 }}>{n.message}</div>
                    {n.data?.orderNumber && (
                      <div style={{ fontSize:12, color:'#667eea', fontWeight:600, marginBottom:4 }}>#{n.data.orderNumber}</div>
                    )}
                    {n.data?.total && (
                      <div style={{ fontSize:12, color:'#718096' }}>Total points: {n.data.total} pts · {n.data.tier} tier</div>
                    )}
                    {n.type === 'promoCode' && n.data?.code && (
                      <div style={{ marginTop:6 }}>
                        <span style={{ display:'inline-block', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', padding:'4px 16px', borderRadius:20, fontSize:13, fontWeight:900, letterSpacing:'0.08em' }}>
                          {n.data.code}
                        </span>
                        <span style={{ marginLeft:8, fontSize:12, color:'#5b21b6', fontWeight:700 }}>{n.data.discountText}</span>
                        {n.data.isDaily && <span style={{ marginLeft:6, fontSize:11, color:'#92400e', fontWeight:700 }}>⏰ Today only</span>}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:'#a0aec0', marginTop:4 }}>
                      {new Date(n.time).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#667eea', flexShrink:0, marginTop:4 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
