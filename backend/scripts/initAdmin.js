const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config/config');

// Default admin user configuration
const defaultAdmin = {
  name: 'Super Administrator',
  email: 'admin@camtel.cm',
  password: 'Admin@123!',
  role: 'super_admin'
};

async function initializeAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: defaultAdmin.email });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Active:', existingAdmin.isActive);
      await mongoose.connection.close();
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
    
    // Create admin user
    const adminUser = new User({
      name: defaultAdmin.name,
      email: defaultAdmin.email,
      password: hashedPassword,
      role: defaultAdmin.role,
      isActive: true
    });

    // Add role-based permissions
    await adminUser.addRolePermissions();

    // Save the user
    await adminUser.save();

    console.log('✅ Super admin user created successfully!');
    console.log('   Email:', defaultAdmin.email);
    console.log('   Password:', defaultAdmin.password);
    console.log('   Role:', defaultAdmin.role);
    console.log('   Permissions:', adminUser.permissions.length, 'permissions assigned');
    console.log('');
    console.log('🔐 Please change the default password after first login!');
    console.log('🔐 Navigate to Profile > Settings to update your password.');

  } catch (error) {
    console.error('❌ Error initializing admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// Run the initialization
if (require.main === module) {
  console.log('🚀 Initializing CAMTEL Vulnerability Manager Admin User');
  console.log('================================================');
  initializeAdmin();
}

module.exports = { initializeAdmin };
