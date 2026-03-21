import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';
import './Home.css';

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const [stats, setStats] = useState({ restaurants: '...', menuItems: '...', customers: '...', rating: '...' });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [restRes, menuRes, statsRes] = await Promise.all([
          axios.get(config.getApiUrl(config.endpoints.restaurants)),
          axios.get(config.getApiUrl(config.endpoints.menu)),
          axios.get(config.getApiUrl('/api/users/stats')).catch(() => null),
        ]);

        const restaurants = restRes.data?.data || [];
        const menuItems   = menuRes.data?.data   || [];

        // Average rating across all restaurants that have reviews
        const rated = restaurants.filter(r => r.rating > 0);
        const avgRating = rated.length
          ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1)
          : '4.8';

        // Real customer count from public stats endpoint
        const customers = statsRes?.data?.customers ?? 0;

        setStats({
          restaurants: restaurants.length,
          menuItems:   menuItems.length,
          customers,
          rating: avgRating + '★',
        });
      } catch {
        setStats({ restaurants: '—', menuItems: '—', customers: '—', rating: '—' });
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="home">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            {isAuthenticated && user ? (
              <>
                <h1>Welcome back,<br />{user.name}! 👋</h1>
                <p>Ready for something delicious? Browse our restaurants and order your favourite meal.</p>
                <Link to="/restaurants" className="btn btn-primary btn-lg">🍽️ Browse Restaurants</Link>
              </>
            ) : (
              <>
                <h1>Order Your Favourite<br />Food Online</h1>
                <p>Delicious meals from the best restaurants in your city, delivered fresh and fast to your doorstep</p>
                <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
                  <Link to="/restaurants" className="btn btn-primary btn-lg">🍽️ Browse Restaurants</Link>
                  <Link to="/register" className="btn btn-lg" style={{ background:'rgba(255,255,255,0.12)', color:'white', border:'1px solid rgba(255,255,255,0.25)', backdropFilter:'blur(8px)' }}>🚀 Get Started Free</Link>
                </div>
              </>
            )}
            <div className="hero-badges">
              <span className="hero-badge">⚡ 30-min delivery</span>
              <span className="hero-badge">🔒 Secure payments</span>
              <span className="hero-badge">⭐ Top-rated restaurants</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Stats ── */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {[
              { value: stats.restaurants, label: 'Restaurants',    icon: '🏪' },
              { value: stats.menuItems,   label: 'Menu Items',     icon: '🍽️' },
              { value: stats.customers,   label: 'Happy Customers',icon: '😊' },
              { value: stats.rating,      label: 'Average Rating', icon: '⭐' },
            ].map(({ value, label, icon }) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                <div className="stat-number">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features">
        <div className="container">
          <h2 className="text-center">Why Choose FoodOrder?</h2>
          <p className="subtitle text-center">Everything you need for the perfect meal delivery experience</p>
          <div className="grid grid-3">
            <div className="feature-card">
              <div className="feature-icon feature-icon-1">🍕</div>
              <h3>Wide Selection</h3>
              <p>Hundreds of restaurants and thousands of dishes — something for every craving</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-2">⚡</div>
              <h3>Fast Delivery</h3>
              <p>Your food delivered fresh and hot to your doorstep in 30–45 minutes</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon feature-icon-3">💳</div>
              <h3>Easy Payment</h3>
              <p>Pay with Cash, UPI, Cards or Wallets — whatever is most convenient for you</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA — only for guests ── */}
      {!isAuthenticated && (
        <section className="cta-section">
          <div className="container text-center">
            <h2>Hungry? Order Now!</h2>
            <p>Join thousands of happy customers enjoying great food every day</p>
            <Link to="/register" className="btn-white">🚀 Get Started — It's Free</Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;