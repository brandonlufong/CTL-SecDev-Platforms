const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config/config');

const seedAdminProduction = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@camtel.cm' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email: admin@camtel.cm');
      console.log('Role: admin');
      await mongoose.connection.close();
      return;
    }

    // Create admin user with production-ready settings
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@123!', salt);

    const admin = new User({
      name: 'System Administrator',
      email: 'admin@camtel.cm',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
      lastLogin: new Date(),
      permissions: [] // Will be auto-assigned based on role
    });

    await admin.save();
    console.log('=================================');
    console.log('ADMIN USER CREATED SUCCESSFULLY!');
    console.log('=================================');
    console.log('Email: admin@camtel.cm');
    console.log('Password: Admin@123!');
    console.log('Role: admin');
    console.log('Status: Active');
    console.log('Email Verified: Yes');
    console.log('=================================');
    console.log('IMPORTANT: Change the default password after first login!');
    console.log('=================================');

  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the seed function
seedAdminProduction();
