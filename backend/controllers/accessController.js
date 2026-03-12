const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Access policies file path
const policiesPath = path.join(__dirname, '../data/accessPolicies.json');

// Default access policies
const defaultPolicies = {
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuse: 5,
    maxAge: 90,
    lockoutThreshold: 5,
    lockoutDuration: 15
  },
  sessionPolicy: {
    maxDuration: 8,
    idleTimeout: 30,
    concurrentSessions: 3,
    requireReauth: false,
    ipWhitelist: [],
    ipBlacklist: []
  },
  accessPolicy: {
    twoFactorRequired: false,
    allowedIps: [],
    blockedIps: [],
    workingHoursOnly: false,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    emergencyAccess: false
  }
};

// Ensure policies directory exists
const ensurePoliciesDir = async () => {
  const policiesDir = path.dirname(policiesPath);
  try {
    await fs.access(policiesDir);
  } catch {
    await fs.mkdir(policiesDir, { recursive: true });
  }
};

// Load access policies
const loadPolicies = async () => {
  try {
    await ensurePoliciesDir();
    const data = await fs.readFile(policiesPath, 'utf8');
    return { ...defaultPolicies, ...JSON.parse(data) };
  } catch (error) {
    // If file doesn't exist or is invalid, return default policies
    await savePolicies(defaultPolicies);
    return defaultPolicies;
  }
};

// Save access policies
const savePolicies = async (policies) => {
  try {
    await ensurePoliciesDir();
    await fs.writeFile(policiesPath, JSON.stringify(policies, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save policies:', error);
    return false;
  }
};

// Get access policies
exports.getAccessPolicies = async (req, res) => {
  try {
    const policies = await loadPolicies();
    res.json(policies);
  } catch (error) {
    console.error('Get access policies error:', error);
    res.status(500).json({ message: 'Failed to load access policies', error: error.message });
  }
};

// Update access policies
exports.updateAccessPolicies = async (req, res) => {
  try {
    const { category } = req.params;
    const policyData = req.body;

    if (!category || !policyData) {
      return res.status(400).json({ message: 'Category and policy data are required' });
    }

    const currentPolicies = await loadPolicies();
    
    // Update specific category
    currentPolicies[category] = { ...currentPolicies[category], ...policyData };
    
    const saved = await savePolicies(currentPolicies);
    
    if (saved) {
      res.json({ message: `${category} policies updated successfully`, policies: currentPolicies[category] });
    } else {
      res.status(500).json({ message: 'Failed to save policies' });
    }
  } catch (error) {
    console.error('Update access policies error:', error);
    res.status(500).json({ message: 'Failed to update access policies', error: error.message });
  }
};

// Get users with roles
exports.getUsersWithRoles = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .populate('role', 'name permissions')
      .lean();

    const userRoles = {};
    users.forEach(user => {
      userRoles[user._id] = user.role || 'user';
    });

    res.json({ 
      users: users.map(user => ({
        ...user,
        role: user.role || 'user'
      })),
      userRoles 
    });
  } catch (error) {
    console.error('Get users with roles error:', error);
    res.status(500).json({ message: 'Failed to load users', error: error.message });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role, $push: { permissions: { $each: User.schema.paths.role.enumValues[0].rolePermissions[role] || [] } } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the role change
    await logAuditEvent({
      user: req.user.username,
      action: 'update',
      resource: 'user_role',
      resourceId: id,
      details: `Changed user role to ${role}`,
      ipAddress: req.ip,
      success: true
    });

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role', error: error.message });
  }
};

// Get audit logs
exports.getAuditLogs = async (req, res) => {
  try {
    const { action, user, dateRange, severity } = req.query;
    
    // Build query filters
    const filters = {};
    if (action && action !== 'all') filters.action = action;
    if (user && user !== 'all') filters.user = user;
    if (severity && severity !== 'all') filters.severity = severity;
    
    // Date range filtering
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case '1day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filters.timestamp = { $gte: startDate };
      }
    }

    // Query real audit logs from database
    const logs = await AuditLog.find(filters)
      .sort({ timestamp: -1 })
      .limit(1000) // Limit to last 1000 logs for performance
      .lean();

    res.json({ logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs', error: error.message });
  }
};

