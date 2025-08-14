// import React, { useEffect, useState, useContext } from 'react';
// import {
//   Card,
//   Container,
//   Row,
//   Col,
//   Spinner,
//   Button,
//   Table,
//   Collapse,
//   ProgressBar,
//   Badge,
//   Form,
//   InputGroup,
//   Alert,
// } from 'react-bootstrap';
// import { Pie, Bar } from 'react-chartjs-2';
// import {
//   Chart as ChartJS,
//   ArcElement,
//   Tooltip,
//   Legend,
//   BarElement,
//   CategoryScale,
//   LinearScale,
// } from 'chart.js';
// import { AuthContext } from '../context/AuthContext';
// import {
//   FaSyncAlt,
//   FaBug,
//   FaListUl,
//   FaChevronDown,
//   FaChevronUp,
//   FaSearch,
//   FaShieldAlt,
//   FaExclamationTriangle,
//   FaCheckCircle,
//   FaServer,
//   FaNetworkWired,
//   FaTachometerAlt
// } from 'react-icons/fa';
// import config from '../config';

// ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

// const Dashboard = () => {
//   const { auth } = useContext(AuthContext);
//   const token = auth?.token;

//   const [summary, setSummary] = useState({
//     totalVulnerabilities: 0,
//     openVulnerabilities: 0,
//     resolvedVulnerabilities: 0,
//     totalAssets: 0,
//     onlineAssets: 0,
//     offlineAssets: 0,
//     severityCount: {},
//     statusCount: {},
//     riskLevels: {},
//     lastScanDate: null,
//   });

//   const [latestScans, setLatestScans] = useState([]);
//   const [loadingScans, setLoadingScans] = useState(false);
//   const [showScans, setShowScans] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [progress, setProgress] = useState({ percent: 0, message: '', active: false });
//   const [scanStats, setScanStats] = useState({ activeScanCount: 0, maxConcurrentScans: 3 });

//   // Fetch dashboard summary
//   const fetchSummary = async () => {
//     try {
//       const res = await fetch(`${config.API_BASE_URL}/api/dashboard/summary`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       setSummary(data);
//     } catch (err) {
//       console.error('Failed to load dashboard data');
//     }
//   };

//   // Fetch latest scans with enhanced data
//   const fetchScans = async () => {
//     setLoadingScans(true);
//     try {
//       const res = await fetch(`${config.API_BASE_URL}/api/scan/latest?limit=20`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
      
//       if (data.success) {
//         setLatestScans(data.scans || []);
//       } else {
//         console.error('Failed to load scan results');
//       }
//     } catch (err) {
//       console.error('Failed to load scan results', err);
//     } finally {
//       setLoadingScans(false);
//     }
//   };

//   useEffect(() => {
//     if (token) {
//       fetchSummary();
//       fetchScans();
//     }
//   }, [token]);

//   // Poll for scan progress
//   useEffect(() => {
//     if (!loadingScans || !token) return;

//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(`${config.API_BASE_URL}/api/scan/progress`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const data = await res.json();
        
//         if (data.success) {
//           setProgress(data.progress || { percent: 0, message: '', active: false });
//           setScanStats(data.stats || { activeScanCount: 0, maxConcurrentScans: 3 });
          
//           if (!data.progress?.active) {
//             clearInterval(interval);
//             setLoadingScans(false);
//             fetchScans(); // Refresh scan results
//             fetchSummary(); // Refresh summary data
//           }
//         }
//       } catch (err) {
//         console.error('Error fetching progress');
//         clearInterval(interval);
//         setLoadingScans(false);
//       }
//     }, 2000);
    
//     return () => clearInterval(interval);
//   }, [loadingScans, token]);

//   // Enhanced quick scan function
//   const handleQuickScan = async () => {
//     const confirmed = window.confirm('Run a quick scan for all online assets? This may take several minutes.');
//     if (!confirmed) return;

//     setLoadingScans(true);
//     setProgress({ percent: 0, message: 'Initializing quick scan...', active: true });
    
//     try {
//       const res = await fetch(`${config.API_BASE_URL}/api/scan/quick`, {
//         method: 'POST',
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
      
//       if (data.success) {
//         // Show success message
//         alert(`Quick scan completed! Scanned ${data.summary.scannedAssets} assets and found ${data.summary.totalVulnerabilities} vulnerabilities.`);
//         fetchScans();
//         fetchSummary();
//       } else {
//         alert(`Quick scan failed: ${data.message}`);
//       }
//     } catch (err) {
//       console.error('Quick scan error:', err);
//       alert('Quick scan failed due to server error.');
//     } finally {
//       setLoadingScans(false);
//       setProgress({ percent: 100, message: 'Quick scan completed', active: false });
//     }
//   };

