const SystemLog = require('../models/SystemLog');

class Logger {
  constructor(service = 'application') {
    this.service = service;
    this.requestId = this.generateRequestId();
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async log(level, message, options = {}) {
    try {
      const logEntry = new SystemLog({
        level,
        service: this.service,
        message,
        user: options.user || 'system',
        ipAddress: options.ipAddress || null,
        severity: options.severity || this.getDefaultSeverity(level),
        details: options.details || {},
        stackTrace: options.stackTrace || null,
        requestId: options.requestId || this.requestId,
        duration: options.duration || null,
        statusCode: options.statusCode || null
      });

      await logEntry.save();
      console.log(`[${level.toUpperCase()}] ${this.service}: ${message}`);
    } catch (error) {
      console.error('Failed to save log entry:', error);
    }
  }

  getDefaultSeverity(level) {
    const severityMap = {
      error: 'high',
      warn: 'medium',
      info: 'low',
      debug: 'info'
    };
    return severityMap[level] || 'info';
  }

  // Convenience methods
  async error(message, options = {}) {
    return this.log('error', message, { ...options, severity: 'high' });
  }

  async warn(message, options = {}) {
    return this.log('warn', message, { ...options, severity: 'medium' });
  }

  async info(message, options = {}) {
    return this.log('info', message, options);
  }

  async debug(message, options = {}) {
    return this.log('debug', message, options);
  }

  async critical(message, options = {}) {
    return this.log('error', message, { ...options, severity: 'critical' });
  }
}

// Create service-specific loggers
const createLogger = (service) => new Logger(service);

// Default logger
const logger = new Logger();

module.exports = {
  Logger,
  createLogger,
  logger
};
