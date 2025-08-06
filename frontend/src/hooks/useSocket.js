import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import config from '../config';

/**
 * Custom hook for Socket.io integration
 * Handles real-time scan progress updates and other real-time events
 */
const useSocket = (token) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [scanProgress, setScanProgress] = useState({ percent: 0, message: '', active: false });
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    socketRef.current = io(config.API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Scan progress event handler
    socket.on('scanProgress', (data) => {
      console.log('Scan progress update:', data);
      setScanProgress({
        percent: data.percent || 0,
        message: data.message || '',
        active: data.active || false,
      });
      setLastUpdate(new Date());
    });

    // Scan completed event handler
    socket.on('scanCompleted', (data) => {
      console.log('Scan completed:', data);
      setScanProgress({
        percent: 100,
        message: data.message || 'Scan completed',
        active: false,
      });
      setLastUpdate(new Date());
    });

    // Scan error event handler
    socket.on('scanError', (data) => {
      console.error('Scan error:', data);
      setScanProgress({
        percent: 0,
        message: data.message || 'Scan failed',
        active: false,
      });
      setLastUpdate(new Date());
    });

    // Vulnerability found event handler
    socket.on('vulnerabilityFound', (data) => {
      console.log('Vulnerability found:', data);
      // This could trigger notifications or updates to vulnerability lists
    });

    // Asset status update event handler
    socket.on('assetStatusUpdate', (data) => {
      console.log('Asset status update:', data);
      // This could trigger asset list refreshes
    });

    // Cleanup function
    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('scanProgress');
        socket.off('scanCompleted');
        socket.off('scanError');
        socket.off('vulnerabilityFound');
        socket.off('assetStatusUpdate');
        socket.disconnect();
      }
    };
  }, [token]);

  // Method to emit events
  const emit = (event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  };

  // Method to join a room (e.g., for asset-specific updates)
  const joinRoom = (room) => {
    emit('join', { room });
  };

  // Method to leave a room
  const leaveRoom = (room) => {
    emit('leave', { room });
  };

  // Method to request scan status
  const requestScanStatus = () => {
    emit('getScanStatus');
  };

  // Method to reset scan progress
  const resetScanProgress = () => {
    setScanProgress({ percent: 0, message: '', active: false });
  };

  return {
    isConnected,
    scanProgress,
    lastUpdate,
    emit,
    joinRoom,
    leaveRoom,
    requestScanStatus,
    resetScanProgress,
  };
};

export default useSocket;