const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createReview,
  getRestaurantReviews,
  markHelpful,
  replyToReview
} = require('../controllers/reviewController');

router.post('/', protect, authorize('customer'), createReview);
router.get('/restaurant/:restaurantId', getRestaurantReviews);
router.put('/:id/helpful', protect, markHelpful);
router.put('/:id/reply', protect, authorize('restaurant_owner', 'admin'), replyToReview);

module.exports = router;
