import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Cart.css';

const getCuisineEmoji = (cuisines = []) => {
  const c = cuisines.map(x => x.toLowerCase()).join(' ');
  if (c.includes('pizza') || c.includes('italian')) return '🍕';
  if (c.includes('burger') || c.includes('american')) return '🍔';
  if (c.includes('south indian') || c.includes('biryani')) return '🍛';
  if (c.includes('chinese') || c.includes('noodle')) return '🍜';
  if (c.includes('fast food')) return '🌮';
  if (c.includes('indian')) return '🍲';
  return '🍽️';
};

const Cart = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { cart, removeFromCart, updateQuantity, removeRestaurantGroup, clearCart, getGroupTotal, getCartTotal, getItemCount } = useCart();

  const handleQtyChange = (restaurantId, itemId, newQty) => {
    if (newQty < 1) {
      if (window.confirm('Remove this item?')) removeFromCart(restaurantId, itemId);
    } else {
      updateQuantity(restaurantId, itemId, newQty);
    }
  };

  const handleRemoveGroup = (restaurantId, restaurantName) => {
    if (window.confirm(`Remove all items from ${restaurantName}?`)) {
      removeRestaurantGroup(restaurantId);
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) { alert('Please login to checkout'); navigate('/login'); return; }
    navigate('/checkout');
  };

  const grandTotal = getCartTotal();
  const totalItems = getItemCount();
  const totalOrders = cart.length;

  const qBtn = (onClick, label) => (
    <button onClick={onClick} className="quantity-btn">{label}</button>
  );

  if (cart.length === 0) return (
    <div className="page-wrapper">
      <div className="container" style={{ maxWidth: 500, paddingTop: 40 }}>
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add some delicious items to get started!</p>
          <Link to="/restaurants" className="btn btn-primary btn-lg">Browse Restaurants</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: '#1a202c' }}>
              Shopping Cart
            </h1>
            <p style={{ margin: '4px 0 0', color: '#718096', fontSize: 14 }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''} from {totalOrders} restaurant{totalOrders !== 1 ? 's' : ''} · {totalOrders} order{totalOrders !== 1 ? 's' : ''} will be placed
            </p>
          </div>
          <button onClick={clearCart} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
            🗑️ Clear All
          </button>
        </div>

        {/* Info banner for multiple restaurants */}
        {cart.length > 1 && (
          <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>ℹ️</span>
            <span style={{ fontSize: 14, color: '#4a5568' }}>
              <strong>{cart.length} separate orders</strong> will be placed — one per restaurant. Each billed independently.
            </span>
          </div>
        )}

        <div className="cart-container" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* ── Left: Restaurant groups ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cart.map((group, gIdx) => {
              const { subtotal, delivery, tax, total } = getGroupTotal(group);
              const emoji = getCuisineEmoji(group.restaurant.cuisine);

              return (
                <div key={group.restaurant._id} style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0', overflow: 'hidden' }}>

                  {/* Restaurant header */}
                  <div style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {cart.length > 1 && (
                        <div style={{ background: '#ff6b35', color: 'white', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {gIdx + 1}
                        </div>
                      )}
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>
                          {emoji} {group.restaurant.name}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>
                          {group.items.length} item{group.items.length !== 1 ? 's' : ''} · 🕐 {group.restaurant.deliveryTime}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveGroup(group.restaurant._id, group.restaurant.name)}
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                      Remove
                    </button>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '4px 0' }}>
                    {group.items.map((item, iIdx) => (
                      <div key={item._id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 14, padding: '14px 20px', borderBottom: iIdx < group.items.length - 1 ? '1px solid #f0f2f8' : 'none', alignItems: 'center' }}>
                        {/* Thumb */}
                        <div style={{ width: 60, height: 60, borderRadius: 10, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                          {emoji}
                        </div>
                        {/* Info */}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a202c', marginBottom: 3 }}>{item.name}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6b35' }}>₹{Number(item.price).toFixed(2)} each</div>
                        </div>
                        {/* Controls */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 6 }}>
                            {qBtn(() => handleQtyChange(group.restaurant._id, item._id, item.quantity - 1), '−')}
                            <span style={{ minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#1a202c' }}>{item.quantity}</span>
                            {qBtn(() => handleQtyChange(group.restaurant._id, item._id, item.quantity + 1), '+')}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a202c', marginBottom: 4 }}>₹{(item.price * item.quantity).toFixed(2)}</div>
                          <button onClick={() => removeFromCart(group.restaurant._id, item._id)}
                            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-restaurant mini bill */}
                  <div style={{ background: '#f7f8fc', borderTop: '1px solid #f0f2f8', padding: '12px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: 13 }}>
                    <span style={{ color: '#718096' }}>Subtotal: <strong style={{ color: '#1a202c' }}>₹{subtotal.toFixed(2)}</strong></span>
                    <span style={{ color: '#718096' }}>Delivery: <strong style={{ color: '#1a202c' }}>₹{delivery.toFixed(2)}</strong></span>
                    <span style={{ color: '#718096' }}>Tax: <strong style={{ color: '#1a202c' }}>₹{tax.toFixed(2)}</strong></span>
                    <span style={{ color: '#ff6b35', fontWeight: 800, fontSize: 14 }}>Order Total: ₹{total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right: Grand summary ── */}
          <div className="order-summary" style={{ position: 'sticky', top: 88 }}>
            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,46,0.07)', border: '1px solid #e2e6f0', padding: '24px' }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800, color: '#1a202c' }}>
                {cart.length > 1 ? `Grand Summary (${cart.length} Orders)` : 'Order Summary'}
              </h3>

              {/* Per-restaurant breakdown */}
              {cart.map((group, i) => {
                const { subtotal, delivery, tax, total } = getGroupTotal(group);
                return (
                  <div key={group.restaurant._id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < cart.length - 1 ? '1px dashed #e2e6f0' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#667eea', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cart.length > 1 && <span style={{ background: '#ff6b35', color: 'white', width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{i + 1}</span>}
                      {group.restaurant.name}
                    </div>
                    {[['Subtotal', subtotal], ['Delivery', delivery], ['Tax (5%)', tax]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#718096', marginBottom: 3 }}>
                        <span>{l}</span><span>₹{v.toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#1a202c', marginTop: 4 }}>
                      <span>Order {i + 1} Total</span><span style={{ color: '#ff6b35' }}>₹{total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              {cart.length > 1 && (
                <div style={{ borderTop: '2px solid #1a1a2e', paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
                  <span style={{ color: '#1a202c' }}>Grand Total</span>
                  <span style={{ color: '#ff6b35' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              )}

              <button onClick={handleCheckout} className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 20 }}>
                {cart.length > 1 ? `Place ${cart.length} Orders →` : 'Proceed to Checkout →'}
              </button>
              <Link to="/restaurants" style={{ display: 'block', textAlign: 'center', marginTop: 14, color: '#667eea', fontSize: 14, fontWeight: 600 }}>
                + Add from another restaurant
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Cart;