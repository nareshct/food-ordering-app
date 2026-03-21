const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  validatePromo,
  markPromoUsed,
  getDailyPromos,
  getAllPromos,
  createPromo,
  updatePromo,
  deletePromo,
  createDailyPromo,
  getRestaurantPromos
} = require('../controllers/promoController');

// ── Customer routes ───────────────────────────────────────────────────────────
router.post('/validate',             protect, validatePromo);
router.post('/mark-used',            protect, markPromoUsed);
router.get('/daily/:restaurantId',   protect, getDailyPromos);

// ── Restaurant owner routes ───────────────────────────────────────────────────
router.post('/daily',                protect, authorize('restaurant_owner','admin'), createDailyPromo);
router.get('/restaurant/:restaurantId', protect, authorize('restaurant_owner','admin'), getRestaurantPromos);

// ── Admin-only: view all promos ───────────────────────────────────────────────
router.get('/', protect, authorize('admin'), getAllPromos);

// ── Admin + Restaurant Owner: create / update / delete own promos ─────────────
router.post('/',      protect, authorize('restaurant_owner','admin'), createPromo);
router.put('/:id',    protect, authorize('restaurant_owner','admin'), updatePromo);
router.delete('/:id', protect, authorize('restaurant_owner','admin'), deletePromo);

module.exports = router;