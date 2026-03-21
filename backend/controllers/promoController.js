const PromoCode = require('../models/PromoCode');
const Order     = require('../models/Order');
const User      = require('../models/User');
const { sendPromoNotificationEmail } = require('../utils/emailservice');

// ── Helper: notify all past customers of a restaurant ────────────────────────
const notifyPastCustomers = async (req, restaurantId, promo, restaurantName) => {
  try {
    const io = req.app.get('io');
    const discountText = promo.discountType === 'percentage'
      ? `${promo.discountValue}% OFF${promo.maxDiscountAmount ? ` (max ₹${promo.maxDiscountAmount})` : ''}`
      : `₹${promo.discountValue} OFF`;

    // Populate menu item names if promo applies to specific items
    let menuItemNames = [];
    if (promo.appliesTo === 'specific' && promo.menuItems && promo.menuItems.length > 0) {
      const MenuItem = require('../models/MenuItem');
      // menuItems may already be populated objects or just ObjectIds
      const ids = promo.menuItems.map(m => m._id || m);
      const items = await MenuItem.find({ _id: { $in: ids } }).select('name');
      menuItemNames = items.map(i => i.name);
    }

    // Find all unique customers who ordered from this restaurant
    const orders = await Order.find({ restaurant: restaurantId })
      .distinct('user');

    const customers = await User.find({
      _id: { $in: orders },
      role: 'customer',
      isActive: { $ne: false }
    }).select('_id name email');

    console.log(`📣 Notifying ${customers.length} past customers about promo ${promo.code}${menuItemNames.length ? ` (items: ${menuItemNames.join(', ')})` : ''}`);

    for (const customer of customers) {
      // Socket real-time notification
      if (io) {
        io.to(`user_${customer._id}`).emit('promoNotification', {
          type: 'promoCode',
          message: `🎉 ${restaurantName} has a special offer: ${discountText} — Use code ${promo.code}`,
          code: promo.code,
          description: promo.description,
          discountText,
          restaurantName,
          isDaily: promo.isDailyPromo || false,
          menuItemNames,
          timestamp: new Date()
        });
      }
      // Email notification (non-blocking per customer)
      sendPromoNotificationEmail(
        customer.email, customer.name, restaurantName,
        promo.code, promo.description, discountText, promo.isDailyPromo || false,
        menuItemNames
      ).catch(e => console.error(`⚠️ Promo email failed for ${customer.email}:`, e.message));
    }
    return customers.length;
  } catch (e) {
    console.error('⚠️ notifyPastCustomers error:', e.message);
    return 0;
  }
};


// Helper: today's date string YYYY-MM-DD
const todayStr = () => new Date().toISOString().split('T')[0];

// ── Validate promo code at checkout ──────────────────────────────────────────
// @route  POST /api/promo/validate
// @access Private (Customer)
exports.validatePromo = async (req, res) => {
  try {
    // cartItems: [{ _id, subtotal }] — used to calculate discount on specific items only
    const { code, orderAmount, restaurantId, menuItemIds, cartItems } = req.body;
    if (!code) return res.status(400).json({ success:false, message:'Please enter a promo code' });

    const promo = await PromoCode.findOne({ code: code.toUpperCase().trim() });
    if (!promo) return res.status(404).json({ success:false, message:'Invalid promo code' });
    if (!promo.isActive) return res.status(400).json({ success:false, message:'This promo code is no longer active' });

    // Expiry check
    if (promo.expiresAt && new Date() > promo.expiresAt)
      return res.status(400).json({ success:false, message:'This promo code has expired' });

    // Daily promo: only valid today
    if (promo.isDailyPromo && promo.validDate !== todayStr())
      return res.status(400).json({ success:false, message:'This promo code is only valid today and has expired' });

    // Usage limit
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit)
      return res.status(400).json({ success:false, message:'This promo code has reached its usage limit' });

    // One per user check
    if (promo.onePerUser && promo.usedBy.map(id => id.toString()).includes(req.user.id))
      return res.status(400).json({ success:false, message:'You have already used this promo code' });

    // Min order
    if (orderAmount < promo.minOrderAmount)
      return res.status(400).json({ success:false, message:`Minimum order of ₹${promo.minOrderAmount} required` });

    // Restaurant-specific promo — must be ordering from that restaurant
    if (promo.restaurant && restaurantId && promo.restaurant.toString() !== restaurantId)
      return res.status(400).json({ success:false, message:'This promo is only valid at a specific restaurant' });

    // ── Specific items: find matching items and compute their subtotal only ──
    let applicableSubtotal = orderAmount; // default: discount applies to full cart
    let applicableItemIds  = [];          // empty = applies to all items

    if (promo.appliesTo === 'specific' && promo.menuItems.length > 0) {
      const promoItemIds = promo.menuItems.map(m => m.toString());
      const ids = (menuItemIds || []).map(String);

      // Check at least one promo item is in cart
      const matchingIds = ids.filter(id => promoItemIds.includes(id));
      if (matchingIds.length === 0)
        return res.status(400).json({ success:false, message:'This promo code applies to specific menu items not in your cart' });

      applicableItemIds = matchingIds;

      // Sum only the subtotals of matching items
      if (cartItems && cartItems.length > 0) {
        applicableSubtotal = cartItems
          .filter(ci => promoItemIds.includes(String(ci._id)))
          .reduce((sum, ci) => sum + Number(ci.subtotal), 0);
      }
    }

    // ── Calculate discount on the applicable subtotal only ────────────────────
    let discountAmount = 0;
    if (promo.discountType === 'percentage') {
      discountAmount = (applicableSubtotal * promo.discountValue) / 100;
      if (promo.maxDiscountAmount) discountAmount = Math.min(discountAmount, promo.maxDiscountAmount);
    } else {
      // Flat discount: capped to applicable subtotal (can't discount more than item costs)
      discountAmount = Math.min(promo.discountValue, applicableSubtotal);
    }
    discountAmount = Math.min(discountAmount, applicableSubtotal);

    res.status(200).json({
      success: true,
      message: 'Promo code applied!',
      data: {
        code:              promo.code,
        description:       promo.description,
        discountType:      promo.discountType,
        discountValue:     promo.discountValue,
        discountAmount:    parseFloat(discountAmount.toFixed(2)),
        applicableSubtotal: parseFloat(applicableSubtotal.toFixed(2)),
        applicableItemIds, // frontend uses this to highlight which items got discount
        appliesTo:         promo.appliesTo,
        isDailyPromo:      promo.isDailyPromo,
        autoApplied:       false
      }
    });
  } catch (e) {
    res.status(500).json({ success:false, message:'Error validating promo code', error:e.message });
  }
};

