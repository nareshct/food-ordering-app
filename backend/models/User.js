const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  phone:  { type: String, default: '' },
  role: {
    type: String,
    enum: ['customer', 'restaurant_owner', 'admin'],
    default: 'customer'
  },
  address: {
    street:  { type: String, default: '' },
    city:    { type: String, default: '' },
    state:   { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  avatar: { type: String, default: '' },

  // ── Loyalty Points ──────────────────────────────────────────────────────────
  loyaltyPoints:     { type: Number, default: 0, min: 0 },
  totalPointsEarned: { type: Number, default: 0 },   // lifetime (for tier)
  loyaltyTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  pointsHistory: [{
    action:      { type: String, enum: ['earned', 'redeemed'] },
    points:      Number,
    description: String,
    orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    date:        { type: Date, default: Date.now }
  }],

  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ── Tier rules ────────────────────────────────────────────────────────────────
// Bronze 0–499 | Silver 500–1499 | Gold 1500–4999 | Platinum 5000+
userSchema.methods.updateTier = function () {
  const p = this.totalPointsEarned;
  if      (p >= 5000) this.loyaltyTier = 'Platinum';
  else if (p >= 1500) this.loyaltyTier = 'Gold';
  else if (p >= 500)  this.loyaltyTier = 'Silver';
  else                this.loyaltyTier = 'Bronze';
};

// Earn points (₹10 = 1 point)
userSchema.methods.addPoints = async function (points, description, orderId) {
  this.loyaltyPoints     += points;
  this.totalPointsEarned += points;
  this.pointsHistory.push({ action: 'earned', points, description, orderId });
  this.updateTier(); // must come after totalPointsEarned update
  return await this.save();
};

// Redeem points (100 pts = ₹10)
userSchema.methods.redeemPoints = async function (points, description, orderId) {
  if (this.loyaltyPoints < points) throw new Error('Insufficient loyalty points');
  this.loyaltyPoints -= points;
  this.pointsHistory.push({ action: 'redeemed', points: -points, description, orderId });
  await this.save();
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Performance indexes
userSchema.index({ role: 1 });         // fast role filtering
userSchema.index({ createdAt: -1 });   // fast sorting

module.exports = mongoose.model('User', userSchema);