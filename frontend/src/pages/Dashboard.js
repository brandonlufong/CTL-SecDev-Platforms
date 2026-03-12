import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Container,
  Row,
  Col,
  Spinner,
  Button,
  Badge,
  Alert
} from 'react-bootstrap';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { AuthContext } from '../context/AuthContext';
import {
  FaServer,
  FaNetworkWired,
  FaExclamationTriangle,
  FaShieldAlt,
  FaCheckCircle,
  FaSync,
  FaTachometerAlt,
  FaChartLine
} from 'react-icons/fa';
import config from '../config';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const Dashboard = () => {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Real-time dashboard data
  const [dashboardData, setDashboardData] = useState({
    assets: {
      total: 0,
      servers: 0,
      networkDevices: 0,
      online: 0,
      offline: 0,
      maintenance: 0
    },
    vulnerabilities: {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      resolved: 0
    },
    system: {
      scanStatus: 'idle',
      lastScan: null,
      uptime: '0d 0h'
    }
  });

  // Fetch real-time dashboard data
  const fetchDashboardData = async () => {
    try {
      const [assetRes, vulnRes, systemRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}/api/inventory/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${config.API_BASE_URL}/api/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${config.API_BASE_URL}/api/config/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      let assetData = { overview: { totalAssets: 0, onlineAssets: 0, offlineAssets: 0, maintenanceAssets: 0, serverAssets: 0, networkDevices: 0 } };
      let vulnData = { totalVulnerabilities: 0, criticalOpenCount: 0, openVulnerabilities: 0, resolvedVulnerabilities: 0, severityCount: {} };
      let systemData = { uptime: '0d 0h', lastScan: null };

      if (assetRes.ok) assetData = await assetRes.json();
      if (vulnRes.ok) vulnData = await vulnRes.json();
      if (systemRes.ok) systemData = await systemRes.json();

      setDashboardData({
        assets: {
          total: assetData.overview?.totalAssets || 0,
          servers: assetData.overview?.serverAssets || 0,
          networkDevices: assetData.overview?.networkDevices || 0,
          online: assetData.overview?.onlineAssets || 0,
          offline: assetData.overview?.offlineAssets || 0,
          maintenance: assetData.overview?.maintenanceAssets || 0
        },
        vulnerabilities: {
          total: vulnData.totalVulnerabilities || 0,
          critical: vulnData.severityCount?.Critical || 0,
          high: vulnData.severityCount?.High || 0,
          medium: vulnData.severityCount?.Medium || 0,
          low: vulnData.severityCount?.Low || 0,
          open: vulnData.openVulnerabilities || 0,
          resolved: vulnData.resolvedVulnerabilities || 0
        },
        system: {
          scanStatus: 'idle',
          lastScan: systemData.lastScan || null,
          uptime: systemData.uptime || '0d 0h'
        }
      });
      
      setLastUpdate(new Date());
      setError('');
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load and real-time updates
  useEffect(() => {
    fetchDashboardData();
    
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, [token]);

  // Chart configurations
  const vulnerabilitySeverityData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [
        dashboardData.vulnerabilities.critical,
        dashboardData.vulnerabilities.high,
        dashboardData.vulnerabilities.medium,
        dashboardData.vulnerabilities.low
      ],
      backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745'],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  const vulnerabilityStatusData = {
    labels: ['Open', 'Resolved'],
    datasets: [{
      label: 'Vulnerabilities',
      data: [dashboardData.vulnerabilities.open, dashboardData.vulnerabilities.resolved],
      backgroundColor: ['#dc3545', '#28a745']
    }]
  };

  const assetDistributionData = {
    labels: ['Servers', 'Network Devices'],
    datasets: [{
      data: [dashboardData.assets.servers, dashboardData.assets.networkDevices],
      backgroundColor: ['#007bff', '#28a745']
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 15, usePointStyle: true }
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true }
    },
    plugins: {
      legend: { display: false }
    }
  };

  if (loading) {
    return (
      <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <p className="text-muted mt-2">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ color: '#1594EA', fontWeight: '600' }}>
            <FaTachometerAlt className="me-2" style={{ color: '#1594EA' }} />
            Dashboard
          </h2>
          <p className="text-muted mb-0">
            Real-time overview of your security posture
            {lastUpdate && (
              <small className="ms-2">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </small>
            )}
          </p>
        </div>
        <Button variant="outline-primary" onClick={fetchDashboardData}>
          <FaSync className="me-2" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* Critical Alert */}
      {dashboardData.vulnerabilities.critical > 0 && (
        <Alert variant="danger" className="mb-4">
          <FaExclamationTriangle className="me-2" />
          <strong>{dashboardData.vulnerabilities.critical} critical vulnerabilities</strong> require immediate attention
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm" style={{ cursor: 'pointer' }} 
                onClick={() => navigate('/asset-inventory')}>
            <Card.Body className="text-center">
              <FaServer className="text-primary mb-2" size={32} />
              <h3 className="mb-1">{dashboardData.assets.total}</h3>
              <p className="text-muted mb-0">Total Assets</p>
              <small className="text-muted">
                {dashboardData.assets.servers} servers, {dashboardData.assets.networkDevices} devices
              </small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm" style={{ cursor: 'pointer' }}
                onClick={() => navigate('/vulnerabilities?status=Open')}>
            <Card.Body className="text-center">
              <FaShieldAlt className="text-warning mb-2" size={32} />
              <h3 className="mb-1">{dashboardData.vulnerabilities.total}</h3>
              <p className="text-muted mb-0">Total Vulnerabilities</p>
              <small className="text-muted">
                {dashboardData.vulnerabilities.open} open, {dashboardData.vulnerabilities.resolved} resolved
              </small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm" style={{ cursor: 'pointer' }}
                onClick={() => navigate('/vulnerabilities?severity=Critical')}>
            <Card.Body className="text-center">
              <FaExclamationTriangle className="text-danger mb-2" size={32} />
              <h3 className="mb-1 text-danger">{dashboardData.vulnerabilities.critical}</h3>
              <p className="text-muted mb-0">Critical Vulnerabilities</p>
              <small className="text-danger">Immediate action required</small>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center">
              <FaCheckCircle className="text-success mb-2" size={32} />
              <h3 className="mb-1 text-success">{dashboardData.assets.online}</h3>
              <p className="text-muted mb-0">Online Assets</p>
              <small className="text-muted">
                {dashboardData.assets.offline} offline, {dashboardData.assets.maintenance} maintenance
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h6 className="mb-0">Vulnerability Severity</h6>
            </Card.Header>
            <Card.Body style={{ height: '250px' }}>
              {dashboardData.vulnerabilities.total > 0 ? (
                <Pie data={vulnerabilitySeverityData} options={chartOptions} />
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100">
                  <div className="text-center text-muted">
                    <FaCheckCircle size={40} className="mb-2" />
                    <p>No vulnerabilities found</p>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h6 className="mb-0">Vulnerability Status</h6>
            </Card.Header>
            <Card.Body style={{ height: '250px' }}>
              <Bar data={vulnerabilityStatusData} options={barOptions} />
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h6 className="mb-0">Asset Distribution</h6>
            </Card.Header>
            <Card.Body style={{ height: '250px' }}>
              <Pie data={assetDistributionData} options={chartOptions} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h6 className="mb-0">Quick Actions</h6>
            </Card.Header>
            <Card.Body>
              <div className="d-flex gap-3 flex-wrap">
                <Button variant="primary" onClick={() => navigate('/asset-inventory')}>
                  <FaServer className="me-2" />
                  Manage Assets
                </Button>
                <Button variant="danger" onClick={() => navigate('/vulnerabilities')}>
                  <FaShieldAlt className="me-2" />
                  View Vulnerabilities
                </Button>
                <Button variant="outline-primary" onClick={() => navigate('/system-settings')}>
                  <FaTachometerAlt className="me-2" />
                  System Settings
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
