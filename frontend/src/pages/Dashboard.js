import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  'Pending':          { bg:'#fffbeb', color:'#92400e', border:'#fde68a', icon:'⏳' },
  'Confirmed':        { bg:'#ecfdf5', color:'#065f46', border:'#6ee7b7', icon:'✅' },
  'Preparing':        { bg:'#eff6ff', color:'#1e40af', border:'#93c5fd', icon:'👨‍🍳' },
  'Ready':            { bg:'#f5f3ff', color:'#5b21b6', border:'#c4b5fd', icon:'📦' },
  'Out for Delivery': { bg:'#fff7ed', color:'#9a3412', border:'#fdba74', icon:'🚚' },
  'Delivered':        { bg:'#ecfdf5', color:'#065f46', border:'#6ee7b7', icon:'🎉' },
  'Cancelled':        { bg:'#fef2f2', color:'#991b1b', border:'#fca5a5', icon:'❌' },
};

// ── Order Detail Modal ────────────────────────────────────────────────────────
const OrderModal = ({ order, onClose, onStatusUpdate }) => {
  if (!order) return null;
  const sc = STATUS_CFG[order.status] || STATUS_CFG['Pending'];
  const subtotal = order.pricing?.subtotal || 0;
  const tax = order.pricing?.tax || 0;
  const delivery = order.pricing?.deliveryFee || 0;
  const discount = order.pricing?.discount || 0;
  const total = order.pricing?.total || 0;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', padding:'24px 28px', borderRadius:'20px 20px 0 0', position:'relative' }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 70% 50%, rgba(102,126,234,0.2) 0%, transparent 60%)', borderRadius:'20px 20px 0 0', pointerEvents:'none' }} />
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ color:'rgba(255,255,255,0.55)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Order</div>
                <div style={{ color:'white', fontSize:22, fontWeight:800, letterSpacing:'-0.02em' }}>{order.orderNumber}</div>
                <div style={{ color:'rgba(255,255,255,0.55)', fontSize:13, marginTop:4 }}>
                  {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' })}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, padding:'6px 16px', borderRadius:20, fontSize:13, fontWeight:700 }}>
                  {sc.icon} {order.status}
                </span>
                <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'white', width:36, height:36, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding:'24px 28px' }}>

          {/* Customer info */}
          <div style={{ background:'#f7f8fc', borderRadius:12, padding:'14px 18px', marginBottom:18, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Customer</div>
              <div style={{ fontWeight:700, color:'#1a202c', fontSize:15 }}>{order.user?.name || '—'}</div>
              <div style={{ color:'#718096', fontSize:13 }}>{order.user?.phone || order.user?.email || ''}</div>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Delivery Address</div>
              <div style={{ color:'#1a202c', fontSize:13, lineHeight:1.6 }}>
                {order.deliveryAddress?.street}<br />
                {order.deliveryAddress?.city}, {order.deliveryAddress?.state} {order.deliveryAddress?.zipCode}<br />
                📞 {order.deliveryAddress?.phone}
              </div>
            </div>
          </div>

          {/* Items — the main kitchen section */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a202c', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', padding:'3px 10px', borderRadius:6, fontSize:11 }}>KITCHEN</span>
              Items to Prepare
            </div>

            <div style={{ border:'2px solid #e2e6f0', borderRadius:12, overflow:'hidden' }}>
              {order.items.map((item, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'48px 1fr auto', gap:14, padding:'14px 18px', background: i % 2 === 0 ? 'white' : '#f7f8fc', borderBottom: i < order.items.length - 1 ? '1px solid #f0f2f8' : 'none', alignItems:'center' }}>
                  {/* Qty badge */}
                  <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#667eea,#764ba2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color:'white', fontWeight:900, fontSize:18 }}>{item.quantity}</span>
                  </div>
                  {/* Name + notes */}
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:'#1a202c' }}>{item.name}</div>
                    {item.specialInstructions && (
                      <div style={{ fontSize:12, color:'#f59e0b', marginTop:3, display:'flex', alignItems:'center', gap:4 }}>
                        📝 {item.specialInstructions}
                      </div>
                    )}
                  </div>
                  {/* Price */}
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'#ff6b35', fontSize:15 }}>₹{(item.price * item.quantity).toFixed(2)}</div>
                    <div style={{ color:'#a0aec0', fontSize:12 }}>₹{Number(item.price).toFixed(2)} each</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Special instructions */}
          {order.specialInstructions && (
            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 16px', marginBottom:18, display:'flex', gap:10 }}>
              <span style={{ fontSize:20 }}>📝</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:3 }}>Special Instructions</div>
                <div style={{ fontSize:14, color:'#92400e' }}>{order.specialInstructions}</div>
              </div>
            </div>
          )}

          {/* Bill summary */}
          <div style={{ background:'#f7f8fc', borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Bill Summary</div>
            {[['Subtotal', subtotal],['Delivery Fee', delivery],['Tax (5%)', tax]].map(([l,v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#718096', marginBottom:6 }}>
                <span>{l}</span><span>₹{v.toFixed(2)}</span>
              </div>
            ))}
            {discount > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#065f46', fontWeight:700, marginBottom:6 }}>
                <span>Promo Discount</span><span>−₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ borderTop:'2px solid #e2e6f0', marginTop:8, paddingTop:10, display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:18, color:'#1a202c' }}>
              <span>Total</span><span style={{ color:'#ff6b35' }}>₹{total.toFixed(2)}</span>
            </div>
            <div style={{ fontSize:13, color:'#718096', marginTop:6 }}>
              Payment: <strong>{order.payment?.method}</strong> ·{' '}
              <span style={{ color: order.payment?.status === 'Completed' ? '#065f46' : '#92400e', fontWeight:700 }}>
                {order.payment?.status}
              </span>
            </div>
          </div>

          {/* Status update */}
          {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a202c', marginBottom:10 }}>Update Order Status</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {['Confirmed','Preparing','Ready','Out for Delivery','Delivered'].map(s => (
                  <button key={s} onClick={() => { onStatusUpdate(order._id, s); onClose(); }}
                    disabled={order.status === s}
                    style={{
                      padding:'8px 16px', borderRadius:8, border:'2px solid',
                      borderColor: order.status === s ? '#667eea' : '#e2e6f0',
                      background: order.status === s ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'white',
                      color: order.status === s ? 'white' : '#4a5568',
                      fontWeight:700, fontSize:13, cursor: order.status === s ? 'default' : 'pointer',
                      opacity: order.status === s ? 0.7 : 1,
                      fontFamily:'inherit', transition:'all 0.15s'
                    }}>
                    {STATUS_CFG[s]?.icon} {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null); // for modal
  const [stats, setStats] = useState({ totalOrders:0, pendingOrders:0, deliveredOrders:0, totalRevenue:0 });

  const [newRestaurant, setNewRestaurant] = useState({
    name:'', description:'', cuisine:'', deliveryTime:'', deliveryFee:'',
    openingHours:'9:00 AM - 11:00 PM',
    street:'', city:'', state:'', zipCode:'', phone:'', email:'', leaveDays:[]
  });

  const isAdmin = user?.role === 'admin';
  const socketRef = useRef(null);

  const calculateStats = useCallback((ordersData) => {
    setStats({
      totalOrders: ordersData.length,
      pendingOrders: ordersData.filter(o => ['Pending','Confirmed','Preparing','Ready','Out for Delivery'].includes(o.status)).length,
      deliveredOrders: ordersData.filter(o => o.status === 'Delivered').length,
      totalRevenue: ordersData.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.pricing.total, 0)
    });
  }, []);

  const fetchAllOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(config.getApiUrl(config.endpoints.orders), { headers:{ 'Authorization':`Bearer ${token}` } });
      setAllOrders(res.data.data); calculateStats(res.data.data); setLoading(false);
    } catch { setError('Failed to load orders'); setLoading(false); }
  }, [calculateStats]);

  const fetchRestaurantOrders = useCallback(async (restaurantId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${config.getApiUrl(config.endpoints.orders)}/restaurant/${restaurantId}`, { headers:{ 'Authorization':`Bearer ${token}` } });
      setAllOrders(res.data.data); calculateStats(res.data.data); setLoading(false);
    } catch { setError('Failed to load orders'); setLoading(false); }
  }, [calculateStats]);

  const fetchRestaurants = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = user?._id || user?.id;
      const response = isAdmin
        ? await axios.get(config.getApiUrl(config.endpoints.restaurants), { headers:{ 'Authorization':`Bearer ${token}` } })
        : await axios.get(`${config.getApiUrl(config.endpoints.restaurants)}/owner/${userId}`, { headers:{ 'Authorization':`Bearer ${token}` } });

      setRestaurants(response.data.data);
      if (response.data.data.length > 0) {
        setSelectedRestaurant(response.data.data[0]);
        isAdmin ? fetchAllOrders() : fetchRestaurantOrders(response.data.data[0]._id);
      } else { setLoading(false); }
    } catch { setError('Failed to load restaurants'); setLoading(false); }
  }, [user, isAdmin, fetchAllOrders, fetchRestaurantOrders]);

  useEffect(() => {
    if (user && user.role !== 'restaurant_owner' && user.role !== 'admin') { navigate('/'); return; }
    if (user) fetchRestaurants();
  }, [user, navigate, fetchRestaurants]);

  // ── Real-time socket: notify owner when a new order arrives ───────────────
  useEffect(() => {
    if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) return;
    let socket;
    try {
      const { io } = require('socket.io-client');
      const config = require('../config').default;
      socket = io(config.API_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      // Owner joins a room per restaurant so they only get their orders
      socket.on('connect', () => {
        if (selectedRestaurant?._id) {
          socket.emit('joinUserRoom', user._id || user.id);
        }
      });

      // New order placed — refresh order list + play a subtle visual cue
      socket.on('orderPlaced', () => {
        if (selectedRestaurant) {
          isAdmin ? fetchAllOrders() : fetchRestaurantOrders(selectedRestaurant._id);
        }
      });

      // Order status changed by someone else (e.g. admin) — keep in sync
      socket.on('orderStatusUpdate', () => {
        if (selectedRestaurant) {
          isAdmin ? fetchAllOrders() : fetchRestaurantOrders(selectedRestaurant._id);
        }
      });
    } catch {}
    return () => { if (socket) socket.disconnect(); };
  }, [user, selectedRestaurant, isAdmin, fetchAllOrders, fetchRestaurantOrders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${config.getApiUrl(config.endpoints.orders)}/${orderId}/status`, { status: newStatus }, { headers:{ 'Authorization':`Bearer ${token}` } });
      isAdmin ? fetchAllOrders() : fetchRestaurantOrders(selectedRestaurant._id);
    } catch { alert('Failed to update order status'); }
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(config.getApiUrl(config.endpoints.restaurants), {
        name: newRestaurant.name, description: newRestaurant.description,
        cuisine: newRestaurant.cuisine.split(',').map(c => c.trim()),
        deliveryTime: newRestaurant.deliveryTime, deliveryFee: Number(newRestaurant.deliveryFee),
        address: { street:newRestaurant.street, city:newRestaurant.city, state:newRestaurant.state, zipCode:newRestaurant.zipCode },
        contact: { phone:newRestaurant.phone, email:newRestaurant.email },
        leaveDays: newRestaurant.leaveDays,
        openingHours: newRestaurant.openingHours
      }, { headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/json' } });

      if (res.data.success) {
        alert('✅ Restaurant created!'); setShowCreateForm(false);
        setNewRestaurant({ name:'', description:'', cuisine:'', deliveryTime:'', deliveryFee:'', openingHours:'9:00 AM - 11:00 PM', street:'', city:'', state:'', zipCode:'', phone:'', email:'', leaveDays:[] });
        fetchRestaurants();
      }
    } catch (err) { alert('❌ Failed: ' + (err.response?.data?.message || err.message)); setLoading(false); }
  };

  const handleFormChange = e => setNewRestaurant({ ...newRestaurant, [e.target.name]: e.target.value });

  const handleRestaurantChange = (restaurantId) => {
    const r = restaurants.find(r => r._id === restaurantId);
    setSelectedRestaurant(r);
    if (isAdmin) calculateStats(allOrders.filter(o => o.restaurant?._id === restaurantId || o.restaurant === restaurantId));
    else fetchRestaurantOrders(restaurantId);
  };

  const displayOrders = selectedRestaurant
    ? allOrders.filter(o => o.restaurant?._id === selectedRestaurant._id || o.restaurant === selectedRestaurant._id)
    : allOrders;

  if (loading && restaurants.length === 0) return (
    <div className="container" style={{ padding:'100px 20px', textAlign:'center' }}>
      <div className="spinner"/><p style={{ marginTop:16 }}>Loading dashboard...</p>
    </div>
  );

  const statCards = [
    { label:'Total Orders',   value: stats.totalOrders,              bg:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' },
    { label:'Pending Orders', value: stats.pendingOrders,            bg:'linear-gradient(135deg,#f093fb,#f5576c)' },
    { label:'Delivered',      value: stats.deliveredOrders,          bg:'linear-gradient(135deg,#10b981,#059669)' },
    { label:'Revenue',        value:`₹${stats.totalRevenue.toFixed(2)}`, bg:'linear-gradient(135deg,#ff6b35,#ff9256)' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f8', paddingTop:88, paddingBottom:60 }}>
      <div className="container">

        {/* Page header */}
        <div style={{ marginBottom:28, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:800, letterSpacing:'-0.025em', color:'#1a202c' }}>
              {isAdmin ? 'Admin Dashboard' : 'Restaurant Dashboard'}
            </h1>
            <p style={{ margin:'4px 0 0', color:'#718096', fontSize:14 }}>
              {isAdmin ? 'Manage all restaurants and orders' : 'Manage your restaurant and orders'}
            </p>
          </div>
          {isAdmin && <span style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', padding:'6px 18px', borderRadius:20, fontSize:13, fontWeight:700 }}>👨‍💼 Admin</span>}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:20 }}>{error}</div>}

        {restaurants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏪</div>
            <h3>No Restaurants Yet</h3>
            <p>{isAdmin ? 'No restaurants in the system.' : 'Create your first restaurant to start receiving orders!'}</p>
            {!isAdmin && <button onClick={() => setShowCreateForm(true)} className="btn btn-primary btn-lg">➕ Create Restaurant</button>}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
              {statCards.map(({ label, value, bg }) => (
                <div key={label} style={{ background:bg, borderRadius:14, padding:'22px 24px', color:'white', boxShadow:'0 4px 16px rgba(26,26,46,0.15)' }}>
                  <div style={{ fontSize:12, opacity:0.75, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</div>
                  <div style={{ fontSize:32, fontWeight:900, letterSpacing:'-0.02em' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Restaurant cards — one per restaurant with toggle */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
                <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#4a5568' }}>Your Restaurants</h3>
                {!isAdmin && <button onClick={() => setShowCreateForm(true)} className="btn btn-primary">➕ Create Restaurant</button>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {restaurants.map(r => {
                  const today = new Date().toLocaleDateString('en-US', { weekday:'long' });
                  const isLeaveToday = r.leaveDays?.includes(today);
                  const isClosed = r.isOpen === false || isLeaveToday;
                  const isSelected = selectedRestaurant?._id === r._id;
                  return (
                    <div key={r._id} onClick={() => handleRestaurantChange(r._id)}
                      style={{ background:'white', borderRadius:14, padding:'18px 20px', cursor:'pointer',
                        border:`2px solid ${isSelected?'#667eea':'#e2e6f0'}`,
                        boxShadow: isSelected?'0 4px 16px rgba(102,126,234,0.18)':'0 2px 8px rgba(26,26,46,0.06)',
                        transition:'all 0.15s', position:'relative', overflow:'hidden' }}>
                      {isSelected && <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#667eea,#764ba2)',borderRadius:'14px 14px 0 0' }}/>}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
                          <div style={{ fontWeight:800, fontSize:15, color:'#1a202c', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
                          {isAdmin && r.owner && <div style={{ fontSize:11, color:'#a0aec0', marginTop:2 }}>{r.owner.name}</div>}
                          {isLeaveToday && <div style={{ fontSize:11, color:'#991b1b', fontWeight:600, marginTop:3 }}>🗓️ Holiday today ({today})</div>}
                          {r.leaveDays?.length > 0 && !isLeaveToday && <div style={{ fontSize:11, color:'#a0aec0', marginTop:3 }}>Off: {r.leaveDays.join(', ')}</div>}
                        </div>
                        <span style={{ flexShrink:0, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                          background:isClosed?'#fef2f2':'#ecfdf5', color:isClosed?'#991b1b':'#065f46',
                          border:`1px solid ${isClosed?'#fca5a5':'#6ee7b7'}` }}>
                          {isClosed?'🔴 Closed':'🟢 Open'}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        {!isAdmin && (
                          <button onClick={async e => {
                            e.stopPropagation();
                            try {
                              const token = localStorage.getItem('token');
                              const res = await axios.put(
                                `${config.getApiUrl(config.endpoints.restaurants)}/${r._id}/toggle-open`,
                                {}, { headers:{'Authorization':`Bearer ${token}`} }
                              );
                              if (res.data.success) {
                                setRestaurants(prev => prev.map(x => x._id===r._id?{...x,isOpen:res.data.data.isOpen}:x));
                                if (selectedRestaurant?._id===r._id)
                                  setSelectedRestaurant(prev=>({...prev,isOpen:res.data.data.isOpen}));
                              }
                            } catch {}
                          }}
                          style={{ display:'flex',alignItems:'center',gap:7,padding:'6px 12px',borderRadius:8,border:'none',
                            cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:12,transition:'all 0.2s',
                            background:isClosed?'linear-gradient(135deg,#10b981,#059669)':'linear-gradient(135deg,#ef4444,#dc2626)',
                            color:'white' }}>
                            <div style={{ width:28,height:16,borderRadius:8,background:'rgba(255,255,255,0.25)',position:'relative',flexShrink:0 }}>
                              <div style={{ width:12,height:12,borderRadius:'50%',background:'white',position:'absolute',top:2,
                                left:isClosed?2:14,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                            </div>
                            {isClosed?'Open now':'Close now'}
                          </button>
                        )}
                        <button onClick={e=>{e.stopPropagation();navigate(`/restaurant/${r._id}/menu`);}}
                          style={{ flex:1,padding:'6px 10px',borderRadius:8,border:'2px solid #e2e6f0',
                            background:'white',color:'#667eea',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
                          📋 Menu
                        </button>
                        {!isAdmin && (
                          <button onClick={e=>{e.stopPropagation();navigate(`/restaurant/${r._id}/menu?tab=promo`);}}
                            style={{ flex:1,padding:'6px 10px',borderRadius:8,border:'2px solid #fde68a',
                              background:'#fffbeb',color:'#92400e',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
                            🎁 Promo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRestaurant && (
              <>
                {/* Orders header */}
                <div style={{ background:'white',borderRadius:14,padding:'14px 20px',marginBottom:16,
                  boxShadow:'0 2px 8px rgba(26,26,46,0.07)',border:'1px solid #e2e6f0',
                  display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10 }}>
                  <div>
                    <div style={{ fontWeight:800,fontSize:16,color:'#1a202c' }}>📦 Orders — {selectedRestaurant.name}</div>
                    {isAdmin && selectedRestaurant.owner && (
                      <div style={{ fontSize:13,color:'#667eea',fontWeight:600,marginTop:2 }}>
                        {selectedRestaurant.owner.name} · {selectedRestaurant.owner.email}
                      </div>
                    )}
                  </div>
                </div>
                {/* Orders table */}
                <div style={{ background:'white', borderRadius:16, boxShadow:'0 2px 8px rgba(26,26,46,0.07)', border:'1px solid #e2e6f0', overflow:'hidden' }}>
                  <div style={{ padding:'18px 24px', borderBottom:'1px solid #f0f2f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'#1a202c' }}>Recent Orders</h3>
                    <span style={{ fontSize:13, color:'#a0aec0' }}>Click any order ID to see full details</span>
                  </div>

                  {displayOrders.length === 0 ? (
                    <div style={{ textAlign:'center', padding:48, color:'#a0aec0' }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
                      <p>No orders yet</p>
                    </div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'#f7f8fc', borderBottom:'2px solid #e2e6f0' }}>
                            {['Order #','Customer',isAdmin&&'Restaurant','Items','Total','Status','Actions'].filter(Boolean).map(h => (
                              <th key={h} style={{ padding:'12px 16px', textAlign: h==='Total'||h==='Actions'?'right':'left', fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayOrders.map(order => {
                            const sc = STATUS_CFG[order.status] || STATUS_CFG['Pending'];
                            return (
                              <tr key={order._id} style={{ borderBottom:'1px solid #f0f2f8', transition:'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background='#f7f8fc'}
                                onMouseLeave={e => e.currentTarget.style.background='white'}>

                                {/* Clickable order number */}
                                <td style={{ padding:'14px 16px' }}>
                                  <button onClick={() => setSelectedOrder(order)}
                                    style={{ background:'none', border:'none', cursor:'pointer', fontWeight:800, fontSize:13, color:'#667eea', fontFamily:'inherit', textDecoration:'underline', textUnderlineOffset:3, padding:0 }}>
                                    {order.orderNumber}
                                  </button>
                                </td>

                                <td style={{ padding:'14px 16px' }}>
                                  <div style={{ fontWeight:600, fontSize:14, color:'#1a202c' }}>{order.user?.name}</div>
                                  <div style={{ fontSize:12, color:'#a0aec0' }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                                </td>

                                {isAdmin && (
                                  <td style={{ padding:'14px 16px', fontSize:13, color:'#4a5568' }}>{order.restaurant?.name || '—'}</td>
                                )}

                                <td style={{ padding:'14px 16px', fontSize:13, color:'#4a5568' }}>
                                  {order.items.length} item{order.items.length!==1?'s':''}
                                </td>

                                <td style={{ padding:'14px 16px', textAlign:'right', fontWeight:700, color:'#1a202c' }}>
                                  ₹{order.pricing.total.toFixed(2)}
                                </td>

                                <td style={{ padding:'14px 16px' }}>
                                  <span style={{ background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
                                    {sc.icon} {order.status}
                                  </span>
                                </td>

                                <td style={{ padding:'14px 16px', textAlign:'right' }}>
                                  {order.status !== 'Delivered' && order.status !== 'Cancelled' ? (() => {
                                    const STATUS_OPTS = [
                                      { value:'Pending',          label:'⏳ Pending',          bg:'#fffbeb', color:'#92400e', border:'#fde68a' },
                                      { value:'Confirmed',        label:'✅ Confirmed',        bg:'#eff6ff', color:'#1e40af', border:'#bfdbfe' },
                                      { value:'Preparing',        label:'👨‍🍳 Preparing',        bg:'#f5f3ff', color:'#5b21b6', border:'#c4b5fd' },
                                      { value:'Ready',            label:'📦 Ready',            bg:'#ecfdf5', color:'#065f46', border:'#6ee7b7' },
                                      { value:'Out for Delivery', label:'🚚 Out for Delivery', bg:'#fff7ed', color:'#9a3412', border:'#fdba74' },
                                      { value:'Delivered',        label:'🎉 Delivered',        bg:'#ecfdf5', color:'#065f46', border:'#6ee7b7' },
                                      { value:'Cancelled',        label:'❌ Cancel Order',     bg:'#fef2f2', color:'#991b1b', border:'#fca5a5' },
                                    ];
                                    const cur = STATUS_OPTS.find(o => o.value === order.status) || STATUS_OPTS[0];
                                    return (
                                      <select value={order.status}
                                        onChange={e => {
                                          const newStatus = e.target.value;
                                          if (newStatus === 'Cancelled') {
                                            if (window.confirm(`Cancel order ${order.orderNumber}? This cannot be undone.`))
                                              updateOrderStatus(order._id, newStatus);
                                          } else {
                                            updateOrderStatus(order._id, newStatus);
                                          }
                                        }}
                                        style={{ padding:'5px 8px', borderRadius:20, fontSize:12, fontFamily:'inherit',
                                          cursor:'pointer', fontWeight:700,
                                          background: cur.bg, color: cur.color,
                                          border: `1.5px solid ${cur.border}`,
                                          outline:'none', appearance:'auto' }}>
                                        {STATUS_OPTS.map(o => (
                                          <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                      </select>
                                    );
                                  })() : (
                                    <span style={{ color:'#a0aec0', fontSize:12 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={updateOrderStatus}
        />
      )}

      {/* Create Restaurant Modal */}
      {showCreateForm && !isAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div style={{ background:'white', borderRadius:20, padding:32, maxWidth:580, width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:'#1a202c' }}>Create New Restaurant</h2>
              <button onClick={() => setShowCreateForm(false)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#a0aec0', fontFamily:'inherit' }}>✕</button>
            </div>

            <form onSubmit={handleCreateRestaurant}>
              {[['name','Restaurant Name *','e.g., Pizza Palace'],['description','Description *','Describe your restaurant']].map(([name,label,ph]) => (
                <div className="form-group" key={name}>
                  <label className="form-label">{label}</label>
                  {name === 'description'
                    ? <textarea name={name} className="form-control" value={newRestaurant[name]} onChange={handleFormChange} required placeholder={ph} rows={3} />
                    : <input type="text" name={name} className="form-control" value={newRestaurant[name]} onChange={handleFormChange} required placeholder={ph} />
                  }
                </div>
              ))}

              <div className="form-group">
                <label className="form-label">Cuisine Types * (comma-separated)</label>
                <input type="text" name="cuisine" className="form-control" value={newRestaurant.cuisine} onChange={handleFormChange} required placeholder="e.g., Italian, Pizza" />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Delivery Time *</label>
                  <input type="text" name="deliveryTime" className="form-control" value={newRestaurant.deliveryTime} onChange={handleFormChange} required placeholder="30-40 mins" />
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Fee (₹) *</label>
                  <input type="number" name="deliveryFee" className="form-control" value={newRestaurant.deliveryFee} onChange={handleFormChange} required min="0" placeholder="50" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop:4 }}>
                <label className="form-label">Opening Hours *</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:12, color:'#718096', marginBottom:4, display:'block' }}>Opens at</label>
                    <select className="form-select" value={newRestaurant.openingHours.split(' - ')[0] || '9:00 AM'}
                      onChange={e => setNewRestaurant(prev => ({
                        ...prev,
                        openingHours: `${e.target.value} - ${prev.openingHours.split(' - ')[1] || '11:00 PM'}`
                      }))}>
                      {['12:00 AM','1:00 AM','2:00 AM','3:00 AM','4:00 AM','5:00 AM','6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM',
                        '12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM','11:00 PM']
                        .map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'#718096', marginBottom:4, display:'block' }}>Closes at</label>
                    <select className="form-select" value={newRestaurant.openingHours.split(' - ')[1] || '11:00 PM'}
                      onChange={e => setNewRestaurant(prev => ({
                        ...prev,
                        openingHours: `${prev.openingHours.split(' - ')[0] || '9:00 AM'} - ${e.target.value}`
                      }))}>
                      {['12:00 AM','1:00 AM','2:00 AM','3:00 AM','4:00 AM','5:00 AM','6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM',
                        '12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM','11:00 PM']
                        .map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ fontSize:12, color:'#718096', marginTop:6 }}>
                  🕐 Hours: <strong>{newRestaurant.openingHours}</strong>
                </div>
              </div>

              <div style={{ fontSize:13, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', margin:'16px 0 12px' }}>Address</div>
              <div className="form-group">
                <label className="form-label">Street *</label>
                <input type="text" name="street" className="form-control" value={newRestaurant.street} onChange={handleFormChange} required placeholder="123 Main Street" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {[['city','City','Chennai'],['state','State','Tamil Nadu'],['zipCode','ZIP','600001']].map(([n,l,p]) => (
                  <div className="form-group" key={n}>
                    <label className="form-label">{l} *</label>
                    <input type="text" name={n} className="form-control" value={newRestaurant[n]} onChange={handleFormChange} required placeholder={p} />
                  </div>
                ))}
              </div>

              <div style={{ fontSize:13, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', margin:'16px 0 12px' }}>Contact</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input type="tel" name="phone" className="form-control" value={newRestaurant.phone} onChange={handleFormChange} required placeholder="9876543210" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" name="email" className="form-control" value={newRestaurant.email} onChange={handleFormChange} required placeholder="info@restaurant.com" />
                </div>
              </div>

              <div style={{ margin:'20px 0 12px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Weekly Leave Days</div>
                <p style={{ fontSize:12, color:'#718096', marginBottom:10 }}>Select days your restaurant will be <strong>closed</strong> every week. Customers won't see your restaurant on these days.</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => {
                    const selected = newRestaurant.leaveDays.includes(day);
                    return (
                      <button key={day} type="button"
                        onClick={() => setNewRestaurant(prev => ({
                          ...prev,
                          leaveDays: selected ? prev.leaveDays.filter(d => d !== day) : [...prev.leaveDays, day]
                        }))}
                        style={{ padding:'7px 14px', borderRadius:20, border:`2px solid ${selected ? '#ef4444' : '#e2e6f0'}`,
                          background: selected ? '#fef2f2' : 'white', color: selected ? '#991b1b' : '#718096',
                          fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                        {selected ? '✕ ' : ''}{day}
                      </button>
                    );
                  })}
                </div>
                {newRestaurant.leaveDays.length > 0 && (
                  <div style={{ marginTop:8, fontSize:12, color:'#991b1b', fontWeight:600 }}>
                    ⚠️ Closed every: {newRestaurant.leaveDays.join(', ')}
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:10, marginTop:24 }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex:1 }}>{loading ? '⏳ Creating...' : '✅ Create Restaurant'}</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn btn-outline" style={{ flex:1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;