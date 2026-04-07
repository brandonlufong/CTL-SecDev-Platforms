const assetDiscoveryService = require('../services/assetDiscoveryService');
const networkDetectionService = require('../services/networkDetectionService');
const { getIO } = require('../utils/socket');
const { createLogger } = require('../utils/logger');
const discoveryLogger = createLogger('asset-discovery');

// Start asset discovery
exports.startDiscovery = async (req, res) => {
  try {
    const { networkRange, ports, timeout, maxConcurrent, autoImport = true } = req.body;
    const userId = req.user.id;

    if (!networkRange) {
      return res.status(400).json({ 
        message: 'Network range is required',
        details: 'Please provide a valid network range (e.g., 192.168.1.0/24)'
      });
    }

    // Check if scan is already running
    const scanStatus = assetDiscoveryService.getScanStatus();
    if (scanStatus.isScanning) {
      return res.status(409).json({ 
        message: 'Discovery scan already in progress',
        currentScan: scanStatus.currentScan
      });
    }

    // Generate unique scan ID
    const scanId = `discovery_${Date.now()}_${userId}`;
    
    // Initialize scan with Socket.IO
    const io = getIO();
    
    // Send initial response
    res.json({
      message: 'Asset discovery started',
      scanId,
      estimatedTime: 'Scanning in progress...'
    });

    // Send initial status to all clients
    io.emit('discovery:started', {
      scanId,
      networkRange,
      message: 'Starting network scan...',
      timestamp: new Date()
    });

    // Start discovery in background
    assetDiscoveryService.discoverNetworkRange(networkRange, {
      ports: ports || '22,23,53,80,135,139,443,445,993,995,1723,3389,5900',
      timeout: timeout || 5000,
      maxConcurrent: maxConcurrent || 50,
      scanId,
      userId
    }).then(async (result) => {
      try {
        // Send completion event
        io.emit('discovery:completed', {
          scanId,
          result,
          timestamp: new Date()
        });

        // Auto-import if requested
        if (autoImport && result.success && result.assets.length > 0) {
          io.emit('discovery:importing', {
            scanId,
            message: 'Importing discovered assets...',
            assetCount: result.assets.length
          });

          const importResults = await assetDiscoveryService.importDiscoveredAssets(result.assets, {
            autoCreate: true,
            updateExisting: true
          });

          io.emit('discovery:imported', {
            scanId,
            importResults,
            timestamp: new Date()
          });
        }

        discoveryLogger.info('Discovery process completed successfully', {
          details: { scanId, userId, result }
        });

      } catch (error) {
        discoveryLogger.error('Discovery completion failed', {
          details: { scanId, error: error.message }
        });
        
        io.emit('discovery:error', {
          scanId,
          error: error.message,
          timestamp: new Date()
        });
      }
    }).catch(error => {
      discoveryLogger.error('Discovery process failed', {
        details: { error: error.message, userId: req.user.id }
      });
      
      io.emit('discovery:error', {
        scanId,
        error: error.message,
        timestamp: new Date()
      });
    });

    // Monitor progress and send updates
    const progressInterval = setInterval(() => {
      const status = assetDiscoveryService.getScanStatus();
      
      if (status.currentScan && status.currentScan.progress !== undefined) {
        io.emit('discovery:progress', {
          scanId,
          progress: status.currentScan.progress,
          message: `Scanning... ${status.currentScan.progress}% complete`,
          timestamp: new Date()
        });
      }

      if (!status.isScanning) {
        clearInterval(progressInterval);
      }
    }, 2000);

  } catch (error) {
    discoveryLogger.error('Failed to start discovery', {
      details: { error: error.message, userId: req.user.id }
    });
    
    res.status(500).json({ 
      message: 'Failed to start asset discovery',
      error: error.message 
    });
  }
};

// Get discovery status
exports.getDiscoveryStatus = async (req, res) => {
  try {
    const status = assetDiscoveryService.getScanStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date()
    });

  } catch (error) {
    discoveryLogger.error('Failed to get discovery status', {
      details: { error: error.message }
    });
    
    res.status(500).json({ 
      message: 'Failed to get discovery status',
      error: error.message 
    });
  }
};

