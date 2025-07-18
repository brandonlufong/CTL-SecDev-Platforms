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

let ioInstance = null; // Will hold the Socket.IO server instance

// Simple in-memory object to track scan state per user/session
const scanProgress = {
  active: false,
  percent: 0,
  message: '',
};

module.exports = {
  // To initialize Socket.IO instance once from your main server setup
  init: (io) => {
    ioInstance = io;
  },

  setProgress: (value, msg) => {
    scanProgress.percent = value;
    scanProgress.message = msg;
    scanProgress.active = true;

    // Broadcast progress via WebSocket if ioInstance exists
    if (ioInstance) {
      ioInstance.emit('scanProgress', scanProgress);
    }
  },

  complete: () => {
    scanProgress.percent = 100;
    scanProgress.message = 'Scan complete';
    scanProgress.active = false;

    if (ioInstance) {
      ioInstance.emit('scanProgress', scanProgress);
    }
  },

  getProgress: () => scanProgress,

  reset: () => {
    scanProgress.percent = 0;
    scanProgress.message = '';
    scanProgress.active = false;

    if (ioInstance) {
      ioInstance.emit('scanProgress', scanProgress);
    }
  },
};
