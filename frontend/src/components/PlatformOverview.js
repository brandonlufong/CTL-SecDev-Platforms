import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Badge, 
  Alert, 
  Spinner,
  Button,
  ProgressBar,
  Table,
  Dropdown
} from 'react-bootstrap';
import { 
  FaServer, 
  FaNetworkWired, 
  FaShieldVirus, 
  FaUsers, 
  FaChartBar,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaBell,
  FaArrowUp,
  FaArrowDown,
  FaEllipsisH,
  FaTrophy,
  FaFire,
  FaSnowflake,
  FaBolt
} from 'react-icons/fa';
import axios from 'axios';
import config from '../config';

const PlatformOverview = () => {
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchOverviewData();
  }, [timeRange]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.API_BASE_URL}/api/platform/overview?range=${timeRange}`);
      setOverviewData(response.data);
    } catch (err) {
      setError('Failed to fetch platform overview data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <FaArrowUp className="text-success" />;
    if (trend < 0) return <FaArrowDown className="text-danger" />;
    return <FaArrowUp className="text-muted" />;
  };

  const getTrendColor = (trend) => {
    if (trend > 0) return 'success';
    if (trend < 0) return 'danger';
    return 'secondary';
  };

  const getRiskLevel = (score) => {
    if (score >= 80) return { color: 'danger', icon: FaFire, label: 'Critical' };
    if (score >= 60) return { color: 'warning', icon: FaBolt, label: 'High' };
    if (score >= 40) return { color: 'info', icon: FaSnowflake, label: 'Medium' };
    return { color: 'success', icon: FaCheckCircle, label: 'Low' };
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" className="text-primary" />
        <p className="text-muted mt-2">Loading platform overview...</p>
      </div>
    );
  }

  return (
    <div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      
      {/* Platform Status Header */}
      <Card className="mb-4 border-0 shadow-sm bg-gradient" style={{ 
        background: 'linear-gradient(135deg, #1594EA 0%, #0D6EBD 100%)'
      }}>
        <Card.Body className="py-4">
          <Row className="align-items-center">
            <Col md={8}>
              <h3 className="mb-2" style={{ color: '#1F2937', fontWeight: '600' }}>Platform Overview</h3>
              <p className="mb-0" style={{ color: '#374151', fontSize: '1rem', lineHeight: '1.5' }}>
                Real-time monitoring and insights for CAMTEL platforms
              </p>
            </Col>
            <Col md={4} className="text-end">
              <div className="d-flex align-items-center justify-content-end gap-3">
                <div>
                  <small style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>System Status</small>
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-success me-2" style={{ width: '12px', height: '12px' }}></div>
                    <strong style={{ color: '#1F2937', fontSize: '1rem' }}>Operational</strong>
                  </div>
                </div>
                <Dropdown>
                  <Dropdown.Toggle variant="outline-light" size="sm">
                    {timeRange === '24h' ? 'Last 24h' : timeRange === '7d' ? 'Last 7d' : 'Last 30d'}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => setTimeRange('24h')}>Last 24 hours</Dropdown.Item>
                    <Dropdown.Item onClick={() => setTimeRange('7d')}>Last 7 days</Dropdown.Item>
                    <Dropdown.Item onClick={() => setTimeRange('30d')}>Last 30 days</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Key Metrics */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaServer size={32} className="text-primary mb-2" />
              <h3 className="mb-1">{overviewData?.totalAssets || 0}</h3>
              <p className="text-muted mb-2">Total Assets</p>
              <Badge bg={getTrendColor(overviewData?.assetTrend || 0)} className="mb-2">
                {getTrendIcon(overviewData?.assetTrend || 0)}
                {Math.abs(overviewData?.assetTrend || 0)}%
              </Badge>
              <div className="text-muted small">
                {overviewData?.activeAssets || 0} active
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaShieldVirus size={32} className="text-danger mb-2" />
              <h3 className="mb-1">{overviewData?.totalVulnerabilities || 0}</h3>
              <p className="text-muted mb-2">Vulnerabilities</p>
              <Badge bg={getTrendColor(-(overviewData?.vulnerabilityTrend || 0))} className="mb-2">
                {getTrendIcon(-(overviewData?.vulnerabilityTrend || 0))}
                {Math.abs(overviewData?.vulnerabilityTrend || 0)}%
              </Badge>
              <div className="text-muted small">
                {overviewData?.criticalVulns || 0} critical
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaUsers size={32} className="text-success mb-2" />
              <h3 className="mb-1">{overviewData?.totalUsers || 0}</h3>
              <p className="text-muted mb-2">Active Users</p>
              <Badge bg={getTrendColor(overviewData?.userTrend || 0)} className="mb-2">
                {getTrendIcon(overviewData?.userTrend || 0)}
                {Math.abs(overviewData?.userTrend || 0)}%
              </Badge>
              <div className="text-muted small">
                {overviewData?.onlineUsers || 0} online
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaChartBar size={32} className="text-info mb-2" />
              <h3 className="mb-1">{overviewData?.complianceScore || 0}%</h3>
              <p className="text-muted mb-2">Compliance Score</p>
              <Badge bg={overviewData?.complianceScore >= 80 ? 'success' : overviewData?.complianceScore >= 60 ? 'warning' : 'danger'} className="mb-2">
                {overviewData?.complianceScore >= 80 ? 'Excellent' : overviewData?.complianceScore >= 60 ? 'Good' : 'Needs Attention'}
              </Badge>
              <div className="text-muted small">
                {overviewData?.compliantAssets || 0} compliant assets
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* System Health and Recent Activity */}
      <Row className="mb-4">
        <Col md={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaChartBar className="me-2" />
                System Health Metrics
              </h6>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3">
                <Col md={6}>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>CPU Usage</span>
                      <span>{overviewData?.systemHealth?.cpu || 0}%</span>
                    </div>
                    <ProgressBar variant={overviewData?.systemHealth?.cpu > 80 ? 'danger' : overviewData?.systemHealth?.cpu > 60 ? 'warning' : 'success'} now={overviewData?.systemHealth?.cpu || 0} />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Memory Usage</span>
                      <span>{overviewData?.systemHealth?.memory || 0}%</span>
                    </div>
                    <ProgressBar variant={overviewData?.systemHealth?.memory > 80 ? 'danger' : overviewData?.systemHealth?.memory > 60 ? 'warning' : 'success'} now={overviewData?.systemHealth?.memory || 0} />
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Storage Usage</span>
                      <span>{overviewData?.systemHealth?.storage || 0}%</span>
                    </div>
                    <ProgressBar variant={overviewData?.systemHealth?.storage > 80 ? 'danger' : overviewData?.systemHealth?.storage > 60 ? 'warning' : 'success'} now={overviewData?.systemHealth?.storage || 0} />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Network Load</span>
                      <span>{overviewData?.systemHealth?.network || 0}%</span>
                    </div>
                    <ProgressBar variant={overviewData?.systemHealth?.network > 80 ? 'danger' : overviewData?.systemHealth?.network > 60 ? 'warning' : 'success'} now={overviewData?.systemHealth?.network || 0} />
                  </div>
                </Col>
              </Row>
              <Row>
                <Col md={3}>
                  <div className="text-center">
                    <FaTrophy className="text-warning mb-2" size={24} />
                    <h5>{overviewData?.uptime || '99.9'}%</h5>
                    <small className="text-muted">Uptime</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center">
                    <FaBell className="text-info mb-2" size={24} />
                    <h5>{overviewData?.alerts || 0}</h5>
                    <small className="text-muted">Active Alerts</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center">
                    <FaClock className="text-success mb-2" size={24} />
                    <h5>{overviewData?.avgResponseTime || '120'}ms</h5>
                    <small className="text-muted">Avg Response</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center">
                    <FaCheckCircle className="text-primary mb-2" size={24} />
                    <h5>{overviewData?.scansCompleted || 0}</h5>
                    <small className="text-muted">Scans Today</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaExclamationTriangle className="me-2" />
                Risk Assessment
              </h6>
            </Card.Header>
            <Card.Body>
              {overviewData?.riskAssessment?.map((risk, index) => {
                const RiskIcon = getRiskLevel(risk.score).icon;
                const riskLevel = getRiskLevel(risk.score);
                return (
                  <div key={index} className="mb-3 p-3 border rounded" style={{ borderColor: `var(--bs-${riskLevel.color})` }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center">
                        <RiskIcon className={`text-${riskLevel.color} me-2`} />
                        <strong>{risk.asset}</strong>
                      </div>
                      <Badge bg={riskLevel.color}>{riskLevel.label}</Badge>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <small className="text-muted">Risk Score</small>
                      <strong>{risk.score}/100</strong>
                    </div>
                    <ProgressBar variant={riskLevel.color} now={risk.score} style={{ height: '6px' }} />
                    <small className="text-muted d-block mt-1">{risk.description}</small>
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
          <h6 className="mb-0">
            <FaClock className="me-2" />
            Recent Platform Activity
          </h6>
          <Button variant="outline-primary" size="sm">
            View All Activity
          </Button>
        </Card.Header>
        <Card.Body>
          <Table responsive hover className="align-middle">
            <thead className="table-light">
              <tr>
                <th>Timestamp</th>
                <th>Activity</th>
                <th>User</th>
                <th>Asset</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overviewData?.recentActivity?.map((activity, index) => (
                <tr key={index}>
                  <td>
                    <small className="text-muted">
                      {new Date(activity.timestamp).toLocaleString()}
                    </small>
                  </td>
                  <td>
                    <div className="d-flex align-items-center">
                      {activity.type === 'scan' && <FaShieldVirus className="text-primary me-2" />}
                      {activity.type === 'login' && <FaUsers className="text-success me-2" />}
                      {activity.type === 'alert' && <FaExclamationTriangle className="text-warning me-2" />}
                      {activity.type === 'system' && <FaServer className="text-info me-2" />}
                      {activity.description}
                    </div>
                  </td>
                  <td>{activity.user}</td>
                  <td>{activity.asset || '-'}</td>
                  <td>
                    <Badge bg={activity.status === 'success' ? 'success' : activity.status === 'warning' ? 'warning' : 'danger'}>
                      {activity.status}
                    </Badge>
                  </td>
                  <td>
                    <Button variant="outline-secondary" size="sm">
                      <FaEllipsisH />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default PlatformOverview;
