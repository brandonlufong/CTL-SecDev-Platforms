const { createLogger } = require('../utils/logger');

// Create service-specific loggers
const appLogger = createLogger('application');
const dbLogger = createLogger('database');
const apiLogger = createLogger('api');
const systemLogger = createLogger('system');

// System logging middleware
const systemLogging = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Log API requests
  if (req.path.startsWith('/api/')) {
    const service = getServiceFromPath(req.path);
    const logger = getLoggerForService(service);
    
    logger.info('API request processed', {
      user: req.user?.email || 'anonymous',
      ipAddress: req.ip || req.connection.remoteAddress,
      details: {
        method: req.method,
        endpoint: req.path,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      }
    });
  }
  
  // Override response methods to log completion
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const service = getServiceFromPath(req.path);
    const logger = getLoggerForService(service);
    
    if (res.statusCode >= 400) {
      logger.error('API request failed', {
        user: req.user?.email || 'anonymous',
        details: {
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          duration,
          error: data
        }
      });
    } else {
      logger.info('API request completed', {
        user: req.user?.email || 'anonymous',
        details: {
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          duration
        }
      });
    }
    
    originalSend.call(this, data);
  };
  
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const service = getServiceFromPath(req.path);
    const logger = getLoggerForService(service);
    
    if (res.statusCode >= 400) {
      logger.error('API request failed', {
        user: req.user?.email || 'anonymous',
        details: {
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          duration,
          error: data
        }
      });
    } else {
      logger.info('API request completed', {
        user: req.user?.email || 'anonymous',
        details: {
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          duration
        }
      });
    }
    
    originalJson.call(this, data);
  };
  
  next();
};

// Helper functions
function getServiceFromPath(path) {
  if (path.includes('/auth/')) return 'auth';
  if (path.includes('/users/') || path.includes('/admin/')) return 'api';
  if (path.includes('/scan/')) return 'scan';
  if (path.includes('/logs/')) return 'system';
  if (path.includes('/access/')) return 'security';
  return 'application';
}

function getLoggerForService(service) {
  switch (service) {
    case 'auth': return require('../utils/logger').createLogger('auth');
    case 'api': return require('../utils/logger').createLogger('api');
    case 'scan': return require('../utils/logger').createLogger('scan');
    case 'system': return require('../utils/logger').createLogger('system');
    case 'security': return require('../utils/logger').createLogger('security');
    default: return require('../utils/logger').createLogger('application');
  }
}

// Log system events
const logSystemEvent = async (event, details = {}) => {
  await systemLogger.info(event, {
    user: 'system',
    details
  });
};

// Log database events
const logDatabaseEvent = async (event, details = {}) => {
  await dbLogger.info(event, {
    user: 'system',
    details
  });
};

module.exports = {
  systemLogging,
  logSystemEvent,
  logDatabaseEvent
};
