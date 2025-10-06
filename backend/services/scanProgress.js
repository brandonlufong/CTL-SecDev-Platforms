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

// let ioInstance = null;

// // Track multiple scan sessions (if needed for multi-user support)
// const scanProgress = {
//   active: false,
//   percent: 0,
//   message: '',
//   currentAsset: null,
//   totalAssets: 0,
//   completedAssets: 0,
//   startTime: null,
// };

// module.exports = {
//   // Initialize Socket.IO instance once from your main server setup
//   init: (io) => {
//     ioInstance = io;
//     console.log('Socket.IO initialized for scan progress tracking');
//   },

//   // Get the io instance for direct use
//   getIO: () => ioInstance,

//   setProgress: (value, msg, additionalData = {}) => {
//     scanProgress.percent = Math.min(100, Math.max(0, value));
//     scanProgress.message = msg;
//     scanProgress.active = true;

//     // Merge additional data
//     Object.assign(scanProgress, additionalData);

//     // Broadcast progress via WebSocket if ioInstance exists
//     if (ioInstance) {
//       ioInstance.emit('scanProgress', { ...scanProgress });
//       console.log(`Progress: ${scanProgress.percent}% - ${msg}`);
//     }
//   },

//   complete: (message = 'Scan complete') => {
//     scanProgress.percent = 100;
//     scanProgress.message = message;
//     scanProgress.active = false;

//     if (ioInstance) {
//       ioInstance.emit('scanProgress', { ...scanProgress });
//       ioInstance.emit('scanCompleted', { 
//         message,
//         completedAt: new Date(),
//         totalAssets: scanProgress.totalAssets,
//         completedAssets: scanProgress.completedAssets
//       });
//     }
//   },

//   getProgress: () => ({ ...scanProgress }),

//   reset: () => {
//     scanProgress.percent = 0;
//     scanProgress.message = '';
//     scanProgress.active = false;
//     scanProgress.currentAsset = null;
//     scanProgress.totalAssets = 0;
//     scanProgress.completedAssets = 0;
//     scanProgress.startTime = null;

//     if (ioInstance) {
//       ioInstance.emit('scanProgress', { ...scanProgress });
//     }
//   },

//   // Start a new scan session
//   startScan: (totalAssets = 1, message = 'Starting scan...') => {
//     scanProgress.active = true;
//     scanProgress.percent = 0;
//     scanProgress.message = message;
//     scanProgress.totalAssets = totalAssets;
//     scanProgress.completedAssets = 0;
//     scanProgress.startTime = new Date();

//     if (ioInstance) {
//       ioInstance.emit('scanProgress', { ...scanProgress });
//     }
//   },

//   // Update progress for batch scans
//   updateBatchProgress: (completedAssets, currentAsset = null) => {
//     scanProgress.completedAssets = completedAssets;
//     scanProgress.currentAsset = currentAsset;
    
//     if (scanProgress.totalAssets > 0) {
//       scanProgress.percent = Math.floor((completedAssets / scanProgress.totalAssets) * 100);
//     }

//     scanProgress.message = currentAsset 
//       ? `Scanning ${currentAsset} (${completedAssets}/${scanProgress.totalAssets})`
//       : `Progress: ${completedAssets}/${scanProgress.totalAssets} assets scanned`;

//     if (ioInstance) {
//       ioInstance.emit('scanProgress', { ...scanProgress });
//     }
//   },

//   // Error handling
//   setError: (errorMessage) => {
//     scanProgress.active = false;
//     scanProgress.message = errorMessage;

//     if (ioInstance) {
//       ioInstance.emit('scanError', { 
//         message: errorMessage,
//         occurredAt: new Date()
//       });
//       ioInstance.emit('scanProgress', { ...scanProgress });
//     }
//   }
// };

// backend/services/scanProgress.js

let io = null;
let currentProgress = {
  active: false,
  percent: 0,
  message: '',
  details: null
};

const progressTracker = {
  init(socketIO) {
    io = socketIO;
    console.log('Progress tracker initialized with Socket.IO');
  },

  reset() {
    currentProgress = {
      active: false,
      percent: 0,
      message: '',
      details: null
    };
    this.emit();
  },

  setProgress(percent, message, details = null) {
    currentProgress = {
      active: true,
      percent: Math.min(Math.max(percent, 0), 100),
      message: message || '',
      details: details
    };
    this.emit();
  },

  complete(message, summary = null) {
    currentProgress = {
      active: false,
      percent: 100,
      message: message || 'Scan completed successfully',
      details: summary
    };
    
    // Emit progress update
    this.emit();
    
    // Also emit specific completion event with summary
    if (io) {
      io.emit('scanCompleted', {
        message: message || 'Scan completed successfully',
        summary: summary,
        timestamp: new Date()
      });
      console.log('✅ Scan completed event emitted:', message);
    }
  },

  setError(message, details = null) {
    currentProgress = {
      active: false,
      percent: 0,
      message: message || 'Scan failed',
      details: details
    };
    
    // Emit progress update
    this.emit();
    
    // Also emit specific error event
    if (io) {
      io.emit('scanError', {
        message: message || 'Scan failed',
        details: details,
        timestamp: new Date()
      });
      console.error('❌ Scan error event emitted:', message);
    }
  },

  getProgress() {
    return { ...currentProgress };
  },

  emit() {
    if (io) {
      io.emit('scanProgress', { ...currentProgress });
      console.log(`📊 Progress: ${currentProgress.percent}% - ${currentProgress.message}`);
    } else {
      console.warn('Socket.IO not initialized, cannot emit progress');
    }
  },

  // Convenience methods
  startScan(totalItems, message) {
    this.setProgress(0, message, { totalItems });
  },

  updateBatchProgress(currentIndex, currentItem) {
    // This method can be used if you need batch-specific tracking
    const details = currentProgress.details || {};
    this.setProgress(
      currentProgress.percent,
      `Processing ${currentItem}...`,
      { ...details, currentIndex, currentItem }
    );
  }
};

module.exports = progressTracker;