const User = require('../models/User');

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name:    req.body.name,
      // email intentionally excluded — use /api/users/send-email-otp flow instead
      phone:   req.body.phone,
      address: req.body.address
    };
    // Allow avatar update
    if (req.body.avatar !== undefined) fieldsToUpdate.avatar = req.body.avatar;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['customer', 'restaurant_owner', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user role',
      error: error.message
    });
  }
};
// @desc    Toggle user active/inactive (Admin only)
// @route   PUT /api/users/:id/status
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success:false, message:'Cannot deactivate admin users' });
    user.isActive = !user.isActive;
    await user.save();
    res.status(200).json({ success:true, message:`User ${user.isActive?'activated':'deactivated'} successfully`, data:{ isActive:user.isActive } });
  } catch (e) { res.status(500).json({ success:false, message:'Error updating status', error:e.message }); }
};

// @desc    Send phone verify OTP to user's email
// @route   POST /api/users/verify-phone
exports.sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) return res.status(400).json({ success:false, message:'Valid 10-digit phone number required' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    if (!global.phoneOtpStore) global.phoneOtpStore = new Map();
    global.phoneOtpStore.set(req.user.id, { otp, phone, expiresAt: Date.now() + 10*60*1000 });
    const { sendOtpEmail } = require('../utils/emailservice');
    const user = await User.findById(req.user.id);
    await sendOtpEmail(user.email, otp, user.name, 'change_phone');
    res.status(200).json({ success:true, message:'OTP sent to your registered email address' });
  } catch (e) { res.status(500).json({ success:false, message:'Error sending OTP', error:e.message }); }
};

// @desc    Verify phone OTP and update phone number
// @route   PUT /api/users/verify-phone
exports.verifyPhoneOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!global.phoneOtpStore) return res.status(400).json({ success:false, message:'No pending verification. Request a new OTP.' });
    const entry = global.phoneOtpStore.get(req.user.id);
    if (!entry) return res.status(400).json({ success:false, message:'No pending verification. Request a new OTP.' });
    if (Date.now() > entry.expiresAt) { global.phoneOtpStore.delete(req.user.id); return res.status(400).json({ success:false, message:'OTP expired. Please request a new one.' }); }
    if (entry.otp !== otp.toString().trim()) return res.status(400).json({ success:false, message:'Incorrect OTP. Please try again.' });
    const user = await User.findByIdAndUpdate(req.user.id, { phone: entry.phone }, { new:true }).select('-password');
    global.phoneOtpStore.delete(req.user.id);
    res.status(200).json({ success:true, message:'Phone number updated successfully', data:user });
  } catch (e) { res.status(500).json({ success:false, message:'Error verifying OTP', error:e.message }); }
};

// @desc    Update email (requires password confirmation)
// @desc    Step 1: Send OTP to current email before changing email
// @route   POST /api/users/send-email-otp
exports.sendEmailOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ success:false, message:'New email is required' });
    const newEmailLower = newEmail.toLowerCase().trim();
    // Check not already taken
    const exists = await User.findOne({ email: newEmailLower, _id:{ $ne: req.user.id } });
    if (exists) return res.status(400).json({ success:false, message:'This email is already registered to another account' });
    const user = await User.findById(req.user.id);
    if (user.email === newEmailLower) return res.status(400).json({ success:false, message:'New email is the same as your current email' });
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    if (!global.emailOtpStore) global.emailOtpStore = new Map();
    global.emailOtpStore.set(req.user.id, { otp, newEmail: newEmailLower, expiresAt: Date.now() + 10*60*1000 });
    // Send OTP to NEW email to verify they own it
    const { sendOtpEmail } = require('../utils/emailservice');
    await sendOtpEmail(newEmailLower, otp, user.name, 'change_email');
    res.status(200).json({ success:true, message:`OTP sent to ${newEmailLower}` });
  } catch (e) { res.status(500).json({ success:false, message:'Error sending OTP', error:e.message }); }
};

// @desc    Step 2: Verify OTP and update email
// @route   PUT /api/users/update-email
exports.updateEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success:false, message:'OTP is required' });
    if (!global.emailOtpStore) return res.status(400).json({ success:false, message:'No pending email change. Request a new OTP.' });
    const entry = global.emailOtpStore.get(req.user.id);
    if (!entry) return res.status(400).json({ success:false, message:'No pending email change. Request a new OTP.' });
    if (Date.now() > entry.expiresAt) { global.emailOtpStore.delete(req.user.id); return res.status(400).json({ success:false, message:'OTP expired. Please request a new one.' }); }
    if (entry.otp !== otp.toString().trim()) return res.status(400).json({ success:false, message:'Incorrect OTP. Please try again.' });
    const updated = await User.findByIdAndUpdate(req.user.id, { email: entry.newEmail }, { new:true }).select('-password');
    global.emailOtpStore.delete(req.user.id);
    res.status(200).json({ success:true, message:'Email updated successfully', data:updated });
  } catch (e) { res.status(500).json({ success:false, message:'Error updating email', error:e.message }); }
};