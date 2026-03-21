const Restaurant = require('../models/Restaurant');

// @desc    Get all restaurants
// @route   GET /api/restaurants
// @access  Public
exports.getRestaurants = async (req, res) => {
  try {
    const { search, cuisine } = req.query;
    let query = { isActive: true, isOpen: { $ne: false } };

    // Filter out restaurants with today as a leave day
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }); // e.g. 'Monday'
    query.leaveDays = { $nin: [today] };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (cuisine && cuisine !== 'All') {
      query.cuisine = cuisine;
    }

    const restaurants = await Restaurant.find(query)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurants',
      error: error.message
    });
  }
};

// @desc    Get single restaurant
// @route   GET /api/restaurants/:id
// @access  Public
exports.getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate('owner', 'name email');

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.status(200).json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurant',
      error: error.message
    });
  }
};

// @desc    Get restaurants by owner ID
// @route   GET /api/restaurants/owner/:ownerId
// @access  Private
exports.getOwnerRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.params.ownerId })
      .populate('owner', 'name email');

    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('Error fetching owner restaurants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching restaurants',
      error: error.message
    });
  }
};

// @desc    Create restaurant
// @route   POST /api/restaurants
// @access  Private (Restaurant Owner/Admin)
exports.createRestaurant = async (req, res) => {
  try {
    // Add owner from logged in user
    req.body.owner = req.user.id;

    const restaurant = await Restaurant.create(req.body);

    res.status(201).json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating restaurant',
      error: error.message
    });
  }
};

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
// @access  Private (Restaurant Owner/Admin)
exports.updateRestaurant = async (req, res) => {
  try {
    let restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Make sure user is restaurant owner
    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update this restaurant'
      });
    }

    restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating restaurant',
      error: error.message
    });
  }
};

// @desc    Delete restaurant
// @route   DELETE /api/restaurants/:id
// @access  Private (Restaurant Owner/Admin)
exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Make sure user is restaurant owner
    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to delete this restaurant'
      });
    }

    await restaurant.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Restaurant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting restaurant',
      error: error.message
    });
  }
};
// @desc    Toggle restaurant open/closed (owner only)
// @route   PUT /api/restaurants/:id/toggle-open
// @access  Private (Restaurant Owner)
exports.toggleOpen = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success:false, message:'Restaurant not found' });
    if (restaurant.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success:false, message:'Not authorized' });
    }
    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();
    res.status(200).json({
      success: true,
      message: `Restaurant is now ${restaurant.isOpen ? 'Open' : 'Closed'}`,
      data: { isOpen: restaurant.isOpen }
    });
  } catch (e) { res.status(500).json({ success:false, message:e.message }); }
};
