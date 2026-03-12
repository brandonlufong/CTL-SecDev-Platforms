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
  Pagination,
  Dropdown,
  Nav,
  ProgressBar
} from 'react-bootstrap';
import {
  FaHistory,
  FaSearch,
  FaDownload,
  FaTrash,
  FaFilter,
  FaEye,
  FaEyeSlash,
  FaFileAlt,
  FaServer,
  FaDatabase,
  FaShieldAlt,
  FaUser,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaBug,
  FaSync,
  FaCalendarAlt,
  FaClock,
  FaNetworkWired,
  FaCogs,
  FaLock,
  FaKey,
  FaChartLine,
  FaFileExport,
  FaFileArchive,
  FaCompress,
  FaExpand
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import config from '../config';

const SystemLogs = () => {
  const { token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('application');

  // Logs data
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logStats, setLogStats] = useState({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(50);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    level: 'all',
    service: 'all',
    dateRange: '24h',
    search: '',
    severity: 'all',
    action: 'all',
    user: 'all'
  });

  // Log levels and services
  const logLevels = ['error', 'warn', 'info', 'debug'];
  const services = ['application', 'database', 'auth', 'api', 'scan', 'system', 'security', 'network'];
  const severities = ['critical', 'high', 'medium', 'low', 'info'];

  useEffect(() => {
    fetchLogs();
    fetchLogStats();
  }, [filters, currentPage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');

      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: logsPerPage,
        ...filters
      });

      const response = await fetch(`${config.API_BASE_URL}/api/logs?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setFilteredLogs(data.logs || []);
        setTotalLogs(data.total || 0);
      } else {
        setError('Failed to fetch logs');
      }
    } catch (error) {
      console.error('Fetch logs error:', error);
      setError('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogStats = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/logs/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogStats(data);
      }
    } catch (error) {
      console.error('Fetch log stats error:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleClearLogs = async (level) => {
    if (!window.confirm(`Are you sure you want to clear all ${level} logs?`)) {
      return;
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/logs/clear/${level}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess(`${level} logs cleared successfully`);
        fetchLogs();
        fetchLogStats();
      } else {
        setError('Failed to clear logs');
      }
    } catch (error) {
      console.error('Clear logs error:', error);
      setError('Failed to clear logs');
    }
  };

  const handleExportLogs = async (format) => {
    try {
      const queryParams = new URLSearchParams({
        format,
        ...filters
      });

      const response = await fetch(`${config.API_BASE_URL}/api/logs/export?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess(`Logs exported successfully as ${format.toUpperCase()}`);
      } else {
        setError('Failed to export logs');
      }
    } catch (error) {
      console.error('Export logs error:', error);
      setError('Failed to export logs');
    }
  };

  const handleArchiveLogs = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/logs/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('Logs archived successfully');
        fetchLogs();
        fetchLogStats();
      } else {
        setError('Failed to archive logs');
      }
    } catch (error) {
      console.error('Archive logs error:', error);
      setError('Failed to archive logs');
    }
  };

  const getLevelBadge = (level) => {
    const variants = {
      error: 'danger',
      warn: 'warning',
      info: 'info',
      debug: 'secondary'
    };
    return variants[level] || 'secondary';
  };

  const getSeverityBadge = (severity) => {
    const variants = {
      critical: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'primary',
      info: 'secondary'
    };
    return variants[severity] || 'secondary';
  };

  const getServiceIcon = (service) => {
    const icons = {
      application: <FaFileAlt />,
      database: <FaDatabase />,
      auth: <FaLock />,
      api: <FaNetworkWired />,
      scan: <FaShieldAlt />,
      system: <FaServer />,
      security: <FaShieldAlt />,
      network: <FaNetworkWired />
    };
    return icons[service] || <FaFileAlt />;
  };

  const renderLogStats = () => (
    <Row className="mb-4">
      <Col md={3}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center">
            <FaFileAlt className="text-primary mb-2" size={24} />
            <h4 className="mb-1">{logStats.totalLogs || 0}</h4>
            <p className="text-muted mb-0">Total Logs</p>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center">
            <FaExclamationTriangle className="text-danger mb-2" size={24} />
            <h4 className="mb-1">{logStats.errorLogs || 0}</h4>
            <p className="text-muted mb-0">Errors</p>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center">
            <FaExclamationTriangle className="text-warning mb-2" size={24} />
            <h4 className="mb-1">{logStats.warningLogs || 0}</h4>
            <p className="text-muted mb-0">Warnings</p>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center">
            <FaCheckCircle className="text-success mb-2" size={24} />
            <h4 className="mb-1">{logStats.infoLogs || 0}</h4>
            <p className="text-muted mb-0">Info</p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );

  const renderFilters = () => (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Header className="bg-white py-3">
        <h5 className="mb-0">
          <FaFilter className="me-2" />
          Filters
        </h5>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={3}>
            <Form.Group className="mb-3">
              <Form.Label>Log Level</Form.Label>
              <Form.Select
                value={filters.level}
                onChange={(e) => handleFilterChange('level', e.target.value)}
              >
                <option value="all">All Levels</option>
                {logLevels.map(level => (
                  <option key={level} value={level}>{level.toUpperCase()}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group className="mb-3">
              <Form.Label>Service</Form.Label>
              <Form.Select
                value={filters.service}
                onChange={(e) => handleFilterChange('service', e.target.value)}
              >
                <option value="all">All Services</option>
                {services.map(service => (
                  <option key={service} value={service}>{service.charAt(0).toUpperCase() + service.slice(1)}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group className="mb-3">
              <Form.Label>Date Range</Form.Label>
              <Form.Select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group className="mb-3">
              <Form.Label>Severity</Form.Label>
              <Form.Select
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
              >
                <option value="all">All Severities</option>
                {severities.map(severity => (
                  <option key={severity} value={severity}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Search</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
                <Button variant="outline-secondary">
                  <FaSearch />
                </Button>
              </InputGroup>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Actions</Form.Label>
              <div className="d-flex gap-2">
                <Dropdown>
                  <Dropdown.Toggle variant="outline-primary" size="sm">
                    <FaDownload className="me-1" />
                    Export
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handleExportLogs('json')}>
                      Export as JSON
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleExportLogs('csv')}>
                      Export as CSV
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleExportLogs('txt')}>
                      Export as TXT
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
                <Button variant="outline-secondary" size="sm" onClick={handleArchiveLogs}>
                  <FaFileArchive className="me-1" />
                  Archive
                </Button>
                <Dropdown>
                  <Dropdown.Toggle variant="outline-danger" size="sm">
                    <FaTrash className="me-1" />
                    Clear
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handleClearLogs('error')}>
                      Clear Error Logs
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleClearLogs('warning')}>
                      Clear Warning Logs
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleClearLogs('info')}>
                      Clear Info Logs
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleClearLogs('debug')}>
                      Clear Debug Logs
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleClearLogs('all')}>
                      Clear All Logs
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Form.Group>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  const renderLogsTable = () => (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <FaHistory className="me-2" />
          System Logs
        </h5>
        <div>
          <Badge bg="secondary" className="me-2">
            {totalLogs} total logs
          </Badge>
          <Button variant="outline-secondary" size="sm" onClick={fetchLogs}>
            <FaSync className="me-1" />
            Refresh
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="text-muted mt-2">Loading logs...</p>
          </div>
        ) : (
          <>
            <Table responsive hover size="sm">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Level</th>
                  <th>Service</th>
                  <th>Message</th>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Severity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <small>
                        {new Date(log.timestamp).toLocaleString()}
                      </small>
                    </td>
                    <td>
                      <Badge bg={getLevelBadge(log.level)}>
                        {log.level.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        {getServiceIcon(log.service)}
                        <span className="ms-2">{log.service}</span>
                      </div>
                    </td>
                    <td>
                      <div className="text-truncate" style={{ maxWidth: '200px' }}>
                        {log.message}
                      </div>
                    </td>
                    <td>
                      <small>{log.user || 'system'}</small>
                    </td>
                    <td>
                      <code>{log.ipAddress || '-'}</code>
                    </td>
                    <td>
                      <Badge bg={getSeverityBadge(log.severity)}>
                        {log.severity || 'low'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <FaEye />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            
            {totalLogs > logsPerPage && (
              <div className="d-flex justify-content-center mt-3">
                <Pagination>
                  <Pagination.Prev
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  />
                  {[...Array(Math.ceil(totalLogs / logsPerPage))].map((_, index) => (
                    <Pagination.Item
                      key={index + 1}
                      active={currentPage === index + 1}
                      onClick={() => setCurrentPage(index + 1)}
                    >
                      {index + 1}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next
                    disabled={currentPage === Math.ceil(totalLogs / logsPerPage)}
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalLogs / logsPerPage), prev + 1))}
                  />
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );

  const renderLogDetails = () => (
    <Modal show={!!selectedLog} onHide={() => setSelectedLog(null)} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Log Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {selectedLog && (
          <div>
            <Row className="mb-3">
              <Col md={6}>
                <strong>Timestamp:</strong>
                <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
              </Col>
              <Col md={6}>
                <strong>Level:</strong>
                <p>
                  <Badge bg={getLevelBadge(selectedLog.level)}>
                    {selectedLog.level.toUpperCase()}
                  </Badge>
                </p>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <strong>Service:</strong>
                <p>
                  {getServiceIcon(selectedLog.service)} {selectedLog.service}
                </p>
              </Col>
              <Col md={6}>
                <strong>Severity:</strong>
                <p>
                  <Badge bg={getSeverityBadge(selectedLog.severity)}>
                    {selectedLog.severity || 'low'}
                  </Badge>
                </p>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={6}>
                <strong>User:</strong>
                <p>{selectedLog.user || 'system'}</p>
              </Col>
              <Col md={6}>
                <strong>IP Address:</strong>
                <p><code>{selectedLog.ipAddress || '-'}</code></p>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col md={12}>
                <strong>Message:</strong>
                <p>{selectedLog.message}</p>
              </Col>
            </Row>
            {selectedLog.details && (
              <Row className="mb-3">
                <Col md={12}>
                  <strong>Details:</strong>
                  <pre className="bg-light p-3 rounded">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </Col>
              </Row>
            )}
            {selectedLog.stackTrace && (
              <Row className="mb-3">
                <Col md={12}>
                  <strong>Stack Trace:</strong>
                  <pre className="bg-light p-3 rounded text-danger">
                    {selectedLog.stackTrace}
                  </pre>
                </Col>
              </Row>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setSelectedLog(null)}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const renderServiceLogs = () => (
    <Tabs
      activeKey={activeTab}
      onSelect={(k) => setActiveTab(k)}
      className="mb-4"
    >
      {services.map(service => (
        <Tab eventKey={service} title={
          <span>
            {getServiceIcon(service)}
            <span className="ms-2">{service.charAt(0).toUpperCase() + service.slice(1)}</span>
          </span>
        } key={service}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h5 className="mb-0">
                {getServiceIcon(service)}
                <span className="ms-2">{service.charAt(0).toUpperCase() + service.slice(1)} Logs</span>
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="text-muted mt-2">Loading {service} logs...</p>
              </div>
            </Card.Body>
          </Card>
        </Tab>
      ))}
    </Tabs>
  );

  if (loading && !logs.length) {
    return (
      <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <p className="text-muted mt-2">Loading system logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ color: '#1F2937', fontWeight: '600' }}>
            <FaHistory className="me-2" />
            System Logs
          </h2>
          <p className="text-muted mb-0">View and manage system logs and audit trails</p>
        </div>
        <div>
          <Button variant="outline-secondary" onClick={fetchLogs}>
            <FaSync className="me-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}><FaExclamationTriangle className="me-2" />{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}><FaCheckCircle className="me-2" />{success}</Alert>}

      {renderLogStats()}
      {renderFilters()}
      {renderLogsTable()}
      {renderLogDetails()}
    </div>
  );
};

export default SystemLogs;
