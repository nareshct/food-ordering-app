const Order      = require('../models/Order');
const MenuItem   = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const User       = require('../models/User');
const { sendOrderDeliveredEmail, sendOrderCancelledEmail } = require('../utils/emailservice');

// ── Points config ─────────────────────────────────────────────────────────────
// Earn: ₹10 spent = 1 point
// Redeem: 100 points = ₹10 discount
const EARN_RATE   = 0.1;   // points per rupee
const REDEEM_RATE = 0.1;   // rupees per point

// Helper: emit socket event safely
const emit = (req, room, event, data) => {
  const io = req.app.get('io');
  if (io) io.to(room).emit(event, data);
};

// ── STATUS MESSAGES ───────────────────────────────────────────────────────────
const STATUS_MSG = {
  'Confirmed':        '✅ Your order is confirmed!',
  'Preparing':        '👨‍🍳 The kitchen is preparing your food.',
  'Ready':            '📦 Your order is ready for pickup!',
  'Out for Delivery': '🚚 Your order is on the way!',
  'Delivered':        '🎉 Your order has been delivered. Enjoy your meal!',
  'Cancelled':        '❌ Your order has been cancelled.'
};

// ── CREATE ORDER ──────────────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { restaurant, items, deliveryAddress, payment, specialInstructions, scheduledTime } = req.body;

    const restaurantData = await Restaurant.findById(restaurant);
    if (!restaurantData) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // ── Scheduled order validation ─────────────────────────────────────────────
    if (scheduledTime) {
      const schedDate = new Date(scheduledTime);

      // 1. Must be at least 30 min in the future
      if (schedDate.getTime() < Date.now() + 29 * 60000) {
        return res.status(400).json({ success: false, message: 'Scheduled time must be at least 30 minutes from now.' });
      }

      // 2. Check restaurant leave days
      const dayName = schedDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g. "Monday"
      if (restaurantData.leaveDays && restaurantData.leaveDays.includes(dayName)) {
        return res.status(400).json({
          success: false,
          message: `${restaurantData.name} is closed on ${dayName}s. Please choose a different day.`
        });
      }

      // 3. Check opening hours (format: "9:00 AM - 11:00 PM")
      if (restaurantData.openingHours) {
        try {
          const [openStr, closeStr] = restaurantData.openingHours.split(' - ').map(s => s.trim());
          const parseTime = (str, refDate) => {
            const [time, meridiem] = str.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (meridiem === 'PM' && hours !== 12) hours += 12;
            if (meridiem === 'AM' && hours === 12) hours = 0;
            const d = new Date(refDate);
            d.setHours(hours, minutes, 0, 0);
            return d;
          };
          const openTime  = parseTime(openStr,  schedDate);
          const closeTime = parseTime(closeStr, schedDate);
          if (schedDate < openTime || schedDate > closeTime) {
            return res.status(400).json({
              success: false,
              message: `${restaurantData.name} is only open ${restaurantData.openingHours}. Please schedule within opening hours.`
            });
          }
        } catch {} // if format is unparseable, skip this check
      }
    }

    // ── ASAP order: check restaurant is open right now ─────────────────────────
    if (!scheduledTime) {
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      if (restaurantData.leaveDays && restaurantData.leaveDays.includes(todayName)) {
        return res.status(400).json({
          success: false,
          message: `${restaurantData.name} is closed today (${todayName}). Try scheduling for another day.`
        });
      }
      if (restaurantData.isOpen === false) {
        return res.status(400).json({
          success: false,
          message: `${restaurantData.name} is currently closed. Try scheduling for later.`
        });
      }
    }

    let subtotal = 0;
    const orderItems = [];

    // Fetch ALL menu items in ONE query instead of one per item (fixes N+1)
    const menuItemIds = items.map(i => i.menuItem);
    const menuItemDocs = await MenuItem.find({ _id: { $in: menuItemIds } });
    const menuItemMap = {};
    menuItemDocs.forEach(m => { menuItemMap[m._id.toString()] = m; });

    for (let item of items) {
      const menuItem = menuItemMap[item.menuItem?.toString() || item.menuItem];
      if (!menuItem) return res.status(404).json({ success: false, message: `Menu item not found` });
      if (!menuItem.isAvailable) return res.status(400).json({ success: false, message: `${menuItem.name} is currently unavailable` });

      const itemSubtotal = menuItem.price * item.quantity;
      subtotal += itemSubtotal;
      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price,
        subtotal: itemSubtotal,
        specialInstructions: item.specialInstructions || ''
      });
    }

    const deliveryFee = restaurantData.deliveryFee || 0;
    const tax = subtotal * 0.05;

    // ── Discount: recalculate on backend — never trust frontend value ─────────
    // Frontend sends pricing.discount as a hint, but we verify it here.
    // Promo discount: frontend already validated via /api/promo/validate, so we
    // trust the amount only up to the applicable item subtotals cap.
    const frontendDiscount = Number(req.body.pricing?.discount) || 0;
    // Cap promo discount to subtotal (cannot discount more than items cost)
    const promoDiscount = Math.min(frontendDiscount, subtotal);
    let discount = promoDiscount;

    // ── Loyalty: apply redeemed points ───────────────────────────────────────
    const pointsToRedeem = Number(req.body.pointsToRedeem) || 0;
    if (pointsToRedeem > 0) {
      const customer = await User.findById(req.user.id);
      if (customer.loyaltyPoints < pointsToRedeem) {
        return res.status(400).json({ success: false, message: 'Insufficient loyalty points' });
      }
      // Loyalty discount: each point = ₹0.10
      const loyaltyDiscount = pointsToRedeem * REDEEM_RATE;
      discount += loyaltyDiscount;
    }

    // Final discount cannot exceed subtotal + tax (delivery fee is never discounted)
    discount = Math.min(discount, subtotal + tax);

    const total = Math.max(0, subtotal + deliveryFee + tax - discount);

    // Enforce correct payment status regardless of what frontend sends
    const paymentMethod = payment?.method || 'Cash on Delivery';
    const paymentStatus = paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Completed';
    const safePayment = { method: paymentMethod, status: paymentStatus };

    // ── Smart estimated delivery time ────────────────────────────────────────
    // 1. Parse preparationTime strings like "20 mins", "15-20 mins", "30 min"
    const parsePrepTime = (str) => {
      if (!str) return 15; // default fallback
      const nums = str.match(/\d+/g);
      if (!nums) return 15;
      // If range like "15-20", take the higher number
      return Math.max(...nums.map(Number));
    };

    // 2. Max prep time across all ordered items (kitchen cooks in parallel)
    const maxPrepMins = orderItems.reduce((max, item) => {
      const menuDoc = menuItemDocs.find(m => m._id.toString() === item.menuItem.toString());
      const mins = parsePrepTime(menuDoc?.preparationTime);
      return Math.max(max, mins);
    }, 15);

    // 3. Queue delay: count active orders at this restaurant right now
    //    Each active order adds 5 min (restaurant has limited capacity)
    const activeOrderCount = await Order.countDocuments({
      restaurant,
      status: { $in: ['Pending', 'Confirmed', 'Preparing'] }
    });
    const queueDelayMins = activeOrderCount * 5;

    // 4. Fixed delivery time
    const deliveryMins = 15;

    // 5. Total = prep + queue + delivery (minimum 20 min)
    const totalMins = Math.max(20, maxPrepMins + queueDelayMins + deliveryMins);

    // 6. For scheduled orders: start from scheduledTime, not now
    const baseTime = scheduledTime ? new Date(scheduledTime) : new Date();
    const estimatedDeliveryTime = new Date(baseTime.getTime() + totalMins * 60000);

    console.log(`⏱️ ETA calc — prep:${maxPrepMins}m queue:${queueDelayMins}m (${activeOrderCount} active orders) delivery:${deliveryMins}m = ${totalMins}m total`);

    const order = await Order.create({
      user: req.user.id,
      restaurant,
      items: orderItems,
      deliveryAddress,
      pricing: { subtotal, deliveryFee, tax, discount, total },
      payment: safePayment,
      specialInstructions,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      estimatedDeliveryTime,
      statusHistory: [{ status: 'Pending', timestamp: new Date(), note: scheduledTime ? `Scheduled for ${new Date(scheduledTime).toLocaleString()}` : 'Order placed' }]
    });

    // Deduct redeemed points
    if (pointsToRedeem > 0) {
      const customer = await User.findById(req.user.id);
      await customer.redeemPoints(
        pointsToRedeem,
        `Redeemed for order ${order.orderNumber}`,
        order._id
      );
    }

    const populatedOrder = await Order.findById(order._id)
      .populate('restaurant', 'name address contact')
      .populate('items.menuItem', 'name image');

    // Socket: notify customer their order was received
    emit(req, `user_${req.user.id}`, 'orderPlaced', {
      orderId:     order._id,
      orderNumber: order.orderNumber,
      message:     '✅ Order placed! Restaurant will confirm shortly.'
    });

    res.status(201).json({ success: true, message: 'Order placed successfully', data: populatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating order', error: error.message });
  }
};

