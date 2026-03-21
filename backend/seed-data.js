const mongoose = require('mongoose');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const Review = require('./models/Review');
const Favorite = require('./models/Favorite');
const PromoCode = require('./models/PromoCode');
require('dotenv').config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear ALL collections to avoid orphan data between reseeds
    await User.deleteMany({});
    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});
    await Order.deleteMany({});
    await Review.deleteMany({});
    await Favorite.deleteMany({});
    await PromoCode.deleteMany({});
    console.log('✅ Cleared all existing data');

    // Create customer user
    const customer = await User.create({
      name: 'Udhaya Kumar Customer',
      email: 'customer@gmail.com',
      password: 'password123',
      phone: '8596234715',
      role: 'customer',
      address: {
        street: '1 New St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600 001'
      }
    });
    console.log('✅ Customer created');

    // Create restaurant owner
    const owner = await User.create({
      name: 'Taj Restaurant',
      email: 'owner@gmail.com',
      password: 'password123',
      phone: '9874586327',
      role: 'restaurant_owner',
      address: {
        street: '789 Gandhi St',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600 002'
      }
    });
    console.log('✅ Owner created');

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@gmail.com',
      password: 'password123',
      phone: '8597641253',
      role: 'admin'
    });
    console.log('✅ Admin created');

    // Create restaurants - ALL START WITH 0 REVIEWS AND 0 RATING
    const restaurant1 = await Restaurant.create({
      name: 'Pizza Palace',
      description: 'Best pizzas in town with authentic Italian taste',
      owner: owner._id,
      cuisine: ['Italian', 'Fast Food'],
      address: {
        street: '123 Main Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600 008'
      },
      contact: {
        phone: '+91 4758965142',
        email: 'info@pizzapalace.com'
      },
      deliveryTime: '30-40 mins',
      deliveryFee: 35,
      rating: 0,           // Start with 0 rating
      totalReviews: 0,     // Start with 0 reviews
      isActive: true
    });

    const restaurant2 = await Restaurant.create({
      name: 'DNS Fast Food',
      description: 'Good Food with Good Mood',
      owner: owner._id,
      cuisine: ['Indian', 'Fast Food'],
      address: {
        street: '456 Food Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600 004'
      },
      contact: {
        phone: '+91 8547976215',
        email: 'info@dnsfastfood.com'
      },
      deliveryTime: '25-35 mins',
      deliveryFee: 20,
      rating: 0,           // Start with 0 rating
      totalReviews: 0,     // Start with 0 reviews
      isActive: true
    });

    const restaurant3 = await Restaurant.create({
      name: 'Burger Kingdom',
      description: 'Premium burgers and sides made fresh daily',
      owner: owner._id,
      cuisine: ['American', 'Fast Food'],
      address: {
        street: '789 Food Avenue',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600 017'
      },
      contact: {
        phone: '+91 9876543210',
        email: 'info@burgerkingdom.com'
      },
      deliveryTime: '20-30 mins',
      deliveryFee: 25,
      rating: 0,           // Start with 0 rating
      totalReviews: 0,     // Start with 0 reviews
      isActive: true
    });

    const restaurant4 = await Restaurant.create({
      name: 'Spice Garden',
      description: 'Authentic South Indian cuisine with traditional recipes',
      owner: owner._id,
      cuisine: ['South Indian', 'Indian'],
      address: {
        street: '321 Temple Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zipCode: '600 012'
      },
      contact: {
        phone: '+91 8765432109',
        email: 'info@spicegarden.com'
      },
      deliveryTime: '35-45 mins',
      deliveryFee: 30,
      rating: 0,           // Start with 0 rating
      totalReviews: 0,     // Start with 0 reviews
      isActive: true
    });

    console.log('✅ Restaurants created');

    // Create menu items for Pizza Palace
    await MenuItem.create([
      {
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce, mozzarella, and fresh basil',
        restaurant: restaurant1._id,
        category: 'Main Course',
        price: 250,
        isVegetarian: true,
        spiceLevel: 'None',
        ingredients: ['Tomato', 'Mozzarella', 'Basil'],
        preparationTime: '15-20 mins',
        isAvailable: true
      },
      {
        name: 'Pepperoni Pizza',
        description: 'Loaded with pepperoni and mozzarella cheese',
        restaurant: restaurant1._id,
        category: 'Main Course',
        price: 350,
        isVegetarian: false,
        spiceLevel: 'Mild',
        ingredients: ['Pepperoni', 'Mozzarella', 'Tomato Sauce'],
        preparationTime: '15-20 mins',
        isAvailable: true
      },
      {
        name: 'Veggie Supreme Pizza',
        description: 'Loaded with fresh vegetables and extra cheese',
        restaurant: restaurant1._id,
        category: 'Main Course',
        price: 300,
        isVegetarian: true,
        spiceLevel: 'None',
        ingredients: ['Bell Peppers', 'Onions', 'Mushrooms', 'Olives', 'Mozzarella'],
        preparationTime: '18-22 mins',
        isAvailable: true
      },
      {
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with Caesar dressing and croutons',
        restaurant: restaurant1._id,
        category: 'Salads',
        price: 180,
        isVegetarian: true,
        spiceLevel: 'None',
        ingredients: ['Lettuce', 'Parmesan', 'Croutons', 'Caesar Dressing'],
        preparationTime: '8-10 mins',
        isAvailable: true
      },
      {
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter and herbs',
        restaurant: restaurant1._id,
        category: 'Snacks',
        price: 120,
        isVegetarian: true,
        spiceLevel: 'None',
        ingredients: ['Bread', 'Garlic', 'Butter', 'Herbs'],
        preparationTime: '10-12 mins',
        isAvailable: true
      }
    ]);

    // Create menu items for DNS Fast Food
    await MenuItem.create([
      {
        name: 'Chicken Rice',
        description: 'The rice is cooked in chicken broth, which gives it a rich aroma and taste',
        restaurant: restaurant2._id,
        category: 'Main Course',
        price: 130,
        isVegetarian: false,
        spiceLevel: 'Mild',
        ingredients: ['Chicken', 'Rice', 'Cabbage', 'Tomato', 'Onion'],
        preparationTime: '12-15 mins',
        isAvailable: true
      },
      {
        name: 'Chicken Noodles',
        description: 'Stir-fried noodles with tender chicken pieces and vegetables',
        restaurant: restaurant2._id,
        category: 'Main Course',
        price: 130,
        isVegetarian: false,
        spiceLevel: 'Medium',
        ingredients: ['Chicken', 'Noodles', 'Cabbage', 'Carrot', 'Onion'],
        preparationTime: '12-15 mins',
        isAvailable: true
      },
      {
        name: 'Veggie Rice',
        description: 'Healthy vegetable fried rice with fresh mixed vegetables',
        restaurant: restaurant2._id,
        category: 'Main Course',
        price: 100,
        isVegetarian: true,
        isVegan: true,
        spiceLevel: 'Mild',
        ingredients: ['Rice', 'Mixed Vegetables', 'Soy Sauce'],
        preparationTime: '10-12 mins',
        isAvailable: true
      },
      {
        name: 'Egg Rice',
        description: 'Fried rice with scrambled eggs and aromatic spices',
        restaurant: restaurant2._id,
        category: 'Main Course',
        price: 125,
        isVegetarian: false,
        spiceLevel: 'Mild',
        ingredients: ['Rice', 'Egg', 'Onion', 'Soy Sauce'],
        preparationTime: '10-12 mins',
        isAvailable: true
      },
      {
        name: 'Egg Noodles',
        description: 'Stir-fried noodles with scrambled eggs',
        restaurant: restaurant2._id,
        category: 'Main Course',
        price: 130,
        isVegetarian: false,
        spiceLevel: 'Mild',
        ingredients: ['Noodles', 'Egg', 'Vegetables'],
        preparationTime: '12-15 mins',
        isAvailable: true
      },
      {
        name: 'Chicken Fried Rice',
        description: 'Classic fried rice with chunks of chicken',
        restaurant: restaurant2._id,
        category: 'Main Course',
        price: 140,
        isVegetarian: false,
        spiceLevel: 'Medium',
        ingredients: ['Rice', 'Chicken', 'Egg', 'Vegetables'],
        preparationTime: '15-18 mins',
        isAvailable: true
      }
    ]);

    // Create menu items for Burger Kingdom
    await MenuItem.create([
      {
        name: 'Classic Beef Burger',
        description: 'Juicy beef patty with lettuce, tomato, and special sauce',
        restaurant: restaurant3._id,
        category: 'Main Course',
        price: 180,
        isVegetarian: false,
        spiceLevel: 'Mild',
        ingredients: ['Beef Patty', 'Lettuce', 'Tomato', 'Onion', 'Special Sauce'],
        preparationTime: '12-15 mins',
        isAvailable: true
      },
      {
        name: 'Chicken Burger',
        description: 'Crispy fried chicken with mayo and lettuce',
        restaurant: restaurant3._id,
        category: 'Main Course',
        price: 160,
        isVegetarian: false,
        spiceLevel: 'Mild',
        ingredients: ['Chicken', 'Lettuce', 'Mayo', 'Pickles'],
        preparationTime: '12-15 mins',
        isAvailable: true
      },
      {
        name: 'Veggie Burger',
        description: 'Plant-based patty with fresh vegetables',
        restaurant: restaurant3._id,
        category: 'Main Course',
        price: 150,
        isVegetarian: true,
        isVegan: true,
        spiceLevel: 'None',
        ingredients: ['Veggie Patty', 'Lettuce', 'Tomato', 'Onion'],
        preparationTime: '10-12 mins',
        isAvailable: true
      },
      {
        name: 'French Fries',
        description: 'Crispy golden fries with seasoning',
        restaurant: restaurant3._id,
        category: 'Snacks',
        price: 80,
        isVegetarian: true,
        spiceLevel: 'None',
        ingredients: ['Potato', 'Salt', 'Seasoning'],
        preparationTime: '8-10 mins',
        isAvailable: true
      },
      {
        name: 'Cheese Fries',
        description: 'Fries topped with melted cheese',
        restaurant: restaurant3._id,
        category: 'Snacks',
        price: 120,
        isVegetarian: true,
        spiceLevel: 'None',
        ingredients: ['Potato', 'Cheese', 'Seasoning'],
        preparationTime: '10-12 mins',
        isAvailable: true
      }
    ]);

    // Create menu items for Spice Garden
    await MenuItem.create([
      {
        name: 'Masala Dosa',
        description: 'Crispy rice crepe filled with spiced potato filling',
        restaurant: restaurant4._id,
        category: 'Main Course',
        price: 80,
        isVegetarian: true,
        spiceLevel: 'Medium',
        ingredients: ['Rice', 'Potato', 'Onion', 'Spices'],
        preparationTime: '15-18 mins',
        isAvailable: true
      },
      {
        name: 'Idli Sambar',
        description: 'Steamed rice cakes served with lentil soup',
        restaurant: restaurant4._id,
        category: 'Main Course',
        price: 60,
        isVegetarian: true,
        spiceLevel: 'Medium',
        ingredients: ['Rice', 'Urad Dal', 'Sambar', 'Chutney'],
        preparationTime: '10-12 mins',
        isAvailable: true
      },
      {
        name: 'Chicken Biryani',
        description: 'Aromatic rice dish with tender chicken pieces',
        restaurant: restaurant4._id,
        category: 'Special',
        price: 200,
        isVegetarian: false,
        spiceLevel: 'Hot',
        ingredients: ['Rice', 'Chicken', 'Spices', 'Yogurt'],
        preparationTime: '25-30 mins',
        isAvailable: true
      },
      {
        name: 'Veg Biryani',
        description: 'Fragrant rice with mixed vegetables and spices',
        restaurant: restaurant4._id,
        category: 'Special',
        price: 150,
        isVegetarian: true,
        spiceLevel: 'Medium',
        ingredients: ['Rice', 'Mixed Vegetables', 'Spices'],
        preparationTime: '20-25 mins',
        isAvailable: true
      },
      {
        name: 'Paneer Tikka',
        description: 'Grilled cottage cheese marinated in spices',
        restaurant: restaurant4._id,
        category: 'Appetizer',
        price: 180,
        isVegetarian: true,
        spiceLevel: 'Hot',
        ingredients: ['Paneer', 'Yogurt', 'Spices', 'Bell Peppers'],
        preparationTime: '15-18 mins',
        isAvailable: true
      },
      {
        name: 'Butter Chicken',
        description: 'Creamy tomato-based chicken curry',
        restaurant: restaurant4._id,
        category: 'Main Course',
        price: 220,
        isVegetarian: false,
        spiceLevel: 'Medium',
        ingredients: ['Chicken', 'Tomato', 'Cream', 'Butter', 'Spices'],
        preparationTime: '20-25 mins',
        isAvailable: true
      }
    ]);

    console.log('✅ Menu items created');
    console.log('\n🎉 Database seeded successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('📧 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════');
    console.log('👤 Customer:');
    console.log('   Email: customer@gmail.com');
    console.log('   Password: password123');
    console.log('');
    console.log('🏪 Restaurant Owner:');
    console.log('   Email: owner@gmail.com');
    console.log('   Password: password123');
    console.log('');
    console.log('👨‍💼 Admin:');
    console.log('   Email: admin@gmail.com');
    console.log('   Password: password123');
    console.log('═══════════════════════════════════════');
    console.log('\n📊 RESTAURANTS CREATED:');
    console.log('═══════════════════════════════════════');
    console.log('1. Pizza Palace - 0 reviews, 0 rating');
    console.log('2. DNS Fast Food - 0 reviews, 0 rating');
    console.log('3. Burger Kingdom - 0 reviews, 0 rating');
    console.log('4. Spice Garden - 0 reviews, 0 rating');
    console.log('═══════════════════════════════════════');
    console.log('\n💡 TIP: Complete orders and write reviews to see');
    console.log('   automatic rating calculations!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedData();