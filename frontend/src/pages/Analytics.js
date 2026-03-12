import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Alert, 
  Spinner,
  Form,
  InputGroup,
  Badge,
  Button
} from 'react-bootstrap';
import { 
  FaChartBar, 
  FaChartLine, 
  FaChartPie, 
  FaArrowUp, 
  FaArrowDown,
  FaShieldVirus,
  FaServer,
  FaNetworkWired,
  FaCalendarAlt,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock
} from 'react-icons/fa';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import axios from 'axios';
import config from '../config';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.API_BASE_URL}/api/analytics?range=${dateRange}`);
      setAnalyticsData(response.data);
    } catch (err) {
      setError('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const vulnerabilityTrendData = {
    labels: analyticsData?.vulnerabilityTrend?.labels || [],
    datasets: [
      {
        label: 'Critical',
        data: analyticsData?.vulnerabilityTrend?.critical || [],
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        tension: 0.4
      },
      {
        label: 'High',
        data: analyticsData?.vulnerabilityTrend?.high || [],
        borderColor: '#fd7e14',
        backgroundColor: 'rgba(253, 126, 20, 0.1)',
        tension: 0.4
      },
      {
        label: 'Medium',
        data: analyticsData?.vulnerabilityTrend?.medium || [],
        borderColor: '#0dcaf0',
        backgroundColor: 'rgba(13, 202, 240, 0.1)',
        tension: 0.4
      },
      {
        label: 'Low',
        data: analyticsData?.vulnerabilityTrend?.low || [],
        borderColor: '#6c757d',
        backgroundColor: 'rgba(108, 117, 125, 0.1)',
        tension: 0.4
      }
    ]
  };

  const severityDistributionData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [
      {
        data: [
          analyticsData?.severityDistribution?.critical || 0,
          analyticsData?.severityDistribution?.high || 0,
          analyticsData?.severityDistribution?.medium || 0,
          analyticsData?.severityDistribution?.low || 0
        ],
        backgroundColor: ['#dc3545', '#fd7e14', '#0dcaf0', '#6c757d'],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  const assetTypeData = {
    labels: ['Servers', 'Network Devices', 'Workstations', 'Mobile Devices', 'IoT'],
    datasets: [
      {
        data: [
          analyticsData?.assetTypes?.servers || 0,
          analyticsData?.assetTypes?.networkDevices || 0,
          analyticsData?.assetTypes?.workstations || 0,
          analyticsData?.assetTypes?.mobileDevices || 0,
          analyticsData?.assetTypes?.iot || 0
        ],
        backgroundColor: ['#1594EA', '#0D6EBD', '#0A5CBF', '#074A9D', '#05387A'],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  
  if (loading) {
    return (
      <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <p className="text-muted mt-2">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-2" style={{ color: '#1594EA' }}>
            <FaChartBar className="me-2" />
            Platform Analytics
          </h3>
          <p className="text-muted mb-0">Advanced security insights and trends</p>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* Key Metrics */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaShieldVirus size={32} className="text-danger mb-2" />
              <h3 className="mb-1">{analyticsData?.totalVulnerabilities || 0}</h3>
              <p className="text-muted mb-0">Total Vulnerabilities</p>
              <Badge bg="danger" className="mt-2">
                <FaArrowUp className="me-1" />
                +12% this month
              </Badge>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaServer size={32} className="text-primary mb-2" />
              <h3 className="mb-1">{analyticsData?.totalAssets || 0}</h3>
              <p className="text-muted mb-0">Total Assets</p>
              <Badge bg="success" className="mt-2">
                <FaArrowUp className="me-1" />
                +5% this month
              </Badge>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaCheckCircle size={32} className="text-success mb-2" />
              <h3 className="mb-1">{analyticsData?.resolvedVulnerabilities || 0}</h3>
              <p className="text-muted mb-0">Resolved Issues</p>
              <Badge bg="success" className="mt-2">
                <FaArrowUp className="me-1" />
                +18% this month
              </Badge>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 border-0 shadow-sm">
            <Card.Body className="py-3">
              <FaExclamationTriangle size={32} className="text-warning mb-2" />
              <h3 className="mb-1">{analyticsData?.criticalIssues || 0}</h3>
              <p className="text-muted mb-0">Critical Issues</p>
              <Badge bg="warning" className="mt-2">
                <FaArrowDown className="me-1" />
                -8% this month
              </Badge>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0">
            <FaFilter className="me-2" />
            Analytics Filters
          </h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search analytics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button variant="outline-secondary" onClick={fetchAnalyticsData} className="w-100">
                <FaFilter className="me-2" />
                Refresh
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Charts Row 1 */}
      <Row className="mb-4">
        <Col md={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaChartLine className="me-2" />
                Vulnerability Trend Analysis
              </h6>
            </Card.Header>
            <Card.Body>
              <Line 
                key="vulnerability-trend-chart"
                data={vulnerabilityTrendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaChartPie className="me-2" />
                Severity Distribution
              </h6>
            </Card.Header>
            <Card.Body>
              <Doughnut 
                key="severity-distribution-chart"
                data={severityDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row className="mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaServer className="me-2" />
                Asset Type Distribution
              </h6>
            </Card.Header>
            <Card.Body>
              <Pie 
                key="asset-type-pie-chart"
                data={assetTypeData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </Card.Body>
          </Card>
        </Col>
              </Row>

      {/* Risk Assessment Summary */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Risk Assessment Summary
          </h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={3}>
              <div className="text-center p-3">
                <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center mx-auto mb-2" 
                     style={{ width: '60px', height: '60px', fontSize: '24px' }}>
                  HIGH
                </div>
                <h5>High Risk</h5>
                <p className="text-muted">{analyticsData?.riskAssessment?.high || 0} assets require immediate attention</p>
              </div>
            </Col>
            <Col md={3}>
              <div className="text-center p-3">
                <div className="rounded-circle bg-warning text-white d-flex align-items-center justify-content-center mx-auto mb-2" 
                     style={{ width: '60px', height: '60px', fontSize: '24px' }}>
                  MED
                </div>
                <h5>Medium Risk</h5>
                <p className="text-muted">{analyticsData?.riskAssessment?.medium || 0} assets need monitoring</p>
              </div>
            </Col>
            <Col md={3}>
              <div className="text-center p-3">
                <div className="rounded-circle bg-info text-white d-flex align-items-center justify-content-center mx-auto mb-2" 
                     style={{ width: '60px', height: '60px', fontSize: '24px' }}>
                  LOW
                </div>
                <h5>Low Risk</h5>
                <p className="text-muted">{analyticsData?.riskAssessment?.low || 0} assets are secure</p>
              </div>
            </Col>
            <Col md={3}>
              <div className="text-center p-3">
                <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center mx-auto mb-2" 
                     style={{ width: '60px', height: '60px', fontSize: '24px' }}>
                  OK
                </div>
                <h5>Compliant</h5>
                <p className="text-muted">{analyticsData?.riskAssessment?.compliant || 0} assets meet standards</p>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Analytics;
