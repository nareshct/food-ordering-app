const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, resendOtp, login, getMe, updatePassword, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// OTP registration flow
router.post('/send-otp',   sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Auth
router.post('/login', login);
router.get('/me',           protect, getMe);
router.put('/updatepassword', protect, updatePassword);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

module.exports = router;