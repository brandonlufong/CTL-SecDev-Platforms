#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Setup script for IP Intelligence module
 * Installs dependencies and initializes GeoIP service
 */

async function setupGeoIP() {
  console.log('🚀 Setting up IP Intelligence module...\n');

  try {
    // Check if we're in the backend directory
    if (!fs.existsSync('package.json')) {
      throw new Error('Please run this script from the backend directory');
    }

    // Install required packages
    console.log('📦 Installing required packages...');
    const packages = [
      'maxmind',
      'node-cron',
      'ping',
      'is-reachable'
    ];

    await execPromise(`npm install ${packages.join(' ')}`);
    console.log('✅ Packages installed successfully\n');

    // Create data directory
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Created data directory');
    }

    // Test GeoIP service initialization
    console.log('🔧 Testing GeoIP service initialization...');
    const geoService = require('../services/geoService');
    
    try {
      await geoService.initialize();
      console.log('✅ GeoIP service initialized successfully');
      
      // Test with a sample IP
      const testIP = '8.8.8.8'; // Google DNS
      const geoData = await geoService.getIpGeoData(testIP);
      console.log(`🌍 Test lookup for ${testIP}:`);
      console.log(`   Country: ${geoData.country}`);
      console.log(`   City: ${geoData.city}`);
      console.log(`   ISP: ${geoData.isp}`);
      console.log(`   Coordinates: ${geoData.latitude}, ${geoData.longitude}\n`);
      
    } catch (error) {
      console.error('❌ GeoIP service test failed:', error.message);
      throw error;
    }

    // Update MongoDB indexes
    console.log('🗄️ Updating MongoDB indexes...');
    const Asset = require('../models/Asset');
    try {
      await Asset.createIndexes();
      console.log('✅ MongoDB indexes updated\n');
    } catch (error) {
      console.warn('⚠️ Index update failed (may need database connection):', error.message);
    }

    // Create initialization script for server startup
    const initScript = `
// Auto-initialize IP Intelligence on server start
const geoScheduler = require('./jobs/geoScheduler');

// Initialize GeoIP system when server starts
geoScheduler.initialize().catch(error => {
  console.error('❌ Failed to initialize IP Intelligence:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down IP Intelligence scheduler...');
  geoScheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Shutting down IP Intelligence scheduler...');
  geoScheduler.stop();
  process.exit(0);
});
`;

    const initScriptPath = path.join(__dirname, '../initGeoIP.js');
    fs.writeFileSync(initScriptPath, initScript);
    console.log('📝 Created initialization script: initGeoIP.js\n');

    // Display usage instructions
    console.log('🎉 IP Intelligence module setup completed!\n');
    console.log('📋 Next steps:');
    console.log('1. Add the following to your main server file (app.js or server.js):');
    console.log('   require("./initGeoIP.js");');
    console.log('\n2. Or manually initialize in your server startup:');
    console.log('   const geoScheduler = require("./jobs/geoScheduler");');
    console.log('   geoScheduler.initialize();');
    console.log('\n3. The system will automatically:');
    console.log('   • Download MaxMind GeoLite2 database');
    console.log('   • Enrich existing assets with geolocation data');
    console.log('   • Schedule automatic updates (daily, weekly, monthly)');
    console.log('   • Provide REST API endpoints for geolocation features');
    console.log('\n📚 Available API endpoints:');
    console.log('   GET  /api/assets/geo-stats - Get geolocation statistics');
    console.log('   GET  /api/assets/location?country=US - Filter by location');
    console.log('   POST /api/assets/bulk-enrich - Bulk enrich assets');
    console.log('   POST /api/assets/update-stale-geo - Update stale data');
    console.log('\n🔍 Features:');
    console.log('   • Automatic IP geolocation enrichment');
    console.log('   • MaxMind GeoLite2 database (local, no API calls)');
    console.log('   • Batch processing for performance');
    console.log('   • Scheduled updates and maintenance');
    console.log('   • Comprehensive error handling');
    console.log('   • MongoDB persistence with indexing');
    console.log('\n⚡ Performance optimizations:');
    console.log('   • Non-blocking enrichment (async)');
    console.log('   • Batch IP lookups');
    console.log('   • Database indexing for fast queries');
    console.log('   • Memory-efficient GeoIP reader');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupGeoIP();
}

module.exports = setupGeoIP;