//   // Enhanced severity colors
//   const severityColors = {
//     Critical: '#dc3545',
//     High: '#fd7e14',
//     Medium: '#ffc107',
//     Low: '#20c997',
//     Informational: '#6c757d',
//   };

//   // Risk level colors
//   const riskColors = {
//     Critical: '#dc3545',
//     High: '#fd7e14',
//     Medium: '#ffc107',
//     Low: '#28a745',
//   };

//   // Filter scan results based on search term
//   const filteredScans = latestScans.filter((scan) =>
//     Object.values(scan)
//       .join(' ')
//       .toLowerCase()
//       .includes(searchTerm.toLowerCase())
//   );

//   // Enhanced chart data for vulnerabilities by severity
//   const severityChartData = {
//     labels: Object.keys(summary.severityCount || {}),
//     datasets: [
//       {
//         data: Object.values(summary.severityCount || {}),
//         backgroundColor: Object.keys(summary.severityCount || {}).map(
//           severity => severityColors[severity] || '#6c757d'
//         ),
//         borderWidth: 2,
//         borderColor: '#fff',
//       },
//     ],
//   };

//   // Chart data for vulnerability status
//   const statusChartData = {
//     labels: Object.keys(summary.statusCount || {}),
//     datasets: [
//       {
//         data: Object.values(summary.statusCount || {}),
//         backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
//         borderWidth: 2,
//         borderColor: '#fff',
//       },
//     ],
//   };

//   // Risk level chart data
//   const riskChartData = {
//     labels: Object.keys(summary.riskLevels || {}),
//     datasets: [
//       {
//         label: 'Assets by Risk Level',
//         data: Object.values(summary.riskLevels || {}),
//         backgroundColor: Object.keys(summary.riskLevels || {}).map(
//           risk => riskColors[risk] || '#6c757d'
//         ),
//         borderWidth: 1,
//         borderColor: '#fff',
//       },
//     ],
//   };

//   const chartOptions = {
//     responsive: true,
//     maintainAspectRatio: false,
//     plugins: {
//       legend: {
//         position: 'bottom',
//         labels: {
//           padding: 15,
//           usePointStyle: true,
//         },
//       },
//     },
//   };

//   return (
//     <Container fluid className="container py-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
//       <h3 style={{ color: '#1594EA' }} className="mb-4 d-flex align-items-center">
//         <FaTachometerAlt className="me-2"/> Dashboard Overview
//       </h3>

//       {/* Summary Cards */}
//       <Row className="mb-4">
//         <Col md={3} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Body className="text-center">
//               <FaShieldAlt size={30} className="text-warning mb-2" />
//               <h4 className="text-warning">{summary.totalVulnerabilities}</h4>
//               <p className="mb-0">Total Vulnerabilities</p>
//               <small className="text-muted">
//                 {summary.openVulnerabilities} open, {summary.resolvedVulnerabilities} resolved
//               </small>
//             </Card.Body>
//           </Card>
//         </Col>

//         <Col md={3} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Body className="text-center">
//               <FaServer size={30} className="text-primary mb-2" />
//               <h4 className="text-primary">{summary.totalAssets}</h4>
//               <p className="mb-0">Total Assets</p>
//               <small className="text-muted">
//                 {summary.onlineAssets} online, {summary.offlineAssets} offline
//               </small>
//             </Card.Body>
//           </Card>
//         </Col>

//         <Col md={3} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Body className="text-center">
//               <FaExclamationTriangle size={30} className="text-danger mb-2" />
//               <h4 className="text-danger">{summary.severityCount?.Critical || 0}</h4>
//               <p className="mb-0">Critical Vulnerabilities</p>
//               <small className="text-muted">Require immediate attention</small>
//             </Card.Body>
//           </Card>
//         </Col>

//         <Col md={3} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Body className="text-center">
//               <FaNetworkWired size={30} className="text-info mb-2" />
//               <h4 className="text-info">{scanStats.activeScanCount}</h4>
//               <p className="mb-0">Active Scans</p>
//               <small className="text-muted">
//                 Max: {scanStats.maxConcurrentScans} concurrent
//               </small>
//             </Card.Body>
//           </Card>
//         </Col>
//       </Row>

