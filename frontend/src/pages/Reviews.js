import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Reviews.css';
import config from '../config';

const Reviews = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  
  const [reviewForm, setReviewForm] = useState({
    orderId: '',
    rating: 5,
    foodQuality: 5,
    deliverySpeed: 5,
    valueForMoney: 5,
    comment: ''
  });

  // Owner reply state: { [reviewId]: { open, text, loading } }
  const [replyState, setReplyState] = useState({});

  const handleReply = async (reviewId) => {
    const state = replyState[reviewId];
    if (!state?.text?.trim()) return;
    setReplyState(prev => ({ ...prev, [reviewId]: { ...prev[reviewId], loading: true } }));
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        config.getApiUrl(`/api/reviews/${reviewId}/reply`),
        { comment: state.text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setReviews(prev => prev.map(r => r._id === reviewId ? res.data.data : r));
        setReplyState(prev => ({ ...prev, [reviewId]: { open: false, text: '', loading: false } }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit reply');
      setReplyState(prev => ({ ...prev, [reviewId]: { ...prev[reviewId], loading: false } }));
    }
  };

  const fetchRestaurant = useCallback(async () => {
    try {
      const response = await axios.get(`${config.getApiUrl(config.endpoints.restaurants)}/${restaurantId}`);
      setRestaurant(response.data.data);
    } catch (err) {
      console.error('Error fetching restaurant:', err);
    }
  }, [restaurantId]);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await axios.get(`${config.getApiUrl(config.endpoints.reviews)}/restaurant/${restaurantId}`);
      setReviews(response.data.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setLoading(false);
    }
  }, [restaurantId]);

  const fetchUserOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(config.getApiUrl(config.endpoints.orders + '/myorders'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Filter delivered orders for this restaurant without reviews
      const deliveredOrders = response.data.data.filter(order => 
        order.restaurant._id === restaurantId && 
        order.status === 'Delivered' && 
        !order.hasReview
      );
      setUserOrders(deliveredOrders);
    } catch (err) {
      console.error('Error fetching user orders:', err);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchRestaurant();
    fetchReviews();
    if (isAuthenticated && user?.role === 'customer') {
      fetchUserOrders();
    }
  }, [restaurantId, isAuthenticated, user, fetchRestaurant, fetchReviews, fetchUserOrders]);

  // Auto-open review form from navigate() state OR from ?openReviewForm=true URL param (email link)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromEmail = params.get('openReviewForm') === 'true';
    if ((location.state?.openReviewForm || fromEmail) && isAuthenticated && user?.role === 'customer') {
      setShowReviewForm(true);
      setTimeout(() => {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }, 100);
    }
  }, [location.state, location.search, isAuthenticated, user]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    
    if (!reviewForm.orderId) {
      alert('Please select an order');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(config.getApiUrl(config.endpoints.reviews), {
        restaurant: restaurantId,
        order: reviewForm.orderId,
        rating: reviewForm.rating,
        foodQuality: reviewForm.foodQuality,
        deliverySpeed: reviewForm.deliverySpeed,
        valueForMoney: reviewForm.valueForMoney,
        comment: reviewForm.comment
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      alert('✅ Review submitted successfully!');
      setShowReviewForm(false);
      setReviewForm({
        orderId: '',
        rating: 5,
        foodQuality: 5,
        deliverySpeed: 5,
        valueForMoney: 5,
        comment: ''
      });
      fetchReviews();
      fetchUserOrders();
      fetchRestaurant();
    } catch (err) {
      alert('❌ Failed to submit review: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleMarkHelpful = async (reviewId) => {
    if (!isAuthenticated) {
      alert('Please login to mark reviews as helpful');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `${config.getApiUrl(config.endpoints.reviews)}/${reviewId}/helpful`, {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      // Update review in state directly from response — no need to refetch all
      if (res.data.success) {
        setReviews(prev => prev.map(r => r._id === reviewId ? res.data.data : r));
      }
    } catch (err) {
      console.error('Error marking helpful:', err);
    }
  };

  const renderStars = (rating) => {
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} style={{ 
            color: star <= rating ? '#FFD700' : '#ddd',
            fontSize: '20px'
          }}>
            ★
          </span>
        ))}
      </div>
    );
  };

  const renderRatingInput = (label, value, onChange) => {
    return (
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '32px',
                color: star <= value ? '#FFD700' : '#ddd',
                padding: '0',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              ★
            </button>
          ))}
          <span style={{ marginLeft: '10px', fontWeight: '600', color: '#667eea' }}>
            {value} / 5
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '100px 20px', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p>Loading reviews...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', paddingTop: '100px', paddingBottom: '50px' }}>
      <div className="container">
        {/* Header */}
        <button 
          onClick={() => navigate(`/restaurant/${restaurantId}`)}
          className="btn btn-outline btn-sm"
          style={{ marginBottom: '20px' }}
        >
          ← Back to Restaurant
        </button>

        {restaurant && (
          <div style={{ 
            background: 'white', 
            borderRadius: '10px', 
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{ marginBottom: '15px', color: '#2c3e50' }}>{restaurant.name} Reviews</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              {renderStars(Math.round(restaurant.rating || 0))}
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>
                {restaurant.rating || 0}
              </span>
              <span style={{ color: '#666', fontSize: '16px' }}>
                ({restaurant.totalReviews || 0} reviews)
              </span>
            </div>
          </div>
        )}

        {/* Write Review Button */}
        {isAuthenticated && user?.role === 'customer' && userOrders.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="btn btn-primary"
              style={{ fontSize: '16px', padding: '12px 24px' }}
            >
              {showReviewForm ? '✕ Cancel' : '✍️ Write a Review'}
            </button>
          </div>
        )}

        {/* No Orders Message */}
        {isAuthenticated && user?.role === 'customer' && userOrders.length === 0 && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '30px',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#856404' }}>
              📦 You need to place and complete an order from this restaurant to leave a review.
            </p>
          </div>
        )}

        {/* Review Form */}
        {showReviewForm && (
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: '25px', color: '#2c3e50' }}>Write Your Review</h2>
            <form onSubmit={handleSubmitReview}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Select Order *
                </label>
                <select
                  className="form-control"
                  value={reviewForm.orderId}
                  onChange={(e) => setReviewForm({ ...reviewForm, orderId: e.target.value })}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Choose an order...</option>
                  {userOrders.map(order => (
                    <option key={order._id} value={order._id}>
                      Order #{order.orderNumber} - {new Date(order.createdAt).toLocaleDateString()} - ₹{order.pricing.total}
                    </option>
                  ))}
                </select>
              </div>

              {renderRatingInput('Overall Rating *', reviewForm.rating, (val) => 
                setReviewForm({ ...reviewForm, rating: val })
              )}

              {renderRatingInput('Food Quality', reviewForm.foodQuality, (val) => 
                setReviewForm({ ...reviewForm, foodQuality: val })
              )}

              {renderRatingInput('Delivery Speed', reviewForm.deliverySpeed, (val) => 
                setReviewForm({ ...reviewForm, deliverySpeed: val })
              )}

              {renderRatingInput('Value for Money', reviewForm.valueForMoney, (val) => 
                setReviewForm({ ...reviewForm, valueForMoney: val })
              )}

              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Your Review *
                </label>
                <textarea
                  className="form-control"
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  rows="5"
                  placeholder="Share your experience with this restaurant..."
                  required
                  maxLength="500"
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <small style={{ color: '#666', fontSize: '12px' }}>
                  {reviewForm.comment.length}/500 characters
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  Submit Review
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowReviewForm(false);
                    setReviewForm({
                      orderId: '',
                      rating: 5,
                      foodQuality: 5,
                      deliverySpeed: 5,
                      valueForMoney: 5,
                      comment: ''
                    });
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reviews List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {reviews.length === 0 ? (
            <div style={{ 
              background: 'white', 
              borderRadius: '10px', 
              padding: '60px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '80px', marginBottom: '20px' }}>📝</div>
              <h3 style={{ marginBottom: '10px', color: '#2c3e50' }}>No Reviews Yet</h3>
              <p style={{ color: '#666', margin: 0 }}>Be the first to review this restaurant!</p>
            </div>
          ) : (
            reviews.map(review => (
              <div key={review._id} style={{
                background: 'white',
                borderRadius: '10px',
                padding: '25px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                {/* Review Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '15px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold',
                      marginBottom: '5px',
                      color: '#2c3e50'
                    }}>
                      {review.user?.name || 'Anonymous'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {new Date(review.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {/* Detailed Ratings */}
                {(review.foodQuality || review.deliverySpeed || review.valueForMoney) && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '15px',
                    marginBottom: '15px',
                    padding: '15px',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    {review.foodQuality && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '500' }}>
                          Food Quality
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ color: '#FFD700', fontSize: '16px' }}>★</span>
                          <span style={{ fontWeight: '600', color: '#2c3e50' }}>{review.foodQuality}</span>
                        </div>
                      </div>
                    )}
                    {review.deliverySpeed && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '500' }}>
                          Delivery Speed
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ color: '#FFD700', fontSize: '16px' }}>★</span>
                          <span style={{ fontWeight: '600', color: '#2c3e50' }}>{review.deliverySpeed}</span>
                        </div>
                      </div>
                    )}
                    {review.valueForMoney && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '500' }}>
                          Value for Money
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ color: '#FFD700', fontSize: '16px' }}>★</span>
                          <span style={{ fontWeight: '600', color: '#2c3e50' }}>{review.valueForMoney}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Review Comment */}
                {review.comment && (
                  <p style={{ 
                    lineHeight: '1.7',
                    color: '#333',
                    marginBottom: '15px',
                    fontSize: '15px'
                  }}>
                    {review.comment}
                  </p>
                )}

                {/* Restaurant Response */}
                {review.restaurantResponse && (
                  <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    background: '#e8f4f8',
                    borderLeft: '4px solid #667eea',
                    borderRadius: '5px'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      color: '#667eea',
                      fontSize: '14px'
                    }}>
                      ✉️ Response from {restaurant?.name}
                    </div>
                    <p style={{ margin: 0, color: '#333', lineHeight: '1.6' }}>
                      {review.restaurantResponse.comment}
                    </p>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      marginTop: '8px'
                    }}>
                      Responded on {new Date(review.restaurantResponse.respondedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {/* Owner Reply Button — shown only to restaurant owner if no reply yet */}
                {isAuthenticated && user?.role === 'restaurant_owner' && !review.restaurantResponse && (
                  <div style={{ marginTop: 12 }}>
                    {!replyState[review._id]?.open ? (
                      <button
                        onClick={() => setReplyState(prev => ({ ...prev, [review._id]: { open: true, text: '', loading: false } }))}
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid #667eea', background: 'white', color: '#667eea', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                        ✉️ Reply to this review
                      </button>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        <textarea
                          rows={3}
                          value={replyState[review._id]?.text || ''}
                          onChange={e => setReplyState(prev => ({ ...prev, [review._id]: { ...prev[review._id], text: e.target.value } }))}
                          placeholder="Write your response to this customer..."
                          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e6f0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            onClick={() => handleReply(review._id)}
                            disabled={replyState[review._id]?.loading || !replyState[review._id]?.text?.trim()}
                            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#667eea', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {replyState[review._id]?.loading ? 'Submitting...' : '✅ Submit Reply'}
                          </button>
                          <button
                            onClick={() => setReplyState(prev => ({ ...prev, [review._id]: { open: false, text: '', loading: false } }))}
                            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e6f0', background: 'white', color: '#718096', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Helpful Button */}
                <div style={{ 
                  marginTop: '15px',
                  display: 'flex',
                  gap: '15px',
                  paddingTop: '15px',
                  borderTop: '1px solid #eee'
                }}>
                  {(() => {
                    const hasVoted = isAuthenticated && user &&
                      review.helpfulBy?.map(id => id.toString()).includes(
                        (user._id || user.id)?.toString()
                      );
                    return (
                      <button
                        onClick={() => handleMarkHelpful(review._id)}
                        className="btn btn-outline btn-sm"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '14px',
                          background: hasVoted ? '#eff6ff' : 'white',
                          borderColor: hasVoted ? '#667eea' : undefined,
                          color: hasVoted ? '#667eea' : undefined,
                          fontWeight: hasVoted ? 700 : undefined
                        }}
                      >
                        {hasVoted ? '👍 Helpful · You voted' : `👍 Helpful (${review.helpful || 0})`}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Reviews;