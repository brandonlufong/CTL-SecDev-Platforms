const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { logAuditEvent } = require('../middleware/auditMiddleware');

// Get all users with pagination and filtering
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = '',
      isActive = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by active status
    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, permissions = [] } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        message: 'Missing required fields: name, email, password, role' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      permissions,
      createdBy: req.user.id
    });

    // Add role-based permissions
    await user.addRolePermissions();

    // Save user
    await user.save();

    // Populate creator info
    await user.populate('createdBy', 'name email');

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, permissions, isActive } = req.body;
    const userId = req.params.id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-deactivation
    if (userId === req.user.id && isActive === false) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    // Prevent self-role change to lower role
    if (userId === req.user.id && role) {
      const roleHierarchy = {
        'user': 0,
        'auditor': 1,
        'security_analyst': 2,
        'admin': 3,
        'super_admin': 4
      };
      
      const currentUser = await User.findById(req.user.id);
      const currentRoleLevel = roleHierarchy[currentUser.role] || 0;
      const newRoleLevel = roleHierarchy[role] || 0;
      
      if (newRoleLevel < currentRoleLevel) {
        return res.status(400).json({ message: 'You cannot downgrade your own role' });
      }
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    user.updatedBy = req.user.id;

    // If role changed, update permissions
    if (role && role !== user.role) {
      await user.addRolePermissions();
    }

    await user.save();

    // Populate updater info
    await user.populate('updatedBy', 'name email');

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
};

// Reset user password
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.updatedBy = req.user.id;

    await user.save();

    res.json({ 
      message: 'Password reset successfully',
      tempPassword: newPassword 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

// Toggle user active status
exports.toggleUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deactivation
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot change your own active status' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    user.updatedBy = req.user.id;

    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ message: 'Failed to toggle user status', error: error.message });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          inactiveUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
          }
        }
      }
    ]);

    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const recentUsers = await User.find()
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      overview: stats[0] || { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 },
      roleDistribution: roleStats,
      recentUsers
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Failed to fetch user statistics', error: error.message });
  }
};

const fs = require('fs').promises;
const path = require('path');

// Role permissions file path
const rolePermissionsPath = path.join(__dirname, '../data/rolePermissions.json');

// Default role permissions
const defaultRolePermissions = {
  'super_admin': [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'scan:create', 'scan:read', 'scan:update', 'scan:delete',
    'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
    'asset:create', 'asset:read', 'asset:update', 'asset:delete',
    'dashboard:read',
    'system:config', 'system:monitor', 'system:backup'
  ],
  'admin': [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'scan:create', 'scan:read', 'scan:update', 'scan:delete',
    'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
    'asset:create', 'asset:read', 'asset:update', 'asset:delete',
    'dashboard:read',
    'system:config', 'system:monitor', 'system:backup'
  ],
  'security_analyst': [
    'scan:create', 'scan:read', 'scan:update', 'scan:delete',
    'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
    'asset:create', 'asset:read', 'asset:update', 'asset:delete',
    'dashboard:read',
    'system:monitor'
  ],
  'auditor': [
    'user:read', 'scan:read', 'vulnerability:read', 'asset:read',
    'dashboard:read', 'system:monitor'
  ],
  'user': [
    'dashboard:read'
  ]
};

// Ensure role permissions directory exists
const ensureRolePermissionsDir = async () => {
  const rolePermissionsDir = path.dirname(rolePermissionsPath);
  try {
    await fs.access(rolePermissionsDir);
  } catch {
    await fs.mkdir(rolePermissionsDir, { recursive: true });
  }
};

// Load role permissions from file
const loadRolePermissions = async () => {
  try {
    await ensureRolePermissionsDir();
    const data = await fs.readFile(rolePermissionsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, create it with default permissions
    await ensureRolePermissionsDir();
    await fs.writeFile(rolePermissionsPath, JSON.stringify(defaultRolePermissions, null, 2));
    return defaultRolePermissions;
  }
};

// Save role permissions to file
const saveRolePermissions = async (rolePermissions) => {
  try {
    await ensureRolePermissionsDir();
    await fs.writeFile(rolePermissionsPath, JSON.stringify(rolePermissions, null, 2));
    return true;
  } catch (error) {
    console.error('Save role permissions error:', error);
    return false;
  }
};

// Get available roles and permissions
exports.getRolesAndPermissions = async (req, res) => {
  try {
    // Default roles
    const defaultRoles = ['super_admin', 'admin', 'security_analyst', 'auditor', 'user'];
    const permissions = [
      'user:create', 'user:read', 'user:update', 'user:delete',
      'scan:create', 'scan:read', 'scan:update', 'scan:delete',
      'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
      'asset:create', 'asset:read', 'asset:update', 'asset:delete',
      'dashboard:read',
      'system:config', 'system:monitor', 'system:backup'
    ];

    // Load role permissions from file
    const rolePermissions = await loadRolePermissions();
    
    // Combine default roles with custom roles from file
    const customRoles = Object.keys(rolePermissions).filter(role => !defaultRoles.includes(role));
    const roles = [...defaultRoles, ...customRoles];

    res.json({ roles, permissions, rolePermissions });
  } catch (error) {
    console.error('Get roles and permissions error:', error);
    res.status(500).json({ message: 'Failed to fetch roles and permissions', error: error.message });
  }
};

// Create new role
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    // Load current role permissions
    const rolePermissions = await loadRolePermissions();
    
    // Check if role already exists
    if (rolePermissions[name]) {
      return res.status(400).json({ message: 'Role already exists' });
    }
    
    // Add new role
    rolePermissions[name] = permissions;
    
    // Save to file
    const saved = await saveRolePermissions(rolePermissions);
    
    if (!saved) {
      return res.status(500).json({ message: 'Failed to save role permissions' });
    }
    
    console.log('Role created successfully:', { name, description, permissions });
    
    // Log role creation
    await logAuditEvent({
      user: req.user.username || req.user.email,
      userId: req.user.id,
      action: 'role_create',
      resource: 'role',
      resourceId: name,
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
      userAgent: req.get('User-Agent'),
      success: true,
      severity: 'medium',
      details: `Created new role: ${name} with ${permissions.length} permissions`
    });
    
    res.status(201).json({ 
      message: 'Role created successfully',
      role: { name, description, permissions }
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: 'Failed to create role', error: error.message });
  }
};

// Update role permissions
exports.updateRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    const { permissions } = req.body;
    
    // Load current role permissions
    const rolePermissions = await loadRolePermissions();
    
    // Update the specific role's permissions
    rolePermissions[roleName] = permissions;
    
    // Save to file
    const saved = await saveRolePermissions(rolePermissions);
    
    if (!saved) {
      return res.status(500).json({ message: 'Failed to save role permissions' });
    }
    
    console.log('Updated role:', roleName, 'with permissions:', permissions);
    
    res.json({ 
      message: 'Role updated successfully',
      role: { name: roleName, permissions }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Failed to update role', error: error.message });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    
    // Prevent deletion of default roles
    const defaultRoles = ['super_admin', 'admin', 'security_analyst', 'auditor', 'user'];
    if (defaultRoles.includes(roleName)) {
      return res.status(400).json({ message: 'Cannot delete default system roles' });
    }
    
    // Load current role permissions
    const rolePermissions = await loadRolePermissions();
    
    // Check if role exists
    if (!rolePermissions[roleName]) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    // Delete role from object
    delete rolePermissions[roleName];
    
    // Save to file
    const saved = await saveRolePermissions(rolePermissions);
    
    if (!saved) {
      return res.status(500).json({ message: 'Failed to save role permissions' });
    }
    
    console.log('Role deleted successfully:', roleName);
    
    // Log role deletion
    await logAuditEvent({
      user: req.user.username || req.user.email,
      userId: req.user.id,
      action: 'role_delete',
      resource: 'role',
      resourceId: roleName,
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
      userAgent: req.get('User-Agent'),
      success: true,
      severity: 'high',
      details: `Deleted role: ${roleName}`
    });
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Failed to delete role', error: error.message });
  }
};
