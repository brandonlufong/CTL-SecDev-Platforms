# IP Intelligence Module API Documentation

## Overview

The IP Intelligence module provides automatic geolocation enrichment for network assets using MaxMind GeoLite2 database. It enriches asset IP addresses with comprehensive geographic and network intelligence data.

## Features

- **Automatic IP Geolocation**: Enriches assets with country, city, coordinates, ISP, ASN data
- **Local Database**: Uses MaxMind GeoLite2 locally (no external API dependencies)
- **Performance Optimized**: Non-blocking enrichment with batch processing
- **Scheduled Updates**: Automatic data refresh and maintenance
- **Comprehensive Error Handling**: Robust error recovery and fallbacks
- **MongoDB Integration**: Persistent storage with optimized indexing

## Data Schema

### Asset Geolocation Fields

```javascript
geoLocation: {
  country: String,           // Country name (e.g., "United States")
  countryCode: String,      // ISO country code (e.g., "US")
  city: String,             // City name (e.g., "New York")
  latitude: Number,         // Geographic latitude
  longitude: Number,        // Geographic longitude
  timezone: String,         // Timezone (e.g., "America/New_York")
  isp: String,              // Internet Service Provider
  asn: Number,              // Autonomous System Number
  asnOrganization: String,  // ASN Organization
  isProxy: Boolean,         // Proxy detection
  isHostingProvider: Boolean, // Hosting provider detection
  continent: String,        // Continent name
  subdivision: String,      // State/Province
  postalCode: String,       // Postal code
  accuracyRadius: Number,  // Accuracy radius in meters
  lastUpdated: Date,       // Last update timestamp
  source: String           // Data source
}
```

## API Endpoints

### Asset Management with Geolocation

#### Get All Assets
```http
GET /api/assets
Authorization: Bearer <token>
```

**Response**: Array of assets with enriched geolocation data

#### Create Asset (Auto-Enriched)
```http
POST /api/assets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Web Server 01",
  "ip": "8.8.8.8",
  "type": "Server",
  "os": "Ubuntu 20.04"
}
```

**Response**: Created asset with automatic geolocation enrichment

#### Update Asset (Re-Enriched if IP Changes)
```http
PUT /api/assets/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "ip": "1.1.1.1",
  "name": "Updated Server"
}
```

**Response**: Updated asset with new geolocation data

### Geolocation-Specific Endpoints

#### Get Geolocation Statistics
```http
GET /api/assets/geo-stats
Authorization: Bearer <token>
```

**Response**:
```json
{
  "totalAssets": 150,
  "assetsWithGeoData": 142,
  "coveragePercentage": "94.67",
  "uniqueCountries": 12,
  "uniqueISPs": 8,
  "uniqueCities": 45,
  "geoServiceStats": {
    "isInitialized": true,
    "dbExists": true,
    "dbSize": 52428800
  }
}
```

#### Filter Assets by Location
```http
GET /api/assets/location?country=United States&city=New York&isp=Cloudflare
Authorization: Bearer <token>
```

**Query Parameters**:
- `country` (optional): Filter by country name
- `city` (optional): Filter by city name
- `isp` (optional): Filter by ISP name

**Response**: Array of assets matching location criteria

#### Bulk Enrich Assets
```http
POST /api/assets/bulk-enrich
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "Successfully enriched 25 assets",
  "enriched": 25
}
```

#### Update Stale Geolocation Data
```http
POST /api/assets/update-stale-geo
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "Stale geolocation data updated successfully"
}
```

#### Search with Geolocation
```http
GET /api/assets/search?q=United States
Authorization: Bearer <token>
```

**Response**: Assets matching search in geolocation fields (country, city, ISP, etc.)

## Usage Examples

### JavaScript/Node.js

```javascript
// Create asset with automatic geolocation
const response = await fetch('/api/assets', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Production Server',
    ip: '203.0.113.1',
    type: 'Server',
    os: 'Ubuntu 22.04'
  })
});

const asset = await response.json();
console.log('Geolocation:', asset.geoLocation);
```

### Python

```python
import requests

headers = {'Authorization': 'Bearer ' + token}

# Get assets by country
response = requests.get(
    '/api/assets/location?country=Japan', 
    headers=headers
)
assets = response.json()

# Get geolocation statistics
stats = requests.get('/api/assets/geo-stats', headers=headers).json()
print(f"Coverage: {stats['coveragePercentage']}%")
```

### cURL

