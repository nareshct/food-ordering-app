const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Please provide a rating'],
    min: 1,
    max: 5
  },
  foodQuality: {
    type: Number,
    min: 1,
    max: 5
  },
  deliverySpeed: {
    type: Number,
    min: 1,
    max: 5
  },
  valueForMoney: {
    type: Number,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
  helpful: {
    type: Number,
    default: 0
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  restaurantResponse: {
    comment: String,
    respondedAt: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
reviewSchema.index({ restaurant: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });

// ============================================
// AUTOMATIC RATING CALCULATION SYSTEM
// ============================================
// This function automatically calculates and updates
// the restaurant's average rating and total review count

reviewSchema.statics.calculateAverageRating = async function(restaurantId) {
  const stats = await this.aggregate([
    {
      $match: { restaurant: restaurantId }
    },
    {
      $group: {
        _id: '$restaurant',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  try {
    if (stats.length > 0) {
      await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, {
        rating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal place
        totalReviews: stats[0].totalReviews
      });
      console.log(`✅ Updated restaurant rating: ${Math.round(stats[0].averageRating * 10) / 10} (${stats[0].totalReviews} reviews)`);
    } else {
      // If no reviews, reset to 0
      await mongoose.model('Restaurant').findByIdAndUpdate(restaurantId, {
        rating: 0,
        totalReviews: 0
      });
      console.log('✅ Restaurant rating reset to 0 (no reviews)');
    }
  } catch (error) {
    console.error('Error updating restaurant rating:', error);
  }
};

// Automatically update rating when a review is saved
reviewSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.restaurant);
});

// Automatically update rating when a review is deleted
reviewSchema.post('remove', function() {
  this.constructor.calculateAverageRating(this.restaurant);
});

// Automatically update rating when a review is deleted using findOneAndDelete
reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await doc.constructor.calculateAverageRating(doc.restaurant);
  }
});

module.exports = mongoose.model('Review', reviewSchema);