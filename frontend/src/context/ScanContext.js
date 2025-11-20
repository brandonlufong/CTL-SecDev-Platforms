import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { useSocket } from './SocketContext';
import config from '../config';

const ScanContext = createContext();

export const useScan = () => {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error('useScan must be used within ScanProvider');
  }
  return context;
};

export const ScanProvider = ({ children }) => {
  const { token } = useContext(AuthContext);
  const { emit, scanProgress } = useSocket();

  // Scan Results State
  const [scanResults, setScanResults] = useState([]);
  const [latestScanResults, setLatestScanResults] = useState(null);
  const [scannedTargetInfo, setScannedTargetInfo] = useState(null);
  
  // Modal States
  const [showScanResultModal, setShowScanResultModal] = useState(false);
  const [showScanOptionsModal, setShowScanOptionsModal] = useState(false);
  
  // Scanning States
  const [scanningTargetId, setScanningTargetId] = useState(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [selectedTargetForScan, setSelectedTargetForScan] = useState(null);
  const [selectedScanType, setSelectedScanType] = useState('quick');
  
  // Notifications/Alerts
  const [notifications, setNotifications] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);

  // Load scan history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('scanHistory');
    if (savedHistory) {
      try {
        setScanHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to load scan history', err);
      }
    }
  }, []);

  // Save scan history to localStorage
  useEffect(() => {
    if (scanHistory.length > 0) {
      localStorage.setItem('scanHistory', JSON.stringify(scanHistory));
    }
  }, [scanHistory]);

  // Monitor socket scan completion
  useEffect(() => {
    if (!scanProgress.active && scanProgress.percent === 100 && scanProgress.message) {
      // Scan completed via socket
      console.log('Scan completed detected via socket:', scanProgress);
      
      // Reset scanning states
      setScanningTargetId(null);
      setScanningAll(false);
      
      // Show completion notification if we were scanning
      if (scanningAll || scanningTargetId) {
        const details = scanProgress.details;
        if (details && (details.scannedTargets || details.scannedAssets)) {
          addNotification(
            'success',
            `Scan completed! Scanned ${details.scannedTargets || details.scannedAssets || 0} targets and found ${details.totalVulnerabilities || 0} vulnerabilities.`,
            10000
          );
          
          // Add to history if batch scan
          if ((details.scannedTargets > 1 || details.scannedAssets > 1) && scanningAll) {
            setScanHistory(prev => [{
              id: Date.now(),
              target: { name: 'All Targets', targetType: 'batch' },
              scanType: 'quick',
              timestamp: new Date(),
              resultCount: details.totalTargets || details.totalAssets || 0,
              vulnerabilityCount: details.totalVulnerabilities || 0
            }, ...prev].slice(0, 50));
          }
        }
      }
    }
  }, [scanProgress, scanningAll, scanningTargetId]);

  // Add notification
  const addNotification = useCallback((type, message, duration = 5000) => {
    const id = Date.now();
    const notification = { id, type, message, timestamp: new Date() };
    
    setNotifications(prev => [...prev, notification]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
    
    return id;
  }, []);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Start Single Target Scan
  const startScan = useCallback(async (target, scanType = 'quick') => {
    const _id = target._id;
    const name = target.name;
    const targetType = target.targetType || (target.type === 'Network Device' ? 'device' : 'asset');
    
    console.log('Starting scan for:', { _id, name, targetType });
    
    setScanningTargetId(_id);
    
    try {
      const endpoint = targetType === 'device' ? 'device' : 'asset';
      const bodyKey = targetType === 'device' ? 'deviceId' : 'assetId';
      
      const res = await fetch(`${config.API_BASE_URL}/api/scan/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          [bodyKey]: _id, 
          scanType 
        }),
      });

      const data = await res.json();

      if (data.success) {
        const formattedResults = (data.scanResults || []).map(result => ({
          ...result,
          vulnerabilities: Array.isArray(result.vulnerabilities) ? 
            result.vulnerabilities.map(vuln => {
              if (typeof vuln === 'string') return vuln;
              if (typeof vuln === 'object' && vuln !== null) {
                return {
                  ...vuln,
                  title: String(vuln.title || vuln.cve || vuln.name || 'Unknown'),
                  severity: String(vuln.severity || 'Unknown'),
                  cve: String(vuln.cve || ''),
                  cvssScore: vuln.cvssScore ? Number(vuln.cvssScore) : 0
                };
              }
              return 'Unknown Vulnerability';
            }) : []
        }));
        
        setScanResults(formattedResults);
        setLatestScanResults({
          results: formattedResults,
          target: { _id, name, targetType },
          scanType,
          timestamp: new Date(),
          summary: data.scanSummary
        });
        setScannedTargetInfo({ _id, name, targetType });
        
        setShowScanResultModal(true);
        
        setScanHistory(prev => [{
          id: Date.now(),
          target: { _id, name, targetType },
          scanType,
          timestamp: new Date(),
          resultCount: formattedResults.length,
          vulnerabilityCount: data.newVulnerabilities || 0
        }, ...prev].slice(0, 50));
        
        addNotification(
          'success', 
          `${scanType.charAt(0).toUpperCase() + scanType.slice(1)} scan completed for ${name}. Found ${data.newVulnerabilities || 0} vulnerabilities.`
        );
        
        return { success: true, data };
      } else {
        addNotification('error', data.message || 'Scan failed');
        return { success: false, error: data.message };
      }
    } catch (err) {
      console.error('Scan failed', err);
      addNotification('error', 'Scan failed due to server error');
      return { success: false, error: err.message };
    } finally {
      setScanningTargetId(null);
    }
  }, [token, addNotification]);

  // Start Quick Scan All - FIXED VERSION
  const scanAllTargets = useCallback(async () => {
    setScanningAll(true);
    
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/quick`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
      });

      const data = await res.json();

      if (data.success) {
        if (data.status === 'started') {
          // Async scan started - socket will handle completion
          addNotification(
            'info',
            `Quick scan started for ${data.summary?.totalTargets || 'all'} targets. Watch the progress indicator.`,
            5000
          );
          // Don't set setScanningAll(false) here - let socket completion handle it
        } else if (data.status === 'completed') {
          // Synchronous completion (unlikely for batch scans)
          addNotification(
            'success',
            `Quick scan completed! Scanned ${data.summary.scannedTargets || data.summary.scannedAssets} targets and found ${data.summary.totalVulnerabilities} vulnerabilities.`,
            10000
          );
          
          setScanHistory(prev => [{
            id: Date.now(),
            target: { name: 'All Targets', targetType: 'batch' },
            scanType: 'quick',
            timestamp: new Date(),
            resultCount: data.summary.totalTargets || data.summary.totalAssets,
            vulnerabilityCount: data.summary.totalVulnerabilities
          }, ...prev].slice(0, 50));
          
          setScanningAll(false);
        }
      } else {
        addNotification('error', data.message || 'Quick scan failed');
        setScanningAll(false);
      }
    } catch (err) {
      console.error('Quick scan failed', err);
      addNotification('error', `Quick scan failed: ${err.message}`);
      setScanningAll(false);
    }
  }, [token, addNotification]);

  // Batch Scan
  const batchScan = useCallback(async (targetIds, scanType = 'quick') => {
    if (targetIds.length === 0) {
      addNotification('error', 'Please select targets to scan');
      return { success: false };
    }

    setScanningAll(true);
    
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assetIds: targetIds, scanType }),
      });

      const data = await res.json();

      if (data.success) {
        addNotification(
          'success',
          `Batch scan completed! Successfully scanned ${data.summary.successfulScans} targets.`
        );
        
        if (data.summary.failedScans > 0) {
          addNotification('warning', `${data.summary.failedScans} targets failed to scan.`);
        }
        
        return { success: true, data };
      } else {
        addNotification('error', data.message || 'Batch scan failed');
        return { success: false, error: data.message };
      }
    } catch (err) {
      console.error('Batch scan failed', err);
      addNotification('error', 'Batch scan failed due to server error');
      return { success: false, error: err.message };
    } finally {
      setScanningAll(false);
    }
  }, [token, addNotification]);

  // Test Connectivity
