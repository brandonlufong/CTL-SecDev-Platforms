const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const SystemLog = require('../models/SystemLog');
const { logger } = require('../utils/logger');

// Log storage path
const logsPath = path.join(__dirname, '../data/logs');

// Ensure logs directory exists
const ensureLogsDir = async () => {
  try {
    await fs.access(logsPath);
  } catch {
    await fs.mkdir(logsPath, { recursive: true });
  }
};

// Generate mock logs for demonstration
const generateMockLogs = async (filters = {}) => {
  const { level = 'all', service = 'all', dateRange = '24h', search = '', severity = 'all', page = 1, limit = 50 } = filters;
  
  const levels = ['error', 'warn', 'info', 'debug'];
  const services = ['application', 'database', 'auth', 'api', 'scan', 'system', 'security', 'network'];
  const severities = ['critical', 'high', 'medium', 'low', 'info'];
  const users = ['admin', 'system', 'analyst1', 'auditor', 'user1'];
  const messages = [
    'User authentication successful',
    'Database connection established',
    'Scan completed successfully',
    'API request processed',
    'System backup completed',
    'Security scan initiated',
    'Network configuration updated',
    'User session expired',
    'Failed login attempt detected',
    'Vulnerability scan completed',
    'System health check passed',
    'Configuration updated',
    'Service restarted',
    'Cache cleared',
    'Memory usage warning',
    'Disk space low',
    'Network latency detected',
    'Authentication failed',
    'Permission denied',
    'System error occurred'
  ];

  const logs = [];
  const now = new Date();
  let startTime;

  // Calculate start time based on date range
  switch (dateRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  // Generate logs
  const totalLogs = 1000; // Mock total logs
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalLogs);

  for (let i = startIndex; i < endIndex; i++) {
    const logLevel = levels[Math.floor(Math.random() * levels.length)];
    const logService = services[Math.floor(Math.random() * services.length)];
    const logSeverity = severities[Math.floor(Math.random() * severities.length)];
    const logUser = users[Math.floor(Math.random() * users.length)];
    const logMessage = messages[Math.floor(Math.random() * messages.length)];
    const logTimestamp = new Date(startTime.getTime() + Math.random() * (now - startTime));
    
    // Apply filters
    if (level !== 'all' && logLevel !== level) continue;
    if (service !== 'all' && logService !== service) continue;
    if (severity !== 'all' && logSeverity !== severity) continue;
    if (search && !logMessage.toLowerCase().includes(search.toLowerCase())) continue;

    logs.push({
      _id: `log_${i}`,
      timestamp: logTimestamp.toISOString(),
      level: logLevel,
      service: logService,
      message: logMessage,
      user: logUser,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      severity: logSeverity,
      details: {
        requestId: `req_${Math.random().toString(36).substr(2, 9)}`,
        duration: Math.floor(Math.random() * 1000),
        statusCode: Math.floor(Math.random() * 500) + 100
      },
      stackTrace: logLevel === 'error' ? `Error: ${logMessage}\n    at Function.process (internal/process.js:12:16)\n    at Object.<anonymous> (/app/index.js:45:5)` : null
    });
  }

  return { logs, total: logs.length };
};