//       {/* Quick Actions */}
//       <Row className="mb-4">
//         <Col>
//           <Card className="shadow-sm">
//             <Card.Body>
//               <div className="d-flex justify-content-between align-items-center flex-wrap">
//                 <div>
//                   <h5 className="mb-1">Quick Actions</h5>
//                   <p className="text-muted mb-0">Manage your security scanning operations</p>
//                 </div>
//                 <div className="d-flex gap-2">
//                   <Button
//                     variant="success"
//                     onClick={handleQuickScan}
//                     disabled={loadingScans || progress.active}
//                     className="d-flex align-items-center"
//                   >
//                     {loadingScans || progress.active ? (
//                       <>
//                         <Spinner size="sm" animation="border" className="me-2" />
//                         Scanning...
//                       </>
//                     ) : (
//                       <>
//                         <FaSyncAlt className="me-2" /> Run Quick Scan
//                       </>
//                     )}
//                   </Button>
                  
//                   <Button
//                     variant="outline-primary"
//                     onClick={() => setShowScans(!showScans)}
//                     className="d-flex align-items-center"
//                   >
//                     <FaListUl className="me-2" />
//                     {showScans ? (
//                       <>
//                         Hide Recent Scans <FaChevronUp className="ms-1" />
//                       </>
//                     ) : (
//                       <>
//                         Show Recent Scans <FaChevronDown className="ms-1" />
//                       </>
//                     )}
//                   </Button>
//                 </div>
//               </div>

//               {/* Scan Progress */}
//               {progress.active && (
//                 <div className="mt-3">
//                   <div className="d-flex justify-content-between align-items-center mb-2">
//                     <small><strong>Scan Progress</strong></small>
//                     <small>{progress.percent}%</small>
//                   </div>
//                   <ProgressBar
//                     now={progress.percent}
//                     animated={progress.active}
//                     variant={progress.percent === 100 ? 'success' : 'info'}
//                     style={{ height: '8px' }}
//                   />
//                   <small className="text-muted mt-1 d-block">{progress.message}</small>
//                 </div>
//               )}
//             </Card.Body>
//           </Card>
//         </Col>
//       </Row>

//       {/* Charts Row */}
//       <Row className="mb-4">
//         <Col md={4} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Header>
//               <h6 className="mb-0">Vulnerabilities by Severity</h6>
//             </Card.Header>
//             <Card.Body>
//               <div style={{ height: '250px' }}>
//                 {Object.keys(summary.severityCount || {}).length > 0 ? (
//                   <Pie data={severityChartData} options={chartOptions} />
//                 ) : (
//                   <div className="d-flex align-items-center justify-content-center h-100">
//                     <div className="text-center text-muted">
//                       <FaCheckCircle size={40} className="mb-2" />
//                       <p>No vulnerabilities found</p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </Card.Body>
//           </Card>
//         </Col>

//         <Col md={4} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Header>
//               <h6 className="mb-0">Vulnerability Status</h6>
//             </Card.Header>
//             <Card.Body>
//               <div style={{ height: '250px' }}>
//                 {Object.keys(summary.statusCount || {}).length > 0 ? (
//                   <Pie data={statusChartData} options={chartOptions} />
//                 ) : (
//                   <div className="d-flex align-items-center justify-content-center h-100">
//                     <div className="text-center text-muted">
//                       <FaCheckCircle size={40} className="mb-2" />
//                       <p>No status data available</p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </Card.Body>
//           </Card>
//         </Col>

//         <Col md={4} className="mb-3">
//           <Card className="h-100 shadow-sm">
//             <Card.Header>
//               <h6 className="mb-0">Assets by Risk Level</h6>
//             </Card.Header>
//             <Card.Body>
//               <div style={{ height: '250px' }}>
//                 {Object.keys(summary.riskLevels || {}).length > 0 ? (
//                   <Bar data={riskChartData} options={chartOptions} />
//                 ) : (
//                   <div className="d-flex align-items-center justify-content-center h-100">
//                     <div className="text-center text-muted">
//                       <FaCheckCircle size={40} className="mb-2" />
//                       <p>No risk data available</p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </Card.Body>
//           </Card>
//         </Col>
//       </Row>

//       {/* Recent Scans Section */}
//       <Collapse in={showScans}>
//         <div>
//           <Card className="shadow-sm">
//             <Card.Header className="d-flex justify-content-between align-items-center">
//               <h5 className="mb-0">
//                 <FaListUl className="me-2" />
//                 Latest Scan Results
//               </h5>
//               {summary.lastScanDate && (
//                 <small className="text-muted">
//                   Last scan: {new Date(summary.lastScanDate).toLocaleString()}
//                 </small>
//               )}
//             </Card.Header>
//             <Card.Body>
//               <Row className="mb-3">
//                 <Col md={6}>
//                   <InputGroup>
//                     <InputGroup.Text>
//                       <FaSearch />
//                     </InputGroup.Text>
//                     <Form.Control
//                       type="text"
//                       placeholder="Search scans..."
//                       value={searchTerm}
//                       onChange={(e) => setSearchTerm(e.target.value)}
//                     />
//                   </InputGroup>
//                 </Col>
//               </Row>

