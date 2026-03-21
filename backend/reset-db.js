const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function resetDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await mongoose.connection.dropDatabase();
  console.log('✅ Database dropped completely');

  await mongoose.connection.close();
  console.log('Done. Now run: node seed-data.js');
}

resetDB().catch(console.error);