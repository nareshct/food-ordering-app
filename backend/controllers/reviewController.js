const Review = require('../models/Review');
const Order = require('../models/Order');

exports.createReview = async (req, res) => {
  try {
    const { restaurant, order, rating, foodQuality, deliverySpeed, valueForMoney, comment } = req.body;

    const orderDoc = await Order.findById(order);
    if (!orderDoc || orderDoc.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (orderDoc.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Can only review delivered orders'
      });
    }

    const existingReview = await Review.findOne({ order });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Review already exists'
      });
    }

    const review = await Review.create({
      user: req.user.id,
      restaurant,
      order,
      rating,
      foodQuality,
      deliverySpeed,
      valueForMoney,
      comment
    });

    await Order.findByIdAndUpdate(order, { hasReview: true });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRestaurantReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ restaurant: req.params.restaurantId })
      .populate('user', 'name')
      .sort('-createdAt');

    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const userId = req.user.id;
    const alreadyVoted = review.helpfulBy.map(id => id.toString()).includes(userId);

    if (alreadyVoted) {
      // Toggle off — remove vote
      review.helpful = Math.max(0, review.helpful - 1);
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== userId);
    } else {
      // Add vote
      review.helpful += 1;
      review.helpfulBy.push(userId);
    }

    await review.save();
    res.status(200).json({ success: true, data: review, voted: !alreadyVoted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.replyToReview = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Reply comment is required' });
    }
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const Restaurant = require('../models/Restaurant');
    const restaurant = await Restaurant.findById(review.restaurant);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to reply to this review' });
    }
    review.restaurantResponse = { comment: comment.trim(), respondedAt: new Date() };
    await review.save();
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};