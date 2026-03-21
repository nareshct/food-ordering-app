import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const Favorites = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    fetchFavorites();
  }, [isAuthenticated, navigate]);

  const fetchFavorites = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(config.getApiUrl(config.endpoints.favorites), { headers:{ 'Authorization':`Bearer ${token}` } });
      setFavorites(res.data.data); setLoading(false);
    } catch { setLoading(false); }
  };

  const removeFavorite = async (restaurantId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${config.getApiUrl(config.endpoints.favorites)}/${restaurantId}`, { headers:{ 'Authorization':`Bearer ${token}` } });
      fetchFavorites();
    } catch {}
  };

  if (loading) return (
    <div className="page-wrapper" style={{ textAlign:'center', paddingTop:160 }}>
      <div className="spinner"/>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">
        <div style={{ marginBottom:28 }}>
          <h1 style={{ margin:0, fontSize:32, fontWeight:800, letterSpacing:'-0.025em', color:'#1a202c' }}>❤️ My Favourites</h1>
          <p style={{ margin:'6px 0 0', color:'#718096', fontSize:15 }}>{favorites.length} saved restaurant{favorites.length !== 1 ? 's' : ''}</p>
        </div>

        {favorites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💔</div>
            <h3>No favourites yet</h3>
            <p>Tap the heart on any restaurant to save it here!</p>
            <Link to="/restaurants" className="btn btn-primary">Browse Restaurants</Link>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:24 }}>
            {favorites.map(({ restaurant }) => {
              const s = getCuisineStyle(restaurant.cuisine);
              return (
                <div key={restaurant._id}
                  style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(26,26,46,0.08)', border:'1px solid #e2e6f0', display:'flex', flexDirection:'column', transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 40px rgba(26,26,46,0.14)'; e.currentTarget.style.borderColor='transparent'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(26,26,46,0.08)'; e.currentTarget.style.borderColor='#e2e6f0'; }}>

                  {/* Banner */}
                  <div style={{ background:s.bg, height:180, position:'relative', overflow:'hidden', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
                    <div style={{ position:'absolute', bottom:-20, left:-20, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:72, filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>{s.emoji}</div>
                    <div style={{ position:'absolute', bottom:12, left:14, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)', color:'white', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:'0.04em' }}>{s.label}</div>
                    <button onClick={() => removeFavorite(restaurant._id)}
                      style={{ position:'absolute', top:10, right:10, background:'rgba(255,255,255,0.95)', border:'none', borderRadius:'50%', width:38, height:38, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.2)', transition:'transform 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.transform='scale(1.15)'}
                      onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>❤️</button>
                  </div>

                  {/* Content */}
                  <div style={{ padding:'18px 18px 20px', flex:1, display:'flex', flexDirection:'column' }}>
                    <h3 style={{ margin:'0 0 6px', fontSize:17, fontWeight:800, color:'#1a202c', letterSpacing:'-0.01em' }}>{restaurant.name}</h3>
                    <p style={{ color:'#718096', fontSize:13, marginBottom:12, lineHeight:1.5, flex:1 }}>{restaurant.description}</p>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                      {restaurant.cuisine.map((c,i) => (
                        <span key={i} style={{ padding:'3px 10px', background:'rgba(255,107,53,0.1)', color:'#ff6b35', borderRadius:20, fontSize:11, fontWeight:700 }}>{c}</span>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:14, fontSize:13, color:'#718096', marginBottom:16 }}>
                      <span>⭐ <strong style={{ color:'#1a202c' }}>{restaurant.rating||0}</strong></span>
                      <span>🕐 {restaurant.deliveryTime}</span>
                      <span>🚚 ₹{restaurant.deliveryFee}</span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <Link to={`/restaurant/${restaurant._id}`} className="btn btn-primary" style={{ flex:1, textAlign:'center', borderRadius:10 }}>View Menu →</Link>
                      <button onClick={() => removeFavorite(restaurant._id)}
                        style={{ padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:10, cursor:'pointer', fontSize:16, transition:'all 0.15s', fontFamily:'inherit' }}
                        onMouseEnter={e => e.currentTarget.style.background='#fee2e2'}
                        onMouseLeave={e => e.currentTarget.style.background='#fef2f2'}
                        title="Remove">🗑️</button>
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

export default Favorites;