// Layout.js
import React from 'react';
import Footer from './Footer';
import { Container } from 'react-bootstrap';

const Layout = ({ children }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main content */}
      <Container fluid style={{ flex: 1, paddingBottom: '100px' }}>
        {children}
      </Container>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;