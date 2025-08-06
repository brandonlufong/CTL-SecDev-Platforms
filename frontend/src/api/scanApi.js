import config from '../config';

/**
 * Enhanced Scan API Service
 * Centralized API calls for the vulnerability scanning system
 */
class ScanAPI {
  constructor() {
    this.baseURL = config.API_BASE_URL;
  }

  /**
   * Get authorization headers
   */
  getHeaders(token, contentType = 'application/json') {
    const headers = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    
    return headers;
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return await response.json();
  }

  /**
   * Scan a single asset
   */
  async scanAsset(token, assetId, scanType = 'quick') {
    const response = await fetch(`${this.baseURL}/api/scan/asset`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ assetId, scanType }),
    });
    return this.handleResponse(response);
  }

  /**
   * Run quick scan for all online assets
   */
  async runQuickScan(token) {
    const response = await fetch(`${this.baseURL}/api/scan/quick`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  /**
   * Run batch scan for multiple assets
   */
  async runBatchScan(token, assetIds, scanType = 'quick') {
    const response = await fetch(`${this.baseURL}/api/scan/batch`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ assetIds, scanType }),
    });
    return this.handleResponse(response);
  }

  /**
   * Test asset connectivity
   */
  async testConnectivity(token, assetId) {
    const response = await fetch(`${this.baseURL}/api/scan/test/${assetId}`, {
      headers: this.getHeaders(token, null),
    });
    return this.handleResponse(response);
  }

  /**
   * Get scan progress
   */
  async getScanProgress(token) {
    const response = await fetch(`${this.baseURL}/api/scan/progress`, {
      headers: this.getHeaders(token, null),
    });
    return this.handleResponse(response);
  }

  /**
   * Get latest scan results
   */
  async getLatestScans(token, limit = 20, assetId = null) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (assetId) params.append('assetId', assetId);
    
    const response = await fetch(`${this.baseURL}/api/scan/latest?${params}`, {
      headers: this.getHeaders(token, null),
    });
    return this.handleResponse(response);
  }

  /**
   * Get scan statistics
   */
  async getScanStats(token) {
    const response = await fetch(`${this.baseURL}/api/scan/stats`, {
      headers: this.getHeaders(token, null),
    });
    return this.handleResponse(response);
  }
}

// Export singleton instance
export default new ScanAPI();