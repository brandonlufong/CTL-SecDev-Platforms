const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');

const updateAdminPermissions = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri);
    console.log('Connected to MongoDB');

    // Find all admin and super_admin users
    const adminUsers = await User.find({ 
      role: { $in: ['admin', 'super_admin'] }
    });
    
    if (adminUsers.length === 0) {
      console.log('No admin users found');
      await mongoose.connection.close();
      return;
    }

    console.log(`Found ${adminUsers.length} admin user(s)`);
    
    for (const admin of adminUsers) {
      console.log(`Updating permissions for: ${admin.email} (${admin.role})`);
      
      // Manually assign permissions
      await admin.addRolePermissions();
      
      console.log(`New permissions: ${admin.permissions.join(', ')}`);
    }

    console.log('=================================');
    console.log('ADMIN PERMISSIONS UPDATED SUCCESSFULLY!');
    console.log('=================================');

  } catch (error) {
    console.error('Error updating admin permissions:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the update function
updateAdminPermissions();
