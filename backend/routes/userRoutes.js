const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  updateUserRole,
  toggleUserStatus,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtp,
  updateEmail
} = require('../controllers/userController');

// Public stats (no auth needed for home page)
router.get('/stats', async (req, res) => {
  try {
    const User = require('../models/User');
    const count = await User.countDocuments({ role: 'customer', isActive: { $ne: false } });
    res.status(200).json({ success: true, customers: count });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Public/Protected routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Admin only routes
router.get('/', protect, authorize('admin'), getAllUsers);
router.get('/:id', protect, authorize('admin'), getUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);
router.put('/:id/role', protect, authorize('admin'), updateUserRole);

// Phone number change with OTP verification
router.post('/verify-phone',  protect, sendPhoneOtp);
router.put('/verify-phone',   protect, verifyPhoneOtp);

// Email change with OTP
router.post('/send-email-otp', protect, sendEmailOtp);
router.put('/update-email',    protect, updateEmail);

// Admin: activate/deactivate user
router.put('/:id/status', protect, authorize('admin'), toggleUserStatus);

module.exports = router;