const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// ─── Shared HTML shell ────────────────────────────────────────────────────────
const shell = (body) => `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}
  .head{background:linear-gradient(135deg,#667eea,#764ba2);padding:28px;text-align:center}
  .head h1{color:#fff;margin:0;font-size:24px}
  .head p{color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px}
  .body{padding:28px}
  .otp-box{background:#f0f4ff;border:2px dashed #667eea;border-radius:10px;text-align:center;padding:22px;margin:20px 0}
  .otp-code{font-size:40px;font-weight:900;letter-spacing:12px;color:#667eea}
  .otp-note{font-size:12px;color:#999;margin-top:8px}
  .info{background:#f8f9fa;border-radius:8px;padding:16px;margin:14px 0}
  .info h3{margin:0 0 10px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
  .row:last-child{border-bottom:none}
  .total{font-size:16px;font-weight:700;color:#ff6b6b;padding-top:8px}
  .foot{background:#2c3e50;color:#94a3b8;text-align:center;padding:16px;font-size:12px}
</style></head><body>
<div class="wrap">
  <div class="head"><h1>🍔 FoodOrder</h1><p>Your favourite food, delivered fast</p></div>
  <div class="body">${body}</div>
  <div class="foot">© 2026 FoodOrder · If you did not request this email, you can safely ignore it.</div>
</div></body></html>`;

// ─── Shared OTP box HTML ──────────────────────────────────────────────────────
const otpBox = (otp) => `
  <div class="otp-box">
    <div class="otp-code">${otp}</div>
    <div class="otp-note">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</div>
  </div>`;

// ─── 1a. Registration OTP ─────────────────────────────────────────────────────
const sendOtpEmail = async (email, otp, name, context = 'register') => {
  let subject, body;

  if (context === 'register') {
    subject = `${otp} — Verify your FoodOrder account`;
    body = `
      <h2 style="color:#2c3e50;margin-top:0">Welcome to FoodOrder! 👋</h2>
      <p>Hi <strong>${name}</strong>, thanks for signing up.</p>
      <p>Use the verification code below to confirm your email address and activate your account.</p>
      ${otpBox(otp)}
      <p style="color:#666;font-size:13px">Didn't create an account? You can safely ignore this email — no account will be created without verification.</p>`;

  } else if (context === 'change_email') {
    subject = `${otp} — Confirm your new email address`;
    body = `
      <h2 style="color:#2c3e50;margin-top:0">Confirm your new email 📧</h2>
      <p>Hi <strong>${name}</strong>, we received a request to update the email address on your FoodOrder account.</p>
      <p>Enter the code below to confirm ownership of this new address.</p>
      ${otpBox(otp)}
      <p style="color:#666;font-size:13px">If you did not request an email change, please log in and secure your account immediately.</p>`;

  } else if (context === 'change_phone') {
    subject = `${otp} — Verify your new phone number`;
    body = `
      <h2 style="color:#2c3e50;margin-top:0">Phone number verification 📱</h2>
      <p>Hi <strong>${name}</strong>, you asked us to update the phone number linked to your FoodOrder account.</p>
      <p>Use the code below to verify your new number. The code is valid for 10 minutes.</p>
      ${otpBox(otp)}
      <p style="color:#666;font-size:13px">If you did not request this change, please ignore this email. Your phone number will remain unchanged.</p>`;

  } else if (context === 'reset_password') {
    subject = `${otp} — Reset your FoodOrder password`;
    body = `
      <h2 style="color:#2c3e50;margin-top:0">Reset your password 🔑</h2>
      <p>Hi <strong>${name}</strong>, we received a request to reset the password for your FoodOrder account.</p>
      <p>Use the code below to set a new password. It expires in <strong>10 minutes</strong>.</p>
      ${otpBox(otp)}
      <p style="color:#666;font-size:13px">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>`;

  } else {
    // Generic fallback
    subject = `${otp} — Your FoodOrder verification code`;
    body = `
      <h2 style="color:#2c3e50;margin-top:0">Verification code 🔐</h2>
      <p>Hi <strong>${name}</strong>, here is your one-time verification code.</p>
      ${otpBox(otp)}`;
  }

  await transporter.sendMail({
    from: `"FoodOrder" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: shell(body),
  });
  console.log(`📧 OTP [${context}] sent to ${email}`);
};

// ─── 2. Order delivered email ─────────────────────────────────────────────────
const sendOrderDeliveredEmail = async (order, userEmail, userName) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const itemRows = order.items.map(i =>
    `<div class="row"><span>${i.quantity}× ${i.name}</span><span>₹${Number(i.subtotal).toFixed(2)}</span></div>`
  ).join('');

  const body = `
    <h2 style="color:#2c3e50;margin-top:0">Your order has been delivered! 🎉</h2>
    <p>Hi <strong>${userName}</strong>, your food has arrived. Enjoy your meal!</p>

    <div style="text-align:center;padding:10px 0">
      <span style="display:inline-block;padding:8px 22px;background:#d4edda;color:#155724;border:2px solid #28a745;border-radius:20px;font-weight:700;font-size:15px">
        🚚 Delivered
      </span>
    </div>

    <div class="info">
      <h3>Order summary</h3>
      <div class="row"><span>Order #</span><span><strong>${order.orderNumber}</strong></span></div>
      <div class="row"><span>Restaurant</span><span>${order.restaurant?.name || ''}</span></div>
      ${itemRows}
      <div class="row"><span style="color:#666">Subtotal</span><span>₹${Number(order.pricing.subtotal).toFixed(2)}</span></div>
      <div class="row"><span style="color:#666">Delivery Fee</span><span>₹${Number(order.pricing.deliveryFee).toFixed(2)}</span></div>
      <div class="row"><span style="color:#666">Tax (5%)</span><span>₹${Number(order.pricing.tax).toFixed(2)}</span></div>
      ${order.pricing.discount > 0 ? `<div class="row"><span style="color:#28a745">Promo Discount</span><span style="color:#28a745">−₹${Number(order.pricing.discount).toFixed(2)}</span></div>` : ''}
      <div class="row total"><span>Total Paid</span><span>₹${Number(order.pricing.total).toFixed(2)}</span></div>
    </div>

    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px;margin-top:14px;text-align:center">
      <strong style="font-size:15px">⭐ Enjoyed your meal?</strong><br>
      <span style="font-size:13px;color:#666;display:block;margin:6px 0 14px">Leave a review to help others discover great food!</span>
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/restaurant/${order.restaurant?._id}/reviews?openReviewForm=true"
         style="display:inline-block;background:#667eea;color:#ffffff;padding:10px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">
        ✍️ Write a Review
      </a>
    </div>
    <p style="color:#888;font-size:13px;margin-top:16px">Thank you for ordering with FoodOrder! 🍔</p>`;

  await transporter.sendMail({
    from: `"FoodOrder" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `🎉 Order Delivered — #${order.orderNumber} | FoodOrder`,
    html: shell(body),
  });
  console.log(`📧 Delivered email → ${userEmail}`);
};

