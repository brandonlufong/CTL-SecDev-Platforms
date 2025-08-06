import React, { useState, useEffect, useContext } from 'react';
import {
  Table, Button, Modal, Form, Alert, Spinner, Badge, Dropdown, Pagination, Row, Col, Card, ProgressBar, ButtonGroup
} from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaEdit, FaTrash, FaPlus, FaSyncAlt, FaBug, FaDownload, FaSort, FaNetworkWired, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSearch
} from 'react-icons/fa';
import Select from 'react-select';
import Papa from 'papaparse'; // For CSV Export
import '../App.css'
import config from '../config';

const assetTypes = ['Server', 'Database', 'Application', 'Network Device'];
const serverStatuses = ['Online', 'Offline', 'Maintenance'];
const serverTypes = ['Physical', 'Virtual'];
const serverStates = ['Active', 'Passive'];
const serverExposures = ['Public', 'Private'];
const dbOptions = ['MySQL 8.0', 'PostgreSQL 13', 'MongoDB 5.0', 'Oracle 19c'];
const webServerOptions = ['Apache 2.4', 'Nginx 1.18', 'IIS 10'];
const osOptions = ['Windows 10', 'Ubuntu 22.04', 'macOS 13 Ventura', 'RedHat 9', 'CentOS 7'];

