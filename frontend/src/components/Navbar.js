import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { getItemCount } = useCart();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check unread notifications count
  useEffect(() => {
    const check = () => {
      try {
        const notifs = JSON.parse(localStorage.getItem('foodorder_notifications') || '[]');
        setUnreadCount(notifs.filter(n => !n.read).length);
      } catch {}
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    navigate('/');
  };

  const handleProfileClick = () => {
    setShowDropdown(false);
    navigate('/profile');
  };

  const toggleDropdown = () => setShowDropdown(!showDropdown);

  // Only show cart for customers or guests (not logged in)
  

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          🍔 FoodOrder
        </Link>

        <ul className="navbar-menu">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/restaurants">Restaurants</Link></li>
          {isAuthenticated && (
            <>
              {user?.role === 'customer' && (
                <li><Link to="/orders">My Orders</Link></li>
              )}
              {user?.role === 'customer' && (
                <li><Link to="/favorites">❤️ Favorites</Link></li>
              )}
              {user?.role === 'restaurant_owner' && (
                <li><Link to="/dashboard">Dashboard</Link></li>
              )}
              {user?.role === 'admin' && (
                <li><Link to="/admin">🛡️ Admin Panel</Link></li>
              )}
            </>
          )}
        </ul>

        <div className="navbar-actions">

          {/* Cart — only for customers and guests */}
          {/* Notification bell — customers only */}
          {isAuthenticated && user?.role === 'customer' && (
            <Link to="/notifications" style={{ position:'relative', textDecoration:'none', color:'rgba(255,255,255,0.7)', fontSize:20, padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', transition:'all 0.15s', display:'flex', alignItems:'center' }}
              title="Notifications">
              🔔
              {unreadCount > 0 && (
                <span style={{ position:'absolute', top:-4, right:-4, background:'#ff6b35', color:'white', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, border:'2px solid #1a1a2e' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {user?.role === 'customer' && (
            <Link to="/cart" className="cart-icon">
              🛒 Cart
              {getItemCount() > 0 && (
                <span className="cart-badge">{getItemCount()}</span>
              )}
            </Link>
          )}

          {isAuthenticated && user ? (
            <div className="user-menu" ref={dropdownRef}>
              <button
                className="user-button"
                onClick={toggleDropdown}
                type="button"
              >
                👤 {user.name}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button onClick={handleProfileClick} type="button">
                    👤 Profile
                  </button>
                  <button onClick={handleLogout} type="button">
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;