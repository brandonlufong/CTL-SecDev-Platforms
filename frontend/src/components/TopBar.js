import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Navbar,
  Container,
  Button,
  NavDropdown,
  Badge
} from 'react-bootstrap';
import { 
  FaCog,
  FaChevronDown,
  FaTimes,
  FaBars,
  FaShieldVirus
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';

const TopBar = ({ onToggleSidebar, isSidebarCollapsed }) => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <Navbar
      expand="lg"
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '0.75rem 0',
        position: 'fixed',
        top: 0,
        left: isSidebarCollapsed ? '80px' : '280px',
        right: 0,
        zIndex: 999,
        transition: 'all 0.3s ease'
      }}
    >
      <Container fluid className="px-4">
        <div className="d-flex align-items-center justify-content-between w-100">
          {/* Left side - Toggle and Brand */}
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="link"
              onClick={onToggleSidebar}
              style={{
                color: '#6B7280',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0.5rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isSidebarCollapsed ? <FaBars size={20} /> : <FaTimes size={20} />}
            </Button>
            
            <div className="d-flex align-items-center gap-2">
              <FaShieldVirus size={24} color="#1594EA" />
              <div>
                <h5 className="mb-0" style={{ color: '#1F2937', fontSize: '1.1rem', fontWeight: '600' }}>
                  CAMTEL Platforms
                </h5>
              </div>
            </div>
          </div>

          {/* Right side - User Menu */}
          <div className="d-flex align-items-center">
            <NavDropdown
              title={
                <span style={{ color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div 
                    className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                    style={{ width: '32px', height: '32px', fontSize: '14px', fontWeight: 'bold' }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="d-none d-md-inline">{user?.name || 'User'}</span>
                  <FaChevronDown size={12} />
                </span>
              }
              align="end"
              menuVariant="light"
              style={{ border: 'none' }}
            >
              <NavDropdown.Header>
                <div className="text-center">
                  <div 
                    className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto mb-2"
                    style={{ width: '40px', height: '40px', fontSize: '18px', fontWeight: 'bold' }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <strong>{user?.name}</strong>
                  <br />
                  <small style={{ color: '#6B7280' }}>{user?.email}</small>
                  <br />
                  <Badge bg="info" className="mt-1">
                    {user?.role?.replace('_', ' ').toUpperCase() || 'USER'}
                  </Badge>
                </div>
              </NavDropdown.Header>
              
              <NavDropdown.Divider />
              
              <NavDropdown.Item
                href="/profile"
                style={{ color: '#1F2937' }}
              >
                <FaCog className="me-2" />
                Profile Settings
              </NavDropdown.Item>

              <NavDropdown.Item
                href="/settings"
                style={{ color: '#1F2937' }}
              >
                <FaCog className="me-2" />
                Platform Settings
              </NavDropdown.Item>

              <NavDropdown.Divider />

              <NavDropdown.Item
                onClick={handleLogout}
                style={{ color: '#DC3545' }}
              >
                <FaTimes className="me-2" />
                Logout
              </NavDropdown.Item>
            </NavDropdown>
          </div>
        </div>
      </Container>
    </Navbar>
  );
};

export default TopBar;
