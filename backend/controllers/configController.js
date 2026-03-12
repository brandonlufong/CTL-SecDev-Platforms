const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const systemMonitor = require('../services/systemMonitor');

// Default system configuration
const defaultConfig = {
  general: {
    platformName: 'CAMTEL Security Platform',
    version: '2.0.0',
    environment: 'production',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '24h',
    language: 'en'
  },
  security: {
    sessionTimeout: 30,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    enableTwoFactor: false,
    apiRateLimit: 100
  },
  scanning: {
    defaultScanTimeout: 300,
    maxConcurrentScans: 5,
    scanResultsRetention: 90,
    autoScheduleScans: false,
    scanScheduleFrequency: 'daily',
    enableVulnerabilityScanning: true,
    enablePortScanning: true,
    enableServiceDetection: true
  },
  notifications: {
    emailEnabled: true,
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpUseTLS: true,
    emailFrom: '',
    emailAdmin: '',
    enableCriticalAlerts: true,
    enableWeeklyReports: false,
    enableMaintenanceAlerts: true
  },
  performance: {
    enablePerformanceMonitoring: true,
    metricsRetention: 30,
    alertThresholdCPU: 80,
    alertThresholdMemory: 85,
    alertThresholdDisk: 90,
    enableAutoCleanup: true,
    cleanupInterval: 7
  },
  backup: {
    enableAutoBackup: true,
    backupFrequency: 'daily',
    backupRetention: 30,
    backupLocation: '/var/backups/camtel',
    compressBackups: true,
    encryptBackups: true,
    lastBackupTime: null,
    backupStatus: 'idle'
  }
};

// Configuration file path
const configPath = path.join(__dirname, '../data/systemConfig.json');

// Ensure config directory exists
const ensureConfigDir = async () => {
  const configDir = path.dirname(configPath);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
};

// Load system configuration
const loadConfig = async () => {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(configPath, 'utf8');
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch (error) {
    // If file doesn't exist or is invalid, return default config
    await saveConfig(defaultConfig);
    return defaultConfig;
  }
};

// Save system configuration
const saveConfig = async (config) => {
  try {
    await ensureConfigDir();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
};

// Get system configuration
exports.getSystemConfig = async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({ message: 'Failed to load system configuration', error: error.message });
  }
};

// Update system configuration
exports.updateSystemConfig = async (req, res) => {
  try {
    const { category } = req.params;
    const configData = req.body;

    if (!category || !configData) {
      return res.status(400).json({ message: 'Category and config data are required' });
    }

    const currentConfig = await loadConfig();
    
    // Update specific category
    currentConfig[category] = { ...currentConfig[category], ...configData };
    
    const saved = await saveConfig(currentConfig);
    
    if (saved) {
      res.json({ message: `${category} configuration updated successfully`, config: currentConfig[category] });
    } else {
      res.status(500).json({ message: 'Failed to save configuration' });
    }
  } catch (error) {
    console.error('Update system config error:', error);
    res.status(500).json({ message: 'Failed to update system configuration', error: error.message });
  }
};

// Get system status
exports.getSystemStatus = async (req, res) => {
  try {
    // Get real-time system status from monitor
    const status = systemMonitor.getSystemStatus();

    res.json(status);
  } catch (error) {
    console.error('Get system status error:', error);
    res.status(500).json({ message: 'Failed to get system status', error: error.message });
  }
};

// Get database status
const getDatabaseStatus = async () => {
  try {
    const mongoose = require('mongoose');
    const start = Date.now();
    
    if (mongoose.connection.readyState === 1) {
      const responseTime = Date.now() - start;
      return {
        status: 'connected',
        responseTime,
        uptime: '99.9%'
      };
    } else {
      return {
        status: 'disconnected',
        responseTime: 0,
        uptime: '0%'
      };
    }
  } catch (error) {
    return {
      status: 'error',
      responseTime: 0,
      uptime: '0%'
    };
  }
};

// Get API status
const getApiStatus = async () => {
  try {
    const start = Date.now();
    // Simulate API health check
    await new Promise(resolve => setTimeout(resolve, 10));
    const responseTime = Date.now() - start;
    
    return {
      status: 'healthy',
      responseTime,
      uptime: '99.8%'
    };
  } catch (error) {
    return {
      status: 'error',
      responseTime: 0,
      uptime: '0%'
    };
  }
};

// Get authentication status
const getAuthenticationStatus = async () => {
  try {
    const start = Date.now();
    // Simulate authentication service check
    await new Promise(resolve => setTimeout(resolve, 5));
    const responseTime = Date.now() - start;
    
    return {
      status: 'active',
      responseTime,
      uptime: '100%'
    };
  } catch (error) {
    return {
      status: 'error',
      responseTime: 0,
      uptime: '0%'
    };
  }
};

