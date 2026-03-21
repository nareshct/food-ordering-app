const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  addFavorite,
  removeFavorite,
  getFavorites,
  checkFavorite
} = require('../controllers/favoriteController');

router.post('/', protect, addFavorite);
router.delete('/:restaurantId', protect, removeFavorite);
router.get('/', protect, getFavorites);
router.get('/check/:restaurantId', protect, checkFavorite);

module.exports = router;