// Log audit event
const logAuditEvent = async (eventData) => {
  try {
    // In a real implementation, you would save to a proper audit log collection
    console.log('Audit Event:', eventData);
    
    // For now, we'll just log to console
    // In production, you would save to database with schema like:
    // await AuditLog.create(eventData);
  } catch (error) {
    console.error('Log audit event error:', error);
  }
};

// Validate password against policy
exports.validatePassword = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const policies = await loadPolicies();
    const passwordPolicy = policies.passwordPolicy;
    
    const validationResults = {
      isValid: true,
      errors: []
    };

    // Check minimum length
    if (password.length < passwordPolicy.minLength) {
      validationResults.isValid = false;
      validationResults.errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
    }

    // Check uppercase requirement
    if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      validationResults.isValid = false;
      validationResults.errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      validationResults.isValid = false;
      validationResults.errors.push('Password must contain at least one lowercase letter');
    }

    // Check numbers requirement
    if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
      validationResults.isValid = false;
      validationResults.errors.push('Password must contain at least one number');
    }

    // Check special characters requirement
    if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      validationResults.isValid = false;
      validationResults.errors.push('Password must contain at least one special character');
    }

    res.json(validationResults);
  } catch (error) {
    console.error('Validate password error:', error);
    res.status(500).json({ message: 'Failed to validate password', error: error.message });
  }
};

// Check access permissions
exports.checkAccess = async (req, res) => {
  try {
    const { resource, action } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get user permissions
    const userPermissions = user.permissions || [];
    const requiredPermission = `${resource}:${action}`;

    const hasPermission = userPermissions.includes(requiredPermission) || 
                         userPermissions.includes(`${resource}:*`) ||
                         user.role === 'super_admin';

    // Log access check
    await logAuditEvent({
      user: user.username,
      action: 'access',
      resource: resource,
      resourceId: null,
      details: `Access check for ${requiredPermission}: ${hasPermission ? 'granted' : 'denied'}`,
      ipAddress: req.ip,
      success: hasPermission
    });

    res.json({ 
      hasPermission,
      requiredPermission,
      userPermissions
    });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ message: 'Failed to check access', error: error.message });
  }
};

// Get user permissions
exports.getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('permissions role');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      permissions: user.permissions || [],
      role: user.role || 'user'
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Failed to get user permissions', error: error.message });
  }
};

// Update user permissions
exports.updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permissions must be an array' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { permissions },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the permission change
    await logAuditEvent({
      user: req.user.username,
      action: 'update',
      resource: 'user_permissions',
      resourceId: id,
      details: `Updated user permissions: ${permissions.join(', ')}`,
      ipAddress: req.ip,
      success: true
    });

    res.json({ message: 'User permissions updated successfully', user });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ message: 'Failed to update user permissions', error: error.message });
  }
};

// Lock/unlock user account
exports.toggleUserLock = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'lock' or 'unlock'

    if (!['lock', 'unlock'].includes(action)) {
      return res.status(400).json({ message: 'Action must be lock or unlock' });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (action === 'lock') {
      user.isLocked = true;
      user.lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // Lock for 24 hours
    } else {
      user.isLocked = false;
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }

    await user.save();

    // Log the lock/unlock action
    await logAuditEvent({
      user: req.user.username,
      action: action,
      resource: 'user_account',
      resourceId: id,
      details: `${action === 'lock' ? 'Locked' : 'Unlocked'} user account`,
      ipAddress: req.ip,
      success: true
    });

    res.json({ message: `User account ${action}ed successfully`, user });
  } catch (error) {
    console.error('Toggle user lock error:', error);
    res.status(500).json({ message: `Failed to ${action} user account`, error: error.message });
  }
};

// Get access statistics
exports.getAccessStatistics = async (req, res) => {
  try {
    // In a real implementation, you would query actual statistics
    const stats = {
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ isActive: true }),
      lockedUsers: await User.countDocuments({ isLocked: true }),
      usersByRole: {},
      recentLogins: 0,
      failedLogins: 0,
      accessByTime: {
        '00-06': 0,
        '06-12': 0,
        '12-18': 0,
        '18-24': 0
      }
    };

    // Get users by role
    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    roleStats.forEach(stat => {
      stats.usersByRole[stat._id || 'user'] = stat.count;
    });

    res.json(stats);
  } catch (error) {
    console.error('Get access statistics error:', error);
    res.status(500).json({ message: 'Failed to get access statistics', error: error.message });
  }
};
