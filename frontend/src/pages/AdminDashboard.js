import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [promos, setPromos] = useState([]);
  const [promoForm, setPromoForm] = useState({ code:'', description:'', discountType:'percentage', discountValue:'', minOrderAmount:'', maxDiscountAmount:'', usageLimit:'', onePerUser:true, isActive:true, expiresAt:'' });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [promoMsg, setPromoMsg] = useState({ type:'', text:'' });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers:0, totalRestaurants:0, totalOrders:0, totalRevenue:0, todayOrders:0, pendingOrders:0, customers:0, restaurantOwners:0 });
  const [users, setUsers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [userFilter, setUserFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [chartDays, setChartDays] = useState(7);
  const [chartRestaurant, setChartRestaurant] = useState('all');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [usersRes, restaurantsRes, ordersRes, promosRes] = await Promise.all([
        axios.get(config.getApiUrl(config.endpoints.users), { headers }),
        axios.get(config.getApiUrl(config.endpoints.restaurants), { headers }),
        axios.get(config.getApiUrl(config.endpoints.orders), { headers }),
        axios.get(config.getApiUrl('/api/promo'), { headers }).catch(()=>({ data:{ data:[] } }))
      ]);
      setUsers(usersRes.data.data || []);
      setRestaurants(restaurantsRes.data.data || []);
      setOrders(ordersRes.data.data || []);
      setPromos(promosRes.data.data || []);
      calculateStats(usersRes.data.data, restaurantsRes.data.data, ordersRes.data.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') { navigate('/'); return; }
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, navigate]);

  const calculateStats = (usersData, restaurantsData, ordersData) => {
    const today = new Date().toDateString();
    setStats({
      totalUsers: usersData.length,
      totalRestaurants: restaurantsData.length,
      totalOrders: ordersData.length,
      totalRevenue: ordersData.filter(o=>o.status==='Delivered').reduce((s,o)=>s+(o.pricing?.total||0),0),
      todayOrders: ordersData.filter(o=>new Date(o.createdAt).toDateString()===today).length,
      pendingOrders: ordersData.filter(o=>o.status==='Pending').length,
      customers: usersData.filter(u=>u.role==='customer').length,
      restaurantOwners: usersData.filter(u=>u.role==='restaurant_owner').length,
    });
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    const action = currentStatus === false ? 'activate' : 'deactivate';
    if (!window.confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} this user?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${config.API_URL}${config.endpoints.users}/${userId}/status`, {}, { headers:{'Authorization':`Bearer ${token}`} });
      fetchAllData();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${config.API_URL}${config.endpoints.users}/${userId}`, { headers:{'Authorization':`Bearer ${token}`} });
      alert('User deleted'); fetchAllData();
    } catch (err) { alert('Error: ' + err.response?.data?.message); }
  };

  const toggleRestaurantStatus = async (restaurantId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${config.API_URL}${config.endpoints.restaurants}/${restaurantId}`, { isActive:!currentStatus }, { headers:{'Authorization':`Bearer ${token}`} });
      fetchAllData();
    } catch (err) { alert('Error: ' + err.response?.data?.message); }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${config.API_URL}${config.endpoints.orders}/${orderId}/status`, { status:newStatus }, { headers:{'Authorization':`Bearer ${token}`} });
      fetchAllData();
    } catch (err) { alert('Error: ' + err.response?.data?.message); }
  };

  const filteredUsers  = users.filter(u  => userFilter  === 'all' || u.role     === userFilter);
  const filteredOrders = orders.filter(o => (orderFilter === 'all' || o.status === orderFilter) && (restaurantFilter === 'all' || o.restaurant?._id === restaurantFilter || o.restaurant === restaurantFilter));

  const C = { background:'white', borderRadius:16, boxShadow:'0 2px 8px rgba(26,26,46,0.07)', border:'1px solid #e2e6f0' };
  const TH = { padding:'13px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#718096', textTransform:'uppercase', letterSpacing:'0.07em' };
  const TD = { padding:'14px 16px', fontSize:14, color:'#374151', borderBottom:'1px solid #f0f2f8' };
  const SC = { Pending:{bg:'#fffbeb',c:'#92400e'}, Confirmed:{bg:'#ecfdf5',c:'#065f46'}, Preparing:{bg:'#eff6ff',c:'#1e40af'}, Ready:{bg:'#f5f3ff',c:'#5b21b6'}, 'Out for Delivery':{bg:'#fff7ed',c:'#9a3412'}, Delivered:{bg:'#ecfdf5',c:'#065f46'}, Cancelled:{bg:'#fef2f2',c:'#991b1b'} };
  const statusPill = (s) => ({ padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700, background:(SC[s]||{bg:'#f0f2f8'}).bg, color:(SC[s]||{c:'#4a5568'}).c });

  const STAT_CARDS = [
    {icon:'👥', value:stats.totalUsers,                   label:'Total Users',       grad:'#667eea,#764ba2', tab:'users'},
    {icon:'🏪', value:stats.totalRestaurants,             label:'Total Restaurants', grad:'#10b981,#059669', tab:'restaurants'},
    {icon:'📦', value:stats.totalOrders,                  label:'Total Orders',      grad:'#ff6b35,#ff9256', tab:'orders'},
    {icon:'💰', value:'₹'+stats.totalRevenue.toFixed(2),  label:'Total Revenue',     grad:'#8b5cf6,#7c3aed', tab:'charts'},
    {icon:'📅', value:stats.todayOrders,                  label:"Today's Orders",    grad:'#14b8a6,#0d9488', tab:'orders'},
    {icon:'⏳', value:stats.pendingOrders,                 label:'Pending Orders',    grad:'#ef4444,#dc2626', tab:'orders'},
    {icon:'👤', value:stats.customers,                    label:'Customers',         grad:'#6366f1,#4f46e5', tab:'users'},
    {icon:'🏢', value:stats.restaurantOwners,             label:'Restaurant Owners', grad:'#ec4899,#db2777', tab:'users'},
  ];

  const TABS = [
    {key:'overview',    icon:'📊', label:'Overview'},
    {key:'users',       icon:'👥', label:`Users (${stats.totalUsers})`},
    {key:'restaurants', icon:'🏪', label:`Restaurants (${stats.totalRestaurants})`},
    {key:'orders',      icon:'📦', label:`Orders (${stats.totalOrders})`},
    {key:'charts',      icon:'📈', label:'Revenue Charts'},
    {key:'promos',      icon:'🎟️', label:`Promos (${promos.length})`},
  ];

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#f0f2f8',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div className="spinner" />
      <p style={{color:'#718096',fontSize:15}}>Loading admin dashboard...</p>
    </div>
  );

  // Render modal via portal so it's not clipped by parent overflow/transform
  const orderModal = selectedOrder ? ReactDOM.createPortal(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(15,20,40,0.78)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999,boxSizing:'border-box'}}
      onClick={e=>e.target===e.currentTarget&&setSelectedOrder(null)}>
      {/* Outer container: rounded corners + shadow, overflow hidden so corners clip children */}
      <div style={{background:'white',borderRadius:20,width:'calc(100% - 48px)',maxWidth:600,maxHeight:'88vh',boxShadow:'0 32px 80px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column',overflow:'hidden',margin:'24px auto'}}>
        {/* Inner scroll wrapper */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',maxHeight:'88vh'}}>

        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)',padding:'24px 28px',flexShrink:0,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 80% 50%,rgba(102,126,234,0.22) 0%,transparent 60%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',zIndex:1,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Order Details</div>
              <div style={{color:'white',fontSize:22,fontWeight:900,letterSpacing:'-0.02em',marginBottom:4}}>{selectedOrder.orderNumber}</div>
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>{new Date(selectedOrder.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{...statusPill(selectedOrder.status),fontSize:12,padding:'5px 14px'}}>{selectedOrder.status}</span>
              <button onClick={()=>setSelectedOrder(null)}
                style={{background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',color:'white',width:36,height:36,borderRadius:'50%',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',flexShrink:0,lineHeight:1}}>
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{padding:'24px 28px',display:'flex',flexDirection:'column',gap:18}}>

          {/* Customer + Restaurant */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{background:'#f7f8fc',borderRadius:14,padding:'16px 18px',border:'1px solid #e2e6f0'}}>
              <div style={{fontSize:10,fontWeight:700,color:'#a0aec0',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>👤 Customer</div>
              <div style={{fontWeight:800,color:'#1a202c',fontSize:14,marginBottom:4}}>{selectedOrder.user?.name||'—'}</div>
              <div style={{fontSize:12,color:'#718096',marginBottom:2}}>{selectedOrder.user?.email}</div>
              <div style={{fontSize:12,color:'#718096'}}>📞 {selectedOrder.deliveryAddress?.phone||'—'}</div>
            </div>
            <div style={{background:'#f7f8fc',borderRadius:14,padding:'16px 18px',border:'1px solid #e2e6f0'}}>
              <div style={{fontSize:10,fontWeight:700,color:'#a0aec0',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>🍽️ Restaurant</div>
              <div style={{fontWeight:800,color:'#1a202c',fontSize:14,marginBottom:4}}>{selectedOrder.restaurant?.name||'—'}</div>
              <div style={{fontSize:12,color:'#718096',marginBottom:2}}>📍 {selectedOrder.deliveryAddress?.street}</div>
              <div style={{fontSize:12,color:'#718096'}}>{selectedOrder.deliveryAddress?.city}{selectedOrder.deliveryAddress?.state?', '+selectedOrder.deliveryAddress.state:''}</div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div style={{fontSize:10,fontWeight:700,color:'#a0aec0',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>🛒 Items Ordered</div>
            <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #e2e6f0'}}>
              {selectedOrder.items?.map((item,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:i%2===0?'white':'#fafbfe',borderBottom:i<selectedOrder.items.length-1?'1px solid #f0f2f8':'none'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#667eea,#764ba2)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:11,flexShrink:0}}>{item.quantity}×</div>
                    <span style={{fontWeight:600,color:'#1a202c',fontSize:14}}>{item.name}</span>
                  </div>
                  <span style={{fontWeight:800,color:'#ff6b35',fontSize:14}}>₹{(item.price*item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bill */}
          <div style={{background:'linear-gradient(135deg,#f7f8fc,#f0f2f8)',borderRadius:14,padding:'18px 20px',border:'1px solid #e2e6f0'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#a0aec0',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>💰 Bill Summary</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[['Subtotal',selectedOrder.pricing?.subtotal],['Delivery Fee',selectedOrder.pricing?.deliveryFee],['Tax (5%)',selectedOrder.pricing?.tax]].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#718096'}}>
                  <span>{l}</span><span>₹{(v||0).toFixed(2)}</span>
                </div>
              ))}
              {selectedOrder.pricing?.discount>0&&(
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#065f46',fontWeight:700}}>
                  <span>Discount</span><span>−₹{selectedOrder.pricing.discount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div style={{borderTop:'2px solid #e2e6f0',marginTop:12,paddingTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:800,fontSize:16,color:'#1a202c'}}>Total</span>
              <span style={{fontWeight:900,fontSize:20,color:'#ff6b35'}}>₹{(selectedOrder.pricing?.total||0).toFixed(2)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,paddingTop:10,borderTop:'1px solid #e2e6f0'}}>
              <span style={{fontSize:12,color:'#718096'}}>💳 {selectedOrder.payment?.method}</span>
              <span style={{width:4,height:4,borderRadius:'50%',background:'#c4c9d4',display:'inline-block'}}/>
              {((o_ps,o_pm) => (
                <span style={{fontSize:12,fontWeight:700,color:o_ps==='Completed'?'#065f46':o_ps==='Refunded'?'#1e40af':o_ps==='Failed'?'#991b1b':'#92400e'}}>
                  {o_ps==='Completed'?'✅ Paid':o_ps==='Refunded'?'↩️ Refunded':o_ps==='Failed'?'❌ Order Cancelled':o_pm==='Cash on Delivery'?'💵 Pay on Delivery':'⏳ Pending'}
                </span>
              ))(selectedOrder.payment?.status, selectedOrder.payment?.method)}
            </div>
          </div>

          {/* Status update */}
          {!['Delivered','Cancelled'].includes(selectedOrder.status)&&(
            <div style={{background:'#f7f8fc',borderRadius:14,padding:'16px 20px',border:'1px solid #e2e6f0'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#4a5568',marginBottom:12}}>⚡ Update Order Status</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {['Confirmed','Preparing','Ready','Out for Delivery','Delivered','Cancelled'].map(s=>(
                  <button key={s}
                    onClick={()=>{updateOrderStatus(selectedOrder._id,s);setSelectedOrder(prev=>({...prev,status:s}));}}
                    style={{padding:'7px 14px',borderRadius:8,border:`2px solid ${selectedOrder.status===s?'#667eea':'#e2e6f0'}`,background:selectedOrder.status===s?'linear-gradient(135deg,#667eea,#764ba2)':'white',color:selectedOrder.status===s?'white':'#4a5568',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',whiteSpace:'nowrap'}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        </div>{/* end inner scroll wrapper */}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{minHeight:'100vh',background:'#f0f2f8'}}>

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)',paddingTop:68,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 75% 40%,rgba(102,126,234,0.22) 0%,transparent 60%)',pointerEvents:'none'}}/>
        <div className="container" style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'22px 0 18px',flexWrap:'wrap',gap:16}}>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <div style={{width:50,height:50,background:'rgba(102,126,234,0.2)',border:'1px solid rgba(102,126,234,0.35)',borderRadius:13,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🛡️</div>
              <div>
                <h1 style={{margin:'0 0 3px',fontSize:23,fontWeight:800,letterSpacing:'-0.025em',color:'white'}}>Admin Dashboard</h1>
                <p style={{margin:0,color:'rgba(255,255,255,0.4)',fontSize:13}}>Manage users, restaurants, orders and revenue</p>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#667eea,#764ba2)',border:'2px solid rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:800,color:'white',flexShrink:0}}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{color:'white',fontSize:14,fontWeight:700}}>{user?.name}</div>
                <span style={{display:'inline-block',background:'rgba(255,107,53,0.2)',color:'#ff6b35',border:'1px solid rgba(255,107,53,0.35)',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>Administrator</span>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:2,borderTop:'1px solid rgba(255,255,255,0.08)',overflowX:'auto'}}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{display:'flex',alignItems:'center',gap:7,background:activeTab===tab.key?'rgba(102,126,234,0.15)':'transparent',border:'none',borderBottom:activeTab===tab.key?'3px solid #667eea':'3px solid transparent',padding:'13px 20px',fontSize:13,fontWeight:600,color:activeTab===tab.key?'white':'rgba(255,255,255,0.45)',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',transition:'all 0.15s'}}>
                <span>{tab.icon}</span><span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="container" style={{padding:'28px 0 48px'}}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <h2 style={{margin:'0 0 18px',fontSize:19,fontWeight:800,color:'#1a202c'}}>System Overview</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginBottom:24}}>
              {STAT_CARDS.map((s,i) => (
                <div key={i} onClick={() => setActiveTab(s.tab)}
                  style={{...C,padding:'18px 20px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',transition:'all 0.2s',overflow:'hidden'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(26,26,46,0.13)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 8px rgba(26,26,46,0.07)';}}>
                  <div style={{width:52,height:52,borderRadius:13,background:`linear-gradient(135deg,${s.grad})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{s.icon}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:21,fontWeight:900,color:'#1a202c',letterSpacing:'-0.02em',wordBreak:'break-word',lineHeight:1.2}}>{s.value}</div>
                    <div style={{fontSize:12,color:'#718096',fontWeight:500,marginTop:3}}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{...C,padding:22}}>
              <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:800,color:'#1a202c'}}>🕐 Recent Orders</h3>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {orders.slice(0,10).map(o => (
                  <div key={o._id}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 15px',background:'#f7f8fc',borderRadius:10,borderLeft:'3px solid #667eea',cursor:'pointer'}}
                    onClick={() => setSelectedOrder(o)}>
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      <strong style={{color:'#1a202c',fontSize:14}}>#{o.orderNumber}</strong>
                      <span style={{color:'#718096',fontSize:12}}>{o.user?.name} · {o.restaurant?.name}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={statusPill(o.status)}>{o.status}</span>
                      <span style={{fontWeight:700,color:'#10b981',fontSize:14}}>₹{(o.pricing?.total||0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* USERS */}
        {activeTab === 'users' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,flexWrap:'wrap',gap:12}}>
              <h2 style={{margin:0,fontSize:19,fontWeight:800,color:'#1a202c'}}>👥 User Management</h2>
              <select value={userFilter} onChange={e=>setUserFilter(e.target.value)} style={{padding:'8px 14px',border:'2px solid #e2e6f0',borderRadius:8,fontSize:14,fontWeight:500,color:'#374151',background:'white',cursor:'pointer',fontFamily:'inherit'}}>
                <option value="all">All Users</option>
                <option value="customer">Customers</option>
                <option value="restaurant_owner">Restaurant Owners</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            <div style={{...C,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f7f8fc',borderBottom:'2px solid #e2e6f0'}}>
                  {['User','Email','Phone','Role','Joined','Actions'].map(h=><th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const initials = u.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?';
                    const RS = {customer:{bg:'#eff6ff',c:'#1e40af',l:'👤 Customer'},restaurant_owner:{bg:'#fffbeb',c:'#92400e',l:'🏪 Owner'},admin:{bg:'#f5f3ff',c:'#5b21b6',l:'👨‍💼 Admin'}};
                    const rs = RS[u.role]||{bg:'#f0f2f8',c:'#4a5568',l:u.role};
                    return (
                      <tr key={u._id} style={{borderBottom:'1px solid #f0f2f8',transition:'background 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f7f8fc'} onMouseLeave={e=>e.currentTarget.style.background='white'}>
                        <td style={TD}><div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{position:'relative',flexShrink:0}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${u.isActive===false?'#9ca3af,#6b7280':'#667eea,#764ba2'})`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:13}}>{initials}</div>
                            <div style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:u.isActive===false?'#ef4444':'#10b981',border:'2px solid white'}}/>
                          </div>
                          <div>
                            <div style={{fontWeight:700,color:u.isActive===false?'#9ca3af':'#1a202c',fontSize:14}}>{u.name}</div>
                            {u.isActive===false&&<div style={{fontSize:10,color:'#ef4444',fontWeight:700}}>Deactivated</div>}
                          </div>
                        </div></td>
                        <td style={{...TD,color:'#4a5568'}}>{u.email}</td>
                        <td style={{...TD,color:'#718096'}}>{u.phone||'—'}</td>
                        <td style={TD}><span style={{padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,background:rs.bg,color:rs.c}}>{rs.l}</span></td>
                        <td style={{...TD,color:'#718096'}}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td style={TD}>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            <button onClick={()=>toggleUserStatus(u._id, u.isActive)} disabled={u.role==='admin'}
                              style={{padding:'5px 10px',borderRadius:8,border:'none',background:u.role==='admin'?'#f0f2f8':u.isActive===false?'#ecfdf5':'#fffbeb',color:u.role==='admin'?'#a0aec0':u.isActive===false?'#065f46':'#92400e',fontWeight:700,fontSize:11,cursor:u.role==='admin'?'not-allowed':'pointer',fontFamily:'inherit',opacity:u.role==='admin'?0.6:1,whiteSpace:'nowrap'}}>
                              {u.isActive===false?'🟢 Activate':'🔴 Deactivate'}
                            </button>
                            <button onClick={()=>deleteUser(u._id)} disabled={u.role==='admin'}
                              style={{padding:'5px 10px',borderRadius:8,border:'none',background:u.role==='admin'?'#f0f2f8':'#fef2f2',color:u.role==='admin'?'#a0aec0':'#991b1b',fontWeight:700,fontSize:11,cursor:u.role==='admin'?'not-allowed':'pointer',fontFamily:'inherit',opacity:u.role==='admin'?0.6:1}}>
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESTAURANTS */}
        {activeTab === 'restaurants' && (
          <div>
            <h2 style={{margin:'0 0 18px',fontSize:19,fontWeight:800,color:'#1a202c'}}>🏪 Restaurant Management</h2>
            <div style={{...C,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f7f8fc',borderBottom:'2px solid #e2e6f0'}}>
                  {['Restaurant','Owner','Cuisine','Rating','Delivery','Status','Actions'].map(h=><th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {restaurants.map(r => (
                    <tr key={r._id} style={{borderBottom:'1px solid #f0f2f8',transition:'background 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f7f8fc'} onMouseLeave={e=>e.currentTarget.style.background='white'}>
                      <td style={TD}><div style={{fontWeight:700,color:'#1a202c',fontSize:14}}>{r.name}</div><div style={{fontSize:12,color:'#a0aec0',marginTop:2}}>📍 {r.address?.city}</div></td>
                      <td style={TD}><div style={{fontWeight:600,color:'#4a5568',fontSize:13}}>{r.owner?.name||'—'}</div><div style={{fontSize:11,color:'#a0aec0'}}>{r.owner?.email}</div></td>
                      <td style={TD}>{r.cuisine.slice(0,2).map((c,i)=><span key={i} style={{display:'inline-block',padding:'2px 8px',background:'rgba(102,126,234,0.1)',color:'#667eea',borderRadius:20,fontSize:11,fontWeight:700,marginRight:4}}>{c}</span>)}</td>
                      <td style={TD}><span style={{color:'#f59e0b'}}>⭐</span> <strong style={{color:'#1a202c'}}>{r.rating||0}</strong> <span style={{color:'#a0aec0',fontSize:12}}>({r.totalReviews||0})</span></td>
                      <td style={TD}><div style={{fontSize:12,color:'#4a5568'}}>🕐 {r.deliveryTime}</div><div style={{fontSize:12,color:'#718096'}}>🚚 ₹{r.deliveryFee}</div></td>
                      <td style={TD}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700,background:r.isActive?'#ecfdf5':'#fef2f2',color:r.isActive?'#065f46':'#991b1b',border:`1px solid ${r.isActive?'#6ee7b7':'#fca5a5'}`}}>
                          <span style={{width:6,height:6,borderRadius:'50%',background:r.isActive?'#10b981':'#ef4444',display:'inline-block'}}/>
                          {r.isActive?'Active':'Inactive'}
                        </span>
                      </td>
                      <td style={TD}>
                        <button onClick={()=>toggleRestaurantStatus(r._id,r.isActive)}
                          style={{padding:'6px 13px',borderRadius:8,border:'none',background:r.isActive?'#fffbeb':'#ecfdf5',color:r.isActive?'#92400e':'#065f46',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                          {r.isActive?'🔴 Deactivate':'🟢 Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <div style={{marginBottom:18}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:12}}>
                <div>
                  <h2 style={{margin:'0 0 3px',fontSize:19,fontWeight:800,color:'#1a202c'}}>📦 Order Management</h2>
                  <span style={{fontSize:13,color:'#718096'}}>{filteredOrders.length} order{filteredOrders.length!==1?'s':''} {restaurantFilter!=='all'||orderFilter!=='all'?'filtered':''}</span>
                </div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                  {/* Status filter */}
                  <select value={orderFilter} onChange={e=>setOrderFilter(e.target.value)}
                    style={{padding:'8px 14px',border:'2px solid #e2e6f0',borderRadius:8,fontSize:13,fontWeight:500,color:'#374151',background:'white',cursor:'pointer',fontFamily:'inherit',minWidth:160}}>
                    {['all','Pending','Confirmed','Preparing','Ready','Out for Delivery','Delivered','Cancelled'].map(s=><option key={s} value={s}>{s==='all'?'All Statuses':s}</option>)}
                  </select>
                  {/* Restaurant filter */}
                  <select value={restaurantFilter} onChange={e=>setRestaurantFilter(e.target.value)}
                    style={{padding:'8px 14px',border:'2px solid #e2e6f0',borderRadius:8,fontSize:13,fontWeight:500,color:'#374151',background:'white',cursor:'pointer',fontFamily:'inherit',minWidth:180}}>
                    <option value="all">All Restaurants</option>
                    {restaurants.map(r=><option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                  {/* Reset button — only show when filters are active */}
                  {(orderFilter!=='all'||restaurantFilter!=='all')&&(
                    <button onClick={()=>{setOrderFilter('all');setRestaurantFilter('all');}}
                      style={{padding:'8px 14px',borderRadius:8,border:'none',background:'#f0f2f8',color:'#667eea',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>
              {/* Active filter pills */}
              {(orderFilter!=='all'||restaurantFilter!=='all')&&(
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {orderFilter!=='all'&&<span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',background:'rgba(102,126,234,0.1)',color:'#667eea',borderRadius:20,fontSize:12,fontWeight:700}}>
                    Status: {orderFilter}
                    <button onClick={()=>setOrderFilter('all')} style={{background:'none',border:'none',color:'#667eea',cursor:'pointer',fontSize:14,fontFamily:'inherit',padding:0,lineHeight:1}}>✕</button>
                  </span>}
                  {restaurantFilter!=='all'&&<span style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',background:'rgba(255,107,53,0.1)',color:'#ff6b35',borderRadius:20,fontSize:12,fontWeight:700}}>
                    🏪 {restaurants.find(r=>r._id===restaurantFilter)?.name||'Restaurant'}
                    <button onClick={()=>setRestaurantFilter('all')} style={{background:'none',border:'none',color:'#ff6b35',cursor:'pointer',fontSize:14,fontFamily:'inherit',padding:0,lineHeight:1}}>✕</button>
                  </span>}
                </div>
              )}
            </div>
            <div style={{...C,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f7f8fc',borderBottom:'2px solid #e2e6f0'}}>
                  {['Order #','Customer','Restaurant','Items','Total','Status','Date','Actions'].map(h=><th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o._id} style={{borderBottom:'1px solid #f0f2f8',transition:'background 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f7f8fc'} onMouseLeave={e=>e.currentTarget.style.background='white'}>
                      <td style={TD}><strong style={{color:'#1a202c'}}>#{o.orderNumber}</strong></td>
                      <td style={TD}>{o.user?.name}</td>
                      <td style={TD}>{o.restaurant?.name}</td>
                      <td style={{...TD,color:'#718096'}}>{o.items?.length||0} items</td>
                      <td style={{...TD,fontWeight:700,color:'#ff6b35'}}>₹{(o.pricing?.total||0).toFixed(2)}</td>
                      <td style={TD}>
                        <select value={o.status} onChange={e=>updateOrderStatus(o._id,e.target.value)}
                          style={{padding:'5px 8px',border:'2px solid #e2e6f0',borderRadius:7,fontSize:12,fontWeight:600,color:'#374151',background:'white',cursor:'pointer',fontFamily:'inherit'}}>
                          {['Pending','Confirmed','Preparing','Ready','Out for Delivery','Delivered','Cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{...TD,color:'#718096'}}>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td style={TD}>
                        <button onClick={()=>setSelectedOrder(o)}
                          style={{padding:'6px 13px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#667eea,#764ba2)',color:'white',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHARTS */}
        {activeTab === 'charts' && (() => {
          const chartOrders = chartRestaurant === 'all'
            ? orders
            : orders.filter(o => o.restaurant?._id === chartRestaurant || o.restaurant === chartRestaurant);

          return (
          <div>
            <div style={{marginBottom:22}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:14}}>
                <h2 style={{margin:0,fontSize:19,fontWeight:800,color:'#1a202c'}}>📈 Revenue & Analytics</h2>
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                  {/* Day range buttons */}
                  <div style={{display:'flex',gap:6}}>
                    {[{d:7,l:'7 Days'},{d:14,l:'14 Days'},{d:30,l:'30 Days'}].map(({d,l})=>(
                      <button key={d} onClick={()=>setChartDays(d)}
                        style={{padding:'7px 14px',borderRadius:8,border:`2px solid ${chartDays===d?'#667eea':'#e2e6f0'}`,background:chartDays===d?'linear-gradient(135deg,#667eea,#764ba2)':'white',color:chartDays===d?'white':'#4a5568',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {/* Restaurant filter */}
                  <select value={chartRestaurant} onChange={e=>setChartRestaurant(e.target.value)}
                    style={{padding:'7px 14px',border:`2px solid ${chartRestaurant!=='all'?'#ff6b35':'#e2e6f0'}`,borderRadius:8,fontSize:12,fontWeight:600,color:chartRestaurant!=='all'?'#ff6b35':'#374151',background:'white',cursor:'pointer',fontFamily:'inherit',minWidth:160}}>
                    <option value="all">All Restaurants</option>
                    {restaurants.map(r=><option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                  {chartRestaurant!=='all'&&(
                    <button onClick={()=>setChartRestaurant('all')}
                      style={{padding:'7px 12px',borderRadius:8,border:'none',background:'#f0f2f8',color:'#667eea',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                  )}
                </div>
              </div>
              {/* Active filter pill */}
              {chartRestaurant!=='all'&&(
                <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',background:'rgba(255,107,53,0.1)',color:'#ff6b35',borderRadius:20,fontSize:12,fontWeight:700}}>
                  🏪 {restaurants.find(r=>r._id===chartRestaurant)?.name||'Restaurant'}
                  <button onClick={()=>setChartRestaurant('all')} style={{background:'none',border:'none',color:'#ff6b35',cursor:'pointer',fontSize:14,padding:0,fontFamily:'inherit'}}>✕</button>
                </div>
              )}
            </div>
            {(()=>{
              const today=new Date();
              const days=Array.from({length:chartDays},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-(chartDays-1-i));return d;});
              const dd=days.map(d=>({label:d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric'}),revenue:chartOrders.filter(o=>o.status==='Delivered'&&new Date(o.createdAt).toDateString()===d.toDateString()).reduce((s,o)=>s+(o.pricing?.total||0),0),count:chartOrders.filter(o=>new Date(o.createdAt).toDateString()===d.toDateString()).length}));
              const mx=Math.max(...dd.map(d=>d.revenue),1);
              return(
                <div style={{...C,padding:22,marginBottom:18}}>
                  <div style={{fontWeight:800,fontSize:15,color:'#1a202c',marginBottom:3}}>
                    💰 Daily Revenue — Last {chartDays} Days
                    {chartRestaurant!=='all'&&<span style={{marginLeft:8,padding:'2px 10px',background:'rgba(255,107,53,0.1)',color:'#ff6b35',borderRadius:20,fontSize:12,fontWeight:700}}>🏪 {restaurants.find(r=>r._id===chartRestaurant)?.name}</span>}
                  </div>
                  <div style={{fontSize:13,color:'#718096',marginBottom:22}}>
                    {chartRestaurant==='all'?'All restaurants — delivered orders only':`${restaurants.find(r=>r._id===chartRestaurant)?.name||''} — delivered orders only`}
                  </div>
                  <div style={{display:'flex',alignItems:'flex-end',gap:10,height:190,paddingBottom:8}}>
                    {dd.map((d,i)=>(
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#667eea',minHeight:14}}>{d.revenue>0?'₹'+d.revenue.toFixed(0):''}</div>
                        <div style={{width:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',height:130}}>
                          <div style={{width:'100%',background:d.revenue>0?'linear-gradient(180deg,#667eea,#764ba2)':'#f0f2f8',borderRadius:'6px 6px 0 0',height:Math.max((d.revenue/mx)*120,d.revenue>0?8:4)+'px',transition:'height 0.4s'}}/>
                        </div>
                        <div style={{fontSize:10,color:'#718096',textAlign:'center',lineHeight:1.3}}>{d.label}</div>
                        {d.count>0&&<div style={{fontSize:9,color:'#a0aec0'}}>{d.count} orders</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              {(()=>{
                const bd=[{l:'Delivered',c:'#10b981',n:chartOrders.filter(o=>o.status==='Delivered').length},{l:'Pending',c:'#f59e0b',n:chartOrders.filter(o=>o.status==='Pending').length},{l:'Preparing',c:'#3b82f6',n:chartOrders.filter(o=>o.status==='Preparing').length},{l:'Cancelled',c:'#ef4444',n:chartOrders.filter(o=>o.status==='Cancelled').length},{l:'Confirmed',c:'#8b5cf6',n:chartOrders.filter(o=>o.status==='Confirmed').length},{l:'Out for Del.',c:'#f97316',n:chartOrders.filter(o=>o.status==='Out for Delivery').length}];
                const tot=Math.max(bd.reduce((s,x)=>s+x.n,0),1);
                return(
                  <div style={{...C,padding:22}}>
                    <div style={{fontWeight:800,fontSize:15,color:'#1a202c',marginBottom:16}}>📦 Orders by Status</div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {bd.map((s,i)=>(
                        <div key={i}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                            <span style={{fontWeight:600,color:'#1a202c'}}>{s.l}</span>
                            <span style={{fontWeight:700,color:s.c}}>{s.n} ({((s.n/tot)*100).toFixed(0)}%)</span>
                          </div>
                          <div style={{height:7,background:'#f0f2f8',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:((s.n/tot)*100)+'%',background:s.c,borderRadius:4,transition:'width 0.4s'}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {(()=>{
                const rr=restaurants.map(r=>({name:r.name,rev:chartOrders.filter(o=>o.status==='Delivered'&&(o.restaurant?._id===r._id||o.restaurant===r._id)).reduce((s,o)=>s+(o.pricing?.total||0),0)})).sort((a,b)=>b.rev-a.rev).slice(0,5);
                const mx=Math.max(...rr.map(r=>r.rev),1);
                return(
                  <div style={{...C,padding:22}}>
                    <div style={{fontWeight:800,fontSize:15,color:'#1a202c',marginBottom:16}}>🏪 Top Restaurants</div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {rr.length===0?<div style={{color:'#a0aec0',fontSize:14}}>No delivered orders yet</div>:rr.map((r,i)=>(
                        <div key={i}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                            <span style={{fontWeight:600,color:'#1a202c',display:'flex',alignItems:'center',gap:6}}>
                              <span style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'white',width:18,height:18,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800}}>{i+1}</span>
                              {r.name}
                            </span>
                            <span style={{fontWeight:700,color:'#ff6b35'}}>₹{r.rev.toFixed(2)}</span>
                          </div>
                          <div style={{height:6,background:'#f0f2f8',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',width:((r.rev/mx)*100)+'%',background:'linear-gradient(90deg,#ff6b35,#ff9256)',borderRadius:3,transition:'width 0.4s'}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
              {[
                {l:'Avg Order Value',v:'₹'+(chartOrders.filter(o=>o.status==='Delivered').length?(chartOrders.filter(o=>o.status==='Delivered').reduce((s,o)=>s+(o.pricing?.total||0),0)/chartOrders.filter(o=>o.status==='Delivered').length).toFixed(2):'0.00'),i:'📊',c:'#667eea'},
                {l:'Delivery Rate',v:(chartOrders.length?((chartOrders.filter(o=>o.status==='Delivered').length/chartOrders.length)*100).toFixed(1):0)+'%',i:'🎯',c:'#10b981'},
                {l:"Today's Revenue",v:'₹'+chartOrders.filter(o=>o.status==='Delivered'&&new Date(o.createdAt).toDateString()===new Date().toDateString()).reduce((s,o)=>s+(o.pricing?.total||0),0).toFixed(2),i:'📅',c:'#ff6b35'},
              ].map((x,i)=>(
                <div key={i} style={{...C,padding:20,textAlign:'center'}}>
                  <div style={{fontSize:30,marginBottom:8}}>{x.i}</div>
                  <div style={{fontSize:20,fontWeight:900,color:x.c,letterSpacing:'-0.02em'}}>{x.v}</div>
                  <div style={{fontSize:12,color:'#718096',marginTop:4}}>{x.l}</div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {/* ── Promos Tab ── */}
        {activeTab === 'promos' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'#1a202c' }}>🎟️ Promo Codes</h3>
              <button onClick={() => { setShowPromoForm(true); setEditingPromo(null);
                setPromoForm({ code:'', description:'', discountType:'percentage', discountValue:'', minOrderAmount:'', maxDiscountAmount:'', usageLimit:'', onePerUser:true, isActive:true, expiresAt:'' });
                setPromoMsg({type:'',text:''}); }}
                className="btn btn-primary">➕ Create Promo</button>
            </div>

            {promoMsg.text && (
              <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:16,
                background:promoMsg.type==='success'?'#ecfdf5':'#fef2f2',
                border:`1px solid ${promoMsg.type==='success'?'#6ee7b7':'#fca5a5'}`,
                color:promoMsg.type==='success'?'#065f46':'#991b1b', fontSize:13, fontWeight:600 }}>
                {promoMsg.text}
              </div>
            )}

            {showPromoForm && (
              <div style={{ background:'white', borderRadius:14, padding:24, marginBottom:20, border:'2px solid #667eea', boxShadow:'0 4px 16px rgba(102,126,234,0.12)' }}>
                <h4 style={{ margin:'0 0 18px', fontSize:16, fontWeight:800 }}>{editingPromo ? 'Edit Promo' : 'New Promo Code'}</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Code *</label>
                    <input className="form-control" placeholder="e.g. SAVE20" style={{ textTransform:'uppercase' }}
                      value={promoForm.code} onChange={e=>setPromoForm(p=>({...p,code:e.target.value.toUpperCase()}))} disabled={!!editingPromo} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Description *</label>
                    <input className="form-control" placeholder="e.g. 20% off your order"
                      value={promoForm.description} onChange={e=>setPromoForm(p=>({...p,description:e.target.value}))} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Discount Type *</label>
                    <select className="form-control" value={promoForm.discountType} onChange={e=>setPromoForm(p=>({...p,discountType:e.target.value}))}>
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Discount Value *</label>
                    <input type="number" className="form-control" min="0"
                      value={promoForm.discountValue} onChange={e=>setPromoForm(p=>({...p,discountValue:e.target.value}))} placeholder={promoForm.discountType==='percentage'?'e.g. 20':'e.g. 50'} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Min Order Amount (₹)</label>
                    <input type="number" className="form-control" min="0"
                      value={promoForm.minOrderAmount} onChange={e=>setPromoForm(p=>({...p,minOrderAmount:e.target.value}))} placeholder="0 = no minimum" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Max Discount (₹) — % only</label>
                    <input type="number" className="form-control" min="0"
                      value={promoForm.maxDiscountAmount} onChange={e=>setPromoForm(p=>({...p,maxDiscountAmount:e.target.value}))} placeholder="leave blank = no cap" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Usage Limit</label>
                    <input type="number" className="form-control" min="1"
                      value={promoForm.usageLimit} onChange={e=>setPromoForm(p=>({...p,usageLimit:e.target.value}))} placeholder="leave blank = unlimited" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Expires At</label>
                    <input type="datetime-local" className="form-control"
                      value={promoForm.expiresAt} onChange={e=>setPromoForm(p=>({...p,expiresAt:e.target.value}))} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:20, marginTop:14 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                    <input type="checkbox" checked={promoForm.onePerUser} onChange={e=>setPromoForm(p=>({...p,onePerUser:e.target.checked}))} />
                    One use per customer
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                    <input type="checkbox" checked={promoForm.isActive} onChange={e=>setPromoForm(p=>({...p,isActive:e.target.checked}))} />
                    Active
                  </label>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:18 }}>
                  <button className="btn btn-primary" onClick={async () => {
                    if (!promoForm.code || !promoForm.description || !promoForm.discountValue) {
                      setPromoMsg({type:'error',text:'Code, description and discount value are required'}); return;
                    }
                    try {
                      const token = localStorage.getItem('token');
                      const payload = { code:promoForm.code, description:promoForm.description,
                        discountType:promoForm.discountType, discountValue:Number(promoForm.discountValue),
                        minOrderAmount:Number(promoForm.minOrderAmount)||0,
                        maxDiscountAmount:promoForm.maxDiscountAmount?Number(promoForm.maxDiscountAmount):null,
                        usageLimit:promoForm.usageLimit?Number(promoForm.usageLimit):null,
                        onePerUser:promoForm.onePerUser, isActive:promoForm.isActive,
                        expiresAt:promoForm.expiresAt||null };
                      if (editingPromo) {
                        const r = await axios.put(config.getApiUrl(`/api/promo/${editingPromo._id}`), payload, { headers:{'Authorization':`Bearer ${token}`} });
                        setPromos(prev => prev.map(p => p._id===editingPromo._id ? r.data.data : p));
                        setPromoMsg({type:'success',text:'Promo updated!'});
                      } else {
                        const r = await axios.post(config.getApiUrl('/api/promo'), payload, { headers:{'Authorization':`Bearer ${token}`} });
                        setPromos(prev => [r.data.data, ...prev]);
                        setPromoMsg({type:'success',text:`Promo "${promoForm.code}" created!`});
                      }
                      setShowPromoForm(false); setEditingPromo(null);
                    } catch (err) { setPromoMsg({type:'error',text:err.response?.data?.message||'Failed'}); }
                  }}>✅ {editingPromo ? 'Update' : 'Create'}</button>
                  <button className="btn btn-outline" onClick={()=>{setShowPromoForm(false);setEditingPromo(null);}}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {promos.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#a0aec0' }}>No promo codes yet. Create one above!</div>}
              {promos.map(p => (
                <div key={p._id} style={{ background:'white', borderRadius:12, padding:'14px 18px',
                  border:`1.5px solid ${p.isActive?'#e2e6f0':'#fca5a5'}`, boxShadow:'0 1px 4px rgba(26,26,46,0.06)', opacity:p.isActive?1:0.7 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:900, fontSize:16, color:'#1a202c', letterSpacing:'0.05em' }}>{p.code}</span>
                        {p.isDailyPromo && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fff7ed', color:'#9a3412', fontSize:11, fontWeight:700, border:'1px solid #fdba74' }}>🗓️ Daily</span>}
                        {!p.isActive && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fef2f2', color:'#991b1b', fontSize:11, fontWeight:700 }}>Inactive</span>}
                        {p.restaurant && <span style={{ padding:'2px 8px', borderRadius:10, background:'#eff6ff', color:'#1e40af', fontSize:11, fontWeight:700, border:'1px solid #bfdbfe' }}>🏪 Restaurant</span>}
                      </div>
                      <div style={{ fontSize:13, color:'#4a5568', marginBottom:4 }}>{p.description}</div>
                      <div style={{ fontSize:12, color:'#718096', display:'flex', gap:14, flexWrap:'wrap' }}>
                        <span>💰 {p.discountType==='percentage'?`${p.discountValue}%`:`₹${p.discountValue}`} off{p.maxDiscountAmount?` (max ₹${p.maxDiscountAmount})`:''}</span>
                        {p.minOrderAmount > 0 && <span>Min: ₹{p.minOrderAmount}</span>}
                        <span>Used: {p.usedCount}{p.usageLimit?`/${p.usageLimit}`:''} times</span>
                        {p.onePerUser && <span>👤 Once per user</span>}
                        {p.expiresAt && <span>⏰ Expires: {new Date(p.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => { setEditingPromo(p); setShowPromoForm(true);
                        setPromoForm({ code:p.code, description:p.description, discountType:p.discountType,
                          discountValue:p.discountValue, minOrderAmount:p.minOrderAmount||'',
                          maxDiscountAmount:p.maxDiscountAmount||'', usageLimit:p.usageLimit||'',
                          onePerUser:p.onePerUser, isActive:p.isActive,
                          expiresAt:p.expiresAt?new Date(p.expiresAt).toISOString().slice(0,16):'' });
                        setPromoMsg({type:'',text:''}); window.scrollTo({top:0,behavior:'smooth'}); }}
                        className="btn btn-outline btn-sm">✏️ Edit</button>
                      <button onClick={async () => {
                        if (!window.confirm(`Delete promo "${p.code}"?`)) return;
                        try {
                          const token = localStorage.getItem('token');
                          await axios.delete(config.getApiUrl(`/api/promo/${p._id}`), { headers:{'Authorization':`Bearer ${token}`} });
                          setPromos(prev => prev.filter(x => x._id !== p._id));
                          setPromoMsg({type:'success',text:'Promo deleted'});
                        } catch {}
                      }} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #fca5a5', background:'#fef2f2', color:'#991b1b', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>

      {orderModal}

    </div>
  );
};

export default AdminDashboard;