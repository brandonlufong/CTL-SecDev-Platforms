import React, { useContext, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Nav,
  Badge,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { 
  FaHistory,
  FaTachometerAlt,
  FaBug,
  FaServer,
  FaNetworkWired,
  FaUserShield,
  FaUsers,
  FaChartBar,
  FaCog,
  FaFileAlt,
  FaDatabase,
  FaLock,
  FaClipboardList,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaMap,
  FaCloud,
  FaHdd,
  FaMicrochip,
  FaWifi,
  FaDesktop,
  FaMobile,
  FaTablet,
  FaLaptop,
  FaChevronRight,
  FaChevronLeft
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { useT } from '../context/LanguageContext';
import { getNavigationItems, hasNavigationPermission } from '../config/navigationConfig';

const Sidebar = ({ onSubmenuToggle, activeSubmenu, isSubmenuOpen, onScanHistoryToggle }) => {
  const { user } = useContext(AuthContext);
  const t = useT();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);

  const navigationItems = getNavigationItems(user?.role);

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleMenuItemClick = (item) => {
    if (item.items && item.items.length > 0) {
      onSubmenuToggle(item.category);
    }
  };

  const renderMainMenuItem = (item) => {
    const Icon = item.icon;
    const isActive = item.path ? isActivePath(item.path) : false;
    const hasSubmenu = item.items && item.items.length > 0;
    const isHovered = hoveredItem === item.name;

    const menuItem = (
      <div
        className={`main-menu-item ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setHoveredItem(item.name)}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => handleMenuItemClick(item)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '60px',
          height: '60px',
          position: 'relative',
          cursor: 'pointer',
          backgroundColor: isActive ? '#1594EA' : 'transparent',
          color: isActive ? '#FFFFFF' : '#6B7280',
          transition: 'all 0.3s ease',
          borderRadius: '8px',
          margin: '4px 8px'
        }}
      >
        <Icon size={20} />
        {item.badge && (
          <Badge
            bg={item.badge === 'Live' ? 'success' : item.badge === 'New' ? 'info' : 'danger'}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              fontSize: '0.6rem',
              padding: '2px 4px',
              minWidth: '16px',
              height: '16px'
            }}
          >
            {item.badge}
          </Badge>
        )}
      </div>
    );

    const tooltip = (
      <Tooltip id={`tooltip-${item.name}`} placement="right">
        <div style={{ textAlign: 'left', padding: '4px 0' }}>
          <strong>{t(item.name)}</strong>
          {item.description && (
            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
              {t(item.description)}
            </div>
          )}
        </div>
      </Tooltip>
    );

    return (
      <OverlayTrigger
        key={item.name}
        placement="right"
        overlay={tooltip}
        delay={{ show: 300, hide: 100 }}
      >
        {item.path && !hasSubmenu ? (
          <NavLink
            to={item.path}
            className="text-decoration-none"
            style={{ display: 'block' }}
          >
            {menuItem}
          </NavLink>
        ) : (
          <div style={{ display: 'block' }}>
            {menuItem}
          </div>
        )}
      </OverlayTrigger>
    );
  };

  return (
    <div
      className="sidebar"
      style={{
        width: '76px',
        height: '100vh',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
      }}
    >
      {/* Logo Section */}
      <div
        className="logo-section"
        style={{
          padding: '20px 8px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '80px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            backgroundColor: '#1594EA',
            borderRadius: '12px',
            color: '#FFFFFF'
          }}
        >
          <FaDesktop size={24} />
        </div>
      </div>

      {/* Navigation Items */}
      <div
        className="nav-items"
        style={{
          flex: 1,
          padding: '16px 0',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {/* Navigation Categories */}
        {navigationItems.map(category => renderMainMenuItem({
          name: category.category,
          icon: category.items[0]?.icon || FaCog,
          description: `${category.items.length} items`,
          items: category.items,
          category: category.category
        }))}
      </div>

      {/* Bottom Section - Scan History */}
      <div
        className="user-section"
        style={{
          padding: '16px 8px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id="scan-history-tooltip">
              <div style={{ textAlign: 'left', padding: '4px 0' }}>
                <strong>Scan History</strong>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
                  View scan history and reports
                </div>
              </div>
            </Tooltip>
          }
          delay={{ show: 300, hide: 100 }}
        >
          <div
            className="user-avatar"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#1594EA',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onClick={onScanHistoryToggle}
          >
            <FaHistory size={18} />
          </div>
        </OverlayTrigger>
      </div>
    </div>
  );
};

export default Sidebar;
