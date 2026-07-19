const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { protect } = require('../middleware/auth');

// ── S3 client ─────────────────────────────────────────────────────────────────
// No accessKeyId/secretAccessKey here on purpose — on EC2 the SDK picks up
// credentials automatically from the instance's IAM role.
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

// ── Storage ───────────────────────────────────────────────────────────────────
// memoryStorage instead of diskStorage — we never want the file to touch the
// EC2 disk, it goes straight from the request into the S3 upload.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) cb(null, true);
  else cb(new Error('Only JPG, PNG and WebP images allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const FOLDER_MAP = { menu: 'menu', restaurant: 'restaurants', avatar: 'avatars' };

// POST /api/upload/menu        — upload a menu item image
// POST /api/upload/restaurant  — upload a restaurant image
// POST /api/upload/avatar      — upload a profile avatar
router.post('/:type', protect, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }

  const folder = FOLDER_MAP[req.params.type] || 'menu';
  const ext    = path.extname(req.file.originalname).toLowerCase();
  const key    = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    return res.status(500).json({ success: false, message: 'S3_BUCKET_NAME is not configured' });
  }

  try {
    await s3.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype
      // No ACL here — bucket policy / CloudFront handles public read access.
      // Setting ACL: 'public-read' will fail on buckets with ACLs disabled
      // (the S3 default since 2023), so leave this out.
    }));

    // Prefer a CloudFront URL if you've set one up; otherwise fall back to
    // the direct S3 URL.
    const imageUrl = process.env.CLOUDFRONT_URL
      ? `${process.env.CLOUDFRONT_URL}/${key}`
      : `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

    res.status(200).json({ success: true, imageUrl, key });
  } catch (error) {
    console.error('S3 upload error:', error.message);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
});

module.exports = router;
