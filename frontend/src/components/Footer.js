import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      style={{
        backgroundColor: '#1594EA',
        color: '#fff',
        padding: '20px 0',
        position: 'fixed',
        bottom: 0,
        width: '100%',
        zIndex: 999
      }}
    >
      <Container>
        <Row className="align-items-center">
          <Col md={6} className="text-center text-md-start mb-2 mb-md-0">
            &copy; {currentYear} Camtel. All rights reserved.
          </Col>
          <Col md={6} className="text-center text-md-end">
            <a href="/privacy" style={{ color: '#fff', marginRight: '15px', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ color: '#fff', textDecoration: 'none' }}>Terms of Service</a>
          </Col>
        </Row>
        {/* <Row className="mt-2">
          <Col className="text-center">
            Built with ❤️ by Your Team
          </Col>
        </Row> */}
      </Container>
    </footer>
  );
};

export default Footer;
