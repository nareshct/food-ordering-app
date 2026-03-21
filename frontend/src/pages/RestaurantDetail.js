import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import config from '../config'; // ✅ FIXED: use config instead of hardcoded URLs
import './RestaurantDetail.css';

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [hasDeliveredOrder, setHasDeliveredOrder] = useState(false);

  const fetchRestaurantDetails = useCallback(async () => {
    try {
      // ✅ FIXED: use config.getApiUrl instead of hardcoded localhost:5000
      const response = await axios.get(
        config.getApiUrl(`${config.endpoints.restaurants}/${id}`)
      );
      setRestaurant(response.data.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load restaurant details');
      setLoading(false);
      console.error('Error fetching restaurant:', err);
    }
  }, [id]);

  const fetchMenuItems = useCallback(async () => {
    try {
      // ✅ FIXED: use config.getApiUrl instead of hardcoded localhost:5000
      const response = await axios.get(
        config.getApiUrl(`${config.endpoints.menu}/restaurant/${id}`)
      );
      setMenuItems(response.data.data);
    } catch (err) {
      console.error('Error fetching menu items:', err);
    }
  }, [id]);

  const checkDeliveredOrders = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'customer') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // ✅ FIXED: use config.getApiUrl instead of hardcoded localhost:5000
      const response = await axios.get(
        config.getApiUrl(`${config.endpoints.orders}/myorders`),
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const hasDelivered = response.data.data.some(order =>
        order.restaurant._id === id &&
        order.status === 'Delivered'
      );

      setHasDeliveredOrder(hasDelivered);
    } catch (err) {
      console.error('Error checking orders:', err);
    }
  }, [id, isAuthenticated, user]);

  useEffect(() => {
    // ✅ FIXED: use Promise.all to fetch restaurant + menu in parallel (faster loading)
    Promise.all([
      fetchRestaurantDetails(),
      fetchMenuItems(),
      checkDeliveredOrders()
    ]);
  }, [fetchRestaurantDetails, fetchMenuItems, checkDeliveredOrders]);

  const handleAddToCart = (item) => {
    if (!isAuthenticated) {
      alert('Please login to add items to cart');
      navigate('/login');
      return;
    }

    if (user?.role !== 'customer') {
      alert('Only customers can add items to cart');
      return;
    }

    // addToCart now supports multiple restaurants — always succeeds
    addToCart(item, restaurant);
    alert(`${item.name} added to cart!`);
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];
  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  if (loading) {
    return (
      <div className="container" style={{ padding: '100px 20px', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p>Loading restaurant details...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="container" style={{ padding: '100px 20px' }}>
        <div className="alert alert-error">{error || 'Restaurant not found'}</div>
        <button onClick={() => navigate('/restaurants')} className="btn btn-primary">
          Back to Restaurants
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', paddingBottom: '50px' }}>
      {/* Restaurant Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: 'white',
        padding: '120px 0 60px 0',
        position: 'relative', overflow: 'hidden'
      }}>
        <div className="container">
          <button
            onClick={() => navigate('/restaurants')}
            className="btn btn-outline"
            style={{
              marginBottom: '20px',
              color: 'white',
              borderColor: 'white'
            }}
          >
            ← Back to Restaurants
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{
              width: '150px',
              height: '150px',
              background: 'white',
              borderRadius: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '70px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}>
              🍽️
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '36px', marginBottom: '10px', fontWeight: 'bold' }}>
                {restaurant.name}
              </h1>
              <p style={{ fontSize: '18px', opacity: 0.95, marginBottom: '20px' }}>
                {restaurant.description}
              </p>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {restaurant.cuisine.map(c => (
                  <span key={c} style={{
                    padding: '6px 16px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {c}
                  </span>
                ))}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '15px',
                fontSize: '15px'
              }}>
                <div>
                  <span style={{ fontSize: '20px' }}>⭐</span> {restaurant.rating || 0} ({restaurant.totalReviews || 0} reviews)
                </div>
                <div>
                  <span style={{ fontSize: '20px' }}>🕐</span> {restaurant.deliveryTime}
                </div>
                <div>
                  <span style={{ fontSize: '20px' }}>🚚</span> Delivery: ₹{Number(restaurant.deliveryFee).toFixed(2)}
                </div>
              </div>

              {/* Review Buttons */}
              <div style={{ marginTop: '25px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                {isAuthenticated && user?.role === 'customer' && hasDeliveredOrder && (
                  <button
                    onClick={() => navigate(`/restaurant/${id}/reviews`, { state: { openReviewForm: true } })}
                    style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>✍️</span>
                    <span>Write a Review</span>
                  </button>
                )}

                <button
                  onClick={() => navigate(`/restaurant/${id}/reviews`)}
                  style={{
                    background: '#FFD700',
                    color: '#2c3e50',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                  }}
                >
                  <span style={{ fontSize: '20px' }}>⭐</span>
                  <span>View All Reviews ({restaurant.totalReviews || 0})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Section */}
      <div className="container" style={{ paddingTop: '40px' }}>
        {(() => {
          const today = new Date().toLocaleDateString('en-US', { weekday:'long' });
          const isLeaveToday = restaurant.leaveDays?.includes(today);
          const isClosed = restaurant.isOpen === false || isLeaveToday;
          if (!isClosed) return null;
          return (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'14px 18px', marginBottom:20, color:'#991b1b', fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>🔴</span>
              <div>
                <div>{isLeaveToday ? `This restaurant is closed today (${today}).` : 'This restaurant is currently closed.'}</div>
                {restaurant.leaveDays?.length > 0 && <div style={{ fontSize:12, fontWeight:500, marginTop:3, opacity:0.8 }}>Weekly off: {restaurant.leaveDays.join(', ')}</div>}
                <div style={{ fontSize:12, fontWeight:500, marginTop:3 }}>You can browse the menu but ordering is not available.</div>
              </div>
            </div>
          );
        })()}
        <h2 style={{ fontSize: '28px', marginBottom: '20px', color: '#2c3e50' }}>Menu</h2>

        {/* Category Filter */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '30px',
          flexWrap: 'wrap',
          overflowX: 'auto',
          paddingBottom: '10px'
        }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '10px 20px',
                border: selectedCategory === category ? '2px solid #667eea' : '2px solid #ddd',
                background: selectedCategory === category ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'white',
                color: selectedCategory === category ? 'white' : '#666',
                borderRadius: '25px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: selectedCategory === category ? '600' : '500',
                transition: 'all 0.3s',
                whiteSpace: 'nowrap'
              }}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        {filteredItems.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '10px'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '15px' }}>🍽️</div>
            <h3>No items in this category</h3>
            <p style={{ color: '#666' }}>Try selecting a different category</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {filteredItems.map(item => (
              <div key={item._id} className="card" style={{
                opacity: item.isAvailable ? 1 : 0.6,
                position: 'relative'
              }}>
                {!item.isAvailable && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#dc3545',
                    color: 'white',
                    padding: '5px 12px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: '600',
                    zIndex: 1
                  }}>
                    Not Available
                  </div>
                )}

                <div style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  height: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '60px',
                  borderRadius: '10px 10px 0 0'
                }}>
                  {item.isVegetarian ? '🥗' : '🍖'}
                </div>

                <div className="card-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', flex: 1 }}>
                      {item.name}
                    </h3>
                    <span style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: '#ff6b35',
                      marginLeft: '10px'
                    }}>
                      ₹{Number(item.price).toFixed(2)}
                    </span>
                  </div>

                  <p style={{
                    color: '#666',
                    fontSize: '14px',
                    marginBottom: '12px',
                    lineHeight: '1.5'
                  }}>
                    {item.description}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: item.isVegetarian ? '#d4edda' : '#f8d7da',
                      color: item.isVegetarian ? '#155724' : '#721c24',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {item.isVegetarian ? '🌱 Veg' : '🍖 Non-Veg'}
                    </span>

                    {item.spiceLevel && item.spiceLevel !== 'None' && (
                      <span style={{
                        padding: '4px 10px',
                        background: '#fff3cd',
                        color: '#856404',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        🌶️ {item.spiceLevel}
                      </span>
                    )}

                    <span style={{
                      padding: '4px 10px',
                      background: '#e7f3ff',
                      color: '#004085',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      ⏱️ {item.preparationTime}
                    </span>
                  </div>

                  {(!isAuthenticated || user?.role === 'customer') && (
                    <button
                      onClick={() => handleAddToCart(item)}
                      disabled={!item.isAvailable}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        opacity: item.isAvailable ? 1 : 0.5,
                        cursor: item.isAvailable ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {!item.isAvailable ? 'Currently Unavailable' : (restaurant.isOpen === false || restaurant.leaveDays?.includes(new Date().toLocaleDateString('en-US',{weekday:'long'}))) ? '🔴 Restaurant Closed' : '🛒 Add to Cart'}
                    </button>
                  )}
                  {isAuthenticated && user?.role !== 'customer' && !item.isAvailable && (
                    <div style={{ width:'100%', padding:'10px', background:'#f0f2f8', borderRadius:8, textAlign:'center', fontSize:13, color:'#a0aec0', fontWeight:600 }}>
                      Currently Unavailable
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantDetail;