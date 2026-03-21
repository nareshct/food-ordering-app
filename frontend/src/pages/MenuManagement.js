import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';

const MenuManagement = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pageTab, setPageTab] = useState(
    new URLSearchParams(location.search).get('tab') === 'promo' ? 'promo' : 'menu'
  );

  const [formData, setFormData] = useState({
    name: '', description: '', category: '', price: '',
    image: '', isVegetarian: false, isAvailable: true,
    preparationTime: '', spicyLevel: 'Medium'
  });

  // ── Promo state ─────────────────────────────────────────────────────────────
  const [showDailyPromo, setShowDailyPromo] = useState(false);
  const [dailyPromoForm, setDailyPromoForm] = useState({
    discountType: 'percentage', discountValue: '', maxDiscountAmount: '',
    description: '', appliesTo: 'all', menuItems: []
  });
  const [todayPromo, setTodayPromo] = useState(null);
  const [promoMsg, setPromoMsg] = useState({ type: '', text: '' });
  const [promoSaving, setPromoSaving] = useState(false);
  const [restaurantPromos, setRestaurantPromos] = useState([]);
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [promoFormData, setPromoFormData] = useState({
    code: '', description: '', discountType: 'percentage',
    discountValue: '', minOrderAmount: '', maxDiscountAmount: '',
    usageLimit: '', onePerUser: true, expiresAt: ''
  });
  const [promoFormMsg, setPromoFormMsg] = useState({ type: '', text: '' });
  const [editingPromo, setEditingPromo] = useState(null); // null = create mode, object = edit mode
  const [promoFormSaving, setPromoFormSaving] = useState(false);
  const promoSectionRef = useRef(null);

  const categories = ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Salads', 'Soups', 'Breads', 'Rice', 'Sides'];
  const spicyLevels = ['Mild', 'Medium', 'Hot', 'Extra Hot'];

  // ── Data fetchers ────────────────────────────────────────────────────────────
  const fetchRestaurant = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${config.getApiUrl(config.endpoints.restaurants)}/${restaurantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRestaurant(response.data.data);
      const userId = user?._id || user?.id;
      if (response.data.data.owner._id !== userId && user?.role !== 'admin') {
        alert('You do not have permission to manage this restaurant menu');
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Failed to load restaurant');
    }
  }, [restaurantId, user, navigate]);

  const fetchMenuItems = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${config.getApiUrl(config.endpoints.menu)}/restaurant/${restaurantId}/all`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sorted = [...response.data.data].sort((a, b) => b.isAvailable - a.isAvailable);
      setMenuItems(sorted);
      setLoading(false);
    } catch (err) {
      setError('Failed to load menu items');
      setLoading(false);
    }
  }, [restaurantId]);

  const fetchTodayPromo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        config.getApiUrl('/api/promo/restaurant/' + restaurantId),
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const allPromos = res.data.data || [];
      const today = new Date().toISOString().split('T')[0];
      const found = allPromos.find(p => p.isDailyPromo && p.validDate === today);
      if (found) {
        setTodayPromo(found);
        setDailyPromoForm({
          discountType: found.discountType,
          discountValue: found.discountValue,
          maxDiscountAmount: found.maxDiscountAmount || '',
          description: found.description,
          appliesTo: found.appliesTo || 'all',
          menuItems: (found.menuItems || []).map(m => m._id || m)
        });
      }
      setRestaurantPromos(allPromos.filter(p => !p.isDailyPromo));
    } catch {}
  }, [restaurantId]);

  // ── ALL useEffect hooks at the top level — NEVER after an early return ───────
  useEffect(() => {
    if (user && (user.role === 'restaurant_owner' || user.role === 'admin')) {
      fetchRestaurant();
      fetchMenuItems();
    } else if (user) {
      navigate('/');
    }
  }, [user, navigate, fetchRestaurant, fetchMenuItems]);

  useEffect(() => {
    if (restaurantId) fetchTodayPromo();
  }, [restaurantId, fetchTodayPromo]);

  // Scroll to promo section when tab is promo AND page has finished loading
  useEffect(() => {
    if (pageTab === 'promo' && !loading) {
      // Use a longer timeout to ensure DOM is fully rendered after loading state clears
      const t = setTimeout(() => {
        if (promoSectionRef.current) {
          promoSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [pageTab, loading]);

  // ── Image upload ─────────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const token = localStorage.getItem('token');
      const formDataObj = new FormData();
      formDataObj.append('image', file);
      const res = await axios.post(
        `${config.API_URL}/api/upload/menu`, formDataObj,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      setFormData(prev => ({ ...prev, image: res.data.imageUrl }));
    } catch (err) {
      alert('Image upload failed: ' + (err.response?.data?.message || err.message));
    } finally { setUploadingImage(false); }
  };

  // ── Menu item handlers ───────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const menuData = {
        restaurant: restaurantId,
        name: formData.name, description: formData.description,
        category: formData.category, price: Number(formData.price),
        image: formData.image || 'https://via.placeholder.com/300x200?text=Food+Item',
        isVegetarian: formData.isVegetarian, isAvailable: formData.isAvailable,
        preparationTime: formData.preparationTime, spicyLevel: formData.spicyLevel
      };
      if (editingItem) {
        await axios.put(`${config.getApiUrl(config.endpoints.menu)}/${editingItem._id}`, menuData,
          { headers: { Authorization: `Bearer ${token}` } });
        alert('Menu item updated!');
      } else {
        await axios.post(config.getApiUrl(config.endpoints.menu), menuData,
          { headers: { Authorization: `Bearer ${token}` } });
        alert('Menu item added!');
      }
      setFormData({ name:'', description:'', category:'', price:'', image:'', isVegetarian:false, isAvailable:true, preparationTime:'', spicyLevel:'Medium' });
      setShowAddForm(false); setEditingItem(null);
      fetchMenuItems();
    } catch (err) {
      alert('Failed to save menu item: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ name:item.name, description:item.description, category:item.category, price:item.price,
      image:item.image, isVegetarian:item.isVegetarian, isAvailable:item.isAvailable,
      preparationTime:item.preparationTime||'', spicyLevel:item.spicyLevel||'Medium' });
    setShowAddForm(true);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Delete this menu item?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${config.getApiUrl(config.endpoints.menu)}/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } });
      fetchMenuItems();
    } catch { alert('Failed to delete menu item'); }
  };

  const toggleAvailability = async (item) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${config.getApiUrl(config.endpoints.menu)}/${item._id}`,
        { ...item, isAvailable: !item.isAvailable },
        { headers: { Authorization: `Bearer ${token}` } });
      fetchMenuItems();
    } catch { alert('Failed to update availability'); }
  };

  const cancelEdit = () => {
    setShowAddForm(false); setEditingItem(null);
    setFormData({ name:'', description:'', category:'', price:'', image:'', isVegetarian:false, isAvailable:true, preparationTime:'', spicyLevel:'Medium' });
  };

  // ── Promo handlers ───────────────────────────────────────────────────────────
  const handleSaveDailyPromo = async () => {
    if (!dailyPromoForm.discountValue || Number(dailyPromoForm.discountValue) <= 0) {
      setPromoMsg({ type:'error', text:'Enter a valid discount value' }); return;
    }
    if (dailyPromoForm.appliesTo === 'specific' && dailyPromoForm.menuItems.length === 0) {
      setPromoMsg({ type:'error', text:'Select at least one menu item' }); return;
    }
    setPromoSaving(true); setPromoMsg({ type:'', text:'' });
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(config.getApiUrl('/api/promo/daily'), {
        restaurantId,
        discountType: dailyPromoForm.discountType,
        discountValue: Number(dailyPromoForm.discountValue),
        maxDiscountAmount: dailyPromoForm.maxDiscountAmount ? Number(dailyPromoForm.maxDiscountAmount) : null,
        description: dailyPromoForm.description || `Today special ${dailyPromoForm.discountValue}${dailyPromoForm.discountType === 'percentage' ? '% off' : ' Rs off'}!`,
        appliesTo: dailyPromoForm.appliesTo,
        menuItems: dailyPromoForm.appliesTo === 'specific' ? dailyPromoForm.menuItems : []
      }, { headers: { Authorization: 'Bearer ' + token } });
      if (res.data.success) {
        setTodayPromo(res.data.data);
        setPromoMsg({ type:'success', text:'Daily promo saved! Code: ' + res.data.data.code });
        setShowDailyPromo(false);
      }
    } catch (err) {
      setPromoMsg({ type:'error', text: err.response?.data?.message || 'Failed' });
    } finally { setPromoSaving(false); }
  };

  const handleCreatePromoCode = async () => {
    if (!promoFormData.code || !promoFormData.description || !promoFormData.discountValue) {
      setPromoFormMsg({ type:'error', text:'Code, description and discount value are required' }); return;
    }
    setPromoFormSaving(true); setPromoFormMsg({ type:'', text:'' });
    try {
      const token = localStorage.getItem('token');
      const payload = {
        description: promoFormData.description,
        discountType: promoFormData.discountType,
        discountValue: Number(promoFormData.discountValue),
        minOrderAmount: Number(promoFormData.minOrderAmount) || 0,
        maxDiscountAmount: promoFormData.maxDiscountAmount ? Number(promoFormData.maxDiscountAmount) : null,
        usageLimit: promoFormData.usageLimit ? Number(promoFormData.usageLimit) : null,
        onePerUser: promoFormData.onePerUser,
        expiresAt: promoFormData.expiresAt || null,
        restaurant: restaurantId, createdBy: 'restaurant'
      };
      if (editingPromo) {
        // Edit mode — PUT
        const res = await axios.put(config.getApiUrl('/api/promo/' + editingPromo._id),
          payload, { headers: { Authorization: 'Bearer ' + token } });
        if (res.data.success) {
          setRestaurantPromos(prev => prev.map(p => p._id === editingPromo._id ? res.data.data : p));
          setPromoFormMsg({ type:'success', text:'Promo updated!' });
          setShowCreatePromo(false); setEditingPromo(null);
          setPromoFormData({ code:'', description:'', discountType:'percentage', discountValue:'', minOrderAmount:'', maxDiscountAmount:'', usageLimit:'', onePerUser:true, expiresAt:'' });
        }
      } else {
        // Create mode — POST
        const res = await axios.post(config.getApiUrl('/api/promo'),
          { ...payload, code: promoFormData.code.toUpperCase().trim(), isActive: true },
          { headers: { Authorization: 'Bearer ' + token } });
        if (res.data.success) {
          setRestaurantPromos(prev => [res.data.data, ...prev]);
          setPromoFormMsg({ type:'success', text:'Promo created! Share code: ' + res.data.data.code });
          setShowCreatePromo(false);
          setPromoFormData({ code:'', description:'', discountType:'percentage', discountValue:'', minOrderAmount:'', maxDiscountAmount:'', usageLimit:'', onePerUser:true, expiresAt:'' });
        }
      }
    } catch (err) {
      setPromoFormMsg({ type:'error', text: err.response?.data?.message || 'Failed' });
    } finally { setPromoFormSaving(false); }
  };

  const handleDeletePromoCode = async (promoId) => {
    if (!window.confirm('Delete this promo code?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(config.getApiUrl('/api/promo/' + promoId),
        { headers: { Authorization: 'Bearer ' + token } });
      setRestaurantPromos(prev => prev.filter(p => p._id !== promoId));
    } catch {}
  };

  const handleDeactivateDailyPromo = async () => {
    if (!todayPromo) return;
    if (!window.confirm('Deactivate promo? Customers will no longer get this discount.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(config.getApiUrl('/api/promo/' + todayPromo._id),
        { isActive: false }, { headers: { Authorization: 'Bearer ' + token } });
      setTodayPromo(prev => ({ ...prev, isActive: false }));
      setPromoMsg({ type:'success', text:'Daily promo deactivated.' });
    } catch {}
  };

  const handleDeleteDailyPromo = async () => {
    if (!todayPromo) return;
    if (!window.confirm('Delete today\'s promo? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(config.getApiUrl('/api/promo/' + todayPromo._id),
        { headers: { Authorization: 'Bearer ' + token } });
      setTodayPromo(null);
      setDailyPromoForm({ discountType:'percentage', discountValue:'', maxDiscountAmount:'', description:'', appliesTo:'all', menuItems:[] });
      setPromoMsg({ type:'success', text:'Daily promo deleted.' });
    } catch (err) {
      setPromoMsg({ type:'error', text: err.response?.data?.message || 'Failed to delete' });
    }
  };

  const handleEditPromoCode = (promo) => {
    setEditingPromo(promo);
    setPromoFormData({
      code: promo.code,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minOrderAmount: promo.minOrderAmount || '',
      maxDiscountAmount: promo.maxDiscountAmount || '',
      usageLimit: promo.usageLimit || '',
      onePerUser: promo.onePerUser,
      expiresAt: promo.expiresAt ? new Date(promo.expiresAt).toISOString().slice(0,16) : ''
    });
    setShowCreatePromo(true);
    setPromoFormMsg({ type:'', text:'' });
  };

  const handleTogglePromoCode = async (promo) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(config.getApiUrl('/api/promo/' + promo._id),
        { isActive: !promo.isActive },
        { headers: { Authorization: 'Bearer ' + token } });
      setRestaurantPromos(prev => prev.map(p => p._id === promo._id ? { ...p, isActive: !p.isActive } : p));
    } catch (err) {
      setPromoFormMsg({ type:'error', text: err.response?.data?.message || 'Failed to update' });
    }
  };

  // ── Grouped items ────────────────────────────────────────────────────────────
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // ── Loading state — AFTER all hooks ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="container" style={{ padding:'100px 20px', textAlign:'center' }}>
        <div className="spinner" />
        <p>Loading menu...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', backgroundColor:'#f8f9fa', paddingTop:100, paddingBottom:50 }}>
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom:30 }}>
          <button onClick={() => navigate('/dashboard')} className="btn btn-outline btn-sm"
            style={{ marginBottom:15 }}>← Back to Dashboard</button>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h1 style={{ margin:0, color:'#2c3e50' }}>Menu Management</h1>
              {restaurant && <p style={{ color:'#666', marginTop:5 }}>{restaurant.name}</p>}
            </div>
            {pageTab === 'menu' && (
              <button onClick={() => { setShowAddForm(true); setEditingItem(null); }} className="btn btn-primary">
                ➕ Add Menu Item
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display:'flex', borderBottom:'2px solid #e2e6f0', marginBottom:24, background:'white', borderRadius:'12px 12px 0 0' }}>
          {[{ k:'menu', l:'📋 Menu Items' }, { k:'promo', l:'🎁 Daily Promo' }].map(t => (
            <button key={t.k} onClick={() => setPageTab(t.k)}
              style={{ padding:'12px 28px', border:'none', cursor:'pointer', fontFamily:'inherit',
                fontWeight:700, fontSize:14, background:'transparent',
                color: pageTab === t.k ? '#667eea' : '#718096',
                borderBottom: '3px solid ' + (pageTab === t.k ? '#667eea' : 'transparent'),
                marginBottom:'-2px', transition:'all 0.15s' }}>
              {t.l}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:20 }}>{error}</div>}

        {/* ── Menu Items Tab ── */}
        {pageTab === 'menu' && (
          <div>
            {Object.keys(groupedItems).length === 0 ? (
              <div style={{ textAlign:'center', padding:50, background:'white', borderRadius:10 }}>
                <div style={{ fontSize:80, marginBottom:20 }}>🍽️</div>
                <h2>No Menu Items Yet</h2>
                <p style={{ color:'#666', marginBottom:30 }}>Start adding items to your restaurant menu</p>
                <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-lg">➕ Add First Menu Item</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:30 }}>
                {Object.keys(groupedItems).sort().map(category => (
                  <div key={category}>
                    <h2 style={{ marginBottom:20, color:'#2c3e50', fontSize:24, paddingBottom:10, borderBottom:'2px solid #667eea' }}>
                      {category} ({groupedItems[category].length})
                    </h2>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
                      {groupedItems[category].map(item => (
                        <div key={item._id} style={{ background:'white', borderRadius:10, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', opacity:item.isAvailable ? 1 : 0.6 }}>
                          <div style={{ height:180, backgroundImage:`url(${item.image})`, backgroundSize:'cover', backgroundPosition:'center', position:'relative' }}>
                            {!item.isAvailable && (
                              <div style={{ position:'absolute', top:10, right:10, background:'#dc3545', color:'white', padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600 }}>Unavailable</div>
                            )}
                            {item.isVegetarian && (
                              <div style={{ position:'absolute', top:10, left:10, background:'#28a745', color:'white', padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600 }}>🌱 Veg</div>
                            )}
                          </div>
                          <div style={{ padding:15 }}>
                            <h3 style={{ margin:'0 0 8px', fontSize:18, color:'#2c3e50' }}>{item.name}</h3>
                            <p style={{ color:'#666', fontSize:14, margin:'0 0 12px', lineHeight:1.5 }}>{item.description}</p>
                            <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
                              {item.preparationTime && <span style={{ fontSize:12, background:'#f0f0f0', padding:'4px 10px', borderRadius:12, color:'#666' }}>⏱️ {item.preparationTime}</span>}
                              {item.spicyLevel && <span style={{ fontSize:12, background:'#fff3cd', padding:'4px 10px', borderRadius:12, color:'#856404' }}>🌶️ {item.spicyLevel}</span>}
                            </div>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:15, paddingTop:15, borderTop:'1px solid #eee' }}>
                              <div style={{ fontSize:24, fontWeight:'bold', color:'#667eea' }}>₹{item.price}</div>
                              <div style={{ display:'flex', gap:8 }}>
                                <div onClick={() => toggleAvailability(item)}
                                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:10, cursor:'pointer',
                                    background:item.isAvailable ? '#ecfdf5' : '#fef2f2',
                                    border:'1.5px solid ' + (item.isAvailable ? '#6ee7b7' : '#fca5a5'), userSelect:'none', transition:'all 0.2s' }}>
                                  <span style={{ fontSize:12, fontWeight:700, color:item.isAvailable ? '#065f46' : '#991b1b' }}>
                                    {item.isAvailable ? '✅ Available' : '❌ Unavailable'}
                                  </span>
                                  <div style={{ width:36, height:20, borderRadius:10, position:'relative', background:item.isAvailable ? '#10b981' : '#d1d5db', transition:'background 0.2s', flexShrink:0 }}>
                                    <div style={{ width:14, height:14, borderRadius:'50%', background:'white', position:'absolute', top:3, left:item.isAvailable ? 19 : 3, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.25)' }} />
                                  </div>
                                </div>
                                <button onClick={() => handleEdit(item)} className="btn btn-outline btn-sm" title="Edit">✏️</button>
                                <button onClick={() => handleDelete(item._id)} className="btn btn-danger btn-sm" title="Delete">🗑️</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Promo Tab ── */}
        {pageTab === 'promo' && (
          <div ref={promoSectionRef}>

            {/* Today's Daily Promo */}
            <div style={{ background:'white', borderRadius:16, border:'1px solid #e2e6f0', overflow:'hidden', marginBottom:20 }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid #f0f2f8', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'#1a202c' }}>🗓️ Today's Daily Promo</h3>
                  <p style={{ margin:'4px 0 0', fontSize:13, color:'#718096' }}>Valid today only — automatically applied for all customers</p>
                </div>
                {!showDailyPromo && (
                  <button onClick={() => { setShowDailyPromo(true); setPromoMsg({ type:'', text:'' }); }} className="btn btn-primary">
                    {todayPromo && todayPromo.isActive ? '✏️ Edit Today Promo' : '➕ Add Today Promo'}
                  </button>
                )}
              </div>
              <div style={{ padding:'16px 24px' }}>
                {promoMsg.text && (
                  <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14,
                    background:promoMsg.type==='success'?'#ecfdf5':'#fef2f2',
                    border:'1px solid '+(promoMsg.type==='success'?'#6ee7b7':'#fca5a5'),
                    color:promoMsg.type==='success'?'#065f46':'#991b1b', fontSize:13, fontWeight:600 }}>
                    {promoMsg.text}
                  </div>
                )}
                {todayPromo && !showDailyPromo && (
                  <div style={{ background:todayPromo.isActive?'#ecfdf5':'#fef2f2', border:'1.5px solid '+(todayPromo.isActive?'#6ee7b7':'#fca5a5'), borderRadius:12, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15, color:'#1a202c', marginBottom:4 }}>
                        {todayPromo.isActive ? '🟢' : '🔴'} Code: <span style={{ color:'#667eea' }}>{todayPromo.code}</span>
                      </div>
                      <div style={{ fontSize:13, color:'#4a5568', marginBottom:3 }}>{todayPromo.description}</div>
                      <div style={{ fontSize:12, color:'#718096' }}>
                        {todayPromo.discountType==='percentage' ? todayPromo.discountValue+'% off' : '₹'+todayPromo.discountValue+' off'}
                        {todayPromo.maxDiscountAmount ? ' (max ₹'+todayPromo.maxDiscountAmount+')' : ''}
                        {' — used '}{todayPromo.usedCount}{' time(s) today'}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={() => setShowDailyPromo(true)} className="btn btn-outline btn-sm">✏️ Edit</button>
                      {todayPromo.isActive && (
                        <button onClick={handleDeactivateDailyPromo}
                          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #fde68a', background:'#fffbeb', color:'#92400e', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                          ⏸ Deactivate
                        </button>
                      )}
                      {!todayPromo.isActive && (
                        <button onClick={async () => {
                          const token = localStorage.getItem('token');
                          await axios.put(config.getApiUrl('/api/promo/' + todayPromo._id),
                            { isActive: true }, { headers: { Authorization: 'Bearer ' + token } });
                          setTodayPromo(prev => ({ ...prev, isActive: true }));
                          setPromoMsg({ type:'success', text:'Daily promo re-activated.' });
                        }}
                          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #6ee7b7', background:'#ecfdf5', color:'#065f46', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                          ▶ Activate
                        </button>
                      )}
                      <button onClick={handleDeleteDailyPromo}
                        style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #fca5a5', background:'#fef2f2', color:'#991b1b', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
                {!todayPromo && !showDailyPromo && (
                  <div style={{ textAlign:'center', padding:24, color:'#a0aec0' }}>
                    No promo for today. Click "Add Today Promo" to create one!
                  </div>
                )}
                {showDailyPromo && (
                  <div style={{ background:'#f7f8fc', borderRadius:12, padding:20, border:'1px solid #e2e6f0' }}>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>
                      {todayPromo ? 'Update Today Promo' : 'Create Today Promo'}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Discount Type</label>
                        <select className="form-control" value={dailyPromoForm.discountType}
                          onChange={e => setDailyPromoForm(p => ({ ...p, discountType:e.target.value }))}>
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">{dailyPromoForm.discountType==='percentage' ? 'Discount %' : 'Amount (₹)'} *</label>
                        <input type="number" className="form-control" min="1"
                          value={dailyPromoForm.discountValue}
                          onChange={e => setDailyPromoForm(p => ({ ...p, discountValue:e.target.value }))}
                          placeholder={dailyPromoForm.discountType==='percentage' ? 'e.g. 20' : 'e.g. 50'} />
                      </div>
                    </div>
                    {dailyPromoForm.discountType === 'percentage' && (
                      <div className="form-group">
                        <label className="form-label">Max Discount (₹) — optional cap</label>
                        <input type="number" className="form-control" min="0"
                          value={dailyPromoForm.maxDiscountAmount}
                          onChange={e => setDailyPromoForm(p => ({ ...p, maxDiscountAmount:e.target.value }))}
                          placeholder="Leave blank for no cap" />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input type="text" className="form-control" value={dailyPromoForm.description}
                        onChange={e => setDailyPromoForm(p => ({ ...p, description:e.target.value }))}
                        placeholder="e.g. Monday special 20% off!" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Applies To</label>
                      <div style={{ display:'flex', gap:10 }}>
                        {[['all','Entire Menu'],['specific','Specific Items']].map(([val, lbl]) => (
                          <label key={val} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13,
                            border:'2px solid '+(dailyPromoForm.appliesTo===val?'#667eea':'#e2e6f0'),
                            background:dailyPromoForm.appliesTo===val?'rgba(102,126,234,0.06)':'white',
                            color:dailyPromoForm.appliesTo===val?'#667eea':'#4a5568' }}>
                            <input type="radio" style={{ display:'none' }} checked={dailyPromoForm.appliesTo===val}
                              onChange={() => setDailyPromoForm(p => ({ ...p, appliesTo:val, menuItems:[] }))} />
                            {lbl}
                          </label>
                        ))}
                      </div>
                    </div>
                    {dailyPromoForm.appliesTo === 'specific' && (
                      <div className="form-group">
                        <label className="form-label">Select Menu Items *</label>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, maxHeight:180, overflowY:'auto', padding:10, background:'white', borderRadius:8, border:'1px solid #e2e6f0' }}>
                          {menuItems.filter(i => i.isAvailable).map(item => {
                            const sel = dailyPromoForm.menuItems.includes(item._id);
                            return (
                              <button key={item._id} type="button"
                                onClick={() => setDailyPromoForm(p => ({
                                  ...p, menuItems: sel ? p.menuItems.filter(id => id!==item._id) : [...p.menuItems, item._id]
                                }))}
                                style={{ padding:'5px 12px', borderRadius:20, fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                                  border:'1.5px solid '+(sel?'#667eea':'#e2e6f0'),
                                  background:sel?'rgba(102,126,234,0.1)':'white', color:sel?'#667eea':'#718096' }}>
                                {sel ? '✓ ' : ''}{item.name} — ₹{item.price}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ fontSize:12, color:'#a0aec0', marginTop:6 }}>{dailyPromoForm.menuItems.length} selected</div>
                      </div>
                    )}
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#1e40af', fontWeight:600 }}>
                      Valid today only. Auto-applied for all customers once per person.
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={handleSaveDailyPromo} className="btn btn-primary" disabled={promoSaving}>
                        {promoSaving ? 'Saving...' : 'Save Promo'}
                      </button>
                      <button onClick={() => { setShowDailyPromo(false); setPromoMsg({ type:'', text:'' }); }} className="btn btn-outline">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Permanent Promo Codes */}
            <div style={{ background:'white', borderRadius:16, border:'1px solid #e2e6f0', overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid #f0f2f8', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'#1a202c' }}>🎟️ My Promo Codes</h3>
                  <p style={{ margin:'4px 0 0', fontSize:13, color:'#718096' }}>Permanent codes customers can enter at checkout — share anytime</p>
                </div>
                {!showCreatePromo && (
                  <button onClick={() => { setShowCreatePromo(true); setPromoFormMsg({ type:'', text:'' }); }} className="btn btn-primary">
                    + Create Promo Code
                  </button>
                )}
              </div>
              <div style={{ padding:'16px 24px' }}>
                {promoFormMsg.text && (
                  <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14,
                    background:promoFormMsg.type==='success'?'#ecfdf5':'#fef2f2',
                    border:'1px solid '+(promoFormMsg.type==='success'?'#6ee7b7':'#fca5a5'),
                    color:promoFormMsg.type==='success'?'#065f46':'#991b1b', fontSize:13, fontWeight:600 }}>
                    {promoFormMsg.text}
                  </div>
                )}
                {showCreatePromo && (
                  <div style={{ background:'#f7f8fc', borderRadius:12, padding:20, border:'1px solid #e2e6f0', marginBottom:16 }}>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>{editingPromo ? '✏️ Edit Promo Code' : '➕ New Promo Code'}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Code * {editingPromo && <span style={{color:'#a0aec0',fontWeight:400,fontSize:11}}>(cannot change code)</span>}</label>
                        <input className="form-control" style={{ textTransform:'uppercase', background: editingPromo ? '#f7f8fc' : 'white' }}
                          placeholder="SAVE20" value={promoFormData.code} disabled={!!editingPromo}
                          onChange={e => setPromoFormData(p => ({ ...p, code:e.target.value.toUpperCase() }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Description *</label>
                        <input className="form-control" placeholder="e.g. 20% off your order" value={promoFormData.description}
                          onChange={e => setPromoFormData(p => ({ ...p, description:e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Discount Type</label>
                        <select className="form-control" value={promoFormData.discountType}
                          onChange={e => setPromoFormData(p => ({ ...p, discountType:e.target.value }))}>
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">{promoFormData.discountType==='percentage' ? 'Discount %' : 'Amount (₹)'} *</label>
                        <input type="number" className="form-control" min="1" value={promoFormData.discountValue}
                          onChange={e => setPromoFormData(p => ({ ...p, discountValue:e.target.value }))}
                          placeholder={promoFormData.discountType==='percentage' ? '20' : '50'} />
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Min Order Amount (₹)</label>
                        <input type="number" className="form-control" min="0" placeholder="0 = no minimum"
                          value={promoFormData.minOrderAmount}
                          onChange={e => setPromoFormData(p => ({ ...p, minOrderAmount:e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Usage Limit</label>
                        <input type="number" className="form-control" min="1" placeholder="blank = unlimited"
                          value={promoFormData.usageLimit}
                          onChange={e => setPromoFormData(p => ({ ...p, usageLimit:e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Expires At</label>
                        <input type="datetime-local" className="form-control" value={promoFormData.expiresAt}
                          onChange={e => setPromoFormData(p => ({ ...p, expiresAt:e.target.value }))} />
                      </div>
                      <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, fontSize:13 }}>
                          <input type="checkbox" checked={promoFormData.onePerUser}
                            onChange={e => setPromoFormData(p => ({ ...p, onePerUser:e.target.checked }))} />
                          One use per customer
                        </label>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={handleCreatePromoCode} className="btn btn-primary" disabled={promoFormSaving}>
                        {promoFormSaving ? (editingPromo ? 'Updating...' : 'Creating...') : (editingPromo ? '✅ Update Code' : '✅ Create Code')}
                      </button>
                      <button onClick={() => { setShowCreatePromo(false); setEditingPromo(null); setPromoFormMsg({ type:'', text:'' }); setPromoFormData({ code:'', description:'', discountType:'percentage', discountValue:'', minOrderAmount:'', maxDiscountAmount:'', usageLimit:'', onePerUser:true, expiresAt:'' }); }} className="btn btn-outline">Cancel</button>
                    </div>
                  </div>
                )}
                {restaurantPromos.length === 0 && !showCreatePromo && (
                  <div style={{ textAlign:'center', padding:32, color:'#a0aec0' }}>
                    No promo codes yet. Click "Create Promo Code" to add one!
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {restaurantPromos.map(p => (
                    <div key={p._id} style={{ background:'white', borderRadius:12, padding:'14px 18px',
                      border:'1.5px solid '+(p.isActive?'#e2e6f0':'#fca5a5'), opacity:p.isActive?1:0.7 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                            <span style={{ fontWeight:900, fontSize:16, letterSpacing:'0.05em', background:'#f0f2f8', padding:'3px 12px', borderRadius:8, color:'#1a202c' }}>{p.code}</span>
                            {!p.isActive && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fef2f2', color:'#991b1b', fontSize:11, fontWeight:700 }}>Inactive</span>}
                          </div>
                          <div style={{ fontSize:13, color:'#4a5568', marginBottom:4 }}>{p.description}</div>
                          <div style={{ fontSize:12, color:'#718096', display:'flex', gap:12, flexWrap:'wrap' }}>
                            <span>{p.discountType==='percentage' ? p.discountValue+'% off' : '₹'+p.discountValue+' off'}</span>
                            {p.minOrderAmount > 0 && <span>Min: ₹{p.minOrderAmount}</span>}
                            <span>Used: {p.usedCount}{p.usageLimit ? '/'+p.usageLimit : ''} times</span>
                            {p.onePerUser && <span>Once per customer</span>}
                            {p.expiresAt && <span>Expires: {new Date(p.expiresAt).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          <button onClick={() => handleEditPromoCode(p)}
                            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1e40af', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleTogglePromoCode(p)}
                            style={{ padding:'6px 12px', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                              border: p.isActive ? '1px solid #fde68a' : '1px solid #6ee7b7',
                              background: p.isActive ? '#fffbeb' : '#ecfdf5',
                              color: p.isActive ? '#92400e' : '#065f46' }}>
                            {p.isActive ? '⏸ Deactivate' : '▶ Activate'}
                          </button>
                          <button onClick={() => handleDeletePromoCode(p._id)}
                            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #fca5a5', background:'#fef2f2', color:'#991b1b', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Add/Edit Menu Item Modal */}
        {showAddForm && (
          <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, overflowY:'auto' }}>
            <div style={{ background:'white', borderRadius:10, padding:30, maxWidth:600, width:'100%', maxHeight:'90vh', overflowY:'auto', margin:'20px 0' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <h2 style={{ margin:0 }}>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                <button onClick={cancelEdit} style={{ background:'transparent', border:'none', fontSize:24, cursor:'pointer', color:'#999' }}>×</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="name">Item Name *</label>
                  <input type="text" id="name" name="name" className="form-control" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Butter Chicken" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="description">Description *</label>
                  <textarea id="description" name="description" className="form-control" value={formData.description} onChange={handleInputChange} required placeholder="Describe the dish" rows="3" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:15 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="category">Category *</label>
                    <select id="category" name="category" className="form-control" value={formData.category} onChange={handleInputChange} required>
                      <option value="">Select Category</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="price">Price (₹) *</label>
                    <input type="number" id="price" name="price" className="form-control" value={formData.price} onChange={handleInputChange} required min="0" step="0.01" placeholder="e.g., 250" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Food Image</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', border:'2px dashed #e2e6f0', borderRadius:10, cursor:'pointer', background:'#f7f8fc' }}>
                      <span style={{ fontSize:24 }}>📷</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'#1a202c' }}>{uploadingImage ? '⏳ Uploading...' : 'Click to upload image'}</div>
                        <div style={{ fontSize:12, color:'#a0aec0', marginTop:2 }}>JPG, PNG or WebP · Max 5MB</div>
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display:'none' }} disabled={uploadingImage} />
                    </label>
                    {formData.image && (
                      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#ecfdf5', borderRadius:10, border:'1px solid #6ee7b7' }}>
                        <img src={formData.image} alt="preview" style={{ width:52, height:52, objectFit:'cover', borderRadius:8 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#065f46' }}>✅ Image ready</div>
                          <div style={{ fontSize:11, color:'#059669', marginTop:2, wordBreak:'break-all' }}>{formData.image.split('/').pop()}</div>
                        </div>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, image:'' }))} style={{ background:'none', border:'none', color:'#991b1b', cursor:'pointer', fontSize:18, fontFamily:'inherit' }}>✕</button>
                      </div>
                    )}
                    <input type="url" name="image" className="form-control" value={formData.image} onChange={handleInputChange} placeholder="Or paste image URL (optional)" style={{ fontSize:13 }} />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:15 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="preparationTime">Preparation Time</label>
                    <input type="text" id="preparationTime" name="preparationTime" className="form-control" value={formData.preparationTime} onChange={handleInputChange} placeholder="e.g., 20 mins" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="spicyLevel">Spicy Level</label>
                    <select id="spicyLevel" name="spicyLevel" className="form-control" value={formData.spicyLevel} onChange={handleInputChange}>
                      {spicyLevels.map(level => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'flex', gap:20, marginTop:15, marginBottom:15 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                    <input type="checkbox" name="isVegetarian" checked={formData.isVegetarian} onChange={handleInputChange} style={{ width:18, height:18, cursor:'pointer' }} />
                    <span>🌱 Vegetarian</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                    <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleInputChange} style={{ width:18, height:18, cursor:'pointer' }} />
                    <span>✅ Available</span>
                  </label>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:25 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex:1 }}>{editingItem ? '✅ Update Item' : '✅ Add Item'}</button>
                  <button type="button" onClick={cancelEdit} className="btn btn-outline" style={{ flex:1 }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MenuManagement;