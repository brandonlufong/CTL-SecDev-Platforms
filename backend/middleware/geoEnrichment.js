const geoService = require('../services/geoService');
const Asset = require('../models/Asset');

/**
 * Middleware to automatically enrich asset with geolocation data
 * This middleware runs after asset creation/update to add IP geolocation
 */
const geoEnrichmentMiddleware = {
  /**
   * Enrich single asset with geolocation data
   * @param {Object} asset - Asset document
   * @returns {Object} Enriched asset
   */
  async enrichAsset(asset) {
    try {
      if (!asset.ip) {
        console.warn('⚠️ Asset has no IP address, skipping geolocation');
        return asset;
      }

      // Get geolocation data for the IP
      const geoData = await geoService.getIpGeoData(asset.ip);
      
      // Update asset with geolocation data
      asset.geoLocation = {
        ...asset.geoLocation,
        ...geoData,
        lastUpdated: new Date()
      };

      // Save the enriched asset
      await asset.save();

      console.log(`✅ Enriched asset ${asset.name} (${asset.ip}) with geolocation data`);
      return asset;
    } catch (error) {
      console.error(`❌ Failed to enrich asset ${asset.name}:`, error);
      // Don't throw error to avoid breaking the main flow
      return asset;
    }
  },

  /**
   * Enrich multiple assets with geolocation data
   * @param {Array} assets - Array of asset documents
   * @returns {Array} Enriched assets
   */
  async enrichAssets(assets) {
    if (!Array.isArray(assets) || assets.length === 0) {
      return assets;
    }

    try {
      // Extract unique IP addresses for batch lookup
      const ipAddresses = [...new Set(assets.map(asset => asset.ip).filter(ip => ip))];
      
      if (ipAddresses.length === 0) {
        console.log('ℹ️ No IP addresses found for geolocation enrichment');
        return assets;
      }

      console.log(`🌍 Enriching ${assets.length} assets with geolocation data...`);
      
      // Batch lookup geolocation data
      const geoResults = await geoService.batchLookup(ipAddresses);
      
      // Create IP to geoData mapping
      const ipToGeoMap = {};
      geoResults.forEach(result => {
        if (result.success) {
          ipToGeoMap[result.ip] = result.geoData;
        }
      });

      // Enrich each asset
      const enrichedAssets = await Promise.all(
        assets.map(async (asset) => {
          const geoData = ipToGeoMap[asset.ip];
          if (geoData) {
            asset.geoLocation = {
              ...asset.geoLocation,
              ...geoData,
              lastUpdated: new Date()
            };
            
            // Save enriched asset
            try {
              await asset.save();
            } catch (saveError) {
              console.error(`❌ Failed to save enriched asset ${asset.name}:`, saveError);
            }
          }
          return asset;
        })
      );

      console.log(`✅ Successfully enriched ${enrichedAssets.length} assets with geolocation data`);
      return enrichedAssets;
    } catch (error) {
      console.error('❌ Failed to batch enrich assets:', error);
      return assets;
    }
  },

  /**
   * Express middleware for asset creation
   */
  async enrichOnCreate(req, res, next) {
    // Only run for asset creation/update endpoints
    if (req.path.includes('/assets') && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      try {
        // Store original send function
        const originalSend = res.send;
        
        // Override send to intercept response
        res.send = function(data) {
          // Check if this is a successful asset creation/update
          if (res.statusCode >= 200 && res.statusCode < 300 && data) {
            try {
              const responseData = typeof data === 'string' ? JSON.parse(data) : data;
              
              // Handle single asset
              if (responseData.data && responseData.data.ip) {
                geoEnrichmentMiddleware.enrichAsset(responseData.data)
                  .catch(error => console.error('❌ Geo enrichment failed:', error));
              }
              // Handle multiple assets
              else if (responseData.data && Array.isArray(responseData.data)) {
                geoEnrichmentMiddleware.enrichAssets(responseData.data)
                  .catch(error => console.error('❌ Geo enrichment failed:', error));
              }
            } catch (parseError) {
              console.error('❌ Failed to parse response for geo enrichment:', parseError);
            }
          }
          
          // Call original send
          return originalSend.call(this, data);
        };
        
        next();
      } catch (error) {
        console.error('❌ Geo enrichment middleware error:', error);
        next();
      }
    } else {
      next();
    }
  },

  /**
   * Background job to enrich all existing assets
   */
  async enrichAllAssets() {
    try {
      console.log('🌍 Starting background geolocation enrichment for all assets...');
      
      // Get all assets that don't have geolocation data or have outdated data
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const assets = await Asset.find({
        $or: [
          { 'geoLocation.lastUpdated': { $lt: oneWeekAgo } },
          { 'geoLocation.lastUpdated': { $exists: false } },
          { 'geoLocation.country': 'Unknown' }
        ]
      });

      if (assets.length === 0) {
        console.log('ℹ️ All assets have up-to-date geolocation data');
        return;
      }

      console.log(`📊 Found ${assets.length} assets needing geolocation enrichment`);
      
      // Enrich assets in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        await geoEnrichmentMiddleware.enrichAssets(batch);
        
        // Small delay between batches
        if (i + batchSize < assets.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('✅ Background geolocation enrichment completed');
    } catch (error) {
      console.error('❌ Background geolocation enrichment failed:', error);
    }
  },

  /**
   * Update geolocation data for assets with old data
   */
  async updateStaleGeoData() {
    try {
      console.log('🔄 Updating stale geolocation data...');
      
      // Get assets with geolocation data older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const assets = await Asset.find({
        'geoLocation.lastUpdated': { $lt: thirtyDaysAgo }
      });

      if (assets.length === 0) {
        console.log('ℹ️ No stale geolocation data found');
        return;
      }

      console.log(`📊 Found ${assets.length} assets with stale geolocation data`);
      await geoEnrichmentMiddleware.enrichAssets(assets);
      
      console.log('✅ Stale geolocation data updated successfully');
    } catch (error) {
      console.error('❌ Failed to update stale geolocation data:', error);
    }
  },

  /**
   * Get geolocation statistics
   */
  async getGeoStats() {
    try {
      const stats = await Asset.aggregate([
        {
          $group: {
            _id: null,
            totalAssets: { $sum: 1 },
            assetsWithGeoData: {
              $sum: {
                $cond: [
                  { $ne: ['$geoLocation.country', 'Unknown'] },
                  1,
                  0
                ]
              }
            },
            uniqueCountries: { $addToSet: '$geoLocation.country' },
            uniqueISPs: { $addToSet: '$geoLocation.isp' },
            uniqueCities: { $addToSet: '$geoLocation.city' }
          }
        }
      ]);

      const result = stats[0] || {
        totalAssets: 0,
        assetsWithGeoData: 0,
        uniqueCountries: [],
        uniqueISPs: [],
        uniqueCities: []
      };

      return {
        totalAssets: result.totalAssets,
        assetsWithGeoData: result.assetsWithGeoData,
        coveragePercentage: result.totalAssets > 0 ? 
          ((result.assetsWithGeoData / result.totalAssets) * 100).toFixed(2) : 0,
        uniqueCountries: result.uniqueCountries.length,
        uniqueISPs: result.uniqueISPs.length,
        uniqueCities: result.uniqueCities.length,
        geoServiceStats: geoService.getStats()
      };
    } catch (error) {
      console.error('❌ Failed to get geolocation statistics:', error);
      return {
        totalAssets: 0,
        assetsWithGeoData: 0,
        coveragePercentage: 0,
        uniqueCountries: 0,
        uniqueISPs: 0,
        uniqueCities: 0,
        error: error.message
      };
    }
  }
};

module.exports = geoEnrichmentMiddleware;
