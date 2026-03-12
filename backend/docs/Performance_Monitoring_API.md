# Network Performance Monitoring API Documentation

## Overview

The Network Performance Monitoring module provides real-time monitoring of network assets with comprehensive metric collection, historical data storage, and live dashboard updates via WebSocket connections.

## Features

- **Real-time Monitoring**: Ping latency, packet loss, response time tracking
- **Event-driven Architecture**: No polling, uses intelligent scheduling
- **WebSocket Integration**: Live dashboard updates
- **Historical Storage**: MongoDB with TTL for efficient data management
- **Performance Analytics**: Trends, uptime statistics, alerts
- **Export Functionality**: JSON and CSV data export

## Architecture

### Event-Driven Model
- **Asset Checks**: Every 30 seconds (configurable)
- **Buffer Flush**: Every 5 seconds for batch database insertion
- **WebSocket Updates**: Real-time metric broadcasting
- **Health Checks**: Every 5 minutes
- **Data Cleanup**: Daily at 2 AM UTC

### Performance Metrics
- **Ping Latency**: ICMP ping response time in milliseconds
- **Packet Loss**: Percentage of lost packets over 10 samples
- **Response Time**: HTTP/TCP connection time in milliseconds
- **Uptime Percentage**: Calculated availability over 24-hour periods
- **Status Classification**: excellent, good, fair, poor, critical, offline

## Data Schema

### PerformanceMetric Schema

```javascript
{
  asset: ObjectId,           // Reference to Asset
  assetName: String,        // Asset name for quick lookup
  assetIP: String,          // Asset IP address
  metricType: String,       // 'ping', 'packet_loss', 'response_time', 'uptime'
  value: Number,           // Metric value
  unit: String,            // 'ms', '%', 'Mbps', 'bytes', 'packets'
  status: String,          // 'excellent', 'good', 'fair', 'poor', 'critical', 'offline'
  timestamp: Date,         // Measurement timestamp
  duration: Number,        // Measurement duration in ms
  samples: Number,         // Number of samples taken
  metadata: {
    min: Number,           // Minimum value
    max: Number,           // Maximum value
    avg: Number,           // Average value
    stddev: Number,        // Standard deviation
    packetsSent: Number,   // Packets sent (for ping/packet loss)
    packetsReceived: Number, // Packets received
    errors: [String],      // Error messages
    measurementMethod: String, // 'icmp', 'tcp', 'http', 'https'
    targetPort: Number,    // Target port for TCP/HTTP
    timeout: Number        // Timeout in ms
  },
  alerts: {
    thresholdExceeded: Boolean,
    alertLevel: String,    // 'info', 'warning', 'critical'
    alertMessage: String
  }
}
```

## REST API Endpoints

### Monitoring Control

#### Get Monitoring Status
```http
GET /api/performance/status
Authorization: Bearer <token>
```

**Response**:
```json
{
  "isRunning": true,
  "monitoredAssets": 15,
  "assetStatuses": [
    {
      "assetId": "507f1f77bcf86cd799439011",
      "assetName": "Web Server 01",
      "assetIP": "192.168.1.100",
      "isOnline": true,
      "lastRun": "2024-01-15T10:30:00.000Z",
      "runCount": 245,
      "consecutiveFailures": 0
    }
  ],
  "bufferSize": 12,
  "lastFlush": "2024-01-15T10:29:55.000Z"
}
```

#### Start Monitoring
```http
POST /api/performance/start
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "Performance monitoring started successfully"
}
```

#### Stop Monitoring
```http
POST /api/performance/stop
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "Performance monitoring stopped successfully"
}
```

### Performance Overview

#### Get Performance Overview
```http
GET /api/performance/overview
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "asset": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Web Server 01",
      "ip": "192.168.1.100",
      "type": "Server",
      "status": "Online"
    },
    "latestMetrics": [
      {
        "metricType": "ping",
        "value": 45.2,
        "unit": "ms",
        "status": "excellent",
        "timestamp": "2024-01-15T10:30:00.000Z"
      }
    ],
    "uptime": {
      "uptime": 86400,
      "downtime": 0,
      "availability": "100.00",
      "timeRange": "24h"
    },
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
]
```

