const AuditLog = require('../models/AuditLog');

// Audit logging middleware
const auditLogger = (action, resource, severity = 'low') => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to capture response
    res.json = function(data) {
      // Log the action after response is sent
      setImmediate(async () => {
        try {
          if (req.user && req.user.id) {
            const auditLog = new AuditLog({
              user: req.user.username || req.user.email || 'unknown',
              userId: req.user.id,
              action,
              resource,
              resourceId: req.params.id || req.body.id || null,
              ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
              userAgent: req.get('User-Agent') || null,
              success: res.statusCode < 400,
              severity,
              details: generateAuditDetails(action, resource, req, res, data),
              metadata: {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                requestBody: sanitizeRequestBody(req.body),
                queryParams: req.query
              }
            });
            
            await auditLog.save();
            console.log(`Audit log created: ${action} on ${resource} by ${req.user.username}`);
          }
        } catch (error) {
          console.error('Failed to create audit log:', error);
        }
      });
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Generate audit log details
const generateAuditDetails = (action, resource, req, res, responseData) => {
  const success = res.statusCode < 400;
  
  switch (action) {
    case 'login':
      return success ? 'User logged in successfully' : 'Login attempt failed';
    case 'logout':
      return 'User logged out';
    case 'create':
      return success ? `Created ${resource}` : `Failed to create ${resource}`;
    case 'update':
      return success ? `Updated ${resource}` : `Failed to update ${resource}`;
    case 'delete':
      return success ? `Deleted ${resource}` : `Failed to delete ${resource}`;
    case 'role_create':
      return success ? 'Created new role' : 'Failed to create role';
    case 'role_update':
      return success ? 'Updated role permissions' : 'Failed to update role';
    case 'role_delete':
      return success ? 'Deleted role' : 'Failed to delete role';
    case 'user_lock':
      return success ? 'User account locked' : 'Failed to lock user account';
    case 'user_unlock':
      return success ? 'User account unlocked' : 'Failed to unlock user account';
    case 'password_reset':
      return success ? 'Password reset successfully' : 'Failed to reset password';
    case 'policy_update':
      return success ? 'Access policies updated' : 'Failed to update access policies';
    case 'scan_start':
      return 'Security scan started';
    case 'scan_complete':
      return 'Security scan completed';
    default:
      return success ? `${action} operation completed` : `${action} operation failed`;
  }
};

// Sanitize request body for logging (remove sensitive data)
const sanitizeRequestBody = (body) => {
  if (!body) return null;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword', 'token'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Manual audit logging function for special cases
const logAuditEvent = async (auditData) => {
  try {
    const auditLog = new AuditLog({
      ...auditData,
      timestamp: new Date()
    });
    
    await auditLog.save();
    console.log(`Manual audit log created: ${auditData.action} on ${auditData.resource}`);
  } catch (error) {
    console.error('Failed to create manual audit log:', error);
  }
};

module.exports = {
  auditLogger,
  logAuditEvent
};
