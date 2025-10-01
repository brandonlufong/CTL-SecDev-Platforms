import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext'; // Add this
import GlobalScanProgress from './components/GlobalScanProgress'; // Add this
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

// Auth context to store user info and token
export const AuthContext = createContext();

const App = () => {
  const [auth, setAuth] = useState(() => {
    // load token from localStorage if exists
    const token = localStorage.getItem('token');
    return { token, user: null };
  });

  // Dummy effect to fetch user info after login
  useEffect(() => {
    if (auth.token) {
      // Fetch user info with token here and set user object
      // For now, mock user data:
      setAuth(prev => ({ ...prev, user: { username: 'demoUser', role: 'admin' } }));
    }
  }, [auth.token]);

  // Simple PrivateRoute wrapper
  // const PrivateRoute = ({ children }) => {
  //   return auth.token ? children : <Navigate to="/login" replace />;
  // };

  return (
    <AuthContext.Provider value={{ auth, setAuth }}>
      <SocketProvider>
        <BrowserRouter>
          <Navbar />
          <Layout>
            {/* Define routes */}
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
        </BrowserRouter>
      </SocketProvider>
    </AuthContext.Provider>
  );
};

export default App;
