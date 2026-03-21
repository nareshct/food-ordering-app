import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';

const cardStyle = { background: 'white', borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0', padding: '24px', marginBottom: 16 };
const sectionTitle = { margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#1a202c', letterSpacing: '-0.01em' };

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, clearCart, getGroupTotal } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({ street: '', city: '', state: '', zipCode: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [pointsInput, setPointsInput] = useState('');
  const [scheduleDelivery, setScheduleDelivery] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState('custom');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showAddrPicker, setShowAddrPicker] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);

  useEffect(() => {
    if (user) {
      // Load saved address book from localStorage
      let list = [];
      try { list = JSON.parse(localStorage.getItem('savedAddresses') || '[]'); } catch {}
      // Auto-seed default address if not already in list
      if (user.address?.street) {
        const exists = list.some(a => a.street?.trim() === user.address.street.trim() && a.city?.trim() === user.address.city.trim());
        if (!exists) {
          list = [{ id:'default', label:'Home', street:user.address.street, city:user.address.city, state:user.address.state||'', zipCode:user.address.zipCode||'', isProfileDefault:true }, ...list];
          localStorage.setItem('savedAddresses', JSON.stringify(list));
        }
      }
      setSavedAddresses(list);

      // Auto-select the profile default address
      const defaultAddr = list.find(a => a.street?.trim() === user.address?.street?.trim() && a.city?.trim() === user.address?.city?.trim()) || list[0];
      if (defaultAddr) {
        setSelectedAddrId(defaultAddr.id);
        setDeliveryAddress({ street:defaultAddr.street, city:defaultAddr.city, state:defaultAddr.state||'', zipCode:defaultAddr.zipCode||'', phone:user.phone||'' });
        setShowCustomForm(false);
      } else {
        setDeliveryAddress({ street:user.address?.street||'', city:user.address?.city||'', state:user.address?.state||'', zipCode:user.address?.zipCode||'', phone:user.phone||'' });
        setSelectedAddrId('custom');
        setShowCustomForm(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) { alert('Please login to checkout'); navigate('/login'); return; }
    if (user && user.role !== 'customer') { alert('Only customers can place orders.'); navigate('/dashboard'); }
  }, [isAuthenticated, user, navigate]);

  // ── Promo: validate via API ──────────────────────────────────────────────
  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoError('Please enter a promo code'); return; }
    setPromoLoading(true); setPromoError('');
    try {
      const token = localStorage.getItem('token');
      // Calculate current subtotal across all groups for validation
      const totalSubtotal = cart.reduce((s, g) => s + getGroupTotal(g).subtotal, 0);
      const allMenuItemIds = cart.flatMap(g => g.items.map(i => i._id));
      // cartItems with subtotals — backend uses these for specific-item discount calculation
      const cartItemsWithSubtotal = cart.flatMap(g =>
        g.items.map(i => ({ _id: i._id, subtotal: i.price * i.quantity }))
      );
      const restaurantId = cart.length === 1 ? cart[0].restaurant._id : null;

      const res = await axios.post(
        config.getApiUrl('/api/promo/validate'),
        { code, orderAmount: totalSubtotal, restaurantId, menuItemIds: allMenuItemIds, cartItems: cartItemsWithSubtotal },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.data.success) {
        setAppliedPromo({
          code:              res.data.data.code,
          description:       res.data.data.description,
          type:              res.data.data.discountType === 'percentage' ? 'percent' : 'flat',
          value:             res.data.data.discountValue,
          discountAmount:    res.data.data.discountAmount,
          applicableSubtotal: res.data.data.applicableSubtotal,
          applicableItemIds: res.data.data.applicableItemIds || [],  // which items get discount
          appliesTo:         res.data.data.appliesTo || 'all'
        });
        setPromoError('');
      }
    } catch (err) {
      setPromoError(err.response?.data?.message || 'Invalid promo code');
      setAppliedPromo(null);
    } finally { setPromoLoading(false); }
  };

  const handleRemovePromo = () => { setAppliedPromo(null); setPromoCode(''); setPromoError(''); };

  // ── Auto-fetch today's daily promos for restaurants in cart ──────────────
  useEffect(() => {
    const fetchDailyPromos = async () => {
      if (!user || cart.length === 0) return;
      try {
        const token = localStorage.getItem('token');
        const results = await Promise.all(
          [...new Set(cart.map(g => g.restaurant._id))].map(rId =>
            axios.get(config.getApiUrl(`/api/promo/daily/${rId}`),
              { headers: { 'Authorization': `Bearer ${token}` } })
              .then(r => r.data.data || [])
              .catch(() => [])
          )
        );
        const promos = results.flat();
        if (promos.length === 0 || appliedPromo) return;

        // Pick the best promo candidate by raw discount value
        const totalSub = cart.reduce((s, g) => s + getGroupTotal(g).subtotal, 0);
        const best = promos.reduce((a, b) => {
          const discA = a.discountType === 'percentage' ? (totalSub * a.discountValue / 100) : a.discountValue;
          const discB = b.discountType === 'percentage' ? (totalSub * b.discountValue / 100) : b.discountValue;
          return discB > discA ? b : a;
        });

        // ── Always validate via API so applicableItemIds & appliesTo are set ──
        // This ensures specific-item promos only discount their own items,
        // not the entire cart (the bug shown in the screenshot).
        const allMenuItemIds = cart.flatMap(g => g.items.map(i => i._id));
        const cartItemsWithSubtotal = cart.flatMap(g =>
          g.items.map(i => ({ _id: i._id, subtotal: i.price * i.quantity }))
        );
        const restaurantId = cart.length === 1 ? cart[0].restaurant._id : null;

        const res = await axios.post(
          config.getApiUrl('/api/promo/validate'),
          { code: best.code, orderAmount: totalSub, restaurantId, menuItemIds: allMenuItemIds, cartItems: cartItemsWithSubtotal },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (res.data.success) {
          setAppliedPromo({
            code:               res.data.data.code,
            description:        res.data.data.description + ' 🎁 Auto-applied!',
            type:               res.data.data.discountType === 'percentage' ? 'percent' : 'flat',
            value:              res.data.data.discountValue,
            discountAmount:     res.data.data.discountAmount,
            applicableSubtotal: res.data.data.applicableSubtotal,
            applicableItemIds:  res.data.data.applicableItemIds || [],
            appliesTo:          res.data.data.appliesTo || 'all',
            autoApplied:        true
          });
        }
      } catch {}
    };
    fetchDailyPromos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cart.length]);

  // ── Loyalty: ₹ value of points per group (split equally across all groups) ──
  const pointsDiscountPerGroup = pointsToRedeem > 0
    ? parseFloat(((pointsToRedeem * 0.1) / Math.max(cart.length, 1)).toFixed(2))
    : 0;

  // ── Promo discount per group ────────────────────────────────────────────────
  // For specific-item promos: discount is based only on matching items' subtotal,
  // not the full group subtotal. The backend already calculated the exact amount.
  const getPromoDiscount = (subtotal, group) => {
    if (!appliedPromo) return 0;

    if (appliedPromo.appliesTo === 'specific' && appliedPromo.applicableItemIds?.length > 0) {
      // Only discount items in this group that match the promo
      if (!group) return 0;
      const matchingSubtotal = group.items
        .filter(i => appliedPromo.applicableItemIds.includes(String(i._id)))
        .reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (matchingSubtotal === 0) return 0;
      return appliedPromo.type === 'percent'
        ? parseFloat(((matchingSubtotal * appliedPromo.value) / 100).toFixed(2))
        : Math.min(appliedPromo.value / Math.max(cart.length, 1), matchingSubtotal);
    }

    // All-items promo — discount on full group subtotal
    return appliedPromo.type === 'percent'
      ? parseFloat(((subtotal * appliedPromo.value) / 100).toFixed(2))
      : Math.min(appliedPromo.value / Math.max(cart.length, 1), subtotal);
  };

  // ── Total discount per group (promo + loyalty) ──────────────────────────────
  const getGroupDiscount = (subtotal, group) => {
    return parseFloat((getPromoDiscount(subtotal, group) + pointsDiscountPerGroup).toFixed(2));
  };

  // ── Grand total after all discounts ─────────────────────────────────────────
  const grandTotal = cart.reduce((sum, group) => {
    const { subtotal, delivery, tax } = getGroupTotal(group);
    return sum + subtotal + delivery + tax - getGroupDiscount(subtotal, group);
  }, 0);

  // ── Place all orders ──────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.zipCode || !deliveryAddress.phone) {
      alert('Please fill in all delivery address fields'); return;
    }
    setLoading(true); setError('');

    const token = localStorage.getItem('token');
    const placedOrders = [];
    const failedOrders = [];

    for (const group of cart) {
      const { subtotal, delivery, tax } = getGroupTotal(group);
      const discount = getGroupDiscount(subtotal, group);
      const total = subtotal + delivery + tax - discount;

      const orderData = {
        restaurant: group.restaurant._id,
        items: group.items.map(item => ({
          menuItem: item._id,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
          subtotal: Number((item.price * item.quantity).toFixed(2))
        })),
        deliveryAddress,
        payment: { method: paymentMethod, status: paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Completed' },
        pricing: {
          subtotal: Number(subtotal.toFixed(2)),
          deliveryFee: Number(delivery.toFixed(2)),
          tax: Number(tax.toFixed(2)),
          discount: Number(discount.toFixed(2)),   // includes both promo + loyalty
          total: Number(Math.max(0, total).toFixed(2))
        },
        specialInstructions: specialInstructions || '',
        pointsToRedeem: pointsToRedeem,
        scheduledTime: scheduleDelivery && scheduledTime ? scheduledTime : null
      };

      try {
        const res = await axios.post(
          config.getApiUrl(config.endpoints.orders),
          orderData,
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (res.data.success) {
          placedOrders.push(res.data.data);
          // Mark promo as used after first successful order (non-blocking)
          if (appliedPromo?.code && placedOrders.length === 1) {
            try {
              await axios.post(config.getApiUrl('/api/promo/mark-used'),
                { code: appliedPromo.code },
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            } catch {}
          }
        } else {
          failedOrders.push(group.restaurant.name);
        }
      } catch (err) {
        failedOrders.push(group.restaurant.name);
      }
    }

    setLoading(false);

    if (placedOrders.length === 0) {
      setError('All orders failed. Please try again.');
      return;
    }

    clearCart();

    if (failedOrders.length > 0) {
      alert(`⚠️ ${placedOrders.length} order(s) placed successfully.\nFailed: ${failedOrders.join(', ')}`);
    } else {
      alert(`✅ ${placedOrders.length} order${placedOrders.length > 1 ? 's' : ''} placed successfully!`);
    }

    // Navigate to the first order's detail page
    navigate(`/order/${placedOrders[0]._id}`, { state: { orderPlaced: true } });
  };

  if (cart.length === 0) return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 500, paddingTop: 40 }}>
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add some delicious items to get started!</p>
          <button onClick={() => navigate('/restaurants')} className="btn btn-primary">Browse Restaurants</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: '#1a202c' }}>Checkout</h1>
          <p style={{ margin: '4px 0 0', color: '#718096', fontSize: 14 }}>
            {cart.length > 1
              ? `${cart.length} separate orders will be placed — one per restaurant`
              : 'Complete your order details below'}
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>❌ {error}</div>}

        {/* Multi-order info */}
        {cart.length > 1 && (
          <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.6 }}>
              <strong>Multiple orders:</strong> Placing {cart.length} orders simultaneously —{' '}
              {cart.map((g, i) => <span key={g.restaurant._id}><strong>{g.restaurant.name}</strong>{i < cart.length - 1 ? ', ' : ''}</span>)}.
              <br />One delivery address and payment method applies to all.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

          {/* ── Left ── */}
          <div>

            {/* Delivery Address */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>📍 Delivery Address</h3>

              {/* ── Selected address display ── */}
              {!showCustomForm && selectedAddrId !== 'custom' ? (
                <div>
                  {(() => {
                    const sel = savedAddresses.find(a => a.id === selectedAddrId);
                    const isDefault = sel && (sel.isProfileDefault || (user?.address?.street?.trim() === sel?.street?.trim() && user?.address?.city?.trim() === sel?.city?.trim()));
                    return sel ? (
                      <div style={{ background:'#f7f8fc', borderRadius:12, padding:'14px 16px', border:'1px solid #e2e6f0', marginBottom:14 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                              <span style={{ fontWeight:800, fontSize:15, color:'#1a202c' }}>{sel.label || 'Address'}</span>
                              {isDefault && <span style={{ background:'rgba(102,126,234,0.12)', color:'#667eea', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>⭐ Default</span>}
                            </div>
                            <div style={{ fontSize:13, color:'#4a5568', lineHeight:1.6 }}>
                              {sel.street}<br/>{sel.city}{sel.state?', '+sel.state:''}{sel.zipCode?' — '+sel.zipCode:''}
                            </div>
                          </div>
                          <button onClick={() => setShowAddrPicker(!showAddrPicker)}
                            style={{ background:'none', border:'none', color:'#667eea', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', padding:0 }}>
                            {showAddrPicker ? '✕ Cancel' : '✏️ Change'}
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Address picker dropdown — shown only when Change is clicked */}
                  {showAddrPicker && (
                    <div style={{ border:'1px solid #e2e6f0', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
                      {savedAddresses.map((addr, i) => {
                        const isSelected = selectedAddrId === addr.id;
                        const isDefault = addr.isProfileDefault || (user?.address?.street?.trim() === addr.street?.trim() && user?.address?.city?.trim() === addr.city?.trim());
                        return (
                          <div key={addr.id}
                            onClick={() => { setSelectedAddrId(addr.id); setDeliveryAddress({ street:addr.street, city:addr.city, state:addr.state||'', zipCode:addr.zipCode||'', phone:deliveryAddress.phone||user?.phone||'' }); setShowAddrPicker(false); }}
                            style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', background:isSelected?'rgba(102,126,234,0.06)':'white', borderBottom: i < savedAddresses.length ? '1px solid #f0f2f8' : 'none', cursor:'pointer', transition:'background 0.15s' }}>
                            <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${isSelected?'#667eea':'#cbd5e0'}`, background:isSelected?'#667eea':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                              {isSelected && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }}/>}
                            </div>
                            <div>
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                                <span style={{ fontWeight:700, fontSize:13, color:isSelected?'#667eea':'#1a202c' }}>{addr.label || 'Address'}</span>
                                {isDefault && <span style={{ background:'rgba(102,126,234,0.1)', color:'#667eea', padding:'1px 6px', borderRadius:10, fontSize:10, fontWeight:700 }}>Default</span>}
                              </div>
                              <div style={{ fontSize:12, color:'#718096' }}>{addr.street}, {addr.city}{addr.zipCode?' — '+addr.zipCode:''}</div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Enter different address option */}
                      <div onClick={() => { setSelectedAddrId('custom'); setShowCustomForm(true); setShowAddrPicker(false); setDeliveryAddress({ street:'', city:'', state:'', zipCode:'', phone:deliveryAddress.phone||user?.phone||'' }); }}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'white', cursor:'pointer' }}>
                        <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid #cbd5e0', background:'white', flexShrink:0 }}/>
                        <span style={{ fontSize:13, fontWeight:700, color:'#718096' }}>📝 Enter a different address</span>
                      </div>
                      <div style={{ padding:'10px 16px', borderTop:'1px solid #f0f2f8', background:'#f7f8fc' }}>
                        <a href="/profile" style={{ fontSize:12, color:'#667eea', fontWeight:700, textDecoration:'none' }}>+ Add or manage addresses →</a>
                      </div>
                    </div>
                  )}

                  {/* Phone row */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f7f8fc', borderRadius:10, padding:'12px 16px', border:'1px solid #e2e6f0' }}>
                    {!showPhoneEdit ? (
                      <>
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Delivery Phone</div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#1a202c' }}>📞 {deliveryAddress.phone || 'Not set'}</div>
                        </div>
                        <button onClick={() => setShowPhoneEdit(true)}
                          style={{ background:'none', border:'none', color:'#667eea', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                          ✏️ Change
                        </button>
                      </>
                    ) : (
                      <div style={{ width:'100%' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#a0aec0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Change Delivery Phone</div>
                        <div style={{ display:'flex', gap:10 }}>
                          <input type="tel" className="form-control" value={deliveryAddress.phone}
                            onChange={e => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value.replace(/[^0-9]/g,'') })}
                            placeholder="10-digit number" maxLength={10} style={{ flex:1 }} />
                          <button onClick={() => setShowPhoneEdit(false)}
                            style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                            ✓ Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Custom / manual address form */
                <div>
                  {savedAddresses.length > 0 && (
                    <button onClick={() => { setShowCustomForm(false); setSelectedAddrId(savedAddresses[0].id); setDeliveryAddress({ street:savedAddresses[0].street, city:savedAddresses[0].city, state:savedAddresses[0].state||'', zipCode:savedAddresses[0].zipCode||'', phone:deliveryAddress.phone||user?.phone||'' }); }}
                      style={{ background:'none', border:'none', color:'#667eea', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', padding:'0 0 14px 0', display:'block' }}>
                      ← Back to saved addresses
                    </button>
                  )}
                  <div className="form-group">
                    <label className="form-label">Street Address *</label>
                    <input type="text" className="form-control" value={deliveryAddress.street}
                      onChange={e => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })} placeholder="123 Main Street" />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group">
                      <label className="form-label">City *</label>
                      <input type="text" className="form-control" value={deliveryAddress.city}
                        onChange={e => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })} placeholder="Chennai" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">State *</label>
                      <input type="text" className="form-control" value={deliveryAddress.state}
                        onChange={e => setDeliveryAddress({ ...deliveryAddress, state: e.target.value })} placeholder="Tamil Nadu" />
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group">
                      <label className="form-label">ZIP Code *</label>
                      <input type="text" className="form-control" value={deliveryAddress.zipCode}
                        onChange={e => setDeliveryAddress({ ...deliveryAddress, zipCode: e.target.value })} placeholder="600001" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone *</label>
                      <input type="tel" className="form-control" value={deliveryAddress.phone}
                        onChange={e => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })} placeholder="9876543210" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>💳 Payment Method</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['Cash on Delivery', '💵'], ['Credit Card', '💳'], ['Debit Card', '💳'], ['UPI', '📱'], ['Wallet', '👛']].map(([method, icon]) => (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', border: `2px solid ${paymentMethod === method ? '#667eea' : '#e2e6f0'}`, borderRadius: 12, cursor: 'pointer', background: paymentMethod === method ? 'rgba(102,126,234,0.06)' : 'white', transition: 'all 0.15s' }}>
                    <input type="radio" name="paymentMethod" value={method} checked={paymentMethod === method} onChange={e => setPaymentMethod(e.target.value)} style={{ marginRight: 12, accentColor: '#667eea' }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: paymentMethod === method ? '#667eea' : '#2d3748' }}>{icon} {method}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Promo */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>🎟️ Promo Code</h3>
              {appliedPromo ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#ecfdf5', border: '2px solid #6ee7b7', borderRadius: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#065f46', fontSize: 15 }}>✅ {appliedPromo.code}</div>
                    <div style={{ color: '#065f46', fontSize: 13, marginTop: 2 }}>{appliedPromo.description}{cart.length > 1 ? ' — applied to each order' : ''}</div>
                  </div>
                  <button onClick={handleRemovePromo} style={{ background: 'none', border: 'none', color: '#991b1b', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input type="text" value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyPromo()} placeholder="Enter promo code"
                      className="form-control" style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }} />
                    <button onClick={handleApplyPromo} disabled={!promoCode.trim() || promoLoading} className="btn btn-secondary" style={{ opacity: promoCode.trim() && !promoLoading ? 1 : 0.5 }}>
                      {promoLoading ? '⏳...' : 'Apply'}
                    </button>
                  </div>
                  {promoError && <div style={{ marginTop: 8, color: '#991b1b', fontSize: 13 }}>❌ {promoError}</div>}
                  <div style={{ marginTop: 10, fontSize: 12, color: '#a0aec0' }}>Enter your promo code above</div>
                </div>
              )}
            </div>


            {/* Loyalty Points */}
            {user?.loyaltyPoints > 0 && (
              <div style={cardStyle}>
                <h3 style={sectionTitle}>🏆 Loyalty Points</h3>
                <div style={{ padding:'14px 16px', background:'rgba(102,126,234,0.06)', borderRadius:10, border:'1px solid rgba(102,126,234,0.15)', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:800, color:'#1a202c', fontSize:15 }}>Available: {user.loyaltyPoints} pts</div>
                    <div style={{ fontSize:13, color:'#718096', marginTop:2 }}>= ₹{(user.loyaltyPoints * 0.1).toFixed(0)} max discount · 100 pts = ₹10</div>
                  </div>
                  <span style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                    {user.loyaltyTier || 'Bronze'}
                  </span>
                </div>
                {pointsToRedeem > 0 ? (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'#ecfdf5', border:'2px solid #6ee7b7', borderRadius:10 }}>
                    <div>
                      <div style={{ fontWeight:800, color:'#065f46' }}>✅ {pointsToRedeem} pts applied</div>
                      <div style={{ fontSize:13, color:'#065f46', marginTop:2 }}>−₹{(pointsToRedeem * 0.1).toFixed(2)} off on order</div>
                    </div>
                    <button onClick={() => { setPointsToRedeem(0); setPointsInput(''); }}
                      style={{ background:'none', border:'none', color:'#991b1b', fontSize:20, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:10 }}>
                    <input type="number" min="0" max={user.loyaltyPoints} step="10"
                      value={pointsInput} onChange={e => setPointsInput(e.target.value)}
                      placeholder={"Enter points (max " + user.loyaltyPoints + ")"}
                      className="form-control" style={{ flex:1 }} />
                    <button className="btn btn-secondary"
                      onClick={() => {
                        const pts = Math.min(parseInt(pointsInput) || 0, user.loyaltyPoints);
                        if (pts > 0) setPointsToRedeem(pts);
                        else alert('Enter a valid number of points');
                      }}>Apply</button>
                  </div>
                )}
              </div>
            )}

            {/* Scheduled Delivery */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>🕐 Delivery Time</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <label style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', border:`2px solid ${!scheduleDelivery ? '#667eea' : '#e2e6f0'}`, borderRadius:12, cursor:'pointer', background: !scheduleDelivery ? 'rgba(102,126,234,0.06)' : 'white', transition:'all 0.15s' }}>
                  <input type="radio" checked={!scheduleDelivery} onChange={() => setScheduleDelivery(false)} style={{ accentColor:'#667eea' }} />
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color: !scheduleDelivery ? '#667eea' : '#2d3748' }}>⚡ Deliver ASAP</div>
                    <div style={{ fontSize:12, color:'#718096', marginTop:2 }}>Estimated 30–45 minutes</div>
                  </div>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', border:`2px solid ${scheduleDelivery ? '#667eea' : '#e2e6f0'}`, borderRadius:12, cursor:'pointer', background: scheduleDelivery ? 'rgba(102,126,234,0.06)' : 'white', transition:'all 0.15s' }}>
                  <input type="radio" checked={scheduleDelivery} onChange={() => setScheduleDelivery(true)} style={{ accentColor:'#667eea' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, color: scheduleDelivery ? '#667eea' : '#2d3748' }}>📅 Schedule for Later</div>
                    <div style={{ fontSize:12, color:'#718096', marginTop:2 }}>Pick a time that works for you</div>
                  </div>
                </label>
                {scheduleDelivery && (
                  <>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    min={(() => {
                      const d = new Date(Date.now() + 30 * 60000);
                      const pad = n => String(n).padStart(2, '0');
                      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })()}
                    required
                    style={{ marginTop:4 }}
                  />
                  {/* Validate scheduled time against each restaurant's leave days & hours */}
                  {scheduledTime && (() => {
                    const schedDate = new Date(scheduledTime);
                    const dayName = schedDate.toLocaleDateString('en-US', { weekday: 'long' });
                    const errors = [];
                    cart.forEach(group => {
                      const r = group.restaurant;
                      // Check leave days
                      if (r.leaveDays?.includes(dayName)) {
                        errors.push(`❌ ${r.name} is closed on ${dayName}s`);
                      } else {
                        // Check opening hours (format: "9:00 AM - 11:00 PM")
                        if (r.openingHours) {
                          try {
                            const [openStr, closeStr] = r.openingHours.split(' - ').map(s => s.trim());
                            const parseT = (str) => {
                              const [time, mer] = str.split(' ');
                              let [h, m] = time.split(':').map(Number);
                              if (mer === 'PM' && h !== 12) h += 12;
                              if (mer === 'AM' && h === 12) h = 0;
                              const d2 = new Date(schedDate);
                              d2.setHours(h, m, 0, 0);
                              return d2;
                            };
                            if (schedDate < parseT(openStr) || schedDate > parseT(closeStr)) {
                              errors.push(`⏰ ${r.name} is only open ${r.openingHours}`);
                            }
                          } catch {}
                        }
                      }
                    });
                    if (errors.length === 0) return null;
                    return (
                      <div style={{ marginTop:8, padding:'10px 14px', background:'#fff5f5', border:'1px solid #fed7d7', borderRadius:8 }}>
                        {errors.map((e, i) => (
                          <div key={i} style={{ fontSize:13, color:'#c53030', fontWeight:600 }}>{e}</div>
                        ))}
                        <div style={{ fontSize:12, color:'#a0aec0', marginTop:4 }}>Please pick a different time.</div>
                      </div>
                    );
                  })()}
                  </>
                )}
              </div>
            </div>

            {/* Special Instructions */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>📝 Special Instructions</h3>
              <textarea className="form-control" value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="No onions, extra spicy, contactless delivery..." rows={3} style={{ resize: 'vertical' }} />
              {cart.length > 1 && <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 8 }}>These instructions will apply to all orders.</p>}
            </div>
          </div>

          {/* ── Right: Order summary ── */}
          <div>
            <div style={{ ...cardStyle, position: 'sticky', top: 88, marginBottom: 0 }}>
              <h3 style={sectionTitle}>
                {cart.length > 1 ? `${cart.length} Orders Summary` : 'Order Summary'}
              </h3>

              {/* Per-restaurant breakdown */}
              {cart.map((group, i) => {
                const { subtotal, delivery, tax, total } = getGroupTotal(group);
                const discount = getGroupDiscount(subtotal, group);
                const finalTotal = total - discount;

                return (
                  <div key={group.restaurant._id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < cart.length - 1 ? '1px dashed #e2e6f0' : 'none' }}>
                    {/* Restaurant name */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#667eea', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cart.length > 1 && (
                        <span style={{ background: '#ff6b35', color: 'white', width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                          {i + 1}
                        </span>
                      )}
                      {group.restaurant.name}
                    </div>

                    {/* Items */}
                    <div style={{ borderBottom: '1px solid #f0f2f8', paddingBottom: 8, marginBottom: 8, maxHeight: 120, overflowY: 'auto' }}>
                      {group.items.map(item => {
                        const isDiscounted = appliedPromo?.appliesTo === 'specific' &&
                          appliedPromo?.applicableItemIds?.includes(String(item._id));
                        return (
                          <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, alignItems: 'center' }}>
                            <span>
                              <span style={{ fontWeight: 700, color: '#667eea' }}>{item.quantity}×</span> {item.name}
                              {isDiscounted && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                                  PROMO
                                </span>
                              )}
                            </span>
                            <span style={{ fontWeight: 600, color: isDiscounted ? '#166534' : '#1a202c' }}>
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pricing */}
                    {[['Subtotal', subtotal], ['Delivery', delivery], ['Tax (5%)', tax]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#718096', marginBottom: 3 }}>
                        <span>{l}</span><span>₹{v.toFixed(2)}</span>
                      </div>
                    ))}
                    {getPromoDiscount(subtotal, group) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#065f46', fontWeight: 700, marginBottom: 3 }}>
                        <span>🎟️ Promo</span><span>−₹{getPromoDiscount(subtotal, group).toFixed(2)}</span>
                      </div>
                    )}
                    {pointsDiscountPerGroup > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#667eea', fontWeight: 700, marginBottom: 3 }}>
                        <span>🏆 Loyalty pts</span><span>−₹{pointsDiscountPerGroup.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginTop: 6 }}>
                      <span style={{ color: '#1a202c' }}>Order {i + 1}</span>
                      <span style={{ color: '#ff6b35' }}>₹{Math.max(0, finalTotal).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              {cart.length > 1 && (
                <div style={{ borderTop: '2px solid #1a1a2e', paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                  <span style={{ color: '#1a202c' }}>Grand Total</span>
                  <span style={{ color: '#ff6b35' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              )}
              {cart.length === 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                  <span style={{ color: '#1a202c' }}>Total</span>
                  <span style={{ color: '#ff6b35' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              )}

              <button onClick={handlePlaceOrder} className="btn btn-primary" disabled={loading || (() => {
                // Block submission if scheduled time conflicts with any restaurant
                if (!scheduleDelivery || !scheduledTime) return false;
                const schedDate = new Date(scheduledTime);
                const dayName = schedDate.toLocaleDateString('en-US', { weekday: 'long' });
                return cart.some(group => {
                  const r = group.restaurant;
                  if (r.leaveDays?.includes(dayName)) return true;
                  if (r.openingHours) {
                    try {
                      const [openStr, closeStr] = r.openingHours.split(' - ').map(s => s.trim());
                      const parseT = (str) => {
                        const [time, mer] = str.split(' ');
                        let [h, m] = time.split(':').map(Number);
                        if (mer === 'PM' && h !== 12) h += 12;
                        if (mer === 'AM' && h === 12) h = 0;
                        const d = new Date(schedDate); d.setHours(h, m, 0, 0); return d;
                      };
                      if (schedDate < parseT(openStr) || schedDate > parseT(closeStr)) return true;
                    } catch {}
                  }
                  return false;
                });
              })()}
                style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 18, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ Placing Orders...' : cart.length > 1 ? `🛒 Place ${cart.length} Orders` : '🛒 Place Order'}
              </button>

              <button onClick={() => navigate('/cart')} style={{ width: '100%', marginTop: 10, background: 'transparent', border: '2px solid #667eea', color: '#667eea', padding: '12px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
                ← Back to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;