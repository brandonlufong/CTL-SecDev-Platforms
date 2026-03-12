import React, { useState, useEffect, useContext } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  InputGroup,
  Badge,
  Alert,
  Spinner,
  Tabs,
  Tab,
  Table,
  Modal,
  ProgressBar
} from 'react-bootstrap';
import {
  FaCog,
  FaServer,
  FaDatabase,
  FaNetworkWired,
  FaShieldAlt,
  FaClock,
  FaBell,
  FaSave,
  FaUndo,
  FaPlay,
  FaPause,
  FaSync,
  FaDownload,
  FaUpload,
  FaKey,
  FaUserShield,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import config from '../config';

const SystemSettings = () => {
  const { token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  // System Configuration
  const [systemConfig, setSystemConfig] = useState({
    general: {
      platformName: 'CAMTEL Security Platform',
      version: '2.0.0',
      environment: 'production',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '24h',
      language: 'en'
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true,
      maxLoginAttempts: 5,
      lockoutDuration: 15,
      enableTwoFactor: false,
      apiRateLimit: 100
    },
    scanning: {
      defaultScanTimeout: 300,
      maxConcurrentScans: 5,
      scanResultsRetention: 90,
      autoScheduleScans: false,
      scanScheduleFrequency: 'daily',
      enableVulnerabilityScanning: true,
      enablePortScanning: true,
      enableServiceDetection: true
    },
    notifications: {
      emailEnabled: true,
      smtpHost: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpUseTLS: true,
      emailFrom: '',
      emailAdmin: '',
      enableCriticalAlerts: true,
      enableWeeklyReports: false,
      enableMaintenanceAlerts: true
    },
    performance: {
      enablePerformanceMonitoring: true,
      metricsRetention: 30,
      alertThresholdCPU: 80,
      alertThresholdMemory: 85,
      alertThresholdDisk: 90,
      enableAutoCleanup: true,
      cleanupInterval: 7
    },
    backup: {
      enableAutoBackup: true,
      backupFrequency: 'daily',
      backupRetention: 30,
      backupLocation: '/var/backups/camtel',
      compressBackups: true,
      encryptBackups: true,
      lastBackupTime: null,
      backupStatus: 'idle'
    }
  });

  // System Status
  const [systemStatus, setSystemStatus] = useState({
    database: { status: 'connected', responseTime: 12, uptime: '99.9%' },
    api: { status: 'healthy', responseTime: 45, uptime: '99.8%' },
    authentication: { status: 'active', responseTime: 8, uptime: '100%' },
    scanning: { status: 'idle', activeScans: 0, queuedScans: 0 },
    performance: { status: 'monitoring', cpuUsage: 23, memoryUsage: 67, diskUsage: 45 }
  });

  // Recent Activity
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchSystemSettings();
    fetchSystemStatus();
    fetchRecentActivity();
    
    // Set up real-time updates for system status
    const statusInterval = setInterval(() => {
      fetchSystemStatus();
    }, 10000); // Update every 10 seconds
    
    // Set up real-time updates for recent activity
    const activityInterval = setInterval(() => {
      fetchRecentActivity();
    }, 30000); // Update every 30 seconds
    
    return () => {
      clearInterval(statusInterval);
      clearInterval(activityInterval);
    };
  }, []);

  const fetchSystemSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/config/system`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystemConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
      setError('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/config/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/config/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data);
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    }
  };

  const handleSaveSettings = async (category) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch(`${config.API_BASE_URL}/api/config/system/${category}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(systemConfig[category])
      });

      if (response.ok) {
        setSuccess(`${category.charAt(0).toUpperCase() + category.slice(1)} settings saved successfully!`);
      } else {
        setError('Failed to save settings');
      }
    } catch (error) {
      console.error('Save settings error:', error);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (category, field, value) => {
    setSystemConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleRestartService = async (service) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/config/restart/${service}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess(`${service} service restarted successfully`);
        // Refresh system status immediately and then continue normal updates
        await fetchSystemStatus();
        setTimeout(() => fetchSystemStatus(), 2000); // Check again after 2 seconds
      } else {
        setError(`Failed to restart ${service} service`);
      }
    } catch (error) {
      console.error('Restart service error:', error);
      setError(`Failed to restart ${service} service`);
    }
  };

  const handleBackupNow = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/config/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('Backup initiated successfully');
        fetchSystemSettings();
      } else {
        setError('Failed to initiate backup');
      }
    } catch (error) {
      console.error('Backup error:', error);
      setError('Failed to initiate backup');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      healthy: 'success',
      connected: 'success',
      active: 'success',
      idle: 'secondary',
      monitoring: 'info',
      warning: 'warning',
      error: 'danger'
    };
    return variants[status] || 'secondary';
  };