// ── GET ALL ORDERS (Admin) ────────────────────────────────────────────────────
exports.getAllOrders = async (req, res) => {
  try {
    const { status, restaurant } = req.query;
    let query = {};
    if (status)     query.status     = status;
    if (restaurant) query.restaurant = restaurant;

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('restaurant', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
};

// ── GET MY ORDERS ─────────────────────────────────────────────────────────────
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('restaurant', 'name image address')
      .populate('items.menuItem', 'name image')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
};

// ── GET SINGLE ORDER ──────────────────────────────────────────────────────────
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('restaurant', 'name image address contact')
      .populate('items.menuItem', 'name image description');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      const rest = await Restaurant.findById(order.restaurant._id);
      if (!rest || rest.owner.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
      }
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching order', error: error.message });
  }
};

// ── UPDATE ORDER STATUS ───────────────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    let order = await Order.findById(req.params.id)
      .populate('restaurant')
      .populate('user', 'email name role loyaltyPoints loyaltyTier');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Order status updated to ${status}`
    });

    if (status === 'Delivered') {
      order.actualDeliveryTime = new Date();
      // Cash on Delivery → mark as Completed when delivered
      if (order.payment.method === 'Cash on Delivery') {
        order.payment.status = 'Completed';
      }
    }

    if (status === 'Cancelled') {
      // Already charged (card/UPI/Wallet) → Refunded; CoD or unpaid → Failed
      order.payment.status = order.payment.status === 'Completed' ? 'Refunded' : 'Failed';
    }

    await order.save();

    // ── Socket: push real-time status update to customer ─────────────────────
    const socketData = {
      orderId:     order._id.toString(),
      orderNumber: order.orderNumber,
      status,
      message:     STATUS_MSG[status] || `Order ${status}`,
      timestamp:   new Date()
    };
    emit(req, `order_${order._id}`, 'orderStatusUpdate', socketData);
    emit(req, `user_${order.user._id}`, 'orderStatusUpdate', socketData);

    // ── Loyalty: award points on delivery ─────────────────────────────────────
    // loyaltyAwarded flag prevents double-awarding if status is set to
    // Delivered more than once (e.g. accidental double-click or retry)
    if (status === 'Delivered' && order.user?.role === 'customer' && !order.loyaltyAwarded) {
      try {
        const customer = await User.findById(order.user._id);
        const pointsEarned = Math.floor(order.pricing.total * EARN_RATE);
        if (pointsEarned > 0 && customer) {
          await customer.addPoints(
            pointsEarned,
            `Earned from order ${order.orderNumber}`,
            order._id
          );
          // Mark as awarded so it never runs again for this order
          order.loyaltyAwarded = true;
          // Socket: tell customer they earned points
          emit(req, `user_${order.user._id}`, 'pointsEarned', {
            points:  pointsEarned,
            total:   customer.loyaltyPoints,
            tier:    customer.loyaltyTier,
            message: `🏆 You earned ${pointsEarned} loyalty points!`
          });
        }
      } catch (e) { console.error('⚠️ Loyalty points error:', e.message); }

      // Email: delivered
      try {
        await sendOrderDeliveredEmail(order, order.user.email, order.user.name);
      } catch (e) { console.error('⚠️ Delivered email failed:', e.message); }
    }

    // Email: cancelled by restaurant
    if (status === 'Cancelled' && order.user?.role === 'customer') {
      try {
        await sendOrderCancelledEmail(order, order.user.email, order.user.name, 'restaurant');
      } catch (e) { console.error('⚠️ Cancelled email failed:', e.message); }
    }

    res.status(200).json({ success: true, message: 'Order status updated successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating order status', error: error.message });
  }
};

// ── CANCEL ORDER (Customer) ───────────────────────────────────────────────────
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'email name role');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }
    if (['Ready', 'Out for Delivery', 'Delivered'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel order at this stage' });
    }

    order.status = 'Cancelled';
    order.statusHistory.push({
      status: 'Cancelled',
      timestamp: new Date(),
      note: 'Order cancelled by customer'
    });
    await order.save();

    emit(req, `order_${order._id}`, 'orderStatusUpdate', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: 'Cancelled',
      message: '❌ Order cancelled by customer'
    });

    if (order.user?.role === 'customer') {
      try {
        await sendOrderCancelledEmail(order, order.user.email, order.user.name, 'customer');
      } catch (e) { console.error('⚠️ Cancel email failed:', e.message); }
    }

    res.status(200).json({ success: true, message: 'Order cancelled successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cancelling order', error: error.message });
  }
};

// ── RATE ORDER ────────────────────────────────────────────────────────────────
exports.rateOrder = async (req, res) => {
  try {
    const { food, delivery, comment } = req.body;
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (order.status !== 'Delivered') return res.status(400).json({ success: false, message: 'Can only rate delivered orders' });
    order.rating = { food, delivery, comment, ratedAt: new Date() };
    await order.save();
    res.status(200).json({ success: true, message: 'Rating submitted successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting rating', error: error.message });
  }
};

// ── GET RESTAURANT ORDERS ─────────────────────────────────────────────────────
exports.getRestaurantOrders = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view these orders' });
    }
    const orders = await Order.find({ restaurant: req.params.restaurantId })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
};