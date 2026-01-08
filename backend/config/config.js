// ========================================
// backend/config/config.js
// ========================================
require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '172.20.19.172',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Database Configuration
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/vulnmanager',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'yourStrongJWTSecretHere',
    expiresIn: process.env.JWT_EXPIRE || '30d',
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://172.20.19.172:3001',
    credentials: true,
  },

  // Scan Configuration
  scan: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SCANS || '3'),
    timeout: parseInt(process.env.SCAN_TIMEOUT || '300000'),
  },

  // External APIs
  external: {
    nvdApiKey: process.env.NVD_API_KEY || '',
  },

  // Client Configuration (to be sent to frontend)
  getClientConfig() {
    return {
      apiBaseUrl: `http://${this.server.host}:${this.server.port}`,
      wsUrl: `ws://${this.server.host}:${this.server.port}`,
      environment: this.server.nodeEnv,
      features: {
        maxConcurrentScans: this.scan.maxConcurrent,
      }
    };
  }
};

module.exports = config;