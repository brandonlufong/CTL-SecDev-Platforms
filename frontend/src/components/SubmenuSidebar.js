import React, { useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Badge,
  Button
} from 'react-bootstrap';
import { 
  FaTimes,
  FaChevronLeft
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { useT } from '../context/LanguageContext';
import { getNavigationItems } from '../config/navigationConfig';

const SubmenuSidebar = ({ 
  activeCategory, 
  isOpen, 
  onClose, 
  categories 
}) => {
  const { user } = useContext(AuthContext);
  const t = useT();
  const location = useLocation();

  const navigationItems = getNavigationItems(user?.role);
  const activeCategoryData = navigationItems.find(cat => cat.category === activeCategory);

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderSubmenuItem = (item) => {
    const Icon = item.icon;
    const isActive = isActivePath(item.path);

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className="submenu-item text-decoration-none d-flex align-items-center"
        style={{
          color: isActive ? '#1594EA' : '#6B7280',
          backgroundColor: isActive ? '#EFF6FF' : 'transparent',
          borderLeft: isActive ? '3px solid #1594EA' : '3px solid transparent',
          borderRadius: '6px',
          padding: '12px 16px',
          margin: '4px 12px',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.9rem',
          fontWeight: isActive ? '600' : '500',
          textDecoration: 'none'
        }}
        onClick={() => onClose()}
      >
        <Icon size={16} style={{ minWidth: '16px' }} />
        <span className="flex-grow-1">{t(item.name)}</span>
        {item.badge && (
          <Badge 
            bg={item.badge === 'Live' ? 'success' : item.badge === 'New' ? 'info' : 'danger'}
            style={{ fontSize: '0.7rem' }}
          >
            {item.badge}
          </Badge>
        )}
      </NavLink>
    );
  };

  if (!isOpen || !activeCategoryData) {
    return null;
  }

  return (
    <div
      className="submenu-sidebar"
      style={{
        width: '280px',
        height: '100vh',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        position: 'fixed',
        left: '76px',
        top: 0,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease'
      }}
    >
      {/* Header */}
      <div
        className="submenu-header"
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '80px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="light"
            onClick={onClose}
            style={{
              backgroundColor: '#F3F4F6',
              border: 'none',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FaChevronLeft size={14} />
          </Button>
          <div>
            <h5 
              className="mb-0" 
              style={{ 
                color: '#1F2937', 
                fontSize: '1rem', 
                fontWeight: '600' 
              }}
            >
              {t(activeCategoryData.category)}
            </h5>
            <small style={{ color: '#6B7280', fontSize: '0.75rem' }}>
              {activeCategoryData.items.length} items
            </small>
          </div>
        </div>
        
        <Button
          variant="light"
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            padding: '8px',
            borderRadius: '6px',
            color: '#6B7280'
          }}
        >
          <FaTimes size={16} />
        </Button>
      </div>

      {/* Submenu Items */}
      <div
        className="submenu-items"
        style={{
          flex: 1,
          padding: '16px 0',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {activeCategoryData.items.map(item => renderSubmenuItem(item))}
      </div>

      {/* Footer */}
      <div
        className="submenu-footer"
        style={{
          padding: '16px',
          borderTop: '1px solid #E5E7EB',
          fontSize: '0.75rem',
          color: '#6B7280',
          textAlign: 'center'
        }}
      >
        Click outside to close
      </div>
    </div>
  );
};

export default SubmenuSidebar;
