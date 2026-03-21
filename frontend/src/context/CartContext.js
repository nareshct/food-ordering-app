import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

// ─── Structure ────────────────────────────────────────────────────────────────
// cart = [
//   {
//     restaurant: { _id, name, deliveryFee, deliveryTime, ... },
//     items: [ { _id, name, price, quantity, ... }, ... ]
//   },
//   ...
// ]

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]); // array of { restaurant, items }

  // ── Persist ──────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('multiCart');
      if (saved) setCart(JSON.parse(saved));
    } catch { localStorage.removeItem('multiCart'); }
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('multiCart', JSON.stringify(cart));
    } else {
      localStorage.removeItem('multiCart');
    }
  }, [cart]);

  // ── Add item ─────────────────────────────────────────────────────────────
  const addToCart = (item, restaurantInfo) => {
    setCart(prev => {
      const idx = prev.findIndex(g => g.restaurant._id === restaurantInfo._id);
      if (idx !== -1) {
        // Restaurant already in cart — add/increment item
        const updated = [...prev];
        const group = { ...updated[idx], items: [...updated[idx].items] };
        const itemIdx = group.items.findIndex(i => i._id === item._id);
        if (itemIdx !== -1) {
          group.items[itemIdx] = { ...group.items[itemIdx], quantity: group.items[itemIdx].quantity + 1 };
        } else {
          group.items.push({ ...item, quantity: 1 });
        }
        updated[idx] = group;
        return updated;
      } else {
        // New restaurant — add new group
        return [...prev, { restaurant: restaurantInfo, items: [{ ...item, quantity: 1 }] }];
      }
    });
    return true;
  };

  // ── Remove item ───────────────────────────────────────────────────────────
  const removeFromCart = (restaurantId, itemId) => {
    setCart(prev => {
      return prev.map(g => {
        if (g.restaurant._id !== restaurantId) return g;
        return { ...g, items: g.items.filter(i => i._id !== itemId) };
      }).filter(g => g.items.length > 0); // remove empty restaurant groups
    });
  };

  // ── Update quantity ───────────────────────────────────────────────────────
  const updateQuantity = (restaurantId, itemId, newQty) => {
    if (newQty <= 0) { removeFromCart(restaurantId, itemId); return; }
    setCart(prev =>
      prev.map(g => {
        if (g.restaurant._id !== restaurantId) return g;
        return { ...g, items: g.items.map(i => i._id === itemId ? { ...i, quantity: newQty } : i) };
      })
    );
  };

  // ── Remove entire restaurant group ────────────────────────────────────────
  const removeRestaurantGroup = (restaurantId) => {
    setCart(prev => prev.filter(g => g.restaurant._id !== restaurantId));
  };

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('multiCart');
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const getGroupTotal = (group) => {
    const subtotal = group.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const delivery = group.restaurant.deliveryFee || 0;
    const tax      = subtotal * 0.05;
    return { subtotal, delivery, tax, total: subtotal + delivery + tax };
  };

  const getCartTotal = () =>
    cart.reduce((sum, g) => sum + getGroupTotal(g).total, 0);

  const getItemCount = () =>
    cart.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.quantity, 0), 0);

  // Legacy single-restaurant compat (used by old Navbar badge etc.)
  const restaurant = cart.length === 1 ? cart[0].restaurant : null;

  const value = {
    cart,               // array of { restaurant, items }
    restaurant,         // legacy: single restaurant (null if multi)
    addToCart,
    removeFromCart,
    updateQuantity,
    removeRestaurantGroup,
    clearCart,
    getGroupTotal,
    getCartTotal,
    getItemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};