// Cancel discovery
exports.cancelDiscovery = async (req, res) => {
  try {
    const cancelled = assetDiscoveryService.cancelScan();
    
    if (cancelled) {
      const io = getIO();
      
      io.emit('discovery:cancelled', {
        message: 'Discovery scan cancelled',
        timestamp: new Date()
      });

      discoveryLogger.info('Discovery scan cancelled', {
        details: { userId: req.user.id }
      });
      
      res.json({ message: 'Discovery scan cancelled successfully' });
    } else {
      res.status(400).json({ message: 'No active discovery scan to cancel' });
    }

  } catch (error) {
    discoveryLogger.error('Failed to cancel discovery', {
      details: { error: error.message }
    });
    
    res.status(500).json({ 
      message: 'Failed to cancel discovery',
      error: error.message 
    });
  }
};

// Get discovery history
exports.getDiscoveryHistory = async (req, res) => {
  try {
    // This would typically query a database for past discovery results
    // For now, return current scan status
    const status = assetDiscoveryService.getScanStatus();
    
    res.json({
      history: [],
      currentScan: status.currentScan,
      timestamp: new Date()
    });

  } catch (error) {
    discoveryLogger.error('Failed to get discovery history', {
      details: { error: error.message }
    });
    
    res.status(500).json({ 
      message: 'Failed to get discovery history',
      error: error.message 
    });
  }
};

// Import discovered assets
exports.importDiscoveredAssets = async (req, res) => {
  try {
    const { assets, options = {} } = req.body;
    
    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({
        message: 'Assets array is required',
        details: 'Please provide an array of discovered assets'
      });
    }

    const importResults = await assetDiscoveryService.importDiscoveredAssets(assets, {
      autoCreate: options.autoCreate || true,
      updateExisting: options.updateExisting || true
    });
    
    res.json({
      message: 'Assets imported successfully',
      importResults
    });

  } catch (error) {
    discoveryLogger.error('Failed to import assets', {
      details: { error: error.message, userId: req.user.id }
    });
    
    res.status(500).json({ 
      message: 'Failed to import assets',
      error: error.message 
    });
  }
};

// Detect current network configuration
exports.detectNetwork = async (req, res) => {
  try {
    console.log('detectNetwork function called');
    const networkConfig = await networkDetectionService.detectNetworkConfiguration();
    console.log('Network config result:', networkConfig);
    
    if (!networkConfig) {
      return res.status(500).json({
        message: 'Failed to detect network configuration',
        error: 'Network detection service unavailable'
      });
    }

    res.json({
      success: true,
      data: networkConfig,
      recommendations: networkConfig.recommendedRanges,
      commonRanges: networkDetectionService.getCommonNetworkRanges()
    });

  } catch (error) {
    discoveryLogger.error('Failed to detect network', {
      details: { error: error.message }
    });
    
    res.status(500).json({ 
      message: 'Failed to detect network configuration',
      error: error.message 
    });
  }
};

// Validate network range
exports.validateNetworkRange = async (req, res) => {
  try {
    const { networkRange } = req.params;

    if (!networkRange) {
      return res.status(400).json({
        message: 'Network range is required',
        example: '192.168.1.0/24'
      });
    }

    const validation = await networkDetectionService.validateNetworkRange(networkRange);
    
    res.json({
      success: true,
      validation
    });

  } catch (error) {
    discoveryLogger.error('Failed to validate network range', {
      details: { error: error.message, networkRange: req.params.networkRange }
    });
    
    res.status(500).json({ 
      message: 'Failed to validate network range',
      error: error.message 
    });
  }
};

// Get common network ranges
exports.getCommonRanges = async (req, res) => {
  try {
    const commonRanges = networkDetectionService.getCommonNetworkRanges();
    
    res.json({
      success: true,
      commonRanges
    });

  } catch (error) {
    discoveryLogger.error('Failed to get common ranges', {
      details: { error: error.message }
    });
    
    res.status(500).json({ 
      message: 'Failed to get common network ranges',
      error: error.message 
    });
  }
};
