const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getOwnerRestaurants,
  toggleOpen
} = require('../controllers/restaurantController');

router.route('/')
  .get(getRestaurants)
  .post(protect, authorize('restaurant_owner', 'admin'), createRestaurant);

router.route('/owner/:ownerId')
  .get(protect, getOwnerRestaurants);

router.route('/:id')
  .get(getRestaurant)
  .put(protect, authorize('restaurant_owner', 'admin'), updateRestaurant)
  .delete(protect, authorize('restaurant_owner', 'admin'), deleteRestaurant);

router.put('/:id/toggle-open', protect, authorize('restaurant_owner', 'admin'), toggleOpen);

module.exports = router;