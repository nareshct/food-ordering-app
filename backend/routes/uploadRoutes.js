const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { protect } = require('../middleware/auth');

// ── Ensure folders exist ──────────────────────────────────────────────────────
['uploads', 'uploads/menu', 'uploads/restaurants', 'uploads/avatars'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Storage ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const map = { menu: 'uploads/menu', restaurant: 'uploads/restaurants', avatar: 'uploads/avatars' };
    cb(null, map[req.params.type] || 'uploads/menu');
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  if (/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) cb(null, true);
  else cb(new Error('Only JPG, PNG and WebP images allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/upload/menu        — upload a menu item image
// POST /api/upload/restaurant  — upload a restaurant image
// POST /api/upload/avatar      — upload a profile avatar
router.post('/:type', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }
  const subDir = { menu: 'menu', restaurant: 'restaurants', avatar: 'avatars' };
  const folder = subDir[req.params.type] || 'menu';
  const imageUrl = `${process.env.SERVER_URL || 'http://localhost:8000'}/uploads/${folder}/${req.file.filename}`;
  res.status(200).json({ success: true, imageUrl, filename: req.file.filename });
});

module.exports = router;