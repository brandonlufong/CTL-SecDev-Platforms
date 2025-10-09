// // Simple in-memory object to track scan state per user/session
// const scanProgress = {
//   active: false,
//   percent: 0,
//   message: '',
// };

// module.exports = {
//   setProgress: (value, msg) => {
//     scanProgress.percent = value;
//     scanProgress.message = msg;
//     scanProgress.active = true;
//   },
//   complete: () => {
//     scanProgress.percent = 100;
//     scanProgress.message = 'Scan complete';
//     scanProgress.active = false;
//   },
//   getProgress: () => scanProgress,
//   reset: () => {
//     scanProgress.percent = 0;
//     scanProgress.message = '';
//     scanProgress.active = false;
//   },
// };
// scanProgress.js

// backend/services/scanProgress.js

let ioInstance = null;

// Track multiple scan sessions (if needed for multi-user support)
const scanProgress = {
  active: false,
  percent: 0,
  message: '',
  currentAsset: null,
  totalAssets: 0,
  completedAssets: 0,
  startTime: null,
  details: null,
};

module.exports = {
  // Initialize Socket.IO instance once from your main server setup
  init: (io) => {
    ioInstance = io;
    console.log('Socket.IO initialized for scan progress tracking');
  },

  // Get the io instance for direct use
  getIO: () => ioInstance,

  setProgress: (value, msg, additionalData = {}) => {
    scanProgress.percent = Math.min(100, Math.max(0, value));
    scanProgress.message = msg;
    scanProgress.active = true;

    // Merge additional data (top-level for backward compatibility)
    Object.assign(scanProgress, additionalData);

    // Also keep a nested details object for richer UIs
    scanProgress.details = {
      ...(scanProgress.details || {}),
      ...additionalData,
    };

    // Broadcast progress via WebSocket if ioInstance exists
    if (ioInstance) {
      ioInstance.emit('scanProgress', { ...scanProgress });
      console.log(`Progress: ${scanProgress.percent}% - ${msg}`);
    }
  },

  complete: (message = 'Scan complete') => {
    scanProgress.percent = 100;
    scanProgress.message = message;
    scanProgress.active = false;

    if (ioInstance) {
      ioInstance.emit('scanProgress', { ...scanProgress });
      ioInstance.emit('scanCompleted', { 
        message,
        completedAt: new Date(),
        totalAssets: scanProgress.totalAssets,
        completedAssets: scanProgress.completedAssets
      });
    }
  },

  getProgress: () => ({ ...scanProgress }),

  reset: () => {
    scanProgress.percent = 0;
    scanProgress.message = '';
    scanProgress.active = false;
    scanProgress.currentAsset = null;
    scanProgress.totalAssets = 0;
    scanProgress.completedAssets = 0;
    scanProgress.startTime = null;

    if (ioInstance) {
      ioInstance.emit('scanProgress', { ...scanProgress });
    }
  },

  // Start a new scan session
  startScan: (totalAssets = 1, message = 'Starting scan...') => {
    scanProgress.active = true;
    scanProgress.percent = 0;
    scanProgress.message = message;
    scanProgress.totalAssets = totalAssets;
    scanProgress.completedAssets = 0;
    scanProgress.startTime = new Date();
    scanProgress.details = { totalAssets, completedAssets: 0 };

    if (ioInstance) {
      ioInstance.emit('scanProgress', { ...scanProgress });
    }
  },

  // Update progress for batch scans
  updateBatchProgress: (completedAssets, currentAsset = null) => {
    scanProgress.completedAssets = completedAssets;
    scanProgress.currentAsset = currentAsset;
    
    if (scanProgress.totalAssets > 0) {
      scanProgress.percent = Math.floor((completedAssets / scanProgress.totalAssets) * 100);
    }

    scanProgress.message = currentAsset 
      ? `Scanning ${currentAsset} (${completedAssets}/${scanProgress.totalAssets})`
      : `Progress: ${completedAssets}/${scanProgress.totalAssets} assets scanned`;

    scanProgress.details = {
      ...(scanProgress.details || {}),
      currentAsset,
      completedAssets,
      totalAssets: scanProgress.totalAssets,
    };

    if (ioInstance) {
      ioInstance.emit('scanProgress', { ...scanProgress });
    }
  },

  // Error handling
  setError: (errorMessage) => {
    scanProgress.active = false;
    scanProgress.message = errorMessage;
    scanProgress.details = {
      ...(scanProgress.details || {}),
      error: errorMessage,
    };

    if (ioInstance) {
      ioInstance.emit('scanError', { 
        message: errorMessage,
        occurredAt: new Date()
      });
      ioInstance.emit('scanProgress', { ...scanProgress });
    }
  }
};
