// Run this ONCE to fix all existing orders with wrong payment status
// Usage: node fix-payment-status.js
// Run from: backend folder

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ Connection failed:', err); process.exit(1); });

const fixPaymentStatus = async () => {
  try {
    let fixed = 0;

    // Fix 1: Delivered + Cash on Delivery + Pending → Completed
    const deliveredCod = await Order.updateMany(
      { status: 'Delivered', 'payment.method': 'Cash on Delivery', 'payment.status': 'Pending' },
      { $set: { 'payment.status': 'Completed' } }
    );
    console.log(`✅ Delivered CoD orders marked Completed: ${deliveredCod.modifiedCount}`);
    fixed += deliveredCod.modifiedCount;

    // Fix 2: Cancelled + Cash on Delivery + Pending → Failed
    const cancelledCod = await Order.updateMany(
      { status: 'Cancelled', 'payment.method': 'Cash on Delivery', 'payment.status': 'Pending' },
      { $set: { 'payment.status': 'Failed' } }
    );
    console.log(`❌ Cancelled CoD orders marked Failed: ${cancelledCod.modifiedCount}`);
    fixed += cancelledCod.modifiedCount;

    // Fix 3: Cancelled + Card/UPI/Wallet + Completed → Refunded
    const cancelledPaid = await Order.updateMany(
      { status: 'Cancelled', 'payment.method': { $in: ['Credit Card', 'Debit Card', 'UPI', 'Wallet'] }, 'payment.status': 'Completed' },
      { $set: { 'payment.status': 'Refunded' } }
    );
    console.log(`↩️  Cancelled paid orders marked Refunded: ${cancelledPaid.modifiedCount}`);
    fixed += cancelledPaid.modifiedCount;

    // Fix 4: Card/UPI/Wallet + Active/Delivered + Pending → Completed
    const nonCodPaid = await Order.updateMany(
      {
        'payment.method': { $in: ['Credit Card', 'Debit Card', 'UPI', 'Wallet'] },
        'payment.status': 'Pending',
        status: { $nin: ['Cancelled'] }
      },
      { $set: { 'payment.status': 'Completed' } }
    );
    console.log(`💳 Non-CoD active orders marked Completed: ${nonCodPaid.modifiedCount}`);
    fixed += nonCodPaid.modifiedCount;

    console.log(`\n🎉 Total orders fixed: ${fixed}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

fixPaymentStatus();
