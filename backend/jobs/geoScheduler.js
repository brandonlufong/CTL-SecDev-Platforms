const cron = require('node-cron');
const geoEnrichmentMiddleware = require('../middleware/geoEnrichment');
const geoService = require('../services/geoService');

class GeoScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Geo scheduler is already running');
      return;
    }

    console.log('🚀 Starting IP Intelligence scheduler...');

    // Schedule daily geolocation enrichment for new assets
    const dailyEnrichmentJob = cron.schedule('0 2 * * *', async () => {
      console.log('🌍 Running daily geolocation enrichment...');
      try {
        await geoEnrichmentMiddleware.enrichAllAssets();
      } catch (error) {
        console.error('❌ Daily enrichment failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Schedule weekly stale data updates
    const weeklyUpdateJob = cron.schedule('0 3 * * 0', async () => {
      console.log('🔄 Running weekly stale geolocation data update...');
      try {
        await geoEnrichmentMiddleware.updateStaleGeoData();
      } catch (error) {
        console.error('❌ Weekly update failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Schedule monthly MaxMind database update
    const monthlyDbUpdateJob = cron.schedule('0 4 1 * *', async () => {
      console.log('📥 Running monthly MaxMind database update...');
      try {
        await geoService.updateDatabase();
      } catch (error) {
        console.error('❌ Monthly database update failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Schedule hourly cleanup and stats
    const hourlyCleanupJob = cron.schedule('0 * * * *', async () => {
      try {
        const stats = await geoEnrichmentMiddleware.getGeoStats();
        console.log(`📊 Geo Stats - Coverage: ${stats.coveragePercentage}%, Countries: ${stats.uniqueCountries}, ISPs: ${stats.uniqueISPs}`);
      } catch (error) {
        console.error('❌ Hourly stats failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs = [
      { name: 'daily-enrichment', job: dailyEnrichmentJob },
      { name: 'weekly-update', job: weeklyUpdateJob },
      { name: 'monthly-db-update', job: monthlyDbUpdateJob },
      { name: 'hourly-stats', job: hourlyCleanupJob }
    ];

    // Start all jobs
    this.jobs.forEach(({ name, job }) => {
      job.start();
      console.log(`✅ Started scheduled job: ${name}`);
    });

    this.isRunning = true;
    console.log('✅ IP Intelligence scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Geo scheduler is not running');
      return;
    }

    console.log('🛑 Stopping IP Intelligence scheduler...');

    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`⏹️ Stopped scheduled job: ${name}`);
    });

    this.jobs = [];
    this.isRunning = false;
    console.log('✅ IP Intelligence scheduler stopped');
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.jobs.length,
      jobs: this.jobs.map(({ name }) => name)
    };
  }

  /**
   * Run a specific job manually
   */
  async runJob(jobName) {
    const job = this.jobs.find(j => j.name === jobName);
    if (!job) {
      throw new Error(`Job '${jobName}' not found`);
    }

    console.log(`🏃 Manually running job: ${jobName}`);
    
    try {
      // Trigger the job immediately
      if (jobName === 'daily-enrichment') {
        await geoEnrichmentMiddleware.enrichAllAssets();
      } else if (jobName === 'weekly-update') {
        await geoEnrichmentMiddleware.updateStaleGeoData();
      } else if (jobName === 'monthly-db-update') {
        await geoService.updateDatabase();
      } else if (jobName === 'hourly-stats') {
        const stats = await geoEnrichmentMiddleware.getGeoStats();
        return stats;
      }
      
      console.log(`✅ Successfully ran job: ${jobName}`);
      return { success: true, message: `Job '${jobName}' completed successfully` };
    } catch (error) {
      console.error(`❌ Failed to run job '${jobName}':`, error);
      throw error;
    }
  }

  /**
   * Initialize GeoIP service and run initial enrichment
   */
  async initialize() {
    try {
      console.log('🔧 Initializing IP Intelligence system...');
      
      // Initialize GeoIP service
      await geoService.initialize();
      
      // Run initial enrichment for existing assets
      console.log('🌍 Running initial geolocation enrichment...');
      await geoEnrichmentMiddleware.enrichAllAssets();
      
      // Start scheduler
      this.start();
      
      console.log('✅ IP Intelligence system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize IP Intelligence system:', error);
      throw error;
    }
  }
}

// Singleton instance
const geoScheduler = new GeoScheduler();

module.exports = geoScheduler;
