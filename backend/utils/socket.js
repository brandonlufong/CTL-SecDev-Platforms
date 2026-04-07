let io = null;

// Initialize Socket.IO instance
const initSocket = (socketIO) => {
  io = socketIO;
  return io;
};

// Get Socket.IO instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket first.');
  }
  return io;
};

// Join user to their discovery room
const joinDiscoveryRoom = (socket, userId) => {
  const room = `discovery_${userId}`;
  socket.join(room);
  console.log(`User ${userId} joined discovery room: ${room}`);
  return room;
};

// Leave discovery room
const leaveDiscoveryRoom = (socket, userId) => {
  const room = `discovery_${userId}`;
  socket.leave(room);
  console.log(`User ${userId} left discovery room: ${room}`);
};

// Send discovery update to specific user
const sendDiscoveryUpdate = (userId, event, data) => {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot send discovery update');
    return false;
  }
  
  const room = `discovery_${userId}`;
  io.to(room).emit(event, data);
  return true;
};

// Broadcast discovery event to all connected clients
const broadcastDiscoveryEvent = (event, data) => {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot broadcast discovery event');
    return false;
  }
  
  io.emit(event, data);
  return true;
};

module.exports = {
  initSocket,
  getIO,
  joinDiscoveryRoom,
  leaveDiscoveryRoom,
  sendDiscoveryUpdate,
  broadcastDiscoveryEvent
};
