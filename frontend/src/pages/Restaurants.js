import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config';

const getCuisineStyle = (cuisines = []) => {
  const c = cuisines.map(x => x.toLowerCase()).join(' ');
  if (c.includes('italian') || c.includes('pizza'))   return { bg:'linear-gradient(160deg,#c0392b,#e74c3c)', emoji:'🍕', label:'Italian' };
  if (c.includes('burger') || c.includes('american')) return { bg:'linear-gradient(160deg,#e67e22,#f39c12)', emoji:'🍔', label:'American' };
  if (c.includes('south indian') || c.includes('biryani')) return { bg:'linear-gradient(160deg,#27ae60,#2ecc71)', emoji:'🍛', label:'South Indian' };
  if (c.includes('chinese') || c.includes('noodle')) return { bg:'linear-gradient(160deg,#8e44ad,#9b59b6)', emoji:'🍜', label:'Chinese' };
  if (c.includes('fast food') || c.includes('snack')) return { bg:'linear-gradient(160deg,#2980b9,#3498db)', emoji:'🌮', label:'Fast Food' };
  if (c.includes('dessert') || c.includes('sweet'))  return { bg:'linear-gradient(160deg,#e91e63,#f06292)', emoji:'🍰', label:'Desserts' };
  if (c.includes('seafood') || c.includes('fish'))   return { bg:'linear-gradient(160deg,#0097a7,#00bcd4)', emoji:'🦞', label:'Seafood' };
  if (c.includes('indian'))  return { bg:'linear-gradient(160deg,#ff6f00,#ffa000)', emoji:'🍲', label:'Indian' };
  return { bg:'linear-gradient(160deg,#667eea,#764ba2)', emoji:'🍽️', label:'Restaurant' };
};

