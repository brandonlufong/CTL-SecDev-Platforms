const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const scanRoutes = require('./routes/scanRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const vulnerabilityRoutes = require('./routes/vulnerabilityRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const configRoutes = require('./routes/configRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vulnerabilities', require('./routes/vulnerabilityRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/scan', require('./routes/scanRoutes'));
app.use('/api/devices', require('./routes/deviceRoutes'));

const http = require('http').createServer(app);
const { Server } = require('socket.io');
const progressTracker = require('./services/scanProgress');

const io = new Server(http, {
  cors: {
    origin: '*', // Adjust this to your frontend origin in production
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
progressTracker.init(io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Respond with current scan status when requested
  socket.on('getScanStatus', () => {
    try {
      const current = progressTracker.getProgress();
      socket.emit('scanProgress', current);
    } catch (err) {
      console.error('Error handling getScanStatus:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5002;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// backend/server.js or backend/index.js

// require('dotenv').config();
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const config = require('./config/config');
// const progressTracker = require('./services/scanProgress');

// const app = express();
// const server = http.createServer(app);

// // Configure Socket.IO with dynamic CORS from config
// const io = new Server(server, {
//   cors: {
//     origin: config.cors.origin,
//     methods: ['GET', 'POST'],
//     credentials: config.cors.credentials
//   }
// });

// // Initialize progress tracker with Socket.IO instance
// progressTracker.init(io);

// // Socket.IO connection handling
// io.on('connection', (socket) => {
//   console.log('Client connected:', socket.id);

//   // Send current progress state to newly connected clients
//   const currentProgress = progressTracker.getProgress();
//   socket.emit('scanProgress', currentProgress);

//   // Handle client requests for current scan status
//   socket.on('getScanStatus', () => {
//     const progress = progressTracker.getProgress();
//     socket.emit('scanProgress', progress);
//   });

//   socket.on('disconnect', (reason) => {
//     console.log('Client disconnected:', socket.id, 'Reason:', reason);
//   });

//   socket.on('error', (error) => {
//     console.error('Socket error:', error);
//   });
// });

// // Middleware
// app.use(cors(config.cors));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Make io accessible to routes (if needed)
// app.set('io', io);

// // Database connection
// mongoose
//   .connect(config.database.uri, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log('✓ MongoDB connected'))
//   .catch((err) => console.error('MongoDB connection error:', err));

// // Your routes
// const authRoutes = require('./routes/authRoutes');
// const assetRoutes = require('./routes/assetRoutes');
// const scanRoutes = require('./routes/scanRoutes');
// const deviceRoutes = require('./routes/deviceRoutes');
// const vulnerabilityRoutes = require('./routes/vulnerabilityRoutes');
// const dashboardRoutes = require('./routes/dashboardRoutes');
// const configRoutes = require('./routes/configRoutes');

// // Mount routes
// app.use('/api/config', configRoutes); // Config route MUST be first and public
// app.use('/api/auth', authRoutes);
// app.use('/api/assets', assetRoutes);
// app.use('/api/scan', scanRoutes);
// app.use('/api/devices', deviceRoutes);
// app.use('/api/vulnerabilities', vulnerabilityRoutes);
// app.use('/api/dashboard', dashboardRoutes);


// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.json({ 
//     status: 'healthy', 
//     timestamp: new Date().toISOString(),
//     environment: config.server.nodeEnv
//   });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ 
//     success: false,
//     message: 'Something went wrong!', 
//     error: config.server.nodeEnv === 'development' ? err.message : 'Internal server error'
//   });
// });

// // Handle 404
// app.use((req, res) => {
//   res.status(404).json({ 
//     success: false,
//     message: 'Route not found' 
//   });
// });

// // Start server
// const PORT = config.server.port;
// const HOST = config.server.host;

// server.listen(PORT, () => {
//   console.log('=================================');
//   console.log(`🚀 Server running on http://${HOST}:${PORT}`);
//   console.log(`📊 Environment: ${config.server.nodeEnv}`);
//   console.log(`🔌 WebSocket: ws://${HOST}:${PORT}`);
//   console.log(`🌐 CORS Origin: ${config.cors.origin}`);
//   console.log('=================================');
// });

// // Graceful shutdown
// process.on('SIGTERM', () => {
//   console.log('SIGTERM signal received: closing HTTP server');
//   server.close(() => {
//     console.log('HTTP server closed');
//     mongoose.connection.close(false, () => {
//       console.log('MongoDB connection closed');
//       process.exit(0);
//     });
//   });
// });

// module.exports = { app, server, io };