#### Get Performance Statistics
```http
GET /api/performance/stats?timeRange=24h
Authorization: Bearer <token>
```

**Response**:
```json
{
  "assets": {
    "total": 25,
    "online": 23,
    "offline": 2,
    "onlinePercentage": "92.00"
  },
  "metrics": {
    "ping": {
      "count": 3450,
      "avg": 67.8,
      "min": 12.3,
      "max": 234.5,
      "statusDistribution": {
        "excellent": 1200,
        "good": 1800,
        "fair": 350,
        "poor": 80,
        "critical": 20
      }
    }
  },
  "monitoring": {
    "isRunning": true,
    "monitoredAssets": 23
  },
  "timeRange": "24h"
}
```

### Asset-Specific Metrics

#### Get Latest Metrics for Asset
```http
GET /api/performance/assets/:assetId/latest
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "asset": "507f1f77bcf86cd799439011",
    "metricType": "ping",
    "value": 45.2,
    "unit": "ms",
    "status": "excellent",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "min": 42.1,
      "max": 48.9,
      "avg": 45.2,
      "packetsSent": 4,
      "packetsReceived": 4
    }
  }
]
```

#### Get Metrics by Time Range
```http
GET /api/performance/assets/:assetId/metrics/:metricType?startTime=2024-01-14T10:00:00.000Z&endTime=2024-01-15T10:00:00.000Z
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "metricType": "ping",
    "value": 45.2,
    "unit": "ms",
    "status": "excellent",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": { ... }
  }
]
```

#### Get Aggregated Metrics
```http
GET /api/performance/assets/:assetId/aggregated/:metricType?interval=5m&limit=100
Authorization: Bearer <token>
```

**Parameters**:
- `interval`: `1m`, `5m`, `15m`, `1h`, `6h`, `1d`
- `limit`: Number of data points (default: 100)

**Response**:
```json
[
  {
    "_id": "2024-01-15T10:25:00.000Z",
    "avg": 45.6,
    "min": 42.1,
    "max": 48.9,
    "count": 6,
    "timestamp": "2024-01-15T10:25:00.000Z",
    "status": "excellent"
  }
]
```

#### Get Uptime Statistics
```http
GET /api/performance/assets/:assetId/uptime?timeRange=24h
Authorization: Bearer <token>
```

**Parameters**: `timeRange`: `1h`, `6h`, `24h`, `7d`, `30d`

**Response**:
```json
{
  "uptime": 85500,
  "downtime": 900,
  "availability": "98.96",
  "timeRange": "24h"
}
```

#### Get Performance Trends
```http
GET /api/performance/assets/:assetId/trends/:metricType?period=7d&interval=1h
Authorization: Bearer <token>
```

**Response**:
```json
{
  "trends": [
    {
      "_id": "2024-01-15T10:00:00.000Z",
      "avg": 45.6,
      "min": 42.1,
      "max": 48.9,
      "count": 6,
      "timestamp": "2024-01-15T10:00:00.000Z"
    }
  ],
  "analysis": {
    "trend": "stable",
    "recentAverage": 45.2,
    "olderAverage": 45.8,
    "changePercent": "-1.31"
  }
}
```

### Alerts and Export

#### Get Performance Alerts
```http
GET /api/performance/alerts?severity=critical&limit=50
Authorization: Bearer <token>
```

**Parameters**:
- `severity`: `all`, `info`, `warning`, `critical`
- `limit`: Number of alerts (default: 50)

