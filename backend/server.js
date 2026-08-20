// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const connectDB = require('./config/db');

// dotenv.config();
// connectDB();

// const app = express();
// app.use(cors());
// app.use(express.json());

// const authRoutes = require('./routes/authRoutes');
// const assetRoutes = require('./routes/assetRoutes');
// const scanRoutes = require('./routes/scanRoutes');
// const deviceRoutes = require('./routes/deviceRoutes');
// const vulnerabilityRoutes = require('./routes/vulnerabilityRoutes');
// const dashboardRoutes = require('./routes/dashboardRoutes');
// const configRoutes = require('./routes/configRoutes');

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/vulnerabilities', require('./routes/vulnerabilityRoutes'));
// app.use('/api/assets', require('./routes/assetRoutes'));
// app.use('/api/dashboard', require('./routes/dashboardRoutes'));
// app.use('/api/scan', require('./routes/scanRoutes'));
// app.use('/api/devices', require('./routes/deviceRoutes'));

// const http = require('http').createServer(app);
// const { Server } = require('socket.io');
// const progressTracker = require('./services/scanProgress');

// const io = new Server(http, {
//   cors: {
//     origin: '*', // Adjust this to your frontend origin in production
//     methods: ['GET', 'POST'],
//   },
// });

// app.set('io', io);
// progressTracker.init(io);

// io.on('connection', (socket) => {
//   console.log(`Socket connected: ${socket.id}`);

//   socket.on('disconnect', () => {
//     console.log(`Socket disconnected: ${socket.id}`);
//   });
// });

// const PORT = process.env.PORT || 5000;
// http.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// backend/server.js or backend/index.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/config');
const progressTracker = require('./services/scanProgress');
const assetMonitoringService = require('./services/assetMonitoringService');
const { initSocket } = require('./utils/socket');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with dynamic CORS from config
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: config.cors.credentials
  }
});

// Initialize socket utility
initSocket(io);

// Initialize progress tracker with Socket.IO instance
progressTracker.init(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current progress state to newly connected clients
  const currentProgress = progressTracker.getProgress();
  socket.emit('scanProgress', currentProgress);

  // Handle client requests for current scan status
  socket.on('getScanStatus', () => {
    const progress = progressTracker.getProgress();
    socket.emit('scanProgress', progress);
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Middleware
app.use(cors(config.cors));
// 50mb accommodates uploaded scan files (Nessus/OpenVAS XML, base64 PDFs) and backup restores.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Make io accessible to routes (if needed)
app.set('io', io);

// Database connection
mongoose
  .connect(config.database.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Your routes
const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const assetInventoryRoutes = require('./routes/assetInventoryRoutes');
const unifiedAssetInventoryRoutes = require('./routes/unifiedAssetInventoryRoutes');
const scanRoutes = require('./routes/scanRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const vulnerabilityRoutes = require('./routes/vulnerabilityRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const configRoutes = require('./routes/configRoutes');
const adminRoutes = require('./routes/adminRoutes');
const accessRoutes = require('./routes/accessRoutes');
const logsRoutes = require('./routes/logsRoutes');
const assetDiscoveryRoutes = require('./routes/discovery');
const schedulerRoutes = require('./routes/schedulerRoutes');
const securityRoutes = require('./routes/securityRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const systemRoutes = require('./routes/systemRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const importRoutes = require('./routes/importRoutes');
const scanScheduler = require('./services/scanScheduler');

// Mount routes
app.use('/api/config', configRoutes); // Config route MUST be first and public
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/inventory', unifiedAssetInventoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/vulnerabilities', vulnerabilityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/discovery', assetDiscoveryRoutes);
app.use('/api/schedules', schedulerRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/import', importRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    uptime: process.uptime(),
    message: 'Server is running smoothly'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!', 
    error: config.server.nodeEnv === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  });
});

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

server.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${config.server.nodeEnv}`);
  console.log(`🔌 WebSocket: ws://${HOST}:${PORT}`);
  console.log(`🌐 CORS Origin: ${config.cors.origin}`);
  console.log('=================================');
  
  // Start asset monitoring service
  console.log('🔍 Starting Asset Monitoring Service...');
  assetMonitoringService.start(5); // Check every 5 minutes
  console.log('✅ Asset Monitoring Service started');

  // Start recurring-scan scheduler (Workstream D)
  console.log('🕒 Starting Scan Scheduler...');
  scanScheduler.start(60);
  console.log('✅ Scan Scheduler started');

  // Start background CVE enrichment sweep (Workstream B)
  console.log('🧠 Starting CVE Enrichment sweep...');
  require('./services/enrichmentQueue').startPeriodicSweep(720);
  console.log('✅ CVE Enrichment sweep started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };