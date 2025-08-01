import React, { useEffect, useState, useContext } from 'react';
import {
  Card,
  Container,
  Row,
  Col,
  Spinner,
  Button,
  Table,
  Collapse,
  ProgressBar,
  Badge,
  Form,
  InputGroup,
} from 'react-bootstrap';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { AuthContext } from '../context/AuthContext';
import {
  FaSyncAlt,
  FaBug,
  FaListUl,
  FaChevronDown,
  FaChevronUp,
  FaSearch,
} from 'react-icons/fa';
import config from '../config';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const Dashboard = () => {
  const { token } = useContext(AuthContext);

  const [summary, setSummary] = useState({
    totalVulnerabilities: 0,
    openVulnerabilities: 0,
    resolvedVulnerabilities: 0,
    totalAssets: 0,
    severityCount: {},
    statusCount: {},
  });

  const [latestScans, setLatestScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [showScans, setShowScans] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '', active: false });
  const [searchTerm, setSearchTerm] = useState(''); // ✅ Added for filter

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch(`${config.API_BASE_URL}/api/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSummary(data);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [token]);

  useEffect(() => {
    const fetchScans = async () => {
      setLoadingScans(true);
      try {
        const res = await fetch(`${config.API_BASE_URL}/api/scan/latest`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setLatestScans(data);
      } catch (err) {
        console.error('Failed to load scan results');
      } finally {
        setLoadingScans(false);
      }
    };

    fetchScans();
  }, [token]);

  useEffect(() => {
    if (!loadingScans) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${config.API_BASE_URL}/api/scan/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setProgress(data);
        if (!data.active) clearInterval(interval);
      } catch (err) {
        console.error('Error fetching progress');
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [loadingScans, token]);

  const handleQuickScan = async () => {
    const confirmed = window.confirm('Run a quick scan for all assets?');
    if (!confirmed) return;

    setLoadingScans(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/quick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLatestScans(data.logs || []);
      alert('Scan completed!');
    } catch (err) {
      console.error(err);
      alert('Quick scan failed.');
    } finally {
      setLoadingScans(false);
      setProgress({ percent: 0, message: '', active: false });
    }
  };

  const severityColors = {
    Critical: 'danger',
    High: 'warning',
    Medium: 'info',
    Low: 'secondary',
  };

  // ✅ Filter scan results based on search term
  const filteredScans = latestScans.filter((scan) =>
    Object.values(scan)
      .join(' ')
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <Container fluid className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <h3 style={{ color: '#1594EA' }} className="mb-4 d-flex align-items-center">
        <FaBug className="me-2"/> Dashboard Overview
      </h3>

      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <Button
          variant="primary"
          onClick={handleQuickScan}
          disabled={loadingScans}
          className="d-flex align-items-center gap-2 rounded-pill shadow-sm"
          style={{ backgroundColor: '#1594EA', border: 'none' }}
        >
          {loadingScans ? (
            <>
              <Spinner size="sm" animation="border" />
              Scanning...
            </>
          ) : (
            <>
              <FaSyncAlt /> Run Quick Scan
            </>
          )}
        </Button>

        <Button
          variant="light"
          onClick={() => setShowScans(!showScans)}
          className="d-flex align-items-center gap-2 border rounded-pill shadow-sm"
          style={{ color: '#1594EA' }}
        >
          <FaListUl />
          {showScans ? (
            <>
              Hide Recent Scan Logs <FaChevronUp />
            </>
          ) : (
            <>
              Show Recent Scan Logs <FaChevronDown />
            </>
          )}
        </Button>
      </div>

      {loadingScans && progress.active && (
        <div className="mb-4">
          <strong className="text-muted">{progress.message}</strong>
          <ProgressBar
            now={progress.percent}
            label={`${progress.percent}%`}
            animated
            striped
            variant="primary"
            className="rounded-pill"
          />
        </div>
      )}

      <Collapse in={showScans}>
        <div className="mb-5">
          <h5 className="mb-3 text-secondary fw-semibold d-flex align-items-center">
            <FaListUl className="me-2" />
            Latest Scan Results
          </h5>

          {/* ✅ Search Bar */}
          <InputGroup className="mb-3">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              placeholder="Search scans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          {loadingScans ? (
            <Spinner animation="border" />
          ) : (
            <Table striped bordered hover responsive className="align-middle shadow-sm rounded">
              <thead style={{ backgroundColor: '#1594EA', color: '#fff' }}>
                <tr>
                  <th>Asset</th>
                  <th>Port</th>
                  <th>Protocol</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Product</th>
                  <th>Version</th>
                  <th>CPE</th>
                  <th>Score</th>
                  <th>#Vulns</th>
                  <th>Notes</th>
                  <th>Scanned At</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="text-center text-muted">
                      No scans found.
                    </td>
                  </tr>
                ) : (
                  filteredScans.map((scan, i) => (
                    <tr key={i}>
                      <td>{scan.asset?.name || scan.assetName || scan.host || 'Unknown'}</td>
                      <td>{scan.port ?? '-'}</td>
                      <td>{scan.protocol ?? '-'}</td>
                      <td>{scan.state ?? '-'}</td>
                      <td>{scan.service ?? '-'}</td>
                      <td>{scan.product ?? '-'}</td>
                      <td>{scan.version ?? '-'}</td>
                      <td>{scan.cpe ?? '-'}</td>
                      <td>
                        <Badge
                          bg={
                            scan.vulnerabilityScore >= 8
                              ? 'danger'
                              : scan.vulnerabilityScore >= 5
                              ? 'warning'
                              : scan.vulnerabilityScore > 0
                              ? 'info'
                              : 'secondary'
                          }
                          className="rounded-pill px-3"
                        >
                          {scan.vulnerabilityScore ?? 0}
                        </Badge>
                      </td>
                      <td>{scan.vulnerabilities?.length || 0}</td>
                      <td style={{ whiteSpace: 'pre-line', maxWidth: 200 }}>
                        {scan.notes || '-'}
                      </td>
                      <td>{new Date(scan.scannedAt || scan.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </div>
      </Collapse>

      <Row className="mb-4 g-4">
        <Col md={3}>
          <Card className="shadow-sm border-0 rounded-4" style={{ backgroundColor: '#1594EA', color: '#fff' }}>
            <Card.Body>
              <Card.Title className="fw-bold">Total Vulnerabilities</Card.Title>
              <h3>{summary.totalVulnerabilities}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm border-0 rounded-4" style={{ backgroundColor: '#1594EA', color: '#fff' }}>
            <Card.Body>
              <Card.Title className="fw-bold">Total Assets</Card.Title>
              <h3>{summary.totalAssets}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm border-0 rounded-4" style={{ backgroundColor: '#dc3545', color: '#fff' }}>
            <Card.Body>
              <Card.Title className="fw-bold">Open Vulnerabilities</Card.Title>
              <h3>{summary.openVulnerabilities}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-white bg-success shadow-sm border-0 rounded-4">
            <Card.Body>
              <Card.Title className="fw-bold">Resolved Vulnerabilities</Card.Title>
              <h4>{summary.resolvedVulnerabilities}</h4>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h4 style={{ color: '#1594EA' }} className="mt-5">Vulnerabilities by Severity</h4>
      <Row className="g-4 mt-2">
        {Object.entries(summary.severityCount).map(([level, count]) => (
          <Col md={3} key={level}>
            <Card
              className={`shadow-sm border-0 rounded-4 text-white`}
              style={{ backgroundColor: severityColors[level] === 'danger' ? '#dc3545' : severityColors[level] === 'warning' ? '#fd7e14' : severityColors[level] === 'info' ? '#0dcaf0' : '#6c757d' }}
            >
              <Card.Body>
                <Card.Title className="fw-bold">{level}</Card.Title>
                <h4>{count}</h4>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <h4 style={{ color: '#1594EA' }} className="mt-5">Vulnerability Overview</h4>
      <Row>
        <Col md={6}>
        <Card className="shadow-sm border-0 rounded-4 p-3">
          <h6 className="text-center text-muted">By Severity</h6>
          <Pie
            data={{
              labels: Object.keys(summary.severityCount),
              datasets: [
                {
                  data: Object.values(summary.severityCount),
                  backgroundColor: ['#dc3545', '#fd7e14', '#0dcaf0', '#6c757d'],
                  borderWidth: 1,
                },
              ],
            }}
            options={{ responsive: true }}
          />
        </Card>
        </Col>

        <Col md={6}>
        <Card className="shadow-sm border-0 rounded-4 p-3">
          <h6 className="text-center text-muted">By Status</h6>
          <Bar
            data={{
              labels: Object.keys(summary.statusCount),
              datasets: [
                {
                  label: 'Vulnerabilities',
                  data: Object.values(summary.statusCount),
                  backgroundColor: '#1594EA',
                },
              ],
            }}
            options={{
              responsive: true,
              scales: {
                y: { 
                  beginAtZero: true,
                  // ticks: { stepSize: 1 },
                  // grid: { color: '#e5e5e5' },
                },
                // x: {
                //   grid: { display: true },
                // },
              },
            }}
          />
        </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
