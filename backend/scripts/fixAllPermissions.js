const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');

const fixAllPermissions = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.database.uri);
    console.log('Connected to MongoDB');

    // Find all users
    const allUsers = await User.find({});
    
    if (allUsers.length === 0) {
      console.log('No users found');
      await mongoose.connection.close();
      return;
    }

    console.log(`Found ${allUsers.length} user(s)`);
    
    // Group users by role
    const usersByRole = {
      super_admin: [],
      admin: [],
      security_analyst: [],
      auditor: [],
      user: []
    };

    allUsers.forEach(user => {
      if (usersByRole[user.role]) {
        usersByRole[user.role].push(user);
      }
    });

    console.log('\n=== Role Distribution ===');
    Object.keys(usersByRole).forEach(role => {
      console.log(`${role}: ${usersByRole[role].length} users`);
    });

    // Update permissions for all users
    for (const user of allUsers) {
      console.log(`\nUpdating permissions for: ${user.email} (${user.role})`);
      
      const oldPermissions = [...user.permissions];
      
      // Manually assign permissions based on role
      await user.addRolePermissions();
      
      console.log(`Old permissions: ${oldPermissions.join(', ') || 'none'}`);
      console.log(`New permissions: ${user.permissions.join(', ')}`);
      
      if (JSON.stringify(oldPermissions.sort()) !== JSON.stringify(user.permissions.sort())) {
        console.log('Permissions updated successfully!');
      } else {
        console.log('Permissions already correct');
      }
    }

    console.log('\n=================================');
    console.log('ALL USER PERMISSIONS UPDATED SUCCESSFULLY!');
    console.log('=================================');
    
    console.log('\n=== Final Permission Summary ===');
    Object.keys(usersByRole).forEach(role => {
      if (usersByRole[role].length > 0) {
        const sampleUser = usersByRole[role][0];
        console.log(`${role}: ${sampleUser.permissions.join(', ')}`);
      }
    });

    console.log('\n=== Expected Access by Role ===');
    console.log('super_admin: Full system access');
    console.log('admin: User management, assets, scans, vulnerabilities, system config');
    console.log('security_analyst: Scans, vulnerabilities, assets, system monitoring');
    console.log('auditor: Read-only access to scans, vulnerabilities, assets, system monitoring');
    console.log('user: Read-only access to scans, vulnerabilities, assets, dashboard');

  } catch (error) {
    console.error('Error fixing permissions:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the fix function
fixAllPermissions();
