#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Setup script for Network Performance Monitoring module
 * Installs dependencies and initializes the monitoring system
 */

async function setupPerformanceMonitoring() {
  console.log('🚀 Setting up Network Performance Monitoring module...\n');

  try {
    // Check if we're in the backend directory
    if (!fs.existsSync('package.json')) {
      throw new Error('Please run this script from the backend directory');
    }

    // Install required packages
    console.log('📦 Installing required packages...');
    const packages = [
      'ping',
      'ws',
      'node-cron',
      'jsonwebtoken'
    ];

    await execPromise(`npm install ${packages.join(' ')}`);
    console.log('✅ Packages installed successfully\n');

    // Create necessary directories
    const directories = [
      'jobs',
      'services',
      'middleware',
      'docs'
    ];

    directories.forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });

    // Test performance service initialization
    console.log('🔧 Testing Performance Service initialization...');
    try {
      const performanceService = require('../services/performanceService');
      console.log('✅ Performance Service loaded successfully');
    } catch (error) {
      console.error('❌ Performance Service test failed:', error.message);
      throw error;
    }

    // Test WebSocket service initialization
    console.log('🌐 Testing WebSocket Service initialization...');
    try {
      const websocketService = require('../services/websocketService');
      console.log('✅ WebSocket Service loaded successfully');
    } catch (error) {
      console.error('❌ WebSocket Service test failed:', error.message);
      throw error;
    }

    // Test PerformanceMetric model
    console.log('📊 Testing PerformanceMetric model...');
    try {
      const PerformanceMetric = require('../models/PerformanceMetric');
      console.log('✅ PerformanceMetric model loaded successfully');
    } catch (error) {
      console.error('❌ PerformanceMetric model test failed:', error.message);
      throw error;
    }

    // Create initialization script for server startup
    const initScript = `
// Auto-initialize Performance Monitoring on server start
const performanceScheduler = require('./jobs/performanceScheduler');
const websocketService = require('./services/websocketService');

// Initialize WebSocket service when server starts
const initializePerformanceMonitoring = (server) => {
  try {
    // Initialize WebSocket service
    websocketService.initialize(server);
    console.log('🌐 WebSocket service initialized');
    
    // Initialize performance monitoring
    performanceScheduler.initialize().catch(error => {
      console.error('❌ Failed to initialize Performance Monitoring:', error);
    });
    
    console.log('📊 Performance Monitoring system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Performance Monitoring system:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down Performance Monitoring system...');
  performanceScheduler.shutdown().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Shutdown failed:', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Shutting down Performance Monitoring system...');
  performanceScheduler.shutdown().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Shutdown failed:', error);
    process.exit(1);
  });
});

module.exports = { initializePerformanceMonitoring };
`;

    const initScriptPath = path.join(__dirname, '../initPerformanceMonitoring.js');
    fs.writeFileSync(initScriptPath, initScript);
    console.log('📝 Created initialization script: initPerformanceMonitoring.js\n');

    // Create server integration example
    const serverExample = `
// Example: Add to your main server file (app.js or server.js)
const express = require('express');
const http = require('http');
const { initializePerformanceMonitoring } = require('./initPerformanceMonitoring');

const app = express();
const server = http.createServer(app);

// Initialize Performance Monitoring
initializePerformanceMonitoring(server);

// Your existing server setup...
app.use('/api/performance', require('./routes/performanceRoutes'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log('📊 Performance Monitoring active');
  console.log('🌐 WebSocket server ready at ws://localhost:\${PORT}/ws/performance');
});
`;

    const serverExamplePath = path.join(__dirname, '../server-example.js');
    fs.writeFileSync(serverExamplePath, serverExample);
    console.log('📝 Created server integration example: server-example.js\n');

    // Display usage instructions
    console.log('🎉 Network Performance Monitoring module setup completed!\n');
    console.log('📋 Next steps:');
    console.log('1. Add performance routes to your main app:');
    console.log('   app.use("/api/performance", require("./routes/performanceRoutes"));');
    console.log('\n2. Initialize Performance Monitoring in your server startup:');
    console.log('   const { initializePerformanceMonitoring } = require("./initPerformanceMonitoring");');
    console.log('   initializePerformanceMonitoring(server);');
    console.log('\n3. Or use the server example provided in server-example.js');
    console.log('\n4. The system will automatically:');
    console.log('   • Start monitoring all online assets');
    console.log('   • Collect ping, packet loss, and response time metrics');
    console.log('   • Calculate uptime percentages');
    console.log('   • Store historical data in MongoDB');
    console.log('   • Provide real-time updates via WebSocket');
    console.log('   • Schedule maintenance and cleanup jobs');
    console.log('\n📚 Available API endpoints:');
    console.log('   GET  /api/performance/status - Get monitoring status');
    console.log('   POST /api/performance/start - Start monitoring');
    console.log('   POST /api/performance/stop - Stop monitoring');
    console.log('   GET  /api/performance/overview - Get performance overview');
    console.log('   GET  /api/performance/stats - Get performance statistics');
    console.log('   GET  /api/performance/alerts - Get performance alerts');
    console.log('   GET  /api/performance/assets/:id/latest - Get latest metrics');
    console.log('   GET  /api/performance/assets/:id/metrics/:type - Get metrics by time range');
    console.log('   GET  /api/performance/assets/:id/uptime - Get uptime statistics');
    console.log('\n🌐 WebSocket endpoints:');
    console.log('   ws://localhost:PORT/ws/performance - Real-time metrics');
    console.log('\n📊 WebSocket message types:');
    console.log('   • subscribe - Subscribe to asset metrics');
    console.log('   • unsubscribe - Unsubscribe from asset metrics');
    console.log('   • get_metrics - Request specific metrics');
    console.log('   • metrics:realtime - Real-time metric updates');
    console.log('   • asset:status:changed - Asset status changes');
    console.log('   • monitoring:status - Monitoring status updates');
    console.log('\n🔍 Features:');
    console.log('   • Event-driven monitoring (no 2-second polling)');
    console.log('   • Real-time WebSocket updates');
    console.log('   • Comprehensive metric collection');
    console.log('   • Historical data storage with TTL');
    console.log('   • Performance alerts and thresholds');
    console.log('   • Automated cleanup and maintenance');
    console.log('   • Export functionality');
    console.log('   • Performance trends analysis');
    console.log('\n⚡ Performance optimizations:');
    console.log('   • Batch metric insertion');
    console.log('   • Efficient WebSocket broadcasting');
    console.log('   • MongoDB TTL indexes');
    console.log('   • Memory-efficient buffering');
    console.log('   • Non-blocking metric collection');
    console.log('\n🛡️ Error handling:');
    console.log('   • Graceful degradation');
    console.log('   • Automatic retry mechanisms');
    console.log('   • Comprehensive logging');
    console.log('   • WebSocket reconnection support');
    console.log('\n📈 Monitoring intervals:');
    console.log('   • Asset checks: 30 seconds (event-driven)');
    console.log('   • Buffer flush: 5 seconds');
    console.log('   • Health checks: 5 minutes');
    console.log('   • Data cleanup: Daily at 2 AM');
    console.log('   • Daily reports: Daily at 8 AM');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupPerformanceMonitoring();
}

module.exports = setupPerformanceMonitoring;
