import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import config from '../config';

// Request browser notification permission and send push notification
const sendPushNotif = (title, body) => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  } catch {}
};

const requestNotifPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

const STATUS_CFG = {
  'Pending':          { color:'#92400e', bg:'#fffbeb', border:'#fde68a', icon:'⏳' },
  'Confirmed':        { color:'#065f46', bg:'#ecfdf5', border:'#6ee7b7', icon:'✅' },
  'Preparing':        { color:'#1e40af', bg:'#eff6ff', border:'#93c5fd', icon:'👨‍🍳' },
  'Ready':            { color:'#5b21b6', bg:'#f5f3ff', border:'#c4b5fd', icon:'📦' },
  'Out for Delivery': { color:'#9a3412', bg:'#fff7ed', border:'#fdba74', icon:'🚚' },
  'Delivered':        { color:'#065f46', bg:'#ecfdf5', border:'#6ee7b7', icon:'🎉' },
  'Cancelled':        { color:'#991b1b', bg:'#fef2f2', border:'#fca5a5', icon:'❌' },
};

const FILTER_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: '🔄 Active',    statuses: ['Pending','Confirmed','Preparing','Ready','Out for Delivery'] },
  { key: 'Delivered', label: '🎉 Delivered' },
  { key: 'Cancelled', label: '❌ Cancelled' },
];

const N = '#1a202c';
const S = '#718096';

const Orders = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToCart, clearCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [liveToast, setLiveToast] = useState('');
  const [reorderToast, setReorderToast] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (user && user.role !== 'customer') { navigate('/dashboard'); return; }
  }, [isAuthenticated, user, navigate]);

  const fetchOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(config.getApiUrl(config.endpoints.orders + '/myorders'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setOrders(res.data.data);
      setLoading(false);
    } catch { setError('Failed to load orders'); setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === 'customer') fetchOrders(); }, [user, fetchOrders]);
  useEffect(() => { requestNotifPermission(); }, []);

  // Real-time socket + polling fallback
  useEffect(() => {
    if (!user || user.role !== 'customer') return;
    let interval;
    try {
      const { io } = require('socket.io-client');
      const socket = io(config.API_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;
      const uid = user._id || user.id;
      socket.on('connect', () => socket.emit('joinUserRoom', uid));
      socket.on('orderStatusUpdate', (data) => {
        setOrders(prev => prev.map(o =>
          o._id === data.orderId || o._id?.toString() === data.orderId
            ? { ...o, status: data.status } : o
        ));
        setLiveToast(data.message);
        setTimeout(() => setLiveToast(''), 5000);
        sendPushNotif('🍔 FoodOrder Update', data.message);
        // Save to notification history — skip if OrderDetail already saved same event
        try {
          const notifs = JSON.parse(localStorage.getItem('foodorder_notifications') || '[]');
          const isDuplicate = notifs.some(n =>
            n.data?.orderId === data.orderId &&
            n.data?.status === data.status &&
            Date.now() - new Date(n.time).getTime() < 5000   // within 5 seconds
          );
          if (!isDuplicate) {
            notifs.unshift({ id: Date.now(), type:'orderStatusUpdate', message:data.message, data, time:new Date().toISOString(), read:false });
            localStorage.setItem('foodorder_notifications', JSON.stringify(notifs.slice(0,50)));
          }
        } catch {}
      });
      // pointsEarned — Orders.js is the single writer for this notification
      // (OrderDetail only shows a toast; it no longer joins the user room)
      socket.on('pointsEarned', (data) => {
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

      return () => socket.disconnect();
    } catch {
      interval = setInterval(() => fetchOrders(), 15000);
      return () => clearInterval(interval);
    }
  }, [user, fetchOrders]);

  const handleCancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${config.getApiUrl(config.endpoints.orders)}/${order._id}/cancel`,
        {}, { headers: { 'Authorization': `Bearer ${token}` } }
      );
      fetchOrders();
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  // Re-order: add all items from a past order to cart
  const handleReorder = async (order) => {
    try {
      // Fetch full restaurant info
      const res = await axios.get(
        `${config.getApiUrl(config.endpoints.restaurants)}/${order.restaurant._id}`
      );
      const restaurant = res.data.data;

      // Fetch current menu to get fresh item data
      const menuRes = await axios.get(
        `${config.getApiUrl(config.endpoints.menu)}/restaurant/${order.restaurant._id}`
      );
      const menuItems = menuRes.data.data;

      // Confirm if cart has items from different restaurant
      clearCart();

      let added = 0;
      for (const item of order.items) {
        const menuItem = menuItems.find(m => m._id === item.menuItem?._id || m.name === item.name);
        if (menuItem && menuItem.isAvailable) {
          for (let i = 0; i < item.quantity; i++) addToCart(menuItem, restaurant);
          added++;
        }
      }

      if (added === 0) {
        setReorderToast('⚠️ All items are currently unavailable');
      } else {
        setReorderToast(`🛒 ${added} item(s) added to cart!`);
        setTimeout(() => navigate('/cart'), 1200);
      }
      setTimeout(() => setReorderToast(''), 4000);
    } catch (err) {
      alert('Failed to re-order: ' + err.message);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return ['Pending','Confirmed','Preparing','Ready','Out for Delivery'].includes(o.status);
    return o.status === activeFilter;
  });

  const card = { background:'white', borderRadius:16, boxShadow:'0 2px 8px rgba(26,26,46,0.07)', border:'1px solid #e2e6f0', overflow:'hidden' };

  if (loading) return (
    <div className="page-wrapper" style={{ textAlign:'center', paddingTop:160 }}>
      <div className="spinner"/><p style={{ marginTop:16, color:S }}>Loading orders...</p>
    </div>
  );

  return (
    <div className="page-wrapper">

      {/* Live status toast */}
      {liveToast && (
        <div style={{ position:'fixed', top:80, right:24, zIndex:9999, background:'linear-gradient(135deg,#1a1a2e,#0f3460)', color:'white', padding:'14px 20px', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', fontSize:14, fontWeight:600, maxWidth:340, display:'flex', alignItems:'center', gap:10 }}>
          🔔 {liveToast}
          <button onClick={() => setLiveToast('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', marginLeft:'auto', fontSize:16, fontFamily:'inherit' }}>✕</button>
        </div>
      )}

      {/* Re-order toast */}
      {reorderToast && (
        <div style={{ position:'fixed', top: liveToast ? 138 : 80, right:24, zIndex:9999, background:'linear-gradient(135deg,#ff6b35,#ff9256)', color:'white', padding:'14px 20px', borderRadius:12, boxShadow:'0 8px 24px rgba(255,107,53,0.4)', fontSize:14, fontWeight:600, maxWidth:340, display:'flex', alignItems:'center', gap:10 }}>
          {reorderToast}
        </div>
      )}

      <div className="container" style={{ maxWidth:920 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:800, letterSpacing:'-0.02em', color:N }}>My Orders</h1>
            <p style={{ margin:'4px 0 0', color:S, fontSize:14 }}>{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
          </div>
          <Link to="/restaurants" className="btn btn-primary btn-sm">+ New Order</Link>
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
          {FILTER_TABS.map(tab => {
            const count = tab.key === 'all' ? orders.length
              : tab.key === 'active' ? orders.filter(o => ['Pending','Confirmed','Preparing','Ready','Out for Delivery'].includes(o.status)).length
              : orders.filter(o => o.status === tab.key).length;
            return (
              <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                style={{ padding:'8px 18px', borderRadius:24, border:`2px solid ${activeFilter === tab.key ? '#667eea' : '#e2e6f0'}`, background: activeFilter === tab.key ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'white', color: activeFilter === tab.key ? 'white' : '#718096', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}>
                {tab.label}
                <span style={{ background: activeFilter === tab.key ? 'rgba(255,255,255,0.25)' : '#f0f2f8', color: activeFilter === tab.key ? 'white' : '#718096', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:800 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>{activeFilter === 'all' ? 'No orders yet' : `No ${activeFilter} orders`}</h3>
            <p>Start ordering from your favourite restaurants!</p>
            <Link to="/restaurants" className="btn btn-primary">Browse Restaurants</Link>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {filteredOrders.map(order => {
              const sc = STATUS_CFG[order.status] || STATUS_CFG['Pending'];
              return (
                <div key={order._id} style={card}>
                  {/* Header band */}
                  <div style={{ background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', padding:'16px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ color:'white', fontWeight:800, fontSize:16, letterSpacing:'-0.01em' }}>{order.orderNumber}</div>
                      <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13, marginTop:2 }}>🍽️ {order.restaurant?.name}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                        {sc.icon} {order.status}
                      </span>
                      <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding:'18px 22px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Items</div>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:N, marginBottom:5 }}>
                            <span><span style={{ fontWeight:700, color:'#667eea' }}>{item.quantity}×</span> {item.name}</span>
                            <span style={{ fontWeight:600 }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ background:'#f0f2f8', borderRadius:12, padding:'14px 16px' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Summary</div>
                        {[['Subtotal', order.pricing.subtotal],['Delivery', order.pricing.deliveryFee],['Tax', order.pricing.tax]].map(([l,v]) => (
                          <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:S, marginBottom:4 }}>
                            <span>{l}</span><span>₹{v.toFixed(2)}</span>
                          </div>
                        ))}
                        {order.pricing.discount > 0 && (
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#065f46', marginBottom:4 }}>
                            <span>Discount</span><span>−₹{order.pricing.discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{ borderTop:'1px solid #e2e6f0', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:15, color:'#ff6b35' }}>
                          <span>Total</span><span>₹{order.pricing.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop:'1px solid #f0f2f8', marginTop:14, paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                      <div style={{ fontSize:12, color:'#a0aec0' }}>
                        {order.payment.method} ·{' '}
                        {(() => { const o_ps=order.payment.status, o_pm=order.payment.method; return (
                          <span style={{fontWeight:700,color:(o_ps==='Completed'?'#065f46':o_ps==='Refunded'?'#1e40af':o_ps==='Failed'?'#991b1b':'#92400e')}}>
                            {(o_ps==='Completed'?'✅ Paid':o_ps==='Refunded'?'↩️ Refunded':o_ps==='Failed'?'❌ Order Cancelled':o_pm==='Cash on Delivery'?'💵 Pay on Delivery':'⏳ Pending')}
                          </span>
                        );})()}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <Link to={`/order/${order._id}`} className="btn btn-outline btn-sm">View Details</Link>
                        {order.status === 'Delivered' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleReorder(order)}>🔁 Re-order</button>
                        )}
                        {['Pending','Confirmed'].includes(order.status) && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(order)}>Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
