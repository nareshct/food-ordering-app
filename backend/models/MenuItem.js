const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [300, 'Description cannot exceed 300 characters']
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Snacks', 'Salads', 'Soups', 'Special']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  image: {
    type: String,
    default: 'default-food.jpg'
  },
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  isGlutenFree: {
    type: Boolean,
    default: false
  },
  spiceLevel: {
    type: String,
    enum: ['None', 'Mild', 'Medium', 'Hot', 'Extra Hot'],
    default: 'None'
  },
  ingredients: [String],
  allergens: [String],
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  preparationTime: {
    type: String,
    default: '15-20 mins'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search
menuItemSchema.index({ name: 'text', description: 'text', category: 'text' });

// Performance indexes
menuItemSchema.index({ restaurant: 1, isAvailable: 1 }); // fast menu lookup
menuItemSchema.index({ restaurant: 1, category: 1 });    // fast category filter

module.exports = mongoose.model('MenuItem', menuItemSchema);
