require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }

    // Create default admin
    await Admin.create({
      username: 'admin',
      password: 'admin123', // Will be hashed automatically
      role: 'admin'
    });

    console.log('Admin created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedAdmin();