// ── Mark promo as used after order is placed ─────────────────────────────────
// @route  POST /api/promo/mark-used
// @access Private (Customer)
exports.markPromoUsed = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success:false, message:'Code required' });
    const promo = await PromoCode.findOne({ code: code.toUpperCase().trim() });
    if (!promo) return res.status(404).json({ success:false, message:'Promo not found' });

    // Only add user if not already there
    if (!promo.usedBy.map(id => id.toString()).includes(req.user.id)) {
      promo.usedBy.push(req.user.id);
    }
    promo.usedCount += 1;
    await promo.save();

    res.status(200).json({ success:true, message:'Promo marked as used' });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Get today's auto-apply daily promos for a restaurant ─────────────────────
// @route  GET /api/promo/daily/:restaurantId
// @access Private (Customer)
exports.getDailyPromos = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const today = todayStr();

    const promos = await PromoCode.find({
      isDailyPromo: true,
      validDate: today,
      isActive: true,
      $or: [
        { restaurant: restaurantId },
        { restaurant: null }  // global daily promos apply everywhere
      ]
    }).populate('menuItems', 'name');

    // Filter out promos this user already used
    const userId = req.user.id;
    const available = promos.filter(p => {
      if (!p.onePerUser) return true;
      return !p.usedBy.map(id => id.toString()).includes(userId);
    });

    res.status(200).json({ success:true, data: available });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Admin: get all promos ─────────────────────────────────────────────────────
// @route  GET /api/promo
// @access Private (Admin)
exports.getAllPromos = async (req, res) => {
  try {
    const promos = await PromoCode.find()
      .populate('restaurant', 'name')
      .populate('menuItems', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success:true, count:promos.length, data:promos });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Admin: create promo ───────────────────────────────────────────────────────
// @route  POST /api/promo
// @access Private (Admin)
exports.createPromo = async (req, res) => {
  try {
    // Restaurant owners can only create promos for their own restaurants
    if (req.user.role === 'restaurant_owner') {
      if (!req.body.restaurant) {
        return res.status(400).json({ success:false, message:'restaurant field is required for owner-created promos' });
      }
      const Restaurant = require('../models/Restaurant');
      const owned = await Restaurant.findOne({ _id: req.body.restaurant, owner: req.user.id });
      if (!owned) return res.status(403).json({ success:false, message:'Not authorized to create promos for this restaurant' });
    }
    const createdBy = req.user.role === 'admin' ? 'admin' : 'restaurant';
    const promo = await PromoCode.create({ ...req.body, createdBy });
    res.status(201).json({ success:true, data:promo });
    // If restaurant created this promo, notify their past customers
    if (req.body.restaurant && createdBy === 'restaurant') {
      const Restaurant = require('../models/Restaurant');
      const rest2 = await Restaurant.findById(req.body.restaurant).select('name');
      const restName2 = rest2 ? rest2.name : 'Your favourite restaurant';
      notifyPastCustomers(req, req.body.restaurant, promo, restName2)
        .catch(e => console.error('Notify error:', e.message));
    }
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success:false, message:'Promo code already exists' });
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Admin: update promo ───────────────────────────────────────────────────────
// @route  PUT /api/promo/:id
// @access Private (Admin)
exports.updatePromo = async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ success:false, message:'Promo code not found' });
    // Restaurant owners can only update their own restaurant's promos
    if (req.user.role === 'restaurant_owner') {
      if (!promo.restaurant) return res.status(403).json({ success:false, message:'Not authorized' });
      const Restaurant = require('../models/Restaurant');
      const owned = await Restaurant.findOne({ _id: promo.restaurant, owner: req.user.id });
      if (!owned) return res.status(403).json({ success:false, message:'Not authorized to update this promo' });
    }
    const updated = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new:true, runValidators:true });
    res.status(200).json({ success:true, data:updated });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Admin: delete promo ───────────────────────────────────────────────────────
// @route  DELETE /api/promo/:id
// @access Private (Admin)
exports.deletePromo = async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ success:false, message:'Promo code not found' });
    // Restaurant owners can only delete their own restaurant's promos
    if (req.user.role === 'restaurant_owner') {
      if (!promo.restaurant) return res.status(403).json({ success:false, message:'Not authorized to delete admin promos' });
      const Restaurant = require('../models/Restaurant');
      const owned = await Restaurant.findOne({ _id: promo.restaurant, owner: req.user.id });
      if (!owned) return res.status(403).json({ success:false, message:'Not authorized to delete this promo' });
    }
    await PromoCode.findByIdAndDelete(req.params.id);
    res.status(200).json({ success:true, message:'Promo code deleted' });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Restaurant owner: create today-only daily promo ───────────────────────────
// @route  POST /api/promo/daily
// @access Private (Restaurant Owner)
exports.createDailyPromo = async (req, res) => {
  try {
    const { restaurantId, discountType, discountValue, description, appliesTo, menuItems, maxDiscountAmount } = req.body;
    if (!restaurantId || !discountType || !discountValue)
      return res.status(400).json({ success:false, message:'restaurantId, discountType and discountValue are required' });

    const today = todayStr();
    // Generate unique code: DAILY-<restaurantId-last4>-<MMDD>
    const suffix = restaurantId.toString().slice(-4).toUpperCase();
    const mmdd   = today.replace(/-/g,'').slice(4);
    let code = `DAILY${suffix}${mmdd}`;

    // If code exists for today from same restaurant, update instead
    const existing = await PromoCode.findOne({ code, validDate: today });
    if (existing) {
      existing.discountType = discountType;
      existing.discountValue = discountValue;
      existing.description = description || `Today's special discount!`;
      existing.appliesTo = appliesTo || 'all';
      existing.menuItems = appliesTo === 'specific' ? (menuItems || []) : [];
      existing.maxDiscountAmount = maxDiscountAmount || null;
      existing.isActive = true;
      await existing.save();
      return res.status(200).json({ success:true, message:'Daily promo updated', data:existing });
    }

    const promo = await PromoCode.create({
      code,
      description: description || `Today's special discount!`,
      discountType,
      discountValue,
      maxDiscountAmount: maxDiscountAmount || null,
      minOrderAmount: 0,
      usageLimit: null,
      onePerUser: true,
      isActive: true,
      isDailyPromo: true,
      validDate: today,
      expiresAt: new Date(new Date().setHours(23,59,59,999)),
      restaurant: restaurantId,
      appliesTo: appliesTo || 'all',
      menuItems: appliesTo === 'specific' ? (menuItems || []) : [],
      createdBy: 'restaurant'
    });

    // Notify past customers about the daily promo
    const Restaurant = require('../models/Restaurant');
    const rest = await Restaurant.findById(restaurantId).select('name');
    const restName = rest ? rest.name : 'Your favourite restaurant';
    const notified = await notifyPastCustomers(req, restaurantId, promo, restName);
    console.log(`📣 Notified ${notified} customers about daily promo ${promo.code}`);

    res.status(201).json({ success:true, message:'Daily promo created', data:promo, notified });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success:false, message:'Daily promo for today already exists' });
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── Restaurant owner: get own promos ─────────────────────────────────────────
// @route  GET /api/promo/restaurant/:restaurantId
// @access Private (Restaurant Owner)
exports.getRestaurantPromos = async (req, res) => {
  try {
    const promos = await PromoCode.find({ restaurant: req.params.restaurantId })
      .populate('menuItems','name')
      .sort({ createdAt:-1 });
    res.status(200).json({ success:true, data:promos });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
};