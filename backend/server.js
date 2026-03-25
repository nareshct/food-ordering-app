const express     = require('express');
const path        = require('path');
const compression = require('compression');
const http     = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const authRoutes       = require('./routes/authRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const menuRoutes       = require('./routes/menuRoutes');
const orderRoutes      = require('./routes/orderRoutes');
const userRoutes       = require('./routes/userRoutes');
const promoRoutes      = require('./routes/promoRoutes');

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Customer tracks a specific order
  socket.on('joinOrderRoom', (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`📦 Joined order room: order_${orderId}`);
  });

  // Customer joins their personal notification room
  socket.on('joinUserRoom', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 Joined user room: user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ── Middleware ────────────────────────────────────────────────────────────────
// Gzip compress all responses — reduces payload size by ~70%
app.use(compression());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache uploaded images for 7 days in browser
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=604800');
  next();
}, express.static('uploads'));

// ── MongoDB ───────────────────────────────────────────────────────────────────
// Atlas needs longer timeouts than local MongoDB
const mongoOpts = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,  // 30s — Atlas SRV lookup can be slow
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  family: 4,                        // force IPv4 — avoids IPv6 DNS issues on EC2
};

const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI, mongoOpts)
    .then(() => console.log('✅ MongoDB Atlas connected successfully'))
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      console.log('⏳ Retrying in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};
connectWithRetry();

// ── Scheduled Order Processor ────────────────────────────────────────────────
// Runs every 60 seconds. Finds scheduled orders whose time has arrived and
// automatically confirms them so the restaurant receives them at the right time.
const Order = require('./models/Order');

const processScheduledOrders = async () => {
  try {
    // Find all Pending orders that have a scheduledTime in the past
    const dueOrders = await Order.find({
      status: 'Pending',
      scheduledTime: { $lte: new Date() }
    }).populate('user', 'name email');

    for (const order of dueOrders) {
      order.status = 'Confirmed';
      order.statusHistory.push({
        status: 'Confirmed',
        timestamp: new Date(),
        note: 'Auto-confirmed — scheduled delivery time reached'
      });
      await order.save();

      // Notify customer via socket
      io.to(`order_${order._id}`).emit('orderStatusUpdate', {
        orderId:     order._id.toString(),
        orderNumber: order.orderNumber,
        status:      'Confirmed',
        message:     '✅ Your scheduled order is now confirmed!',
        timestamp:   new Date()
      });
      io.to(`user_${order.user._id}`).emit('orderStatusUpdate', {
        orderId:     order._id.toString(),
        orderNumber: order.orderNumber,
        status:      'Confirmed',
        message:     '✅ Your scheduled order is now confirmed!',
        timestamp:   new Date()
      });

      console.log(`⏰ Scheduled order ${order.orderNumber} auto-confirmed`);
    }
  } catch (err) {
    console.error('⚠️ Scheduled order processor error:', err.message);
  }
};

// Start the processor after MongoDB connects
mongoose.connection.once('open', () => {
  processScheduledOrders(); // run once immediately on startup
  setInterval(processScheduledOrders, 60 * 1000); // then every 60 seconds
  console.log('⏰ Scheduled order processor started');
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu',        menuRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/reviews',     require('./routes/reviewRoutes'));
app.use('/api/favorites',   require('./routes/favoriteRoutes'));
app.use('/api/promo',       promoRoutes);
app.use('/api/upload',      require('./routes/uploadRoutes'));   // ← Image uploads

app.get('/', (req, res) => {
  res.json({
    message: '🍔 FoodOrder API is running!',
    version: '2.0.0',
    features: ['real-time-tracking', 'image-uploads', 'loyalty-points']
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    // Never expose internal error details in production
    message: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error'
  });
});

// ── Serve React frontend in production ─────────────────────────────────────
// IMPORTANT: Place AFTER all /api routes so API calls are not intercepted
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  // Catch-all: serve React app for any non-API route
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, io };