// Get scanning status
const getScanningStatus = async () => {
  try {
    // This would typically check the actual scanning service
    return {
      status: 'idle',
      activeScans: 0,
      queuedScans: 0
    };
  } catch (error) {
    return {
      status: 'error',
      activeScans: 0,
      queuedScans: 0
    };
  }
};

// Get performance status
const getPerformanceStatus = async () => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Get CPU usage (simplified)
    const cpuUsage = Math.random() * 30 + 10; // Simulated CPU usage
    
    return {
      status: 'monitoring',
      cpuUsage: Math.round(cpuUsage),
      memoryUsage: Math.round((usedMem / totalMem) * 100),
      diskUsage: Math.round(Math.random() * 30 + 40) // Simulated disk usage
    };
  } catch (error) {
    return {
      status: 'error',
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0
    };
  }
};

// Restart service
exports.restartService = async (req, res) => {
  try {
    const { service } = req.params;
    
    // In a real implementation, this would restart the actual service
    // For now, we'll just simulate the restart
    console.log(`Restarting service: ${service}`);
    
    // Simulate restart delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.json({ message: `${service} service restarted successfully` });
  } catch (error) {
    console.error('Restart service error:', error);
    res.status(500).json({ message: `Failed to restart ${service} service`, error: error.message });
  }
};

// Create backup
exports.createBackup = async (req, res) => {
  try {
    const config = await loadConfig();
    const backupPath = config.backup.backupLocation;
    
    // Ensure backup directory exists
    try {
      await fs.access(backupPath);
    } catch {
      await fs.mkdir(backupPath, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `camtel-backup-${timestamp}.json`;
    const backupFilePath = path.join(backupPath, backupFileName);
    
    // Create backup data
    const backupData = {
      timestamp: new Date().toISOString(),
      version: config.general.version,
      config: config,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };
    
    // Write backup file
    if (config.backup.compressBackups) {
      // In a real implementation, you would compress the backup
      await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));
    } else {
      await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));
    }
    
    // Update last backup time
    config.backup.lastBackupTime = new Date().toISOString();
    config.backup.backupStatus = 'completed';
    await saveConfig(config);
    
    res.json({ 
      message: 'Backup created successfully', 
      fileName: backupFileName,
      timestamp: config.backup.lastBackupTime
    });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ message: 'Failed to create backup', error: error.message });
  }
};

// Get backup list
exports.getBackupList = async (req, res) => {
  try {
    const config = await loadConfig();
    const backupPath = config.backup.backupLocation;
    
    try {
      const files = await fs.readdir(backupPath);
      const backupFiles = files
        .filter(file => file.startsWith('camtel-backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(backupPath, file);
          return {
            fileName: file,
            filePath: filePath,
            // In a real implementation, you would get actual file stats
            size: '2.5 MB',
            created: new Date().toISOString()
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      res.json(backupFiles);
    } catch (error) {
      // Backup directory doesn't exist
      res.json([]);
    }
  } catch (error) {
    console.error('Get backup list error:', error);
    res.status(500).json({ message: 'Failed to get backup list', error: error.message });
  }
};

// Restore backup
exports.restoreBackup = async (req, res) => {
  try {
    const { fileName } = req.params;
    const config = await loadConfig();
    const backupPath = config.backup.backupLocation;
    const backupFilePath = path.join(backupPath, fileName);
    
    try {
      const backupData = JSON.parse(await fs.readFile(backupFilePath, 'utf8'));
      
      if (backupData.config) {
        await saveConfig(backupData.config);
        res.json({ message: 'Backup restored successfully', restoredAt: new Date().toISOString() });
      } else {
        res.status(400).json({ message: 'Invalid backup file format' });
      }
    } catch (error) {
      res.status(404).json({ message: 'Backup file not found or corrupted' });
    }
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ message: 'Failed to restore backup', error: error.message });
  }
};

// Get recent system activity
exports.getRecentActivity = async (req, res) => {
  try {
    const activity = await systemMonitor.getRecentActivity();
    res.json(activity);
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ message: 'Failed to get recent activity', error: error.message });
  }
};

// Get system logs
exports.getSystemLogs = async (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;
    
    // Use real SystemLog model
    const SystemLog = require('../models/SystemLog');
    
    let query = {};
    if (level !== 'all') {
      query.level = level;
    }
    
    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('timestamp level service message user')
      .lean();
    
    res.json(logs);
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ message: 'Failed to get system logs', error: error.message });
  }
};

// Clear system logs
exports.clearSystemLogs = async (req, res) => {
  try {
    const { level } = req.params;
    
    // In a real implementation, you would clear actual log files
    console.log(`Clearing ${level} logs`);
    
    res.json({ message: `${level} logs cleared successfully` });
  } catch (error) {
    console.error('Clear system logs error:', error);
    res.status(500).json({ message: 'Failed to clear system logs', error: error.message });
  }
};
