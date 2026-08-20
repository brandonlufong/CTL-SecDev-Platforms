import React from 'react';
import { Navbar, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer';

const AuthLayout = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#F9FAFB',
      overflow: 'hidden'
    }}>
      {/* Simple Navbar with App Name */}
      <Navbar
        style={{
          background: 'linear-gradient(135deg, #1594EA 0%, #0D6EBD 100%)',
          borderBottom: 'none',
          height: '73px',
          flexShrink: 0
        }}
        className="shadow-sm"
      >
        <Container>
          <Navbar.Brand
            style={{
              color: '#FFFFFF',
              fontSize: '1.25rem',
              fontWeight: '600',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/login')}
          >
            Camtel Platform Manager
          </Navbar.Brand>
        </Container>
      </Navbar>

      {/* Main content area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '20px'
      }}>
        {children}
      </div>
      
      {/* Footer */}
      <div style={{ flexShrink: 0 }}>
        <Footer />
      </div>
    </div>
  );
};

export default AuthLayout;