//               {loadingScans ? (
//                 <div className="text-center py-4">
//                   <Spinner animation="border" role="status">
//                     <span className="visually-hidden">Loading...</span>
//                   </Spinner>
//                   <p className="mt-2 text-muted">Loading scan results...</p>
//                 </div>
//               ) : (
//                 <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
//                   <Table responsive striped hover>
//                     <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
//                       <tr>
//                         <th>Asset</th>
//                         <th>Port</th>
//                         <th>Service</th>
//                         <th>Product</th>
//                         <th>Version</th>
//                         <th>Vulnerabilities</th>
//                         <th>Risk Score</th>
//                         <th>Confidence</th>
//                         <th>Scanned At</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {filteredScans.length === 0 ? (
//                         <tr>
//                           <td colSpan="9" className="text-center text-muted py-4">
//                             {searchTerm ? 'No scans match your search.' : 'No scans found.'}
//                           </td>
//                         </tr>
//                       ) : (
//                         filteredScans.map((scan, i) => (
//                           <tr key={i}>
//                             <td>
//                               <strong>{scan.asset?.name || 'Unknown'}</strong>
//                               <br />
//                               <small className="text-muted">{scan.asset?.ip || '-'}</small>
//                             </td>
//                             <td><code>{scan.port ?? '-'}</code></td>
//                             <td>{scan.service ?? '-'}</td>
//                             <td>{scan.product ?? '-'}</td>
//                             <td>{scan.version ?? '-'}</td>
//                             <td>
//                               {scan.vulnerabilities?.length > 0 ? (
//                                 <Badge bg="warning">
//                                   {scan.vulnerabilities.length} found
//                                 </Badge>
//                               ) : (
//                                 <Badge bg="success">None</Badge>
//                               )}
//                             </td>
//                             <td>
//                               <Badge
//                                 bg={
//                                   scan.vulnerabilityScore >= 8
//                                     ? 'danger'
//                                     : scan.vulnerabilityScore >= 5
//                                     ? 'warning'
//                                     : scan.vulnerabilityScore > 0
//                                     ? 'info'
//                                     : 'success'
//                                 }
//                               >
//                                 {scan.vulnerabilityScore?.toFixed(1) ?? '0.0'}
//                               </Badge>
//                             </td>
//                             <td>
//                               <Badge bg="info">{scan.confidence ?? 0}%</Badge>
//                             </td>
//                             <td>
//                               <small>
//                                 {new Date(scan.scannedAt || scan.createdAt).toLocaleString()}
//                               </small>
//                             </td>
//                           </tr>
//                         ))
//                       )}
//                     </tbody>
//                   </Table>
//                 </div>
//               )}

//               {filteredScans.length > 0 && (
//                 <div className="mt-3 d-flex justify-content-between align-items-center">
//                   <small className="text-muted">
//                     Showing {filteredScans.length} of {latestScans.length} scan results
//                   </small>
//                   <Button
//                     variant="outline-primary"
//                     size="sm"
//                     onClick={() => window.open('/assets', '_blank')}
//                   >
//                     View All Assets
//                   </Button>
//                 </div>
//               )}
//             </Card.Body>
//           </Card>
//         </div>
//       </Collapse>

//       {/* Last Scan Information */}
//       {summary.lastScanDate && (
//         <Row className="mt-4">
//           <Col>
//             <Alert variant="info" className="d-flex align-items-center">
//               <FaCheckCircle className="me-2" />
//               <div>
//                 <strong>Last scan completed:</strong> {new Date(summary.lastScanDate).toLocaleString()}
//                 <br />
//                 <small>
//                   Found {summary.totalVulnerabilities} total vulnerabilities across {summary.totalAssets} assets.
//                 </small>
//               </div>
//             </Alert>
//           </Col>
//         </Row>
//       )}
//     </Container>
//   );
// };