```bash
# Create asset
curl -X POST /api/assets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Database Server",
    "ip": "8.8.4.4",
    "type": "Database"
  }'

# Get assets in Germany
curl -X GET "/api/assets/location?country=Germany" \
  -H "Authorization: Bearer <token>"

# Get geo statistics
curl -X GET "/api/assets/geo-stats" \
  -H "Authorization: Bearer <token>"
```

## Scheduled Jobs

The system automatically runs maintenance jobs:

### Daily Enrichment (2:00 AM UTC)
- Enriches new assets without geolocation data
- Updates assets with stale data (older than 7 days)

### Weekly Updates (3:00 AM Sunday UTC)
- Updates geolocation data for all assets
- Refreshes data that might have changed

### Monthly Database Update (4:00 AM 1st of month)
- Downloads latest MaxMind GeoLite2 database
- Reinitializes GeoIP service with new data

### Hourly Statistics (Every hour)
- Logs geolocation coverage statistics
- Monitors system health

## Performance Considerations

### Enrichment Strategy
- **Non-blocking**: Geolocation enrichment runs asynchronously
- **Batch Processing**: Multiple IPs processed in parallel
- **Caching**: GeoIP database loaded once in memory
- **Error Tolerance**: Failed enrichments don't block asset creation

### Database Optimization
- **Indexing**: Optimized indexes for geolocation queries
- **Pagination**: Large result sets support pagination
- **Aggregation**: Efficient statistics aggregation

### Memory Usage
- **GeoIP Reader**: ~50MB memory footprint for database
- **Batch Size**: Configurable batch processing (default: 50 assets)
- **Cleanup**: Automatic memory cleanup for failed operations

## Error Handling

### IP Validation
- Invalid IP addresses receive default geolocation data
- Private IPs marked as "Private Network"
- IPv6 support (basic validation)

### Network Errors
- Failed downloads retry with exponential backoff
- Database corruption handled with automatic recovery
- Service degradation gracefully handled

### Data Quality
- Missing fields populated with "Unknown" defaults
- Coordinates default to (0,0) for invalid locations
- Source tracking for data provenance

## Security Considerations

### Data Privacy
- No external API calls for geolocation
- Local database only (MaxMind GeoLite2)
- IP addresses stored securely in MongoDB

### Access Control
- All endpoints require authentication
- Role-based access can be implemented
- Audit logging for geolocation operations

## Monitoring and Logging

### Log Levels
- **INFO**: Normal operations, statistics
- **WARN**: Non-critical errors, fallbacks used
- **ERROR**: Failed operations, system issues
- **DEBUG**: Detailed troubleshooting information

### Metrics
- Geolocation coverage percentage
- Database size and update status
- Processing times and throughput
- Error rates and types

## Troubleshooting

### Common Issues

**Assets not getting geolocation data**
- Check GeoIP service initialization
- Verify MaxMind database exists
- Review server logs for errors

**Slow performance**
- Check database indexes
- Monitor memory usage
- Consider batch size adjustments

**Database download failures**
- Check network connectivity
- Verify GitHub repository access
- Manual database download option available

### Debug Commands

```javascript
// Check GeoIP service status
const geoService = require('./services/geoService');
console.log(geoService.getStats());

// Manual IP lookup
const geoData = await geoService.getIpGeoData('8.8.8.8');
console.log(geoData);

// Force enrichment
const geoEnrichment = require('./middleware/geoEnrichment');
await geoEnrichment.enrichAllAssets();
```

## Integration Guide

### Server Integration

Add to your main server file:

```javascript
// Initialize IP Intelligence
const geoScheduler = require('./jobs/geoScheduler');
geoScheduler.initialize().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
  geoScheduler.stop();
  process.exit(0);
});
```

### Frontend Integration

```javascript
// Fetch assets with geolocation
const fetchAssets = async () => {
  const response = await fetch('/api/assets');
  const assets = await response.json();
  
  return assets.map(asset => ({
    ...asset,
    location: {
      lat: asset.geoLocation.latitude,
      lng: asset.geoLocation.longitude,
      city: asset.geoLocation.city,
      country: asset.geoLocation.country
    }
  }));
};
```

## License and Compliance

- **MaxMind GeoLite2**: Free database with attribution requirement
- **Data Usage**: Compliant with MaxMind license terms
- **Privacy**: No personal data transmitted externally
- **Attribution**: "This product includes GeoLite2 data created by MaxMind"

## Support

For issues and support:
1. Check server logs for error details
2. Verify network connectivity for database downloads
3. Review MongoDB connection and indexes
4. Monitor system resources (memory, disk space)
