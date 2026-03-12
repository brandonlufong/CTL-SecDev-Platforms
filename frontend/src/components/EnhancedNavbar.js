import React, { useContext, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Navbar, 
  Container, 
  Nav, 
  NavDropdown, 
  Badge, 
  Collapse,
  Button
} from 'react-bootstrap';
import { 
  FaBars, 
  FaCog,
  FaChevronDown,
  FaTimes,
  FaTh,
  FaList,
  FaShieldVirus
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { getNavigationItems, hasNavigationPermission } from '../config/navigationConfig';

const EnhancedNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('horizontal'); // 'horizontal' or 'vertical'

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navigationItems = getNavigationItems(user?.role);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
  };

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderNavigationItem = (item) => {
    const Icon = item.icon;
    const isActive = isActivePath(item.path);
    
    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={`nav-link position-relative ${isActive ? 'active' : ''}`}
        style={({ isActive }) => ({
          color: '#F0F9FF',
          backgroundColor: isActive ? '#0D6EBD' : 'transparent',
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          margin: '0.2rem 0.3rem',
          transition: 'all 0.3s ease',
          border: isActive ? '2px solid rgba(240, 249, 255, 0.3)' : '2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        })}
        onClick={() => setExpanded(false)}
      >
        <Icon size={16} />
        <span>{item.name}</span>
        {item.badge && (
          <Badge 
            bg={item.badge === 'Live' ? 'success' : item.badge === 'New' ? 'info' : 'danger'}
            style={{ fontSize: '0.7rem', position: 'absolute', top: '2px', right: '2px' }}
          >
            {item.badge}
          </Badge>
        )}
      </NavLink>
    );
  };

  const renderDropdownCategory = (category) => {
    return (
      <NavDropdown
        key={category.category}
        title={
          <span style={{ color: '#F0F9FF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {category.category}
            <FaChevronDown size={12} />
          </span>
        }
        menuVariant="dark"
        style={{ margin: '0 0.3rem' }}
      >
        {category.items.map(item => {
          const Icon = item.icon;
          return (
            <NavDropdown.Item
              key={item.path}
              as={NavLink}
              to={item.path}
              style={{
                color: '#F0F9FF',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onClick={() => setExpanded(false)}
            >
              <Icon size={14} />
              <div>
                <div>{item.name}</div>
                <small style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                  {item.description}
                </small>
              </div>
              {item.badge && (
                <Badge 
                  bg={item.badge === 'Live' ? 'success' : item.badge === 'New' ? 'info' : 'danger'}
                  style={{ fontSize: '0.6rem', marginLeft: 'auto' }}
                >
                  {item.badge}
                </Badge>
              )}
            </NavDropdown.Item>
          );
        })}
      </NavDropdown>
    );
  };

  return (
    <>
      <Navbar
        expand="lg"
        expanded={expanded}
        style={{
          backgroundColor: '#1594EA',
          color: '#F0F9FF',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        className="mb-0"
      >
        <Container fluid>
          <Navbar.Brand
            as={NavLink}
            to="/"
            style={{
              color: '#F0F9FF',
              fontWeight: 'bold',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onClick={() => setExpanded(false)}
          >
            <FaShieldVirus />
            CAMTEL Platform Manager
          </Navbar.Brand>

          <div className="d-flex align-items-center gap-2">
            {/* View Mode Toggle */}
            <Button
              variant="outline-light"
              size="sm"
              onClick={toggleViewMode}
              title={`Switch to ${viewMode === 'horizontal' ? 'Vertical' : 'Horizontal'} view`}
              style={{ border: '1px solid rgba(240, 249, 255, 0.3)' }}
            >
              {viewMode === 'horizontal' ? <FaList /> : <FaTh />}
            </Button>

            {/* Mobile Toggle */}
            <Navbar.Toggle
              aria-controls="enhanced-navbar-nav"
              onClick={() => setExpanded(!expanded)}
              style={{ backgroundColor: '#F0F9FF' }}
            >
              {expanded ? <FaTimes /> : <FaBars />}
            </Navbar.Toggle>
          </div>

          <Navbar.Collapse id="enhanced-navbar-nav">
            <Nav className="me-auto">
              {viewMode === 'horizontal' ? (
                // Horizontal navigation with dropdowns for categories
                <>
                  {navigationItems.map(category => {
                    // Show as dropdown if category has more than 2 items
                    if (category.items.length > 2) {
                      return renderDropdownCategory(category);
                    }
                    // Show as direct links for single items or small categories
                    return category.items.map(renderNavigationItem);
                  })}
                </>
              ) : (
                // Vertical navigation style
                navigationItems.map(category => (
                  <div key={category.category} className="mb-3">
                    <div 
                      style={{
                        color: 'rgba(240, 249, 255, 0.7)',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        padding: '0.5rem 1rem',
                        borderBottom: '1px solid rgba(240, 249, 255, 0.2)',
                        marginBottom: '0.5rem'
                      }}
                    >
                      {category.category}
                    </div>
                    {category.items.map(renderNavigationItem)}
                  </div>
                ))
              )}
            </Nav>

            <Nav className="align-items-center">
              {/* User Dropdown */}
              <NavDropdown
                title={
                  <span style={{ color: '#F0F9FF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div 
                      className="rounded-circle bg-light text-primary d-flex align-items-center justify-content-center"
                      style={{ width: '28px', height: '28px', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    {user?.name || 'User'}
                    <FaChevronDown size={12} />
                  </span>
                }
                align="end"
                menuVariant="dark"
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
                    <small style={{ opacity: 0.7 }}>{user?.email}</small>
                    <br />
                    <Badge bg="info" className="mt-1">
                      {user?.role?.replace('_', ' ').toUpperCase() || 'USER'}
                    </Badge>
                  </div>
                </NavDropdown.Header>
                
                <NavDropdown.Divider />
                
                <NavDropdown.Item
                  as={NavLink}
                  to="/profile"
                  style={{ color: '#F0F9FF' }}
                >
                  <FaCog className="me-2" />
                  Profile Settings
                </NavDropdown.Item>

                <NavDropdown.Item
                  as={NavLink}
                  to="/settings"
                  style={{ color: '#F0F9FF' }}
                >
                  <FaCog className="me-2" />
                  Platform Settings
                </NavDropdown.Item>

                <NavDropdown.Divider />

                <NavDropdown.Item
                  onClick={handleLogout}
                  style={{ color: '#dc3545' }}
                >
                  <FaTimes className="me-2" />
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </>
  );
};

export default EnhancedNavbar;
