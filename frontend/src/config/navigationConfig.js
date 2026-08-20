import React from 'react';
import { 
  FaTachometerAlt, 
  FaShieldVirus, 
  FaServer, 
  FaNetworkWired, 
  FaUserShield, 
  FaUsers, 
  FaChartBar, 
  FaCog, 
  FaFileAlt, 
  FaDatabase,
  FaLock,
  FaHistory,
  FaHeartbeat,
    FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaCloud,
  FaHdd,
  FaMicrochip,
  FaWifi,
  FaDesktop,
  FaMobile,
  FaTablet,
  FaLaptop
} from 'react-icons/fa';

// Navigation configuration for platform management
export const navigationConfig = [
  {
    category: 'Main',
    items: [
      {
        name: 'Dashboard',
        path: '/',
        icon: FaTachometerAlt,
        description: 'System overview and analytics',
        roles: ['user', 'security_analyst', 'auditor', 'admin', 'super_admin'],
        badge: null
      }
    ]
  },
  {
    category: 'Security Management',
    items: [
      {
        name: 'Vulnerabilities',
        path: '/vulnerabilities',
        icon: FaShieldVirus,
        description: 'Vulnerability assessment and management',
        roles: ['user', 'security_analyst', 'auditor', 'admin', 'super_admin'],
        badge: null
      },
      {
        name: 'Scan Scheduler',
        path: '/scan-scheduler',
        icon: FaClock,
        description: 'Recurring automated scans',
        roles: ['security_analyst', 'admin', 'super_admin'],
        badge: null
      },
    ]
  },
  {
    category: 'Asset Management',
    items: [
      {
        name: 'Server Assets',
        path: '/servers',
        icon: FaServer,
        description: 'Server inventory and management',
        roles: ['user', 'security_analyst', 'auditor', 'admin', 'super_admin'],
        badge: null
      },
      {
        name: 'Network Devices',
        path: '/devices',
        icon: FaNetworkWired,
        description: 'Network device inventory',
        roles: ['user', 'security_analyst', 'auditor', 'admin', 'super_admin'],
        badge: null
      },
      {
        name: 'Asset Inventory',
        path: '/asset-inventory',
        icon: FaDatabase,
        description: 'Complete asset database',
        roles: ['admin', 'super_admin'],
        badge: null
      }
    ]
  },
  {
    category: 'System Administration',
    items: [
      {
        name: 'User Management',
        path: '/admin',
        icon: FaUsers,
        description: 'User and role management',
        roles: ['admin', 'super_admin'],
        badge: null
      },
      {
        name: 'System Settings',
        path: '/system-settings',
        icon: FaCog,
        description: 'Platform configuration',
        roles: ['admin', 'super_admin'],
        badge: null
      },
      {
        name: 'Access Control',
        path: '/access-control',
        icon: FaLock,
        description: 'Permissions and access policies',
        roles: ['super_admin'],
        badge: null
      },
      {
        name: 'System Logs',
        path: '/system-logs',
        icon: FaHistory,
        description: 'Audit logs and monitoring',
        roles: ['auditor', 'admin', 'super_admin'],
        badge: null
      },
      {
        name: 'System Health',
        path: '/system-health',
        icon: FaHeartbeat,
        description: 'Live scanner, database & scheduler status',
        roles: ['admin', 'super_admin'],
        badge: null
      }
    ]
  },
  {
    category: 'Monitoring & Analytics',
    items: [
      {
        name: 'Analytics',
        path: '/analytics',
        icon: FaChartBar,
        description: 'Advanced analytics and insights',
        roles: ['security_analyst', 'auditor', 'admin', 'super_admin'],
        badge: null
      }
    ]
  }
];

// Device type icons for asset management
export const deviceTypeIcons = {
  server: FaServer,
  desktop: FaDesktop,
  laptop: FaLaptop,
  mobile: FaMobile,
  tablet: FaTablet,
  router: FaNetworkWired,
  switch: FaNetworkWired,
  firewall: FaShieldVirus,
  storage: FaHdd,
  cloud: FaCloud,
  iot: FaMicrochip,
  wireless: FaWifi
};

// Role hierarchy for permission checking
export const roleHierarchy = {
  'user': 1,
  'security_analyst': 2,
  'auditor': 3,
  'admin': 4,
  'super_admin': 5
};

// Helper function to check if user has permission for navigation item
export const hasNavigationPermission = (userRole, requiredRoles) => {
  if (!userRole || !requiredRoles) return false;
  return requiredRoles.includes(userRole);
};

// Helper function to get navigation items for user
export const getNavigationItems = (userRole) => {
  if (!userRole) return [];
  
  return navigationConfig.reduce((acc, category) => {
    const filteredItems = category.items.filter(item => 
      hasNavigationPermission(userRole, item.roles)
    );
    
    if (filteredItems.length > 0) {
      acc.push({
        ...category,
        items: filteredItems
      });
    }
    
    return acc;
  }, []);
};
