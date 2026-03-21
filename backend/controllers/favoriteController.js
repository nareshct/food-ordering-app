const Favorite = require('../models/Favorite');

exports.addFavorite = async (req, res) => {
  try {
    const { restaurant } = req.body;
    const favorite = await Favorite.create({
      user: req.user.id,
      restaurant
    });
    res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Already favorited' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    await Favorite.findOneAndDelete({
      user: req.user.id,
      restaurant: req.params.restaurantId
    });
    res.status(200).json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.id })
      .populate('restaurant')
      .sort('-createdAt');
    res.status(200).json({ success: true, data: favorites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkFavorite = async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      user: req.user.id,
      restaurant: req.params.restaurantId
    });
    res.status(200).json({ success: true, isFavorite: !!favorite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