// export default Dashboard;

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
  FaShieldAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaServer,
  FaNetworkWired,
  FaTachometerAlt
} from 'react-icons/fa';
import config from '../config';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const Dashboard = () => {
  const { token } = useContext(AuthContext);

  const [summary, setSummary] = useState({
    totalVulnerabilities: 0,
    openVulnerabilities: 0,
    resolvedVulnerabilities: 0,
    inprogressVulnerabilities: 0,
    totalAssets: 0,
    onlineAssets: 0,
    offlineAssets: 0,
    severityCount: {},
    statusCount: {},
    riskLevels: {},
    lastScanDate: null,
  });

  const [latestScans, setLatestScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [showScans, setShowScans] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '', active: false });
  const [searchTerm, setSearchTerm] = useState(''); // ✅ Added for filter
  const [scanStats, setScanStats] = useState({ activeScanCount: 0, maxConcurrentScans: 3 });

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
        const res = await fetch(`${config.API_BASE_URL}/api/scan/latest?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (data.success) {
          setLatestScans(data.scans || []);
        } else {
          console.error('Failed to load scan results');
        }
      } catch (err) {
        console.error('Failed to load scan results', err);
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
  // Enhanced severity colors
  // const severityColors = {
  //   Critical: '#dc3545',
  //   High: '#fd7e14',
  //   Medium: '#ffc107',
  //   Low: '#20c997',
  //   Informational: '#6c757d',
  // };

  // Risk level colors
  const riskColors = {
    Critical: '#dc3545',
    High: '#fd7e14',
    Medium: '#ffc107',
    Low: '#28a745',
  };

  // ✅ Filter scan results based on search term
  const filteredScans =
   latestScans.filter((scan) =>
    Object.values(scan)
      .join(' ')
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Enhanced chart data for vulnerabilities by severity
  const severityChartData = {
    labels: Object.keys(summary.severityCount || {}),
    datasets: [
      {
        data: Object.values(summary.severityCount || {}),
        backgroundColor: Object.keys(summary.severityCount || {}).map(
          severity => severityColors[severity] || '#6c757d'
        ),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  // Chart data for vulnerability status
  const statusChartData = {
    labels: Object.keys(summary.statusCount || {}),
    datasets: [
      {
        data: Object.values(summary.statusCount || {}),
        backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

    // Risk level chart data
  const riskChartData = {
    labels: Object.keys(summary.riskLevels || {}),
    datasets: [
      {
        label: 'Assets by Risk Level',
        data: Object.values(summary.riskLevels || {}),
        backgroundColor: Object.keys(summary.riskLevels || {}).map(
          risk => riskColors[risk] || '#6c757d'
        ),
        borderWidth: 1,
        borderColor: '#fff',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          usePointStyle: true,
        },
      },
    },
  };

  return (
    <Container fluid className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <h3 style={{ color: '#1594EA' }} className="mb-4 d-flex align-items-center">
        <FaTachometerAlt className="me-2"/> Dashboard Overview
      </h3>

      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0 rounded-4 p-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center flex-wrap">
                <div>
                  <h5 className="mb-1">Quick Actions</h5>
                  <p className="text-muted mb-0">Manage your security scanning operations</p>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="success"
                    onClick={handleQuickScan}
                    disabled={loadingScans || progress.active}
                    className="d-flex align-items-center"
                  >
                    {loadingScans || progress.active ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <FaSyncAlt className="me-2" /> Run Quick Scan
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline-primary"
                    onClick={() => setShowScans(!showScans)}
                    className="d-flex align-items-center"
                  >
                    <FaListUl className="me-2" />
                    {showScans ? (
                      <>
                        Hide Recent Scans <FaChevronUp className="ms-1" />
                      </>
                    ) : (
                      <>
                        Show Recent Scans <FaChevronDown className="ms-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      {/* <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
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
      )} */}

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
              <Card.Title className="fw-bold"><FaShieldAlt size={30} className="" /> Total Vulnerabilities</Card.Title>
              <h3>{summary.totalVulnerabilities}</h3>
              <small className="">
                {summary.openVulnerabilities} open, {summary.resolvedVulnerabilities} resolved, {summary.inprogressVulnerabilities} in progress
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm border-0 rounded-4" style={{ backgroundColor: '#1594EA', color: '#fff' }}>
            <Card.Body>
              <Card.Title className="fw-bold"><FaServer size={30} className="" /> Total Assets</Card.Title>
              <h3>{summary.totalAssets}</h3>
              <small className="">
                {summary.onlineAssets} online, {summary.offlineAssets} offline
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm border-0 rounded-4" style={{ backgroundColor: '#dc3545', color: '#fff' }}>
            <Card.Body>
              <Card.Title className="fw-bold"> <FaExclamationTriangle size={30} className="" /> Open Vulnerabilities</Card.Title>
              <h3>{summary.openVulnerabilities}</h3>
              <small className="">{summary.severityCount?.Critical || 0} Critical, Requires immediate attention</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-white bg-success shadow-sm border-0 rounded-4">
            <Card.Body className="">
              <Card.Title className="fw-bold">               <FaCheckCircle size={30} className="" /> Resolved Vulnerabilities</Card.Title>
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
