import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext'; // Add this
import GlobalScanProgress from './components/GlobalScanProgress'; // Add this
import ScanResultsModal from './components/ScanResultsModal';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Vulnerabilities from './pages/Vulnerabilities';
import Servers from './pages/Servers';
import Devices from './pages/Devices';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import { useSocket } from './context/SocketContext';
const GlobalUI = () => {
  const { scanResultsModal, hideScanResults } = useSocket();
  return (
    <>
      <GlobalScanProgress />
      <ScanResultsModal
        show={scanResultsModal.show}
        onHide={hideScanResults}
        scanResults={scanResultsModal.scanResults}
        assetName={scanResultsModal.assetName}
        scanSummary={scanResultsModal.scanSummary}
      />
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Navbar />
          <Layout>
            <GlobalUI />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

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
                path="/settings"
                element={
                  <PrivateRoute>
                    <Settings />
                  </PrivateRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          <Footer />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
