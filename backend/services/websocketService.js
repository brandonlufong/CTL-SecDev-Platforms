const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const performanceService = require('./performanceService');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // clientId -> client info
    this.subscriptions = new Map(); // clientId -> Set of assetIds
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxConnections: 100,
      messageQueue: new Map(), // clientId -> message queue
      queueFlushInterval: 1000 // 1 second
    };
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    if (this.isInitialized) {
      console.log('⚠️ WebSocket service already initialized');
      return;
    }

    try {
      this.wss = new WebSocket.Server({
        server,
        path: '/ws/performance',
        maxPayload: 1024 * 1024, // 1MB max payload
        verifyClient: this.verifyClient.bind(this)
      });

      this.setupEventHandlers();
      this.startHeartbeat();
      this.startMessageQueueFlush();
      
      this.isInitialized = true;
      console.log('✅ WebSocket service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Verify client connection
   */
  verifyClient(info) {
    try {
      const { req } = info;
      const token = this.extractToken(req);
      
      if (!token) {
        console.log('❌ WebSocket connection rejected: No token provided');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      
      console.log(`✅ WebSocket connection verified for user: ${decoded.username}`);
      return true;
      
    } catch (error) {
      console.log('❌ WebSocket connection rejected: Invalid token');
      return false;
    }
  }

  /**
   * Extract JWT token from request
   */
  extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Also check query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    // Subscribe to performance service events
    performanceService.on('asset:metrics:updated', this.handleMetricsUpdate.bind(this));
    performanceService.on('asset:status:changed', this.handleStatusChange.bind(this));
    performanceService.on('monitoring:started', this.handleMonitoringStarted.bind(this));
    performanceService.on('monitoring:stopped', this.handleMonitoringStopped.bind(this));
    performanceService.on('monitoring:error', this.handleMonitoringError.bind(this));
    
    console.log('📡 WebSocket event handlers configured');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const user = req.user;
    
    console.log(`🔗 New WebSocket connection: ${clientId} (${user.username})`);
    
    // Store client info
    this.clients.set(clientId, {
      ws,
      user,
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true,
      subscriptions: new Set()
    });
    
    this.subscriptions.set(clientId, new Set());
    
    // Setup client event handlers
    ws.on('message', (message) => this.handleMessage(clientId, message));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));
    
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection:established',
      data: {
        clientId,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        timestamp: new Date(),
        serverTime: new Date()
      }
    });
    
    // Send current monitoring status
    const monitoringStatus = performanceService.getMonitoringStatus();
    this.sendToClient(clientId, {
      type: 'monitoring:status',
      data: monitoringStatus
    });
  }

  /**
   * Handle WebSocket message
   */
  handleMessage(clientId, message) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const parsedMessage = JSON.parse(message);
      const { type, data } = parsedMessage;
      
      console.log(`📨 Message from ${clientId}: ${type}`);
      
      switch (type) {
        case 'subscribe':
          this.handleSubscription(clientId, data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data);
          break;
          
        case 'get_metrics':
          this.handleGetMetrics(clientId, data);
          break;
          
        case 'get_monitoring_status':
          this.handleGetMonitoringStatus(clientId);
          break;
          
        case 'ping':
          this.handlePing(clientId);
          break;
          
        default:
          console.warn(`⚠️ Unknown message type: ${type}`);
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: `Unknown message type: ${type}` }
          });
      }
      
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle asset subscription
   */
  async handleSubscription(clientId, data) {
    const { assetIds } = data;
    
    if (!Array.isArray(assetIds)) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'assetIds must be an array' }
      });
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    // Add subscriptions
    const subscriptions = this.subscriptions.get(clientId);
    assetIds.forEach(assetId => subscriptions.add(assetId));
    
    console.log(`📝 Client ${clientId} subscribed to ${assetIds.length} assets`);
    
    this.sendToClient(clientId, {
      type: 'subscription:confirmed',
      data: {
        subscribedAssets: Array.from(subscriptions),
        timestamp: new Date()
      }
    });
    
    // Send latest metrics for subscribed assets
    for (const assetId of assetIds) {
      const latestMetrics = await performanceService.getLatestMetrics(assetId);
      this.sendToClient(clientId, {
        type: 'metrics:latest',
        data: {
          assetId,
          metrics: latestMetrics
        }
      });
    }
  }

  /**
   * Handle asset unsubscription
   */
  handleUnsubscription(clientId, data) {
    const { assetIds } = data;
    
    if (!Array.isArray(assetIds)) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'assetIds must be an array' }
      });
      return;
    }

    const subscriptions = this.subscriptions.get(clientId);
    if (!subscriptions) return;

    // Remove subscriptions
    assetIds.forEach(assetId => subscriptions.delete(assetId));
    
    console.log(`📝 Client ${clientId} unsubscribed from ${assetIds.length} assets`);
    
    this.sendToClient(clientId, {
      type: 'unsubscription:confirmed',
      data: {
        unsubscribedAssets: assetIds,
        remainingSubscriptions: Array.from(subscriptions),
        timestamp: new Date()
      }
    });
  }

  /**
   * Handle get metrics request
   */
  async handleGetMetrics(clientId, data) {
    const { assetId, metricType, timeRange, interval } = data;
    
    try {
      let metrics;
      
      if (timeRange) {
        const { startTime, endTime } = this.parseTimeRange(timeRange);
        metrics = await performanceService.getMetricsByTimeRange(assetId, metricType, startTime, endTime);
      } else if (interval) {
        metrics = await performanceService.getAggregatedMetrics(assetId, metricType, interval);
      } else {
        metrics = await performanceService.getLatestMetrics(assetId);
      }
      
      this.sendToClient(clientId, {
        type: 'metrics:data',
        data: {
          assetId,
          metricType,
          timeRange,
          interval,
          metrics,
          timestamp: new Date()
        }
      });
      
    } catch (error) {
      console.error(`❌ Error getting metrics for client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Failed to get metrics' }
      });
    }
  }

  /**
   * Handle get monitoring status request
   */
  handleGetMonitoringStatus(clientId) {
    const status = performanceService.getMonitoringStatus();
    
    this.sendToClient(clientId, {
      type: 'monitoring:status',
      data: status
    });
  }

  /**
   * Handle ping request
   */
  handlePing(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
    }
    
    this.sendToClient(clientId, {
      type: 'pong',
      data: { timestamp: new Date() }
    });
  }

  /**
   * Handle metrics update from performance service
   */
  handleMetricsUpdate(data) {
    const { assetId, assetName, timestamp, metrics } = data;
    
    // Send to all subscribed clients
    this.broadcastToSubscribers(assetId, {
      type: 'metrics:realtime',
      data: {
        assetId,
        assetName,
        timestamp,
        metrics
      }
    });
  }

  /**
   * Handle status change from performance service
   */
  handleStatusChange(data) {
    const { assetId, assetName, oldStatus, newStatus, error } = data;
    
    // Send to all subscribed clients
    this.broadcastToSubscribers(assetId, {
      type: 'asset:status:changed',
      data: {
        assetId,
        assetName,
        oldStatus,
        newStatus,
        error,
        timestamp: new Date()
      }
    });
  }

  /**
   * Handle monitoring started event
   */
  handleMonitoringStarted(data) {
    this.broadcast({
      type: 'monitoring:started',
      data
    });
  }

  /**
   * Handle monitoring stopped event
   */
  handleMonitoringStopped(data) {
    this.broadcast({
      type: 'monitoring:stopped',
      data
    });
  }

  /**
   * Handle monitoring error event
   */
  handleMonitoringError(data) {
    this.broadcast({
      type: 'monitoring:error',
      data
    });
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message) {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Broadcast message to clients subscribed to specific asset
   */
  broadcastToSubscribers(assetId, message) {
    for (const [clientId, subscriptions] of this.subscriptions) {
      if (subscriptions.has(assetId)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      client.ws.send(messageString);
    } catch (error) {
      console.error(`❌ Error sending message to client ${clientId}:`, error);
    }
  }

  /**
   * Queue message for client (handles rate limiting)
   */
  queueMessage(clientId, message) {
    if (!this.config.messageQueue.has(clientId)) {
      this.config.messageQueue.set(clientId, []);
    }
    
    const queue = this.config.messageQueue.get(clientId);
    queue.push(message);
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  /**
   * Start message queue flush interval
   */
  startMessageQueueFlush() {
    setInterval(() => {
      for (const [clientId, queue] of this.config.messageQueue) {
        if (queue.length > 0) {
          const message = queue.shift();
          this.sendToClient(clientId, message);
        }
      }
    }, this.config.queueFlushInterval);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`🔌 Client disconnected: ${clientId} (${client.user.username})`);
    }
    
    this.clients.delete(clientId);
    this.subscriptions.delete(clientId);
    this.config.messageQueue.delete(clientId);
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    console.error(`❌ Client error for ${clientId}:`, error);
    this.handleDisconnection(clientId);
  }

  /**
   * Handle server error
   */
  handleServerError(error) {
    console.error('❌ WebSocket server error:', error);
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle pong response
   */
  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
      client.isAlive = true;
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse time range string
   */
  parseTimeRange(timeRange) {
    const now = new Date();
    let startTime;
    
    switch (timeRange) {
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
        startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
    }
    
    return {
      startTime,
      endTime: now
    };
  }

  /**
   * Get WebSocket service statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      connectedClients: this.clients.size,
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((total, subs) => total + subs.size, 0),
      messageQueueSize: Array.from(this.config.messageQueue.values())
        .reduce((total, queue) => total + queue.length, 0),
      uptime: this.isInitialized ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Close all connections
   */
  close() {
    if (this.wss) {
      this.wss.close();
      console.log('🔌 WebSocket service closed');
    }
  }
}

// Singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;