//   const testConnectivity = useCallback(async (target) => {
//     const { _id, targetType = 'asset' } = target;
    
//     try {
//       console.log(`Testing connectivity for ${target.name} (${_id})...`);
      
//       const res = await fetch(`${config.API_BASE_URL}/api/scan/test/${_id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();

//       console.log('Connectivity test response:', data);

//       if (data.success) {
//         const result = { 
//           success: true, 
//           reachable: data.reachable,
//           method: data.method,
//           testedAt: data.testedAt 
//         };
        
//         // Show notification
//         if (data.reachable) {
//           addNotification('success', `${target.name} is reachable via ${data.method}`, 3000);
//         } else {
//           addNotification('warning', `${target.name} is not reachable`, 3000);
//         }
        
//         return result;
//       }
//       return { success: false, reachable: false };
//     } catch (err) {
//       console.error('Connectivity test failed', err);
//       addNotification('error', `Connectivity test failed for ${target.name}: ${err.message}`);
//       return { success: false, reachable: false, error: err.message };
//     }
//   }, [token, addNotification]);

  // Show scan options
  const showScanOptions = useCallback((target) => {
    setSelectedTargetForScan(target);
    setShowScanOptionsModal(true);
  }, []);

  // Execute scan from options modal
  const executeScanFromModal = useCallback(() => {
    if (selectedTargetForScan) {
      startScan(selectedTargetForScan, selectedScanType);
      setShowScanOptionsModal(false);
    }
  }, [selectedTargetForScan, selectedScanType, startScan]);

  // Close modals
  const closeScanResultModal = useCallback(() => {
    setShowScanResultModal(false);
  }, []);

  const closeScanOptionsModal = useCallback(() => {
    setShowScanOptionsModal(false);
  }, []);

  // Clear scan results
  const clearScanResults = useCallback(() => {
    setScanResults([]);
    setLatestScanResults(null);
    setScannedTargetInfo(null);
  }, []);

  // Get scan history for specific target
  const getTargetScanHistory = useCallback((targetId) => {
    return scanHistory.filter(scan => scan.target._id === targetId);
  }, [scanHistory]);

  const value = {
    // State
    scanResults,
    latestScanResults,
    scannedTargetInfo,
    showScanResultModal,
    showScanOptionsModal,
    scanningTargetId,
    scanningAll,
    selectedTargetForScan,
    selectedScanType,
    notifications,
    scanHistory,
    
    // Setters
    setSelectedScanType,
    
    // Actions
    startScan,
    scanAllTargets,
    batchScan,
    // testConnectivity,
    showScanOptions,
    executeScanFromModal,
    closeScanResultModal,
    closeScanOptionsModal,
    clearScanResults,
    addNotification,
    removeNotification,
    getTargetScanHistory,
  };

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
};