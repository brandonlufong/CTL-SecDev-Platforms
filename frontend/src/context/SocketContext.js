// Updated SocketContext.js with proper scan completion handling

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import config from '../config';
import { AuthContext } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { token } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [scanProgress, setScanProgress] = useState({
    active: false,
    percent: 0,
    message: '',
    details: null
  });
  
  // Callback refs for external handlers
  const onScanCompleteRef = useRef(null);
  const onScanErrorRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    console.log('Initializing socket connection...');
    socketRef.current = io(config.API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      socket.emit('getScanStatus');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    socket.on('scanProgress', (data) => {
      console.log('📊 Scan progress update:', data);
      setScanProgress({
        active: data.active !== false,
        percent: data.percent || 0,
        message: data.message || '',
        details: data.details || null
      });
    });

    socket.on('scanCompleted', (data) => {
      console.log('✅ Scan completed:', data);
      setScanProgress({
        active: false,
        percent: 100,
        message: data.message || 'Scan completed successfully',
        details: data.details || null
      });
      
      // Call external completion handler if registered
      if (onScanCompleteRef.current) {
        onScanCompleteRef.current(data);
      }
    });

    socket.on('scanError', (data) => {
      console.error('❌ Scan error:', data);
      setScanProgress({
        active: false,
        percent: 0,
        message: data.message || 'Scan failed',
        details: null
      });
      
      // Call external error handler if registered
      if (onScanErrorRef.current) {
        onScanErrorRef.current(data);
      }
    });

    return () => {
      if (socket) {
        console.log('Cleaning up socket connection');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('scanProgress');
        socket.off('scanCompleted');
        socket.off('scanError');
        socket.disconnect();
      }
    };
  }, [token]);

  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, [isConnected]);

  const requestScanStatus = useCallback(() => {
    emit('getScanStatus');
  }, [emit]);

  const resetScanProgress = useCallback(() => {
    setScanProgress({
      active: false,
      percent: 0,
      message: '',
      details: null
    });
  }, []);

  // Register handlers for scan completion/error
  const onScanComplete = useCallback((handler) => {
    onScanCompleteRef.current = handler;
  }, []);

  const onScanError = useCallback((handler) => {
    onScanErrorRef.current = handler;
  }, []);

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        scanProgress,
        emit,
        requestScanStatus,
        resetScanProgress,
        onScanComplete,
        onScanError,
        socket: socketRef.current
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};