import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Navbar,
  Container,
  Nav,
  Button
} from 'react-bootstrap';
import {
  FaUser,
  FaCog,
  FaUserShield,
  FaSignOutAlt,
  FaQuestionCircle,
  FaMoon,
  FaSun
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const TopNavbar = () => {
  const { user, logout } = React.useContext(AuthContext);
  const { darkMode, toggleTheme } = React.useContext(ThemeContext);
  const { lang, setLang, languages } = useLanguage();
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setShowProfileDropdown(false);
  };

  const handleAdminClick = () => {
    navigate('/admin');
    setShowProfileDropdown(false);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
    setShowProfileDropdown(false);
  };

  const handleHelpClick = () => {
    // Open help documentation or modal
    setShowProfileDropdown(false);
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const userRole = user?.role?.replace('_', ' ').toUpperCase() || 'USER';

  return (
    <Navbar
      expand="lg"
      className="top-navbar"
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '0.75rem 0',
        position: 'fixed',
        top: 0,
        left: '76px',
        right: 0,
        zIndex: 998,
        height: '73px'
      }}
    >
      <Container fluid style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {/* App Name/Brand */}
        <Navbar.Brand
          className="d-flex align-items-center"
          style={{
            color: '#1594EA',
            fontSize: '1.25rem',
            fontWeight: '600',
            textDecoration: 'none',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          Camtel Platforms
        </Navbar.Brand>

        {/* Right side - Profile */}
        <Nav className="ms-auto align-items-center" style={{ gap: 10 }}>
          {/* Language switcher */}
          <Button
            variant="light"
            onClick={() => { const codes = languages.map(l => l.code); setLang(codes[(codes.indexOf(lang) + 1) % codes.length]); }}
            title="Language"
            style={{
              backgroundColor: 'var(--vm-surface-2)', border: '1px solid var(--vm-border)',
              borderRadius: '8px', height: 40, padding: '0 12px', display: 'flex',
              alignItems: 'center', color: 'var(--vm-text)', fontWeight: 600, fontSize: 13,
            }}
          >
            {(languages.find(l => l.code === lang) || languages[0]).short}
          </Button>

          {/* Theme toggle */}
          <Button
            variant="light"
            onClick={toggleTheme}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              backgroundColor: 'var(--vm-surface-2)', border: '1px solid var(--vm-border)',
              borderRadius: '8px', width: 40, height: 40, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--vm-text-muted)',
            }}
          >
            {darkMode ? <FaSun /> : <FaMoon />}
          </Button>

          {/* Profile Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <Button
              variant="light"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              style={{
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#1594EA',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {userInitial}
              </div>
            </Button>

            {/* Dropdown Menu */}
            {showProfileDropdown && (
              <div
                className="profile-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'var(--vm-surface)',
                  border: '1px solid var(--vm-border)',
                  borderRadius: '14px',
                  minWidth: '220px',
                  marginTop: '8px',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}
              >
                {/* Menu Items */}
                <div style={{ padding: '8px 0' }}>
                  {/* Profile */}
                  <button
                    onClick={handleProfileClick}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      color: '#374151',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <FaUser size={16} color="#6B7280" />
                    <span>Profile Settings</span>
                  </button>

                  {/* Admin (only for admin roles) */}
                  {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <button
                      onClick={handleAdminClick}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        color: '#374151',
                        fontSize: '0.875rem',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <FaUserShield size={16} color="#6B7280" />
                      <span>Admin Panel</span>
                    </button>
                  )}

                  {/* Settings */}
                  <button
                    onClick={handleSettingsClick}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      color: '#374151',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <FaCog size={16} color="#6B7280" />
                    <span>Settings</span>
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '8px 0' }} />

                  {/* Help */}
                  <button
                    onClick={handleHelpClick}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      color: '#374151',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#F3F4F6'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <FaQuestionCircle size={16} color="#6B7280" />
                    <span>Help & Documentation</span>
                  </button>

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      color: '#DC2626',
                      fontSize: '0.875rem',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#FEE2E2'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <FaSignOutAlt size={16} color="#DC2626" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Nav>
      </Container>
    </Navbar>
  );
};

export default TopNavbar;