// ─── 3. Order cancelled email ─────────────────────────────────────────────────
const sendOrderCancelledEmail = async (order, userEmail, userName, cancelledBy) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const itemRows = order.items.map(i =>
    `<div class="row"><span>${i.quantity}× ${i.name}</span><span>₹${Number(i.subtotal).toFixed(2)}</span></div>`
  ).join('');

  const byMsg = cancelledBy === 'restaurant'
    ? 'The restaurant has cancelled your order. We apologize for the inconvenience.'
    : 'Your order has been cancelled as requested.';

  const body = `
    <h2 style="color:#2c3e50;margin-top:0">Order Cancelled ❌</h2>
    <p>Hi <strong>${userName}</strong>, ${byMsg}</p>

    <div style="text-align:center;padding:10px 0">
      <span style="display:inline-block;padding:8px 22px;background:#f8d7da;color:#721c24;border:2px solid #ef4444;border-radius:20px;font-weight:700;font-size:15px">
        ❌ Cancelled
      </span>
    </div>

    <div class="info">
      <h3>Cancelled order details</h3>
      <div class="row"><span>Order #</span><span><strong>${order.orderNumber}</strong></span></div>
      <div class="row"><span>Restaurant</span><span>${order.restaurant?.name || ''}</span></div>
      ${itemRows}
      <div class="row total"><span>Order Total</span><span>₹${Number(order.pricing.total).toFixed(2)}</span></div>
    </div>

    ${cancelledBy === 'restaurant' ? `
    <div style="background:#f8d7da;border:1px solid #ef4444;border-radius:8px;padding:14px;margin-top:14px">
      <strong>🙏 We're sorry!</strong><br>
      <span style="font-size:13px;color:#666">Please try ordering from another restaurant. We appreciate your patience.</span>
    </div>` : ''}

    <p style="color:#888;font-size:13px;margin-top:16px">If you have any questions, please contact support.</p>`;

  await transporter.sendMail({
    from: `"FoodOrder" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `❌ Order Cancelled — #${order.orderNumber} | FoodOrder`,
    html: shell(body),
  });
  console.log(`📧 Cancelled email → ${userEmail} (by ${cancelledBy})`);
};

