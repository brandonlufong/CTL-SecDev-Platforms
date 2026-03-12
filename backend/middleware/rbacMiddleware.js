const User = require('../models/User');

// Check if user has specific permission
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated' });
      }

      if (user.isLocked) {
        return res.status(423).json({ message: 'Account is locked' });
      }

      // Super admin has all permissions
      if (user.role === 'super_admin') {
        return next();
      }

      // Check if user has the required permission
      if (!user.permissions.includes(permission)) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permission,
          userRole: user.role,
          userPermissions: user.permissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

// Check if user has any of the specified permissions
const checkAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated' });
      }

      if (user.isLocked) {
        return res.status(423).json({ message: 'Account is locked' });
      }

      // Super admin has all permissions
      if (user.role === 'super_admin') {
        return next();
      }

      // Check if user has any of the required permissions
      const hasPermission = permissions.some(permission => 
        user.permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permissions,
          userRole: user.role,
          userPermissions: user.permissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

// Check if user has specific role or higher
const checkRole = (minimumRole) => {
  const roleHierarchy = {
    'user': 0,
    'auditor': 1,
    'security_analyst': 2,
    'admin': 3,
    'super_admin': 4
  };

  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated' });
      }

      if (user.isLocked) {
        return res.status(423).json({ message: 'Account is locked' });
      }

      const userRoleLevel = roleHierarchy[user.role] || 0;
      const requiredRoleLevel = roleHierarchy[minimumRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ 
          message: 'Insufficient role level',
          required: minimumRole,
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ message: 'Role check failed' });
    }
  };
};

// Check if user can access resource (owner or admin)
const checkResourceAccess = (resourceField = 'userId') => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated' });
      }

      if (user.isLocked) {
        return res.status(423).json({ message: 'Account is locked' });
      }

      // Super admin and admin can access all resources
      if (user.role === 'super_admin' || user.role === 'admin') {
        return next();
      }

      // Check if user is the owner of the resource
      const resourceId = req.params.id || req.body[resourceField] || req.query[resourceField];
      
      if (resourceId && resourceId.toString() === user._id.toString()) {
        return next();
      }

      return res.status(403).json({ 
        message: 'Access denied. You can only access your own resources.',
        required: 'owner or admin role'
      });
    } catch (error) {
      console.error('Resource access check error:', error);
      res.status(500).json({ message: 'Resource access check failed' });
    }
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkRole,
  checkResourceAccess
};