// Enhanced scan types
const scanTypes = [
  { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
  { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
  { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
  { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
  { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
];

const Assets = () => {
  const { token } = useContext(AuthContext);

  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAsset, setCurrentAsset] = useState({});
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    ip: '',
    type: 'Server',
    serverType: 'Physical',
    manufacturer: '',
    model: '',
    dbType: '',
    wsType: '',
    os: '',
    osVersion: '',
    status: 'Online',
    memory: '',
    diskSpace: '',
    cpuCapacity: '',
    hostDepartment: '',
    serverAdministrator: '',
    description: '',
    state: 'Active',
    exposure: 'Private',
    activeProtocols: ['HTTP', 'HTTPS'],
    owner: ''
  });

  // Enhanced scan state
  const [scanResults, setScanResults] = useState([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showScanOptionsModal, setShowScanOptionsModal] = useState(false);
  const [selectedAssetForScan, setSelectedAssetForScan] = useState(null);
  const [selectedScanType, setSelectedScanType] = useState('quick');
  const [scannedAssetName, setScannedAssetName] = useState('');
  const [scanningAssetId, setScanningAssetId] = useState(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [scanProgress, setScanProgress] = useState({ percent: 0, message: '', active: false });
  const [connectivity, setConnectivity] = useState({});
  const [testingConnectivity, setTestingConnectivity] = useState(new Set());

  // ... existing state variables ...
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch assets with enhanced data
  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAssets(data);
      setFilteredAssets(data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [token]);

  // Enhanced single asset scan with options
  const startScan = async (asset, scanType = 'quick') => {
    const { _id, name } = asset;
    setScanningAssetId(_id);
    setError('');
    setSuccess('');
    setScanResults([]);
    setScanProgress({ percent: 0, message: `Starting ${scanType} scan for ${name}...`, active: true });

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assetId: _id, scanType }),
      });

      const data = await res.json();

      if (data.success) {
        setScannedAssetName(name);
        setScanResults(data.scanResults || []);
        setSuccess(`${scanType.charAt(0).toUpperCase() + scanType.slice(1)} scan completed successfully. Found ${data.newVulnerabilities || 0} new vulnerabilities.`);
        setShowScanModal(true);
        
        // Refresh assets to update last scan date
        fetchAssets();
      } else {
        setError(data.message || 'Scan failed');
      }
    } catch (err) {
      console.error('Scan failed', err);
      setError('Scan failed due to server error.');
    } finally {
      setScanningAssetId(null);
      setScanProgress({ percent: 100, message: 'Scan completed', active: false });
    }
  };

  // Test asset connectivity
  const testConnectivity = async (asset) => {
    const { _id } = asset;
    setTestingConnectivity(prev => new Set([...prev, _id]));

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/test/${_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setConnectivity(prev => ({
          ...prev,
          [_id]: { reachable: data.reachable, testedAt: data.testedAt }
        }));
      }
    } catch (err) {
      console.error('Connectivity test failed', err);
      setConnectivity(prev => ({
        ...prev,
        [_id]: { reachable: false, testedAt: new Date() }
      }));
    } finally {
      setTestingConnectivity(prev => {
        const newSet = new Set(prev);
        newSet.delete(_id);
        return newSet;
      });
    }
  };

  // Enhanced quick scan for all assets
  const scanAllAssets = async () => {
    const confirmed = window.confirm('Run quick scan for all online assets? This may take several minutes.');
    if (!confirmed) return;

    setScanningAll(true);
    setScanProgress({ percent: 0, message: 'Initializing quick scan for all assets...', active: true });

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/quick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Quick scan completed! Scanned ${data.summary.scannedAssets} assets and found ${data.summary.totalVulnerabilities} vulnerabilities.`);
        fetchAssets(); // Refresh to show updated scan dates
      } else {
        setError(data.message || 'Quick scan failed');
      }
    } catch (err) {
      console.error('Quick scan failed', err);
      setError('Quick scan failed due to server error.');
    } finally {
      setScanningAll(false);
      setScanProgress({ percent: 100, message: 'Quick scan completed', active: false });
    }
  };

  // Batch scan for selected assets
  const batchScan = async (selectedAssetIds, scanType = 'quick') => {
    if (selectedAssetIds.length === 0) {
      setError('Please select assets to scan');
      return;
    }

    const confirmed = window.confirm(`Run ${scanType} scan for ${selectedAssetIds.length} selected assets?`);
    if (!confirmed) return;

    setScanningAll(true);
    setScanProgress({ percent: 0, message: `Starting batch ${scanType} scan...`, active: true });

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assetIds: selectedAssetIds, scanType }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Batch scan completed! Successfully scanned ${data.summary.successfulScans} assets.`);
        if (data.summary.failedScans > 0) {
          setError(`${data.summary.failedScans} assets failed to scan.`);
        }
        fetchAssets();
      } else {
        setError(data.message || 'Batch scan failed');
      }
    } catch (err) {
      console.error('Batch scan failed', err);
      setError('Batch scan failed due to server error.');
    } finally {
      setScanningAll(false);
      setScanProgress({ percent: 100, message: 'Batch scan completed', active: false });
    }
  };

  // Show scan options modal
  const showScanOptions = (asset) => {
    setSelectedAssetForScan(asset);
    setShowScanOptionsModal(true);
  };

  // Execute scan with selected options
  const executeScan = () => {
    if (selectedAssetForScan) {
      startScan(selectedAssetForScan, selectedScanType);
      setShowScanOptionsModal(false);
    }
  };

  // Get vulnerability count for asset (you might want to fetch this separately)
  const getVulnerabilityCount = (asset) => {
    // This would typically come from a separate API call
    // For now, return a placeholder
    return Math.floor(Math.random() * 10); // Replace with actual data
  };

  // Get risk level badge
  const getRiskBadge = (riskLevel) => {
    const riskColors = {
      'Critical': 'danger',
      'High': 'warning',
      'Medium': 'info',
      'Low': 'success'
    };
    return <Badge bg={riskColors[riskLevel] || 'secondary'}>{riskLevel || 'Unknown'}</Badge>;
  };

  // Get connectivity status badge
  const getConnectivityBadge = (asset) => {
    const conn = connectivity[asset._id];
    const isTesting = testingConnectivity.has(asset._id);

    if (isTesting) {
      return <Spinner size="sm" animation="border" />;
    }

    if (conn) {
      return conn.reachable ? 
        <Badge bg="success"><FaCheckCircle /> Online</Badge> :
        <Badge bg="danger"><FaExclamationTriangle /> Offline</Badge>;
    }

    return <Button size="sm" variant="outline-secondary" onClick={() => testConnectivity(asset)}>
      <FaSearch /> Test
    </Button>;
  };

  // ... (keep existing form handling functions like handleSubmit, handleEdit, handleDelete, etc.)
  
  // Filter and sort assets
  useEffect(() => {
    let filtered = assets.filter(asset =>
      Object.values(asset).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // Sort assets
    filtered.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      if (sortOrder === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

    setFilteredAssets(filtered);
    setCurrentPage(1);
  }, [assets, searchTerm, sortBy, sortOrder]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAssets = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <Row className="mb-4">
        <Col>
          <h3 style={{ color: '#1594EA' }} className="d-flex align-items-center">
            <FaNetworkWired className="me-2" /> Asset Management
          </h3>
        </Col>
      </Row>

      {/* Alert Messages */}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* Scan Progress */}
      {scanProgress.active && (
        <Card className="mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>Scan Progress</strong>
              <Badge bg="info">{scanProgress.percent}%</Badge>
            </div>
            <ProgressBar 
              now={scanProgress.percent} 
              animated={scanProgress.active}
              variant={scanProgress.percent === 100 ? 'success' : 'info'}
            />
            <small className="text-muted mt-1 d-block">{scanProgress.message}</small>
          </Card.Body>
        </Card>
      )}

      {/* Action Buttons */}
      <Row className="mb-3">
        <Col md={6}>
          <ButtonGroup>
            <Button variant="primary" onClick={() => setShowModal(true)}>
              <FaPlus /> Add Asset
            </Button>
            <Button 
              variant="success" 
              onClick={scanAllAssets}
              disabled={scanningAll || scanProgress.active}
            >
              {scanningAll ? (
                <>
                  <Spinner size="sm" animation="border" /> Scanning All...
                </>
              ) : (
                <>
                  <FaSyncAlt /> Quick Scan All
                </>
              )}
            </Button>
          </ButtonGroup>
        </Col>
        <Col md={6}>
          <Form.Control
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Col>
      </Row>

      {/* Assets Table */}
      <Card>
        <Card.Body>
          <Table responsive hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>IP Address</th>
                <th>Type</th>
                <th>Status</th>
                <th>Connectivity</th>
                <th>Vulnerabilities</th>
                <th>Last Scan</th>
                <th>Risk Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentAssets.map((asset) => (
                <tr key={asset._id}>
                  <td>
                    <strong>{asset.name}</strong>
                    {asset.description && (
                      <div className="text-muted small">{asset.description}</div>
                    )}
                  </td>
                  <td>
                    <code>{asset.ip}</code>
                    {asset.manufacturer && (
                      <div className="text-muted small">{asset.manufacturer} {asset.model}</div>
                    )}
                  </td>
                  <td>
                    <Badge bg="info">{asset.type}</Badge>
                    {asset.serverType && (
                      <div className="text-muted small">{asset.serverType}</div>
                    )}
                  </td>
                  <td>
                    <Badge bg={asset.status === 'Online' ? 'success' : asset.status === 'Offline' ? 'danger' : 'warning'}>
                      {asset.status}
                    </Badge>
                  </td>
                  <td>{getConnectivityBadge(asset)}</td>
                  <td>
                    <Badge bg="warning">{getVulnerabilityCount(asset)}</Badge>
                  </td>
                  <td>
                    {asset.lastScanDate ? (
                      <small>{new Date(asset.lastScanDate).toLocaleDateString()}</small>
                    ) : (
                      <small className="text-muted">Never scanned</small>
                    )}
                  </td>
                  <td>{getRiskBadge('Medium')}</td> {/* Replace with actual risk calculation */}
                  <td>
                    <ButtonGroup size="sm">
                      <Button
                        variant="outline-primary"
                        onClick={() => showScanOptions(asset)}
                        disabled={scanningAssetId === asset._id || scanProgress.active}
                      >
                        {scanningAssetId === asset._id ? (
                          <>
                            <Spinner size="sm" animation="border" /> Scanning...
                          </>
                        ) : (
                          <>
                            <FaBug /> Scan
                          </>
                        )}
                      </Button>
                      <Button variant="outline-secondary" onClick={() => handleEdit(asset)}>
                        <FaEdit />
                      </Button>
                      <Button variant="outline-danger" onClick={() => handleDelete(asset._id)}>
                        <FaTrash />
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAssets.length)} of {filteredAssets.length} assets
            </div>
            <Pagination>
              <Pagination.Prev 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              />
              {[...Array(totalPages)].map((_, index) => (
                <Pagination.Item
                  key={index + 1}
                  active={index + 1 === currentPage}
                  onClick={() => setCurrentPage(index + 1)}
                >
                  {index + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              />
            </Pagination>
          </div>
        </Card.Body>
      </Card>

      {/* Scan Options Modal */}
      <Modal show={showScanOptionsModal} onHide={() => setShowScanOptionsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaBug className="me-2" />
            Scan Options for {selectedAssetForScan?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Select Scan Type</Form.Label>
            <Form.Select
              value={selectedScanType}
              onChange={(e) => setSelectedScanType(e.target.value)}
            >
              {scanTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              {scanTypes.find(t => t.value === selectedScanType)?.description}
            </Form.Text>
          </Form.Group>

          <Alert variant="info">
            <FaShieldAlt className="me-2" />
            <strong>Security Note:</strong> Vulnerability scans may be detected by security systems. 
            Use stealth scans in sensitive environments.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowScanOptionsModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={executeScan}>
            <FaBug className="me-2" />
            Start {scanTypes.find(t => t.value === selectedScanType)?.label}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Enhanced Scan Results Modal */}
      <Modal show={showScanModal} onHide={() => setShowScanModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaShieldAlt className="me-2" />
            Scan Results for {scannedAssetName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {scanResults.length === 0 ? (
            <Alert variant="info">
              <FaCheckCircle className="me-2" />
              No open ports or services detected.
            </Alert>
          ) : (
            <>
              <Alert variant="success" className="mb-3">
                <FaCheckCircle className="me-2" />
                Scan completed successfully! Found {scanResults.length} open ports.
              </Alert>
              
              <Table responsive striped>
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Protocol</th>
                    <th>State</th>
                    <th>Service</th>
                    <th>Product</th>
                    <th>Version</th>
                    <th>Vulnerabilities</th>
                    <th>Risk Score</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.map((result, idx) => (
                    <tr key={idx}>
                      <td><code>{result.port}</code></td>
                      <td>{result.protocol}</td>
                      <td>
                        <Badge bg={result.state === 'open' ? 'success' : 'secondary'}>
                          {result.state}
                        </Badge>
                      </td>
                      <td>{result.service}</td>
                      <td>{result.product || '-'}</td>
                      <td>{result.version || '-'}</td>
                      <td>
                        {result.vulnerabilities?.length > 0 ? (
                          <Badge bg="warning">
                            {result.vulnerabilities.length} found
                          </Badge>
                        ) : (
                          <Badge bg="success">None</Badge>
                        )}
                      </td>
                      <td>
                        <Badge bg={
                          result.vulnerabilityScore >= 8 ? 'danger' :
                          result.vulnerabilityScore >= 5 ? 'warning' :
                          result.vulnerabilityScore > 0 ? 'info' : 'success'
                        }>
                          {result.vulnerabilityScore?.toFixed(1) || '0.0'}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg="info">{result.confidence || 0}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Vulnerability Details */}
              {scanResults.some(r => r.vulnerabilities?.length > 0) && (
                <div className="mt-4">
                  <h5><FaExclamationTriangle className="me-2 text-warning" />Detected Vulnerabilities</h5>
                  {scanResults.filter(r => r.vulnerabilities?.length > 0).map((result, idx) => (
                    <Card key={idx} className="mb-2">
                      <Card.Header>
                        <strong>Port {result.port} - {result.service}</strong>
                      </Card.Header>
                      <Card.Body>
                        <ul className="mb-0">
                          {result.vulnerabilities.map((vuln, vIdx) => (
                            <li key={vIdx} className="text-warning">
                              <strong>{vuln}</strong>
                            </li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowScanModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.open('/vulnerabilities', '_blank')}>
            <FaShieldAlt className="me-2" />
            View All Vulnerabilities
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Keep existing Asset Add/Edit Modal here... */}
      {/* ... existing modal code ... */}
    </div>
  );
};

export default Assets;