**Response**:
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "asset": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Web Server 01",
      "ip": "192.168.1.100",
      "type": "Server"
    },
    "metricType": "ping",
    "value": 567.8,
    "status": "critical",
    "alerts": {
      "thresholdExceeded": true,
      "alertLevel": "critical",
      "alertMessage": "Ping latency exceeds critical threshold"
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
]
```

#### Export Performance Data
```http
GET /api/performance/assets/:assetId/export?metricType=ping&format=csv&timeRange=24h
Authorization: Bearer <token>
```

**Parameters**:
- `metricType`: Metric type to export
- `format`: `json` or `csv`
- `timeRange`: `1h`, `6h`, `24h`, `7d`, `30d`

**Response** (CSV):
```
Timestamp,Value,Unit,Status,Min,Max,Avg,Samples
2024-01-15T10:30:00.000Z,45.2,ms,excellent,42.1,48.9,45.2,4
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:5000/ws/performance?token=<jwt_token>');
```

### Message Types

#### Subscribe to Asset Metrics
```json
{
  "type": "subscribe",
  "data": {
    "assetIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
  }
}
```

#### Unsubscribe from Asset Metrics
```json
{
  "type": "unsubscribe",
  "data": {
    "assetIds": ["507f1f77bcf86cd799439011"]
  }
}
```

#### Request Specific Metrics
```json
{
  "type": "get_metrics",
  "data": {
    "assetId": "507f1f77bcf86cd799439011",
    "metricType": "ping",
    "timeRange": "1h",
    "interval": "5m"
  }
}
```

#### Ping/Pong for Connection Health
```json
{
  "type": "ping"
}
```

### Real-time Events

#### Metrics Update
```json
{
  "type": "metrics:realtime",
  "data": {
    "assetId": "507f1f77bcf86cd799439011",
    "assetName": "Web Server 01",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metrics": {
      "ping": {
        "metricType": "ping",
        "value": 45.2,
        "unit": "ms",
        "status": "excellent"
      },
      "packet_loss": {
        "metricType": "packet_loss",
        "value": 0,
        "unit": "%",
        "status": "excellent"
      }
    }
  }
}
```

#### Asset Status Change
```json
{
  "type": "asset:status:changed",
  "data": {
    "assetId": "507f1f77bcf86cd799439011",
    "assetName": "Web Server 01",
    "oldStatus": "Online",
    "newStatus": "Offline",
    "error": "Connection timeout",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Monitoring Status Update
```json
{
  "type": "monitoring:status",
  "data": {
    "isRunning": true,
    "monitoredAssets": 15,
    "assetStatuses": [...]
  }
}
```

## Usage Examples

### JavaScript/Node.js

```javascript
// REST API - Get performance overview
const response = await fetch('/api/performance/overview', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const overview = await response.json();

// WebSocket - Real-time monitoring
const ws = new WebSocket('ws://localhost:5000/ws/performance?token=' + token);

ws.onopen = () => {
  // Subscribe to specific assets
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: { assetIds: ['asset1', 'asset2'] }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'metrics:realtime':
      console.log('Real-time metrics:', message.data);
      break;
    case 'asset:status:changed':
      console.log('Status changed:', message.data);
      break;
  }
};
```

### Python

```python
import requests
import websocket
import json

# REST API
headers = {'Authorization': 'Bearer ' + token}
response = requests.get('/api/performance/stats', headers=headers)
stats = response.json()

# WebSocket
def on_message(ws, message):
    data = json.loads(message)
    if data['type'] == 'metrics:realtime':
        print(f"Metrics update: {data['data']}")

def on_open(ws):
    ws.send(json.dumps({
        'type': 'subscribe',
        'data': {'assetIds': ['asset1', 'asset2']}
    }))

ws = websocket.WebSocketApp(
    'ws://localhost:5000/ws/performance?token=' + token,
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()
```

### cURL

```bash
# Get monitoring status
curl -X GET "/api/performance/status" \
  -H "Authorization: Bearer <token>"

# Get asset metrics
curl -X GET "/api/performance/assets/507f1f77bcf86cd799439011/latest" \
  -H "Authorization: Bearer <token>"

# Export data as CSV
curl -X GET "/api/performance/assets/507f1f77bcf86cd799439011/export?metricType=ping&format=csv&timeRange=24h" \
  -H "Authorization: Bearer <token>" \
  -o performance_data.csv
```

## Performance Considerations

### Monitoring Intervals
- **Asset Checks**: 30 seconds (configurable)
- **Buffer Flush**: 5 seconds
- **WebSocket Updates**: Immediate
- **Health Checks**: 5 minutes
- **Data Retention**: 30 days (TTL)

### Database Optimization
- **TTL Indexes**: Automatic cleanup of old data
- **Compound Indexes**: Optimized for time-series queries
- **Batch Insertion**: Efficient metric storage
- **Aggregation Pipelines**: Fast statistical queries

### Memory Management
- **Metric Buffering**: Batch database operations
- **WebSocket Connection Limits**: Prevent resource exhaustion
- **Event-driven Processing**: No polling overhead
- **Graceful Degradation**: Error handling without service interruption

## Error Handling

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid/missing token)
- `404`: Not Found (asset not found)
- `500`: Internal Server Error

### WebSocket Error Handling
- **Connection Drops**: Automatic reconnection support
- **Invalid Messages**: Error responses with details
- **Rate Limiting**: Message queue for high-frequency updates
- **Heartbeat**: Ping/Pong for connection health

### Monitoring Errors
- **Network Failures**: Graceful degradation, mark as offline
- **Database Errors**: Buffer metrics, retry insertion
- **Service Errors**: Continue monitoring other assets
- **Resource Limits**: Automatic scaling and cleanup

## Troubleshooting

### Common Issues

**Assets not being monitored**
- Check asset status (must be 'Online')
- Verify monitoring service is running
- Review server logs for errors

**WebSocket connection issues**
- Verify JWT token is valid
- Check WebSocket endpoint path
- Ensure server supports WebSocket connections

**Missing metrics data**
- Check database connection
- Verify TTL indexes haven't expired
- Review metric collection logs

**Performance degradation**
- Monitor buffer sizes
- Check database query performance
- Review WebSocket connection count

### Debug Commands

```javascript
// Check monitoring status
const performanceService = require('./services/performanceService');
console.log(performanceService.getMonitoringStatus());

// Check WebSocket stats
const websocketService = require('./services/websocketService');
console.log(websocketService.getStats());

// Force metric collection
await performanceService.runAssetCheck('assetId');
```

## Integration Guide

### Server Integration

```javascript
// Add to your main server file
const { initializePerformanceMonitoring } = require('./initPerformanceMonitoring');

// Initialize after server creation
const server = http.createServer(app);
initializePerformanceMonitoring(server);

// Add performance routes
app.use('/api/performance', require('./routes/performanceRoutes'));
```

### Frontend Integration

```javascript
// Performance monitoring service
class PerformanceMonitor {
  constructor(token) {
    this.ws = new WebSocket(`ws://localhost:5000/ws/performance?token=${token}`);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }

  subscribe(assetIds) {
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      data: { assetIds }
    }));
  }

  handleMessage(message) {
    switch (message.type) {
      case 'metrics:realtime':
        this.updateDashboard(message.data);
        break;
      case 'asset:status:changed':
        this.updateAssetStatus(message.data);
        break;
    }
  }

  updateDashboard(data) {
    // Update your dashboard UI
    console.log('New metrics:', data);
  }
}

// Usage
const monitor = new PerformanceMonitor(token);
monitor.subscribe(['asset1', 'asset2']);
```

## Security Considerations

### Authentication
- All REST endpoints require JWT authentication
- WebSocket connections require valid JWT token
- Token validation on connection and message handling

### Data Protection
- Metric data stored securely in MongoDB
- WebSocket connections use secure tokens
- Rate limiting prevents abuse

### Access Control
- Role-based access can be implemented
- Asset-level permissions support
- Audit logging for monitoring operations

## Monitoring and Maintenance

### Health Monitoring
- Automatic health checks every 5 minutes
- WebSocket connection status monitoring
- Database connection health verification

### Data Management
- Automatic cleanup of old data (30-day retention)
- Daily performance reports
- Metrics aggregation for long-term storage

### Alerts and Notifications
- Threshold-based alerting
- Real-time status change notifications
- Performance degradation warnings

## License and Compliance

- **Open Source**: MIT License
- **Data Privacy**: No external data transmission
- **Performance**: Optimized for enterprise use
- **Scalability**: Designed for large-scale deployments
