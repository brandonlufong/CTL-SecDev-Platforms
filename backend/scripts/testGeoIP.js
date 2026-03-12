#!/usr/bin/env node

/**
 * Test script for IP Intelligence module
 * Verifies all functionality and provides performance metrics
 */

const mongoose = require('mongoose');
const geoService = require('../services/geoService');
const geoEnrichmentMiddleware = require('../middleware/geoEnrichment');
const Asset = require('../models/Asset');

// Test configuration
const TEST_IPS = [
  '8.8.8.8',      // Google DNS (US)
  '1.1.1.1',      // Cloudflare DNS (US)
  '208.67.222.222', // OpenDNS (US)
  '9.9.9.9',      // Quad9 DNS (US)
  '192.168.1.1',  // Private IP
  '127.0.0.1',    // Localhost
  '203.0.113.1',  // Documentation IP
  '198.51.100.1', // Documentation IP
  '151.101.1.69', // Fastly (US)
  '104.16.132.229' // Cloudflare (US)
];

class GeoIPTester {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = {};
  }

  async runAllTests() {
    console.log('🧪 Starting IP Intelligence Module Tests\n');

    try {
      await this.testGeoServiceInitialization();
      await this.testIPLookups();
      await this.testBatchProcessing();
      await this.testAssetEnrichment();
      await this.testDatabaseOperations();
      await this.testErrorHandling();
      await this.testPerformance();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testGeoServiceInitialization() {
    console.log('🔧 Testing GeoService initialization...');
    
    const startTime = Date.now();
    
    try {
      await geoService.initialize();
      const stats = geoService.getStats();
      
      this.addResult('GeoService Initialization', {
        success: stats.isInitialized,
        dbExists: stats.dbExists,
        dbSize: stats.dbSize,
        duration: Date.now() - startTime
      });
      
      console.log('✅ GeoService initialized successfully');
      console.log(`   Database size: ${(stats.dbSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      this.addResult('GeoService Initialization', {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async testIPLookups() {
    console.log('\n🌍 Testing individual IP lookups...');
    
    const results = [];
    const startTime = Date.now();
    
    for (const ip of TEST_IPS) {
      try {
        const geoData = await geoService.getIpGeoData(ip);
        results.push({
          ip,
          success: true,
          country: geoData.country,
          city: geoData.city,
          isp: geoData.isp,
          source: geoData.source
        });
      } catch (error) {
        results.push({
          ip,
          success: false,
          error: error.message
        });
      }
    }
    
    const duration = Date.now() - startTime;
    const successRate = (results.filter(r => r.success).length / results.length * 100).toFixed(1);
    
    this.addResult('IP Lookups', {
      total: TEST_IPS.length,
      successful: results.filter(r => r.success).length,
      successRate: `${successRate}%`,
      averageTime: `${(duration / TEST_IPS.length).toFixed(2)}ms`,
      duration
    });
    
    console.log(`✅ IP lookups completed: ${successRate}% success rate`);
    console.log(`   Average lookup time: ${(duration / TEST_IPS.length).toFixed(2)}ms`);
  }

  async testBatchProcessing() {
    console.log('\n📦 Testing batch IP processing...');
    
    const startTime = Date.now();
    
    try {
      const batchResults = await geoService.batchLookup(TEST_IPS);
      const duration = Date.now() - startTime;
      const successRate = (batchResults.filter(r => r.success).length / batchResults.length * 100).toFixed(1);
      
      this.addResult('Batch Processing', {
        total: TEST_IPS.length,
        successful: batchResults.filter(r => r.success).length,
        successRate: `${successRate}%`,
        totalTime: `${duration}ms`,
        averageTime: `${(duration / TEST_IPS.length).toFixed(2)}ms`
      });
      
      console.log(`✅ Batch processing completed: ${successRate}% success rate`);
      console.log(`   Total time: ${duration}ms`);
    } catch (error) {
      this.addResult('Batch Processing', {
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async testAssetEnrichment() {
    console.log('\n🏢 Testing asset enrichment...');
    
    // Create test asset
    const testAsset = new Asset({
      name: 'Test Asset',
      ip: '8.8.8.8',
      type: 'Server',
      os: 'Ubuntu 20.04'
    });
    
    const startTime = Date.now();
    
    try {
      const enrichedAsset = await geoEnrichmentMiddleware.enrichAsset(testAsset);
      const duration = Date.now() - startTime;
      
      const hasGeoData = enrichedAsset.geoLocation && 
                        enrichedAsset.geoLocation.country !== 'Unknown';
      
      this.addResult('Asset Enrichment', {
        success: hasGeoData,
        country: enrichedAsset.geoLocation?.country,
        city: enrichedAsset.geoLocation?.city,
        isp: enrichedAsset.geoLocation?.isp,
        duration: `${duration}ms`
      });
      
      console.log(`✅ Asset enrichment completed`);
      console.log(`   Country: ${enrichedAsset.geoLocation?.country}`);
      console.log(`   City: ${enrichedAsset.geoLocation?.city}`);
      console.log(`   ISP: ${enrichedAsset.geoLocation?.isp}`);
      
      // Clean up test asset
      await Asset.deleteOne({ _id: enrichedAsset._id });
      
    } catch (error) {
      this.addResult('Asset Enrichment', {
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async testDatabaseOperations() {
    console.log('\n🗄️ Testing database operations...');
    
    try {
      // Test geolocation stats
      const stats = await geoEnrichmentMiddleware.getGeoStats();
      
      this.addResult('Database Operations', {
        statsAvailable: true,
        totalAssets: stats.totalAssets,
        assetsWithGeoData: stats.assetsWithGeoData,
        coveragePercentage: stats.coveragePercentage,
        uniqueCountries: stats.uniqueCountries,
        uniqueISPs: stats.uniqueISPs
      });
      
      console.log(`✅ Database operations successful`);
      console.log(`   Total assets: ${stats.totalAssets}`);
      console.log(`   Geo coverage: ${stats.coveragePercentage}%`);
      
    } catch (error) {
      this.addResult('Database Operations', {
        success: false,
        error: error.message
      });
      console.warn('⚠️ Database operations failed (may need database connection)');
    }
  }

  async testErrorHandling() {
    console.log('\n🛡️ Testing error handling...');
    
    const errorTests = [
      {
        name: 'Invalid IP',
        test: () => geoService.getIpGeoData('invalid-ip')
      },
      {
        name: 'Empty IP',
        test: () => geoService.getIpGeoData('')
      },
      {
        name: 'Null IP',
        test: () => geoService.getIpGeoData(null)
      },
      {
        name: 'Private IP',
        test: () => geoService.getIpGeoData('192.168.1.1')
      }
    ];
    
    const results = [];
    
    for (const errorTest of errorTests) {
      try {
        const result = await errorTest.test();
        results.push({
          test: errorTest.name,
          handled: true,
          result: result.source || result.country
        });
      } catch (error) {
        results.push({
          test: errorTest.name,
          handled: false,
          error: error.message
        });
      }
    }
    
    const handledCount = results.filter(r => r.handled).length;
    
    this.addResult('Error Handling', {
      total: errorTests.length,
      handled: handledCount,
      handlingRate: `${(handledCount / errorTests.length * 100).toFixed(1)}%`,
      results
    });
    
    console.log(`✅ Error handling: ${handledCount}/${errorTests.length} cases handled gracefully`);
  }

  async testPerformance() {
    console.log('\n⚡ Testing performance...');
    
    const performanceTests = [
      {
        name: 'Single Lookup',
        test: () => geoService.getIpGeoData('8.8.8.8'),
        iterations: 100
      },
      {
        name: 'Batch Lookup (10 IPs)',
        test: () => geoService.batchLookup(TEST_IPS.slice(0, 10)),
        iterations: 10
      }
    ];
    
    const results = [];
    
    for (const perfTest of performanceTests) {
      const times = [];
      
      for (let i = 0; i < perfTest.iterations; i++) {
        const start = Date.now();
        await perfTest.test();
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      results.push({
        test: perfTest.name,
        iterations: perfTest.iterations,
        averageTime: `${avgTime.toFixed(2)}ms`,
        minTime: `${minTime}ms`,
        maxTime: `${maxTime}ms`,
        throughput: `${(1000 / avgTime).toFixed(2)} ops/sec`
      });
    }
    
    this.addResult('Performance', { results });
    
    console.log('✅ Performance tests completed:');
    results.forEach(result => {
      console.log(`   ${result.test}:`);
      console.log(`     Average: ${result.averageTime}`);
      console.log(`     Throughput: ${result.throughput}`);
    });
  }

  addResult(testName, result) {
    this.testResults.push({
      test: testName,
      timestamp: new Date().toISOString(),
      ...result
    });
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));
    
    this.testResults.forEach(result => {
      const status = result.success !== false ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
      
      if (result.successRate) {
        console.log(`   Success Rate: ${result.successRate}`);
      }
      
      console.log('');
    });

    // Performance summary
    const perfResult = this.testResults.find(r => r.test === 'Performance');
    if (perfResult && perfResult.results) {
      console.log('⚡ Performance Summary:');
      perfResult.results.forEach(result => {
        console.log(`   ${result.test}: ${result.averageTime} (${result.throughput})`);
      });
    }

    console.log('\n🎉 IP Intelligence Module Tests Completed!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new GeoIPTester();
  
  // Optional: Connect to MongoDB for full testing
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/camtel';
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('📦 Connected to MongoDB');
      tester.runAllTests()
        .then(() => {
          mongoose.disconnect();
          process.exit(0);
        })
        .catch(error => {
          console.error('Test failed:', error);
          mongoose.disconnect();
          process.exit(1);
        });
    })
    .catch(error => {
      console.warn('⚠️ Could not connect to MongoDB, running limited tests...');
      tester.runAllTests()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Test failed:', error);
          process.exit(1);
        });
    });
}

module.exports = GeoIPTester;
