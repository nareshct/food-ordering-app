const express = require('express');
const router = express.Router();
const {
  createOrder,
  getAllOrders,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  rateOrder,
  getRestaurantOrders
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Customer routes
router.post('/', authorize('customer', 'admin'), createOrder);
router.get('/myorders', authorize('customer', 'admin'), getMyOrders);
router.put('/:id/cancel', authorize('customer', 'admin'), cancelOrder);
router.put('/:id/rate', authorize('customer', 'admin'), rateOrder);

// Restaurant owner routes
router.get('/restaurant/:restaurantId', authorize('restaurant_owner', 'admin'), getRestaurantOrders);
router.put('/:id/status', authorize('restaurant_owner', 'admin'), updateOrderStatus);

// Admin routes
router.get('/', authorize('admin'), getAllOrders);

// Common routes
router.get('/:id', getOrder);

module.exports = router;
