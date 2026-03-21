import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import config from '../config';

const sendPushNotif = (title, body) => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  } catch {}
};

const STATUS_STEPS = [
  { label: 'Order Placed',     icon: '📝', key: 'Pending' },
  { label: 'Confirmed',        icon: '✅', key: 'Confirmed' },
  { label: 'Preparing',        icon: '👨‍🍳', key: 'Preparing' },
  { label: 'Ready',            icon: '📦', key: 'Ready' },
  { label: 'Out for Delivery', icon: '🚚', key: 'Out for Delivery' },
  { label: 'Delivered',        icon: '🎉', key: 'Delivered' }
];

const STEP_INDEX = {
  'Pending': 0, 'Confirmed': 1, 'Preparing': 2,
  'Ready': 3, 'Out for Delivery': 4, 'Delivered': 5, 'Cancelled': -1
};

const STATUS_ICON = {
  'Pending':'⏳','Confirmed':'✅','Preparing':'👨‍🍳',
  'Ready':'📦','Out for Delivery':'🚚','Delivered':'🎉','Cancelled':'❌'
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [order, setOrder]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [liveToast, setLiveToast] = useState('');
  const [pointsToast, setPointsToast] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (user && user.role !== 'customer') { navigate('/dashboard'); return; }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (location.state?.orderPlaced) clearCart();
  }, [location.state, clearCart]);

  const fetchOrder = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${config.getApiUrl(config.endpoints.orders)}/${id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setOrder(res.data.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load order details');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, []);

  // ── Real-time socket connection ───────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) return;

    // Dynamically import socket.io-client to avoid build errors if not installed
    let socket;
    try {
      const { io } = require('socket.io-client');
      socket = io(config.API_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      // OrderDetail joins the order room (for live status tracking)
      // AND the user room (for pointsEarned only).
      // orderStatusUpdate from user_ room is intentionally ignored here —
      // it already arrives via order_ room, avoiding the duplicate.
      socket.on('connect', () => {
        socket.emit('joinOrderRoom', id);
        const uid = user._id || user.id;
        socket.emit('joinUserRoom', uid);
      });

      // Track recently processed status updates to suppress the duplicate
      // that arrives from the user_ room (backend emits to both rooms).
      const recentlyProcessed = new Set();

      // Live order status update
      socket.on('orderStatusUpdate', (data) => {
        if (data.orderId === id || data.orderId?.toString() === id) {
          // Build a key: orderId + status. If we processed this within 2s, skip.
          const dedupKey = `${data.orderId}_${data.status}`;
          if (recentlyProcessed.has(dedupKey)) return;
          recentlyProcessed.add(dedupKey);
          setTimeout(() => recentlyProcessed.delete(dedupKey), 2000);

          setOrder(prev => prev ? { ...prev, status: data.status } : prev);
          setLiveToast(data.message);
          setTimeout(() => setLiveToast(''), 5000);
          fetchOrder();
          sendPushNotif('🍔 Order Update', data.message);
          // Save to notification history
          try {
            const notifs = JSON.parse(localStorage.getItem('foodorder_notifications') || '[]');
            notifs.unshift({ id: Date.now(), type:'orderStatusUpdate', message:data.message, data, time:new Date().toISOString(), read:false });
            localStorage.setItem('foodorder_notifications', JSON.stringify(notifs.slice(0,50)));
          } catch {}
        }
      });

      // Points earned — only show toast here; Orders.js writes the notification
      socket.on('pointsEarned', (data) => {
        setPointsToast(`🏆 ${data.message} Total: ${data.total} pts (${data.tier} tier)`);
        sendPushNotif('🏆 Loyalty Points Earned!', data.message);
        setTimeout(() => setPointsToast(''), 7000);
        // Save pointsEarned notification (not a duplicate of orderStatusUpdate)
        try {
          const notifs = JSON.parse(localStorage.getItem('foodorder_notifications') || '[]');
          const isDuplicate = notifs.some(n =>
            n.type === 'pointsEarned' &&
            n.data?.points === data.points &&
            Date.now() - new Date(n.time).getTime() < 5000
          );
          if (!isDuplicate) {
            notifs.unshift({ id: Date.now(), type:'pointsEarned', message:data.message, data, time:new Date().toISOString(), read:false });
            localStorage.setItem('foodorder_notifications', JSON.stringify(notifs.slice(0,50)));
          }
        } catch {}
      });

      // Promo code notification — save to notification history
      socket.on('promoNotification', (data) => {
        try {
          const notifs = JSON.parse(localStorage.getItem('foodorder_notifications') || '[]');
          const dupKey = 'promoCode_' + (data.code||'');
          const isDup = notifs.some(n => n.dedupKey === dupKey);
          if (!isDup) {
            notifs.unshift({ id:Date.now(), dedupKey:dupKey, type:'promoCode', message:data.message, data, time:new Date().toISOString(), read:false });
            localStorage.setItem('foodorder_notifications', JSON.stringify(notifs.slice(0,50)));
          }
        } catch {}
      });

    } catch (e) {
      // socket.io-client not installed yet — polling fallback
      console.warn('Socket.io not available, using polling');
      const interval = setInterval(fetchOrder, 15000);
      return () => clearInterval(interval);
    }

    return () => { if (socket) socket.disconnect(); };
  }, [id, user, fetchOrder]);

  // ── Cancel order ──────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm(`Cancel order #${order.orderNumber}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${config.getApiUrl(config.endpoints.orders)}/${order._id}/cancel`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      fetchOrder();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f0f2f8', paddingTop: 88, textAlign: 'center' }}>
      <div className="spinner" style={{ margin: '80px auto' }} />
      <p style={{ color: '#718096' }}>Loading order details...</p>
    </div>
  );

  if (error || !order) return (
    <div style={{ minHeight: '100vh', background: '#f0f2f8', paddingTop: 120, textAlign: 'center' }}>
      <div style={{ fontSize: 60, marginBottom: 20 }}>😕</div>
      <h2 style={{ color: '#1a202c' }}>Order Not Found</h2>
      <p style={{ color: '#718096', marginBottom: 20 }}>{error}</p>
      <button onClick={() => navigate('/orders')} className="btn btn-primary">Back to Orders</button>
    </div>
  );

  const currentStep = STEP_INDEX[order.status] ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f8', paddingTop: 88, paddingBottom: 60 }}>

      {/* ── Live status toast ── */}
      {liveToast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', color: 'white', padding: '14px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600, maxWidth: 340, display: 'flex', alignItems: 'center', gap: 10, animation: 'slideIn 0.3s ease' }}>
          🔔 {liveToast}
          <button onClick={() => setLiveToast('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginLeft: 'auto', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
        </div>
      )}

      {/* ── Points toast ── */}
      {pointsToast && (
        <div style={{ position: 'fixed', top: liveToast ? 138 : 80, right: 24, zIndex: 9999, background: 'linear-gradient(135deg,#ff6b35,#ff9256)', color: 'white', padding: '14px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(255,107,53,0.4)', fontSize: 14, fontWeight: 600, maxWidth: 360, display: 'flex', alignItems: 'center', gap: 10 }}>
          ⭐ {pointsToast}
          <button onClick={() => setPointsToast('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', marginLeft: 'auto', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
        </div>
      )}

      <div className="container" style={{ maxWidth: 1000 }}>

        {/* Back */}
        <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 15, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          ← Back to Orders
        </button>

        {/* Header band */}
        <div style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', borderRadius: 16, padding: '28px 32px', color: 'white', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(102,126,234,0.2) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Order</div>
              <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800 }}>#{order.orderNumber}</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 4 }}>🍽️ {order.restaurant?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 700, border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{STATUS_ICON[order.status]}</span> {order.status}
              </div>
              {!['Delivered', 'Cancelled'].includes(order.status) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
                  Live tracking active
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tracking timeline ── */}
        {order.status !== 'Cancelled' && (
          <div style={{ background: 'white', borderRadius: 16, padding: '28px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0' }}>
            <h3 style={{ margin: '0 0 28px', fontSize: 16, fontWeight: 800, color: '#1a202c' }}>📍 Real-Time Order Tracking</h3>

            <div style={{ position: 'relative' }}>
              {/* Progress bar */}
              <div style={{ position: 'absolute', top: 21, left: 20, right: 20, height: 3, background: '#e2e6f0', zIndex: 0, borderRadius: 3 }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#667eea,#764ba2)', width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`, transition: 'width 0.6s ease', borderRadius: 3 }} />
              </div>
              {/* Steps */}
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= currentStep;
                  const cur  = i === currentStep;
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: done ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#e2e6f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10, transition: 'all 0.4s', transform: cur ? 'scale(1.2)' : 'scale(1)', boxShadow: cur ? '0 0 0 6px rgba(102,126,234,0.15)' : 'none' }}>
                        {step.icon}
                      </div>
                      <div style={{ fontSize: 11, textAlign: 'center', color: done ? '#1a202c' : '#a0aec0', fontWeight: cur ? 700 : 400, maxWidth: 74, lineHeight: 1.3 }}>
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Estimated / Scheduled time */}
            {order.estimatedDeliveryTime && order.status !== 'Delivered' && (() => {
              const now    = new Date();
              const eta    = new Date(order.estimatedDeliveryTime);
              const minsLeft = Math.max(0, Math.round((eta - now) / 60000));
              const isScheduled = !!order.scheduledTime;
              return (
                <div style={{ marginTop: 24, padding: '16px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #6ee7b7' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize: 13, color: '#065f46', fontWeight: 700 }}>
                      {isScheduled ? '📅 Scheduled Delivery' : '⏰ Estimated Delivery'}
                    </div>
                    <div style={{ fontSize: 22, color: '#065f46', fontWeight: 900, marginTop: 4 }}>
                      {isScheduled
                        ? new Date(order.scheduledTime).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })
                        : new Date(order.estimatedDeliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      }
                    </div>
                    {!isScheduled && minsLeft > 0 && (
                      <div style={{ fontSize: 13, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                        ~{minsLeft} min away
                      </div>
                    )}
                  </div>
                  {/* ETA breakdown */}
                  {!isScheduled && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #a7f3d0', display:'flex', justifyContent:'center', gap:16, flexWrap:'wrap' }}>
                      {(() => {
                        const totalMins = Math.round((eta - new Date(order.createdAt)) / 60000);
                        const deliveryMins = 15;
                        const prepMins = Math.max(0, totalMins - deliveryMins);
                        return (
                          <>
                            <span style={{ fontSize:12, color:'#065f46' }}>👨‍🍳 Prep ~{prepMins} min</span>
                            <span style={{ fontSize:12, color:'#065f46' }}>🚚 Delivery ~{deliveryMins} min</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}
            {order.actualDeliveryTime && (
              <div style={{ marginTop: 14, padding: '13px 16px', background: '#ecfdf5', borderRadius: 10, textAlign: 'center', border: '1px solid #6ee7b7' }}>
                <div style={{ fontSize: 13, color: '#065f46', fontWeight: 700 }}>✅ Delivered at</div>
                <div style={{ fontSize: 18, color: '#065f46', fontWeight: 800, marginTop: 4 }}>
                  {new Date(order.actualDeliveryTime).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancelled */}
        {order.status === 'Cancelled' && (
          <div style={{ background: '#fef2f2', borderRadius: 16, padding: 32, marginBottom: 20, border: '2px solid #fca5a5', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
            <h3 style={{ color: '#991b1b', margin: '0 0 8px' }}>Order Cancelled</h3>
            <p style={{ color: '#718096', margin: 0 }}>This order will not be delivered.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Left */}
          <div>
            {/* Items */}
            <div style={{ background: 'white', borderRadius: 16, padding: '24px', marginBottom: 16, boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0' }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#1a202c' }}>🛒 Order Items ({order.items.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {order.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 14, padding: '14px', background: '#f7f8fc', borderRadius: 12, alignItems: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                      {item.menuItem?.image && item.menuItem.image.startsWith('http')
                        ? <img src={item.menuItem.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '🍽️'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c', marginBottom: 3 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: '#718096' }}><span style={{ fontWeight: 700, color: '#667eea' }}>{item.quantity}×</span> ₹{item.price.toFixed(2)} each</div>
                      {item.specialInstructions && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>📝 {item.specialInstructions}</div>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#ff6b35' }}>₹{item.subtotal.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Address */}
            <div style={{ background: 'white', borderRadius: 16, padding: '24px', marginBottom: 16, boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#1a202c' }}>📍 Delivery Address</h3>
              <div style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: '#1a202c' }}>{order.deliveryAddress.street}</div>
                <div>{order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}</div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f2f8' }}>📞 {order.deliveryAddress.phone}</div>
              </div>
            </div>

            {order.specialInstructions && (
              <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#1a202c' }}>📝 Special Instructions</h3>
                <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 10, fontSize: 14, color: '#92400e', border: '1px solid #fde68a' }}>
                  {order.specialInstructions}
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0', position: 'sticky', top: 88 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#1a202c' }}>💰 Order Summary</h3>

              {[['Subtotal', order.pricing.subtotal], ['Delivery Fee', order.pricing.deliveryFee], ['Tax (5%)', order.pricing.tax]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#718096' }}>
                  <span>{l}</span><span>₹{v.toFixed(2)}</span>
                </div>
              ))}
              {order.pricing.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#065f46', fontWeight: 700 }}>
                  <span>Discount</span><span>−₹{order.pricing.discount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ borderTop: '2px solid #1a1a2e', marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
                <span style={{ color: '#1a202c' }}>Total</span>
                <span style={{ color: '#ff6b35' }}>₹{order.pricing.total.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f7f8fc', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#a0aec0', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Payment</div>
                <div style={{ fontWeight: 700, color: '#1a202c', fontSize: 14 }}>{order.payment.method}</div>
                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: (o_ps => o_ps==='Completed'?'#ecfdf5':o_ps==='Refunded'?'#eff6ff':o_ps==='Failed'?'#fef2f2':'#fffbeb')(order.payment.status),
                  color: (o_ps => o_ps==='Completed'?'#065f46':o_ps==='Refunded'?'#1e40af':o_ps==='Failed'?'#991b1b':'#92400e')(order.payment.status) }}>
                  {((o_ps,o_pm) => o_ps==='Completed'?'✅ Paid':o_ps==='Refunded'?'↩️ Refunded':o_ps==='Failed'?'❌ Order Cancelled':o_pm==='Cash on Delivery'?'💵 Pay on Delivery':'⏳ Pending')(order.payment.status, order.payment.method)}
                </span>
              </div>

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn btn-outline" style={{ width: '100%', fontSize: 14 }}
                  onClick={() => { const ph = order.restaurant?.contact?.phone; if (ph) window.location.href = `tel:${ph}`; }}>
                  📞 Call Restaurant
                </button>
                {['Pending', 'Confirmed'].includes(order.status) && (
                  <button className="btn btn-danger" style={{ width: '100%', fontSize: 14 }} onClick={handleCancel}>
                    ❌ Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
      `}</style>
    </div>
  );
};

export default OrderDetail;