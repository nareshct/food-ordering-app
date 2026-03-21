const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
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
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    },
    specialInstructions: String
  }],
  deliveryAddress: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    deliveryFee: {
      type: Number,
      required: true
    },
    tax: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  },
  payment: {
    method: {
      type: String,
      required: true,
      enum: ['Cash on Delivery', 'Credit Card', 'Debit Card', 'UPI', 'Wallet']
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
      default: 'Pending'
    },
    transactionId: String
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  estimatedDeliveryTime: Date,
  scheduledTime: Date,   // null = ASAP, set = customer chose a time
  actualDeliveryTime: Date,
  specialInstructions: String,
  rating: {
    food: {
      type: Number,
      min: 1,
      max: 5
    },
    delivery: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    ratedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  hasReview: {
    type: Boolean,
    default: false
  },
  loyaltyAwarded: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate unique order number BEFORE validation
orderSchema.pre('validate', function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `ORD${year}${month}${day}${random}`;
  }
  next();
});

// ── Performance indexes ────────────────────────────────────────────────────────
orderSchema.index({ user: 1, createdAt: -1 });       // fast customer order history
orderSchema.index({ restaurant: 1, createdAt: -1 }); // fast restaurant order list
orderSchema.index({ status: 1 });                     // fast status filtering
orderSchema.index({ createdAt: -1 });                 // fast sorting

module.exports = mongoose.model('Order', orderSchema);