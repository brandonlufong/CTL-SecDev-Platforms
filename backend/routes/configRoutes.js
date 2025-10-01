// ========================================
// backend/routes/configRoutes.js
// ========================================
const express = require('express');
const router = express.Router();
const config = require('../config/config');

/**
 * GET /api/config
 * Returns client-safe configuration
 * This endpoint can be public or protected based on your needs
 */
router.get('/', (req, res) => {
  try {
    const clientConfig = config.getClientConfig();
    res.json({
      success: true,
      config: clientConfig
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration'
    });
  }
});

/**
 * GET /api/config/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;