const express = require('express');
const router = express.Router();
const {
  getAllMenuItems,
  getMenuItem,
  getMenuByRestaurant,
  getMenuByRestaurantOwner,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/auth');

// ── IMPORTANT: specific routes MUST come before param routes ──────────────────

// Owner route — returns ALL items including unavailable (must be before /:id)
router.get('/restaurant/:restaurantId/all',
  protect,
  authorize('restaurant_owner', 'admin'),
  getMenuByRestaurantOwner
);

// Public route — returns only available items (for customers)
router.get('/restaurant/:restaurantId', getMenuByRestaurant);

// Public routes
router.get('/', getAllMenuItems);
router.get('/:id', getMenuItem);

// Protected routes
router.post('/',    protect, authorize('restaurant_owner', 'admin'), createMenuItem);
router.put('/:id',  protect, authorize('restaurant_owner', 'admin'), updateMenuItem);
router.delete('/:id', protect, authorize('restaurant_owner', 'admin'), deleteMenuItem);

module.exports = router;