// Get logs
exports.getLogs = async (req, res) => {
  try {
    const filters = {
      level: req.query.level || 'all',
      service: req.query.service || 'all',
      dateRange: req.query.dateRange || '24h',
      search: req.query.search || '',
      severity: req.query.severity || 'all',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // Build query
    const query = {};
    
    // Apply filters
    if (filters.level !== 'all') {
      query.level = filters.level;
    }
    
    if (filters.service !== 'all') {
      query.service = filters.service;
    }
    
    if (filters.severity !== 'all') {
      query.severity = filters.severity;
    }
    
    // Date range filtering
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startTime;
      
      switch (filters.dateRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = null;
      }
      
      if (startTime) {
        query.timestamp = { $gte: startTime };
      }
    }
    
    // Search filtering
    if (filters.search) {
      query.$or = [
        { message: { $regex: filters.search, $options: 'i' } },
        { user: { $regex: filters.search, $options: 'i' } },
        { 'details.requestId': { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await SystemLog.countDocuments(query);
    
    // Get logs with pagination
    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean();

    res.json({
      logs,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit)
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ message: 'Failed to get logs', error: error.message });
  }
};

// Get log statistics
exports.getLogStats = async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get overall statistics
    const [
      totalLogs,
      errorLogs,
      warningLogs,
      infoLogs,
      debugLogs
    ] = await Promise.all([
      SystemLog.countDocuments(),
      SystemLog.countDocuments({ level: 'error' }),
      SystemLog.countDocuments({ level: 'warn' }),
      SystemLog.countDocuments({ level: 'info' }),
      SystemLog.countDocuments({ level: 'debug' })
    ]);

    // Get logs by service
    const logsByService = await SystemLog.aggregate([
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const serviceStats = {};
    logsByService.forEach(item => {
      serviceStats[item._id] = item.count;
    });

    // Get logs by level
    const logsByLevel = await SystemLog.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const levelStats = {};
    logsByLevel.forEach(item => {
      levelStats[item._id] = item.count;
    });

    // Get hourly stats for last 12 hours
    const logsByHour = [];
    for (let i = 11; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - (i - 1) * 60 * 60 * 1000);
      
      const hour = hourStart.getHours().toString().padStart(2, '0') + ':00';
      const count = await SystemLog.countDocuments({
        timestamp: { $gte: hourStart, $lt: hourEnd }
      });
      
      logsByHour.push({ hour, count });
    }

    // Get recent errors
    const recentErrors = await SystemLog.find({
      level: 'error',
      timestamp: { $gte: last24Hours }
    })
    .sort({ timestamp: -1 })
    .limit(5)
    .select('timestamp message service')
    .lean();

    const stats = {
      totalLogs,
      errorLogs,
      warningLogs,
      infoLogs,
      debugLogs,
      logsByService: serviceStats,
      logsByLevel: levelStats,
      logsByHour,
      recentErrors
    };

    res.json(stats);
  } catch (error) {
    console.error('Get log stats error:', error);
    res.status(500).json({ message: 'Failed to get log statistics', error: error.message });
  }
};

// Clear logs
exports.clearLogs = async (req, res) => {
  try {
    const { level } = req.params;

    let deleteQuery = {};
    
    if (level === 'all') {
      // Delete all logs older than 30 days to keep recent data
      deleteQuery = {
        timestamp: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      };
    } else {
      // Delete logs of specific level older than 7 days
      deleteQuery = {
        level: level,
        timestamp: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      };
    }

    const result = await SystemLog.deleteMany(deleteQuery);
    
    console.log(`Cleared ${result.deletedCount} ${level} logs`);

    res.json({ 
      message: `${level} logs cleared successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear logs error:', error);
    res.status(500).json({ message: 'Failed to clear logs', error: error.message });
  }
};

// Export logs
exports.exportLogs = async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const filters = req.query;

    // Build query similar to getLogs
    const query = {};
    
    if (filters.level && filters.level !== 'all') {
      query.level = filters.level;
    }
    
    if (filters.service && filters.service !== 'all') {
      query.service = filters.service;
    }
    
    if (filters.severity && filters.severity !== 'all') {
      query.severity = filters.severity;
    }
    
    // Date range filtering
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      let startTime;
      
      switch (filters.dateRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = null;
      }
      
      if (startTime) {
        query.timestamp = { $gte: startTime };
      }
    }
    
    // Search filtering
    if (filters.search) {
      query.$or = [
        { message: { $regex: filters.search, $options: 'i' } },
        { user: { $regex: filters.search, $options: 'i' } },
        { 'details.requestId': { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Get logs (limit to 10000 for export)
    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .limit(10000)
      .lean();

    let content;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        const headers = 'Timestamp,Level,Service,Message,User,IP Address,Severity,Request ID\n';
        const csvData = logs.map(log => 
          `"${log.timestamp}","${log.level}","${log.service}","${log.message}","${log.user}","${log.ipAddress || ''}","${log.severity}","${log.requestId || ''}"`
        ).join('\n');
        content = headers + csvData;
        contentType = 'text/csv';
        filename = `logs_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'txt':
        content = logs.map(log => 
          `[${log.timestamp}] ${log.level.toUpperCase()} ${log.service}: ${log.message} (User: ${log.user}, IP: ${log.ipAddress || 'N/A'}, ID: ${log.requestId || 'N/A'})`
        ).join('\n');
        contentType = 'text/plain';
        filename = `logs_${new Date().toISOString().split('T')[0]}.txt`;
        break;

      case 'json':
      default:
        content = JSON.stringify(logs, null, 2);
        contentType = 'application/json';
        filename = `logs_${new Date().toISOString().split('T')[0]}.json`;
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('Export logs error:', error);
    res.status(500).json({ message: 'Failed to export logs', error: error.message });
  }
};

// Archive logs
exports.archiveLogs = async (req, res) => {
  try {
    await ensureLogsDir();

    // In a real implementation, you would archive actual log files
    // For now, we'll simulate archiving logs
    const archivePath = path.join(logsPath, `archive_${new Date().toISOString().split('T')[0]}.tar.gz`);
    
    console.log(`Archiving logs to: ${archivePath}`);

    // Create a mock archive file
    await fs.writeFile(archivePath, JSON.stringify({ archived: true, timestamp: new Date().toISOString() }));

    res.json({ 
      message: 'Logs archived successfully',
      archivePath,
      archivedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Archive logs error:', error);
    res.status(500).json({ message: 'Failed to archive logs', error: error.message });
  }
};

// Get service-specific logs
exports.getServiceLogs = async (req, res) => {
  try {
    const { service } = req.params;
    const filters = {
      ...req.query,
      service: service
    };

    const { logs, total } = await generateMockLogs(filters);

    res.json({
      logs,
      total,
      service,
      page: parseInt(filters.page) || 1,
      limit: parseInt(filters.limit) || 50
    });
  } catch (error) {
    console.error('Get service logs error:', error);
    res.status(500).json({ message: 'Failed to get service logs', error: error.message });
  }
};

// Get log details
exports.getLogDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // In a real implementation, you would fetch the specific log from database
    // For now, we'll return a mock log
    const mockLog = {
      _id: id,
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'application',
      message: 'Database connection failed',
      user: 'system',
      ipAddress: '192.168.1.100',
      severity: 'high',
      details: {
        requestId: 'req_123456789',
        duration: 5000,
        statusCode: 500,
        database: 'mongodb',
        host: 'localhost',
        port: 27017
      },
      stackTrace: `Error: Database connection failed
    at MongoDB.connect (/app/services/database.js:45:10)
    at Object.process (/app/controllers/userController.js:23:15)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:137:13)
    at Route.dispatch (/app/node_modules/express/lib/router/route.js:112:3)`,
      relatedLogs: [
        { _id: 'log_1', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'warn', message: 'Database connection slow' },
        { _id: 'log_2', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'info', message: 'Attempting database reconnection' }
      ]
    };

    res.json(mockLog);
  } catch (error) {
    console.error('Get log details error:', error);
    res.status(500).json({ message: 'Failed to get log details', error: error.message });
  }
};

// Search logs
exports.searchLogs = async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchFilters = {
      ...filters,
      search: query
    };

    const { logs, total } = await generateMockLogs(searchFilters);

    res.json({
      logs,
      total,
      query,
      page: parseInt(filters.page) || 1,
      limit: parseInt(filters.limit) || 50
    });
  } catch (error) {
    console.error('Search logs error:', error);
    res.status(500).json({ message: 'Failed to search logs', error: error.message });
  }
};

// Get log analytics
exports.getLogAnalytics = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;

    // In a real implementation, you would query actual analytics data
    const analytics = {
      timeRange,
      logTrends: [
        { timestamp: new Date(Date.now() - 86400000).toISOString(), count: 1234, errors: 23, warnings: 45 },
        { timestamp: new Date(Date.now() - 82800000).toISOString(), count: 1456, errors: 34, warnings: 56 },
        { timestamp: new Date(Date.now() - 79200000).toISOString(), count: 1678, errors: 45, warnings: 67 },
        { timestamp: new Date(Date.now() - 75600000).toISOString(), count: 1234, errors: 23, warnings: 45 },
        { timestamp: new Date(Date.now() - 72000000).toISOString(), count: 1890, errors: 56, warnings: 78 }
      ],
      topErrors: [
        { message: 'Database connection timeout', count: 45, service: 'database' },
        { message: 'API rate limit exceeded', count: 34, service: 'api' },
        { message: 'Authentication failed', count: 23, service: 'auth' }
      ],
      serviceMetrics: {
        application: { total: 3421, errors: 45, avgResponseTime: 234 },
        database: { total: 2156, errors: 67, avgResponseTime: 456 },
        auth: { total: 1876, errors: 23, avgResponseTime: 123 },
        api: { total: 2987, errors: 34, avgResponseTime: 345 },
        scan: { total: 1654, errors: 12, avgResponseTime: 567 }
      },
      severityDistribution: {
        critical: 12,
        high: 45,
        medium: 123,
        low: 456,
        info: 789
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get log analytics error:', error);
    res.status(500).json({ message: 'Failed to get log analytics', error: error.message });
  }
};

// Get real-time logs
exports.getRealTimeLogs = async (req, res) => {
  try {
    // Set up Server-Sent Events for real-time log streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Connected to log stream"}\n\n');

    // In a real implementation, you would subscribe to log events and send them as they occur
    // For now, we'll send mock logs periodically
    const interval = setInterval(async () => {
      const { logs } = await generateMockLogs({ limit: 1 });
      
      if (logs.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'log', data: logs[0] })}\n\n`);
      }
    }, 5000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
  } catch (error) {
    console.error('Get real-time logs error:', error);
    res.status(500).json({ message: 'Failed to get real-time logs', error: error.message });
  }
};
