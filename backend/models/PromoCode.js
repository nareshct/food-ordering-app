const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Promo code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: {
    type: Number,
    default: null
  },
  usageLimit: {
    type: Number,
    default: null
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  onePerUser: {
    type: Boolean,
    default: true       // true = each customer can use only once
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  // ── Restaurant-specific daily promo fields ────────────────────────────────
  createdBy: {
    type: String,
    enum: ['admin', 'restaurant'],
    default: 'admin'
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    default: null        // null = global (admin) promo, set = restaurant promo
  },
  isDailyPromo: {
    type: Boolean,
    default: false       // true = valid today only, auto-applied to all customers
  },
  validDate: {
    type: String,
    default: null        // 'YYYY-MM-DD' — set when isDailyPromo=true
  },
  appliesTo: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'       // 'specific' = only applies when cart has listed menu items
  },
  menuItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }]
}, {
  timestamps: true
});

// Index for fast lookup
promoCodeSchema.index({ restaurant: 1, isDailyPromo: 1, validDate: 1 });
promoCodeSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
