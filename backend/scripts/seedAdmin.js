const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config/config');

const seedAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@camtel.cm' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      await mongoose.connection.close();
      return;
    }

    // Create admin user
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@123!', salt);

    const admin = new User({
      email: 'admin@camtel.cm',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      isActive: true,
      permissions: [
        'user:create',
        'user:read', 
        'user:update',
        'user:delete',
        'asset:create',
        'asset:read',
        'asset:edit',
        'asset:delete',
        'system:config',
        'system:monitor',
        'system:backup',
        'vulnerability:create',
        'vulnerability:read',
        'vulnerability:update',
        'vulnerability:delete',
        'scan:create',
        'scan:read',
        'scan:update',
        'scan:delete'
      ]
    });

    await admin.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@camtel.cm');
    console.log('Password: Admin@123!');
    console.log('Role: admin');

  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the seed function
seedAdmin();