// ─── 4. Promo notification email ──────────────────────────────────────────────
const sendPromoNotificationEmail = async (userEmail, userName, restaurantName, promoCode, description, discountText, isDaily, menuItemNames = []) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const codeLen      = promoCode.length;
  const codeFontSize = codeLen <= 8 ? 36 : codeLen <= 12 ? 28 : codeLen <= 16 ? 22 : 18;
  const letterSpacing = codeLen <= 8 ? '6px' : codeLen <= 12 ? '3px' : '1px';

  // Sentence tailored to whether it's a daily deal or a standard promo
  const introParagraph = isDaily
    ? `<p style="font-size:15px;color:#555">Hi <strong>${userName}</strong>, <strong>${restaurantName}</strong> has a <strong>today-only deal</strong> waiting for you — grab it before midnight!</p>`
    : `<p style="font-size:15px;color:#555">Hi <strong>${userName}</strong>, <strong>${restaurantName}</strong> has sent you an exclusive promo code. Use it on your next order and save instantly!</p>`;

  // Build applicable items section if specific items are set
  const itemsSection = menuItemNames.length > 0
    ? `<div style="background:#fff8f0;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin:0 0 16px">
        <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">
          🍽️ This offer applies to these items
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${menuItemNames.map(name => `
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #fde68a;font-size:14px;color:#78350f;vertical-align:top;width:20px">✦</td>
              <td style="padding:6px 0;border-bottom:1px solid #fde68a;font-size:14px;color:#1a202c;font-weight:600">${name}</td>
            </tr>`).join('')}
        </table>
        <div style="font-size:12px;color:#92400e;margin-top:8px">Add any of the above items to your cart to unlock this discount.</div>
      </div>`
    : '';

  const body = `
    <h2 style="color:#2c3e50;margin-top:0;font-size:20px">🎉 Exclusive Offer Just for You!</h2>
    ${introParagraph}
    ${itemsSection}

    <!--[if mso]><table width="100%"><tr><td><![endif]-->
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;padding:28px 20px;text-align:center;margin:20px 0;width:100%;box-sizing:border-box">

      <div style="display:inline-block;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:30px;padding:5px 18px;margin-bottom:16px">
        <span style="color:white;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">
          ${isDaily ? '🗓️ TODAY ONLY' : '🎟️ PROMO CODE'}
        </span>
      </div>

      <div style="background:white;border-radius:12px;padding:18px 12px;margin:0 auto 16px;width:100%;box-sizing:border-box">
        <div style="font-size:${codeFontSize}px;font-weight:900;letter-spacing:${letterSpacing};color:#667eea;word-break:break-all;line-height:1.2">
          ${promoCode}
        </div>
      </div>

      <div style="color:white;font-size:22px;font-weight:900;margin-bottom:6px">${discountText}</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px">${description}</div>
    </div>
    <!--[if mso]></td></tr></table><![endif]-->

    <div style="background:#f8f9fa;border-radius:10px;padding:18px;margin:16px 0">
      <div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">How to redeem</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;vertical-align:top;width:32px">1️⃣</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#333">Open <strong>${restaurantName}</strong> on FoodOrder</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;vertical-align:top">2️⃣</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#333">Add your favourite items to the cart</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#555;vertical-align:top">3️⃣</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;color:#333">Enter code <strong style="color:#667eea;font-size:15px">${promoCode}</strong> at checkout to apply the discount</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#555;vertical-align:top">⚡</td><td style="padding:8px 0;font-size:14px;color:#333">${isDaily ? '<strong>Valid today only</strong> — order before midnight.' : 'Use it before it expires!'}</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0 16px">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/restaurants"
        style="display:inline-block;background:#ff6b35;color:white;padding:16px 0;border-radius:12px;font-weight:700;font-size:17px;text-decoration:none;width:100%;box-sizing:border-box;text-align:center">
        🍽️ Order Now &amp; Save!
      </a>
    </div>

    <p style="color:#aaa;font-size:12px;text-align:center;margin-top:12px;line-height:1.6">
      You received this because you've ordered from ${restaurantName} before.<br>
      The discount applies only to orders placed on FoodOrder.
    </p>`;

  await transporter.sendMail({
    from: `"FoodOrder" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `🎉 ${restaurantName} sent you a promo — Use code ${promoCode} to save!`,
    html: shell(body),
  });
  console.log(`📧 Promo email → ${userEmail} (${promoCode})`);
};

module.exports = { sendOtpEmail, sendOrderDeliveredEmail, sendOrderCancelledEmail, sendPromoNotificationEmail };