const RestaurantCard = ({ restaurant, isFavorite, onToggleFavorite, showFav }) => {
  const s = getCuisineStyle(restaurant.cuisine);
  return (
    <div style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(26,26,46,0.08)', border:'1px solid #e2e6f0', display:'flex', flexDirection:'column', position:'relative', transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 40px rgba(26,26,46,0.14)'; e.currentTarget.style.borderColor='transparent'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(26,26,46,0.08)'; e.currentTarget.style.borderColor='#e2e6f0'; }}>

      {/* Banner */}
      <div style={{ background:s.bg, height:180, position:'relative', overflow:'hidden', flexShrink:0 }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <div style={{ position:'absolute', bottom:-20, left:-20, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:72, filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>{s.emoji}</div>
        <div style={{ position:'absolute', bottom:12, left:14, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)', color:'white', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:'0.04em' }}>{s.label}</div>
        {(() => {
          const today = new Date().toLocaleDateString('en-US', { weekday:'long' });
          const isLeaveToday = restaurant.leaveDays?.includes(today);
          const isClosed = restaurant.isOpen === false || isLeaveToday;
          return restaurant.isActive ? (
            <div style={{ position:'absolute', top:12, left:14, background: isClosed ? '#ef4444' : '#10b981', color:'white', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
              {isClosed ? '● Closed' : '● Open'}
              {isLeaveToday && <span style={{ fontSize:10, opacity:0.85 }}> (Holiday)</span>}
            </div>
          ) : null;
        })()}
        {showFav && (
          <button onClick={e => { e.preventDefault(); onToggleFavorite(restaurant._id); }}
            style={{ position:'absolute', top:10, right:10, background:'rgba(255,255,255,0.95)', border:'none', borderRadius:'50%', width:38, height:38, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)', transition:'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(1.15)'}
            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
            {isFavorite ? '❤️' : '🤍'}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding:'18px 18px 20px', flex:1, display:'flex', flexDirection:'column' }}>
        <h3 style={{ margin:'0 0 6px', fontSize:17, fontWeight:800, color:'#1a202c', letterSpacing:'-0.01em' }}>{restaurant.name}</h3>
        <p style={{ color:'#718096', fontSize:13, marginBottom:12, lineHeight:1.5, flex:1 }}>{restaurant.description}</p>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          {restaurant.cuisine.map((c,i) => (
            <span key={i} style={{ padding:'3px 10px', background:'rgba(102,126,234,0.1)', color:'#667eea', borderRadius:20, fontSize:11, fontWeight:700 }}>{c}</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:14, fontSize:13, color:'#718096', marginBottom:16, flexWrap:'wrap' }}>
          <span>⭐ <strong style={{ color:'#1a202c' }}>{restaurant.rating||0}</strong> ({restaurant.totalReviews||0})</span>
          <span>🕐 {restaurant.deliveryTime}</span>
          <span>🚚 ₹{Number(restaurant.deliveryFee).toFixed(2)}</span>
        </div>
        <Link to={`/restaurant/${restaurant._id}`} className="btn btn-primary" style={{ textAlign:'center', borderRadius:10 }}>View Menu →</Link>
      </div>
    </div>
  );
};

const Restaurants = () => {
  const { user, isAuthenticated } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => { fetchRestaurants(); }, []);
  useEffect(() => { if (isAuthenticated) fetchFavorites(); }, [isAuthenticated]);

  const fetchRestaurants = async () => {
    try {
      const res = await axios.get(config.getApiUrl(config.endpoints.restaurants));
      setRestaurants(res.data.data); setLoading(false);
    } catch { setError('Failed to load restaurants'); setLoading(false); }
  };

  const fetchFavorites = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(config.getApiUrl(config.endpoints.favorites), { headers:{ 'Authorization':`Bearer ${token}` } });
      setFavorites(res.data.data.map(f => f.restaurant._id));
    } catch {}
  };

  const toggleFavorite = async (restaurantId) => {
    try {
      const token = localStorage.getItem('token');
      if (favorites.includes(restaurantId)) {
        await axios.delete(`${config.getApiUrl(config.endpoints.favorites)}/${restaurantId}`, { headers:{ 'Authorization':`Bearer ${token}` } });
      } else {
        await axios.post(config.getApiUrl(config.endpoints.favorites), { restaurant: restaurantId }, { headers:{ 'Authorization':`Bearer ${token}` } });
      }
      fetchFavorites();
    } catch { alert('Please login to add favorites'); }
  };

  const filtered = restaurants.filter(r => {
    const ms = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.description.toLowerCase().includes(searchTerm.toLowerCase());
    const mc = !selectedCuisine || r.cuisine.includes(selectedCuisine);
    return ms && mc;
  });

  const allCuisines = [...new Set(restaurants.flatMap(r => r.cuisine))];

  if (loading) return (
    <div className="page-wrapper" style={{ textAlign:'center', paddingTop:160 }}>
      <div className="spinner"/><p style={{ marginTop:16, color:'#718096' }}>Loading restaurants...</p>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ margin:0, fontSize:32, fontWeight:800, letterSpacing:'-0.025em', color:'#1a202c' }}>Browse Restaurants</h1>
          <p style={{ margin:'6px 0 0', color:'#718096', fontSize:15 }}>{restaurants.length} restaurants available</p>
        </div>

        {/* Search & Filter */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, marginBottom:32 }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'#a0aec0' }}>🔍</span>
            <input type="text" className="form-control" placeholder="Search restaurants or cuisines..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft:44 }} />
          </div>
          <select className="form-select" value={selectedCuisine} onChange={e => setSelectedCuisine(e.target.value)} style={{ minWidth:160 }}>
            <option value="">All Cuisines</option>
            {allCuisines.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <h3>No restaurants found</h3>
            <p>Try a different search or cuisine filter</p>
            <button className="btn btn-primary" onClick={() => { setSearchTerm(''); setSelectedCuisine(''); }}>Clear Filters</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:24 }}>
            {filtered.map(r => (
              <RestaurantCard key={r._id} restaurant={r}
                isFavorite={favorites.includes(r._id)}
                onToggleFavorite={toggleFavorite}
                showFav={isAuthenticated && user?.role === 'customer'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Restaurants;