import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import SubmenuSidebar from './SubmenuSidebar';
import TopNavbar from './TopNavbar';
import ScanHistorySidebar from './ScanHistorySidebar';

const MainLayout = ({ children }) => {
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [isScanHistoryOpen, setIsScanHistoryOpen] = useState(false);
  const location = useLocation();
  const layoutRef = useRef(null);

  useEffect(() => {
    // Close submenu when route changes
    if (isSubmenuOpen) {
      setIsSubmenuOpen(false);
      setActiveSubmenu(null);
    }
  }, [location]);

  useEffect(() => {
    // Handle click outside to close submenu
    const handleClickOutside = (event) => {
      if (isSubmenuOpen && layoutRef.current) {
        const submenuElement = document.querySelector('.submenu-sidebar');
        const sidebarElement = document.querySelector('.sidebar');
        
        // Check if click is outside both sidebars
        if (submenuElement && sidebarElement &&
            !submenuElement.contains(event.target) &&
            !sidebarElement.contains(event.target)) {
          setIsSubmenuOpen(false);
          setActiveSubmenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSubmenuOpen]);

  const handleSubmenuToggle = (category) => {
    if (activeSubmenu === category && isSubmenuOpen) {
      setIsSubmenuOpen(false);
      setActiveSubmenu(null);
    } else {
      setActiveSubmenu(category);
      setIsSubmenuOpen(true);
    }
  };

  const handleSubmenuClose = () => {
    setIsSubmenuOpen(false);
    setActiveSubmenu(null);
  };

  const handleScanHistoryToggle = () => {
    setIsScanHistoryOpen(!isScanHistoryOpen);
  };

  return (
    <div className="main-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Sidebar */}
      <Sidebar
        onSubmenuToggle={handleSubmenuToggle}
        activeSubmenu={activeSubmenu}
        isSubmenuOpen={isSubmenuOpen}
        onScanHistoryToggle={handleScanHistoryToggle}
      />

      {/* Submenu Sidebar */}
      <SubmenuSidebar
        activeCategory={activeSubmenu}
        isOpen={isSubmenuOpen}
        onClose={handleSubmenuClose}
      />

      {/* Top Navbar */}
      <TopNavbar />

      {/* Scan History Sidebar */}
      <ScanHistorySidebar show={isScanHistoryOpen} onHide={() => setIsScanHistoryOpen(false)} />

      {/* Main Content Area */}
      <div
        className="main-content"
        style={{
          marginLeft: isSubmenuOpen ? '356px' : '76px', // 76px main sidebar + 280px submenu
          marginTop: '73px', // Height of TopNavbar
          flex: 1,
          transition: 'all 0.3s ease',
          backgroundColor: '#F9FAFB',
          padding: '20px',
          minHeight: 'calc(100vh - 73px)'
        }}
        ref={layoutRef}
      >
        {/* Page Content */}
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
