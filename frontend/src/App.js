import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Vulnerabilities from './pages/Vulnerabilities';
import Assets from './pages/Assets';
import Navbar from './components/Navbar';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
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
      <BrowserRouter>
        <Navbar />
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
            path="/assets/*"
            element={
              <PrivateRoute>
                <Assets />
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
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

export default App;