const getProgressBarVariant = (value, threshold) => {
  if (value > threshold) return 'danger';
  if (value > threshold - 10) return 'warning';
  return 'primary';
};

  const renderGeneralSettings = () => (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white py-3">
        <h5 className="mb-0">
          <FaCog className="me-2" />
          General Configuration
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Platform Name</Form.Label>
              <Form.Control
                type="text"
                value={systemConfig.general.platformName}
                onChange={(e) => handleInputChange('general', 'platformName', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Environment</Form.Label>
              <Form.Select
                value={systemConfig.general.environment}
                onChange={(e) => handleInputChange('general', 'environment', e.target.value)}
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Timezone</Form.Label>
              <Form.Select
                value={systemConfig.general.timezone}
                onChange={(e) => handleInputChange('general', 'timezone', e.target.value)}
              >
                <option value="UTC">UTC</option>
                <option value="EST">EST</option>
                <option value="PST">PST</option>
                <option value="GMT">GMT</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Date Format</Form.Label>
              <Form.Select
                value={systemConfig.general.dateFormat}
                onChange={(e) => handleInputChange('general', 'dateFormat', e.target.value)}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Time Format</Form.Label>
              <Form.Select
                value={systemConfig.general.timeFormat}
                onChange={(e) => handleInputChange('general', 'timeFormat', e.target.value)}
              >
                <option value="12h">12-hour</option>
                <option value="24h">24-hour</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <div className="d-flex justify-content-end">
          <Button 
            variant="primary" 
            onClick={() => handleSaveSettings('general')} 
            disabled={saving}
            style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
          >
            {saving ? <Spinner animation="border" size="sm" /> : <FaSave className="me-2" />}
            Save General Settings
          </Button>
        </div>
      </Card.Body>
    </Card>
  );

  const renderSecuritySettings = () => (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white py-3">
        <h5 className="mb-0">
          <FaShieldAlt className="me-2" />
          Security Configuration
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <h6 className="text-muted mb-3">Password Policies</h6>
            <Form.Group className="mb-3">
              <Form.Label>Minimum Password Length</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.security.passwordMinLength}
                onChange={(e) => handleInputChange('security', 'passwordMinLength', parseInt(e.target.value))}
                min="6"
                max="32"
              />
            </Form.Group>
            <Form.Check
              type="checkbox"
              label="Require Uppercase Letters"
              checked={systemConfig.security.passwordRequireUppercase}
              onChange={(e) => handleInputChange('security', 'passwordRequireUppercase', e.target.checked)}
              className="mb-2"
            />
            <Form.Check
              type="checkbox"
              label="Require Numbers"
              checked={systemConfig.security.passwordRequireNumbers}
              onChange={(e) => handleInputChange('security', 'passwordRequireNumbers', e.target.checked)}
              className="mb-2"
            />
            <Form.Check
              type="checkbox"
              label="Require Special Characters"
              checked={systemConfig.security.passwordRequireSpecialChars}
              onChange={(e) => handleInputChange('security', 'passwordRequireSpecialChars', e.target.checked)}
              className="mb-3"
            />
          </Col>
          <Col md={6}>
            <h6 className="text-muted mb-3">Session & Authentication</h6>
            <Form.Group className="mb-3">
              <Form.Label>Session Timeout (minutes)</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.security.sessionTimeout}
                onChange={(e) => handleInputChange('security', 'sessionTimeout', parseInt(e.target.value))}
                min="5"
                max="480"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Max Login Attempts</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.security.maxLoginAttempts}
                onChange={(e) => handleInputChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                min="3"
                max="10"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Lockout Duration (minutes)</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.security.lockoutDuration}
                onChange={(e) => handleInputChange('security', 'lockoutDuration', parseInt(e.target.value))}
                min="5"
                max="1440"
              />
            </Form.Group>
            <Form.Check
              type="checkbox"
              label="Enable Two-Factor Authentication"
              checked={systemConfig.security.enableTwoFactor}
              onChange={(e) => handleInputChange('security', 'enableTwoFactor', e.target.checked)}
              className="mb-3"
            />
          </Col>
        </Row>
        <div className="d-flex justify-content-end">
          <Button 
            variant="primary" 
            onClick={() => handleSaveSettings('security')} 
            disabled={saving}
            style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
          >
            {saving ? <Spinner animation="border" size="sm" /> : <FaSave className="me-2" />}
            Save Security Settings
          </Button>
        </div>
      </Card.Body>
    </Card>
  );

  const renderScanningSettings = () => (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white py-3">
        <h5 className="mb-0">
          <FaSync className="me-2" />
          Scanning Configuration
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <h6 className="text-muted mb-3">Scan Limits</h6>
            <Form.Group className="mb-3">
              <Form.Label>Default Scan Timeout (seconds)</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.scanning.defaultScanTimeout}
                onChange={(e) => handleInputChange('scanning', 'defaultScanTimeout', parseInt(e.target.value))}
                min="60"
                max="3600"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Max Concurrent Scans</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.scanning.maxConcurrentScans}
                onChange={(e) => handleInputChange('scanning', 'maxConcurrentScans', parseInt(e.target.value))}
                min="1"
                max="20"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Scan Results Retention (days)</Form.Label>
              <Form.Control
                type="number"
                value={systemConfig.scanning.scanResultsRetention}
                onChange={(e) => handleInputChange('scanning', 'scanResultsRetention', parseInt(e.target.value))}
                min="7"
                max="365"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <h6 className="text-muted mb-3">Scan Types</h6>
            <Form.Check
              type="checkbox"
              label="Enable Vulnerability Scanning"
              checked={systemConfig.scanning.enableVulnerabilityScanning}
              onChange={(e) => handleInputChange('scanning', 'enableVulnerabilityScanning', e.target.checked)}
              className="mb-2"
            />
            <Form.Check
              type="checkbox"
              label="Enable Port Scanning"
              checked={systemConfig.scanning.enablePortScanning}
              onChange={(e) => handleInputChange('scanning', 'enablePortScanning', e.target.checked)}
              className="mb-2"
            />
            <Form.Check
              type="checkbox"
              label="Enable Service Detection"
              checked={systemConfig.scanning.enableServiceDetection}
              onChange={(e) => handleInputChange('scanning', 'enableServiceDetection', e.target.checked)}
              className="mb-3"
            />
            <h6 className="text-muted mb-3">Scheduled Scans</h6>
            <Form.Check
              type="checkbox"
              label="Auto-Schedule Scans"
              checked={systemConfig.scanning.autoScheduleScans}
              onChange={(e) => handleInputChange('scanning', 'autoScheduleScans', e.target.checked)}
              className="mb-2"
            />
            <Form.Group className="mb-3">
              <Form.Label>Schedule Frequency</Form.Label>
              <Form.Select
                value={systemConfig.scanning.scanScheduleFrequency}
                onChange={(e) => handleInputChange('scanning', 'scanScheduleFrequency', e.target.value)}
                disabled={!systemConfig.scanning.autoScheduleScans}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <div className="d-flex justify-content-end">
          <Button 
            variant="primary" 
            onClick={() => handleSaveSettings('scanning')} 
            disabled={saving}
            style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
          >
            {saving ? <Spinner animation="border" size="sm" /> : <FaSave className="me-2" />}
            Save Scanning Settings
          </Button>
        </div>
      </Card.Body>
    </Card>
  );

  const renderSystemStatus = () => (
    <>
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FaServer className="me-2" />
                System Status
              </h5>
              <div className="d-flex align-items-center">
                <small className="text-muted me-2">
                  <FaSync className="me-1" />
                  Real-time updates every 10s
                </small>
                <Badge bg="success" className="pulse">
                  ● Live
                </Badge>
              </div>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <h6 className="text-muted mb-3">Core Services</h6>
                  <Table borderless size="sm">
                    <tbody>
                      <tr>
                        <td><strong>Database</strong></td>
                        <td>
                          <Badge bg={getStatusBadge(systemStatus.database.status)}>
                            {systemStatus.database.status}
                          </Badge>
                        </td>
                        <td className="text-muted">{systemStatus.database.responseTime}ms</td>
                        <td className="text-muted">{systemStatus.database.uptime}</td>
                        <td>
                          <Button variant="outline-secondary" size="sm" onClick={() => handleRestartService('database')}>
                            <FaSync />
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>API Server</strong></td>
                        <td>
                          <Badge bg={getStatusBadge(systemStatus.api.status)}>
                            {systemStatus.api.status}
                          </Badge>
                        </td>
                        <td className="text-muted">{systemStatus.api.responseTime}ms</td>
                        <td className="text-muted">{systemStatus.api.uptime}</td>
                        <td>
                          <div>
                            <Button 
                              variant="outline-secondary" 
                              onClick={() => window.location.reload()}
                              style={{
                                backgroundColor: 'transparent',
                                border: '1px solid #6c757d',
                                color: '#6c757d'
                              }}
                            >
                              <FaSync className="me-2" />
                              Refresh
                            </Button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Authentication</strong></td>
                        <td>
                          <Badge bg={getStatusBadge(systemStatus.authentication.status)}>
                            {systemStatus.authentication.status}
                          </Badge>
                        </td>
                        <td className="text-muted">{systemStatus.authentication.responseTime}ms</td>
                        <td className="text-muted">{systemStatus.authentication.uptime}</td>
                        <td>
                          <Button variant="outline-secondary" size="sm" onClick={() => handleRestartService('auth')}>
                            <FaSync />
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
                <Col md={6}>
                  <h6 className="text-muted mb-3">System Resources</h6>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>CPU Usage</span>
                      <span>{systemStatus.performance.cpuUsage}%</span>
                    </div>
                    <ProgressBar variant={getProgressBarVariant(systemStatus.performance.cpuUsage, 80)} now={systemStatus.performance.cpuUsage} />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Memory Usage</span>
                      <span>{systemStatus.performance.memoryUsage}%</span>
                    </div>
                    <ProgressBar variant={getProgressBarVariant(systemStatus.performance.memoryUsage, 85)} now={systemStatus.performance.memoryUsage} />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Disk Usage</span>
                      <span>{systemStatus.performance.diskUsage}%</span>
                    </div>
                    <ProgressBar variant={getProgressBarVariant(systemStatus.performance.diskUsage, 90)} now={systemStatus.performance.diskUsage} />
                  </div>
                  <div className="mt-3">
                    <h6 className="text-muted mb-2">Scanning Status</h6>
                    <p className="mb-1">Active Scans: <Badge bg="info">{systemStatus.scanning.activeScans}</Badge></p>
                    <p className="mb-1">Queued Scans: <Badge bg="warning">{systemStatus.scanning.queuedScans}</Badge></p>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FaClock className="me-2" />
                Recent System Activity
              </h5>
              <div className="d-flex align-items-center">
                <small className="text-muted me-2">
                  <FaSync className="me-1" />
                  Updates every 30s
                </small>
                <Badge bg="info">
                  ● Live
                </Badge>
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive hover size="sm">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((activity) => (
                    <tr key={activity.id}>
                      <td>{activity.timestamp}</td>
                      <td>
                        <Badge bg="secondary">{activity.type}</Badge>
                      </td>
                      <td>{activity.action}</td>
                      <td>{activity.user}</td>
                      <td>
                        <Badge bg={activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'warning' : 'danger'}>
                          {activity.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );

  if (loading) {
    return (
      <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <p className="text-muted mt-2">Loading system settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ color: '#1594EA', fontWeight: '600' }}>
            <FaCog className="me-2" style={{ color: '#1594EA' }} />
            System Settings
          </h2>
          <p className="text-muted mb-0">Configure and manage platform settings</p>
        </div>
        <div className="d-flex justify-content-end">
        <Button 
          variant="outline-secondary" 
          onClick={fetchSystemSettings}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #6c757d',
            color: '#6c757d'
          }}
        >
          <FaUndo className="me-2" />
          Reset Changes
        </Button>
      </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}><FaExclamationTriangle className="me-2" />{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}><FaCheckCircle className="me-2" />{success}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="general" title="General">
          {renderGeneralSettings()}
        </Tab>
        <Tab eventKey="security" title="Security">
          {renderSecuritySettings()}
        </Tab>
        <Tab eventKey="scanning" title="Scanning">
          {renderScanningSettings()}
        </Tab>
        <Tab eventKey="status" title="System Status">
          {renderSystemStatus()}
        </Tab>
      </Tabs>
    </div>
  );
};

export default SystemSettings;
