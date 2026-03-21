const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a restaurant name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  cuisine: {
    type: [String],
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    street: {
      type: String,
      required: [true, 'Please add a street address']
    },
    city: {
      type: String,
      required: [true, 'Please add a city']
    },
    state: {
      type: String,
      required: [true, 'Please add a state']
    },
    zipCode: {
      type: String,
      required: [true, 'Please add a zip code']
    },
    country: {
      type: String,
      default: 'India'
    }
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Please add a phone number']
    },
    email: {
      type: String,
      required: [true, 'Please add an email']
    }
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  deliveryTime: {
    type: String,
    required: [true, 'Please add estimated delivery time']
  },
  deliveryFee: {
    type: Number,
    required: [true, 'Please add delivery fee']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOpen: {
    type: Boolean,
    default: true   // owner can toggle open/closed in real-time
  },
  leaveDays: {
    type: [String],
    default: [],    // e.g. ['Monday','Wednesday'] — restaurant closed on these days
    enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  },
  openingHours: {
    type: String,
    default: '9:00 AM - 11:00 PM'
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/400x300?text=Restaurant'
  }
}, {
  timestamps: true
});

// Add index for better query performance
restaurantSchema.index({ name: 'text', description: 'text' });
restaurantSchema.index({ owner: 1 });
restaurantSchema.index({ cuisine: 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);