const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/emailservice');

// In-memory OTP store: { email -> { otp, expiresAt, userData } }
// For production, replace with Redis or a DB collection
const otpStore = new Map();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const makeOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit

// ─── Step 1: Send OTP ─────────────────────────────────────────────────────────
// @route POST /api/auth/send-otp
// @access Public
exports.sendOtp = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    // Check if email already registered
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const otp = makeOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store pending registration
    otpStore.set(email, { otp, expiresAt, userData: { name, email, password, role: role || 'customer' } });

    // Send email
    await sendOtpEmail(email, otp, name);

    res.status(200).json({ success: true, message: `OTP sent to ${email}` });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.', error: error.message });
  }
};

// ─── Step 2: Verify OTP & create account ─────────────────────────────────────
// @route POST /api/auth/verify-otp
// @access Public
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const entry = otpStore.get(email);

    if (!entry) {
      return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (entry.otp !== otp.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    // OTP correct — create the user
    const { name, password, role } = entry.userData;
    otpStore.delete(email); // clean up

    const user = await User.create({ name, email, password, role });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Error creating account', error: error.message });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
// @route POST /api/auth/resend-otp
// @access Public
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const entry = otpStore.get(email);

    if (!entry) {
      return res.status(400).json({ success: false, message: 'No pending registration for this email. Please start over.' });
    }

    const otp = makeOtp();
    entry.otp = otp;
    entry.expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, entry);

    await sendOtpEmail(email, otp, entry.userData.name);

    res.status(200).json({ success: true, message: `New OTP sent to ${email}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resend OTP', error: error.message });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support to reactivate your account.'
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id, name: user.name, email: user.email,
          role: user.role, phone: user.phone,
          address: user.address, createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Error logging in', error: error.message });
  }
};

// ─── Get me ───────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user data' });
  }
};

// ─── Update password ──────────────────────────────────────────────────────────
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = req.body.newPassword;
    await user.save();
    const token = generateToken(user._id);
    res.status(200).json({ success: true, data: { token } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating password' });
  }
};
// ─── Forgot Password — Step 1: Send reset OTP ────────────────────────────────
// @route POST /api/auth/forgot-password
// @access Public
const resetOtpStore = new Map(); // { email -> { otp, expiresAt } }

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    // Always respond OK — don't reveal if email exists (security)
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email is registered, a reset code has been sent.' });
    }

    const otp = makeOtp();
    resetOtpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    await sendOtpEmail(email, otp, user.name, 'reset_password');

    res.status(200).json({ success: true, message: 'Password reset code sent to your email.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send reset code', error: error.message });
  }
};

// ─── Forgot Password — Step 2: Verify OTP & reset password ───────────────────
// @route POST /api/auth/reset-password
// @access Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const entry = resetOtpStore.get(email);
    if (!entry) return res.status(400).json({ success: false, message: 'No reset request found. Please request a new code.' });
    if (Date.now() > entry.expiresAt) {
      resetOtpStore.delete(email);
      return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
    }
    if (entry.otp !== otp.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();
    resetOtpStore.delete(email);

    res.status(200).json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error resetting password', error: error.message });
  }
};
