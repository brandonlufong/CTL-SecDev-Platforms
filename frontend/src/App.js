import React from 'react';
import './styles/layout.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import GlobalScanProgress from './components/GlobalScanProgress';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Vulnerabilities from './pages/Vulnerabilities';
import Servers from './pages/Servers';
import Devices from './pages/Devices';
import Admin from './pages/Admin';
import Analytics from './pages/Analytics';
import MainLayout from './components/MainLayout';
import AuthLayout from './components/AuthLayout';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import SystemSettings from './pages/SystemSettings';
import AccessControl from './pages/AccessControl';
import SystemLogs from './pages/SystemLogs';
import AssetInventory from './pages/AssetInventory';
import { useSocket } from './context/SocketContext';
import ScanResultsModal from './components/ScanResultsModal';
import PrivateRoute from './components/PrivateRoute';
import { ScanProvider } from './context/ScanContext';
import GlobalNotifications from './components/GlobalNotifications';
import GlobalScanResultModal from './components/GlobalScanResultModal';
import GlobalScanOptionsModal from './components/GlobalScanOptionsModal';
import ScanHistorySidebar from './components/ScanHistorySidebar';
import { AuthProvider } from './context/AuthContext';

const GlobalUI = () => {
  const socketContext = useSocket();
  
  // Add safety check for undefined context values
  const scanResultsModal = socketContext?.scanResultsModal || { show: false, scanResults: null, assetName: '', scanSummary: null };
  const hideScanResults = socketContext?.hideScanResults || (() => {});

  return (
    <>
      <GlobalScanProgress />
      <ScanResultsModal
        show={scanResultsModal.show}
        onHide={hideScanResults}
        scanResults={scanResultsModal.scanResults}
      />
    </>
  );
};


const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <ScanProvider>
            <Routes>
              {/* Auth routes without MainLayout */}
              <Route path="/login" element={
                <AuthLayout>
                  <Login />
                </AuthLayout>
              } />
              <Route path="/signup" element={
                <AuthLayout>
                  <Signup />
                </AuthLayout>
              } />
              <Route path="/register" element={
                <AuthLayout>
                  <Register />
                </AuthLayout>
              } />
              
              {/* Protected routes with MainLayout */}
              <Route path="/*" element={
                <MainLayout>
                  <GlobalUI />
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <PrivateRoute>
                          <Dashboard />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/vulnerabilities/*"
                      element={
                        <PrivateRoute>
                          <Vulnerabilities />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/servers/*"
                      element={
                        <PrivateRoute>
                          <Servers />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/devices/*"
                      element={
                        <PrivateRoute>
                          <Devices />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <PrivateRoute>
                          <Profile />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <PrivateRoute>
                          <Admin />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <PrivateRoute>
                          <Settings />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/system-settings"
                      element={
                        <PrivateRoute>
                          <SystemSettings />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/access-control"
                      element={
                        <PrivateRoute>
                          <AccessControl />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/system-logs"
                      element={
                        <PrivateRoute>
                          <SystemLogs />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <PrivateRoute>
                          <Analytics />
                        </PrivateRoute>
                      }
                    />
                    <Route
                      path="/asset-inventory"
                      element={
                        <PrivateRoute>
                          <AssetInventory />
                        </PrivateRoute>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </MainLayout>
              } />
            </Routes>
            <GlobalScanProgress />
            <GlobalNotifications />
            <GlobalScanResultModal />
            <GlobalScanOptionsModal />
            <ScanHistorySidebar />
          </ScanProvider>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;