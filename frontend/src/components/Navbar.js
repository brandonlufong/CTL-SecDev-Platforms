import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Navbar, Container, Nav, NavDropdown } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';

const TopNavbar = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const handleLogout = () => {
    localStorage.removeItem('token'); // Example
    navigate('/login');
  };

  return (
    <Navbar
      expand="lg"
      style={{
        backgroundColor: '#1594EA',
        color: '#F0F9FF',
      }}
      className="mb-4 shadow-sm"
    >
      <Container>
        <Navbar.Brand
          as={NavLink}
          to="/"
          style={{
            color: '#F0F9FF',
            fontWeight: 'bold',
          }}
        >
          VulnTracker
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="basic-navbar-nav"
          style={{ backgroundColor: '#F0F9FF' }}
        />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <NavLink
              to="/"
              className="nav-link"
              style={({ isActive }) => ({
                color: isActive ? '#F0F9FF' : '#F0F9FF',
                backgroundColor: isActive ? '#0D6EBD' : 'transparent',
                borderRadius: '5px',
                padding: '0.5rem 1rem',
                margin: '0 0.3rem',
              })}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/vulnerabilities"
              className="nav-link"
              style={({ isActive }) => ({
                color: isActive ? '#F0F9FF' : '#F0F9FF',
                backgroundColor: isActive ? '#0D6EBD' : 'transparent',
                borderRadius: '5px',
                padding: '0.5rem 1rem',
                margin: '0 0.3rem',
              })}
            >
              Vulnerabilities
            </NavLink>

            <NavLink
              to="/assets"
              className="nav-link"
              style={({ isActive }) => ({
                color: isActive ? '#F0F9FF' : '#F0F9FF',
                backgroundColor: isActive ? '#0D6EBD' : 'transparent',
                borderRadius: '5px',
                padding: '0.5rem 1rem',
                margin: '0 0.3rem',
              })}
            >
              Assets
            </NavLink>
          </Nav>

          <Nav>
            <NavDropdown
              title={<span style={{ color: '#F0F9FF' }}>{user?.name || 'User'}</span>}
              align="end"
              id="user-nav-dropdown"
              menuVariant="light"
              style={{
                backgroundColor: '#1594EA',
              }}
            >
              <NavDropdown.Item
                as={NavLink}
                to="/profile"
                style={{
                  backgroundColor: '#F1F8FD',
                  color: '#1594EA',
                  fontWeight: 500,
                }}
              >
                Profile
              </NavDropdown.Item>

              <NavDropdown.Item
                as={NavLink}
                to="/settings"
                style={{
                  backgroundColor: '#F1F8FD',
                  color: '#1594EA',
                  fontWeight: 500,
                }}
              >
                Settings
              </NavDropdown.Item>

              <NavDropdown.Divider />

              <NavDropdown.Item
                onClick={handleLogout}
                style={{
                  backgroundColor: '#F1F8FD',
                  color: '#dc3545', // red for logout
                  fontWeight: 500,
                }}
              >
                Logout
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default TopNavbar;
