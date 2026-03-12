const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const zlib = require('zlib');
const https = require('https');
const { exec } = require('child_process');

class GeoService {
  constructor() {
    this.reader = null;
    this.dbPath = path.join(__dirname, '../data/GeoLite2-City.mmdb');
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the GeoIP service
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Download and setup MaxMind database if not exists
      await this._setupMaxMindDatabase();

      // Load the database reader
      const maxmind = require('maxmind');
      this.reader = await maxmind.open(this.dbPath);
      this.isInitialized = true;

      console.log('✅ GeoIP service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize GeoIP service:', error);
      throw error;
    }
  }

  /**
   * Setup MaxMind GeoLite2 database
   */
  async _setupMaxMindDatabase() {
    if (fs.existsSync(this.dbPath)) {
      console.log('📁 MaxMind database already exists');
      return;
    }

    console.log('📥 Downloading MaxMind GeoLite2 database...');
    
    try {
      // Download the database
      const downloadUrl = 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb';
      await this._downloadFile(downloadUrl, this.dbPath);
      console.log('✅ MaxMind database downloaded successfully');
    } catch (error) {
      console.error('❌ Failed to download MaxMind database:', error);
      throw new Error('Failed to setup MaxMind database');
    }
  }

  /**
   * Download file from URL
   */
  async _downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(destination, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });
  }

  /**
   * Get IP geolocation data
   * @param {string} ipAddress - IP address to lookup
   * @returns {Object} Geolocation data
   */
  async getIpGeoData(ipAddress) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.reader) {
      throw new Error('GeoIP reader not initialized');
    }

    try {
      // Validate IP address
      if (!this._isValidIp(ipAddress)) {
        return this._getDefaultGeoData(ipAddress);
      }

      // Skip private IPs
      if (this._isPrivateIp(ipAddress)) {
        return this._getPrivateIpGeoData(ipAddress);
      }

      // Lookup IP in MaxMind database
      const result = this.reader.get(ipAddress);
      
      if (!result) {
        return this._getDefaultGeoData(ipAddress);
      }

      return this._formatGeoData(ipAddress, result);
    } catch (error) {
      console.error(`❌ Error looking up IP ${ipAddress}:`, error);
      return this._getDefaultGeoData(ipAddress);
    }
  }

  /**
   * Format geolocation data from MaxMind result
   */
  _formatGeoData(ipAddress, result) {
    const data = {
      ip: ipAddress,
      country: result.country?.names?.en || result.registered_country?.names?.en || 'Unknown',
      countryCode: result.country?.iso_code || result.registered_country?.iso_code || 'XX',
      city: result.city?.names?.en || 'Unknown',
      latitude: result.location?.latitude || 0,
      longitude: result.location?.longitude || 0,
      timezone: result.location?.time_zone || 'UTC',
      isp: result.traits?.isp || 'Unknown',
      asn: result.traits?.autonomous_system_number || null,
      asnOrganization: result.traits?.autonomous_system_organization || 'Unknown',
      isProxy: result.traits?.is_proxy || false,
      isHostingProvider: result.traits?.is_hosting_provider || false,
      continent: result.continent?.names?.en || 'Unknown',
      subdivision: result.subdivisions?.[0]?.names?.en || 'Unknown',
      postalCode: result.postal?.code || '',
      accuracyRadius: result.location?.accuracy_radius || 1000,
      lastUpdated: new Date(),
      source: 'MaxMind GeoLite2'
    };

    return data;
  }

  /**
   * Get default geolocation data for invalid IPs
   */
  _getDefaultGeoData(ipAddress) {
    return {
      ip: ipAddress,
      country: 'Unknown',
      countryCode: 'XX',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isp: 'Unknown',
      asn: null,
      asnOrganization: 'Unknown',
      isProxy: false,
      isHostingProvider: false,
      continent: 'Unknown',
      subdivision: 'Unknown',
      postalCode: '',
      accuracyRadius: 1000,
      lastUpdated: new Date(),
      source: 'Default',
      error: 'Invalid IP or no data found'
    };
  }

  /**
   * Get geolocation data for private IPs
   */
  _getPrivateIpGeoData(ipAddress) {
    return {
      ip: ipAddress,
      country: 'Private Network',
      countryCode: 'PN',
      city: 'Private',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isp: 'Private',
      asn: null,
      asnOrganization: 'Private Network',
      isProxy: false,
      isHostingProvider: false,
      continent: 'Private',
      subdivision: 'Private',
      postalCode: '',
      accuracyRadius: 1000,
      lastUpdated: new Date(),
      source: 'Private IP Detection'
    };
  }

  /**
   * Validate IP address format
   */
  _isValidIp(ip) {
    if (!ip || typeof ip !== 'string') return false;
    
    // IPv4 regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is private
   */
  _isPrivateIp(ip) {
    if (!this._isValidIp(ip)) return false;

    // Private IPv4 ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./, // localhost
      /^169\.254\./ // link-local
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Batch lookup multiple IPs
   * @param {Array} ipAddresses - Array of IP addresses
   * @returns {Array} Array of geolocation data
   */
  async batchLookup(ipAddresses) {
    if (!Array.isArray(ipAddresses)) {
      throw new Error('IP addresses must be an array');
    }

    const results = [];
    const promises = ipAddresses.map(async (ip) => {
      try {
        const geoData = await this.getIpGeoData(ip);
        return { ip, geoData, success: true };
      } catch (error) {
        console.error(`❌ Batch lookup failed for IP ${ip}:`, error);
        return { ip, error: error.message, success: false };
      }
    });

    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          ip: 'unknown',
          error: result.reason.message,
          success: false
        });
      }
    });

    return results;
  }

  /**
   * Update MaxMind database
   */
  async updateDatabase() {
    try {
      console.log('🔄 Updating MaxMind database...');
      
      // Remove old database
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }

      // Download fresh database
      await this._setupMaxMindDatabase();

      // Reinitialize reader
      if (this.reader) {
        await this.reader.close();
      }
      await this.initialize();

      console.log('✅ MaxMind database updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to update MaxMind database:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      dbPath: this.dbPath,
      dbExists: fs.existsSync(this.dbPath),
      dbSize: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0
    };
  }

  /**
   * Close the GeoIP service
   */
  async close() {
    if (this.reader) {
      await this.reader.close();
      this.reader = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// Singleton instance
const geoService = new GeoService();

module.exports = geoService;
