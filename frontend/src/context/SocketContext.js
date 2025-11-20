import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const [scanResultsModal, setScanResultsModal] = useState({
    show: false,
    assetName: '',
    scanResults: [],
    scanSummary: {},
  });

  useEffect(() => {
    if (!token) {
      // Disconnect socket if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Initialize socket connection
    console.log('Initializing socket connection...');
    socketRef.current = io(config.API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // Connection handlers
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      // Request current scan status on connect/reconnect
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

    // Scan progress handler
    socket.on('scanProgress', (data) => {
      console.log('📊 Scan progress update:', data);
      setScanProgress({
        active: data.active !== false,
        percent: data.percent || 0,
        message: data.message || '',
        details: data.details || null
      });
    });

    // Additional event handlers
    socket.on('scanCompleted', (data) => {
      console.log('✅ Scan completed:', data);
      setScanProgress({
        active: false,
        percent: 100,
        message: data.message || 'Scan completed successfully',
        details: data.details || null
      });
      // Optionally request latest scans via REST to populate modal when desired
    });

    socket.on('scanError', (data) => {
      console.error('❌ Scan error:', data);
      setScanProgress({
        active: false,
        percent: 0,
        message: data.message || 'Scan failed',
        details: null
      });
    });

    // Cleanup
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

  const emit = (event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  };

  const requestScanStatus = () => {
    emit('getScanStatus');
  };

  const resetScanProgress = () => {
    setScanProgress({
      active: false,
      percent: 0,
      message: '',
      details: null
    });
  };

  // Global control for showing/hiding scan results modal
  const showScanResults = ({ assetName, scanResults, scanSummary }) => {
    setScanResultsModal({ show: true, assetName, scanResults, scanSummary });
  };
  const hideScanResults = () => {
    setScanResultsModal({ show: false, assetName: '', scanResults: [], scanSummary: {} });
  };

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        scanProgress,
        emit,
        requestScanStatus,
        resetScanProgress,
        socket: socketRef.current,
        scanResultsModal,
        showScanResults,
        hideScanResults
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};