import React, { useState, useEffect, useContext } from 'react';
import {
  Table, Button, Modal, Form, Alert, Spinner, Badge, Dropdown, Pagination, Row, Col, Card, ProgressBar, ButtonGroup
} from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaEdit, FaTrash, FaPlus, FaSyncAlt, FaBug, FaDownload, FaSort, FaNetworkWired, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSearch, FaServer
} from 'react-icons/fa';
import Select from 'react-select';
import Papa from 'papaparse'; // For CSV Export
import '../App.css'
import config from '../config';
import { useSocket } from '../context/SocketContext';
import ScanProgressBar from '../components/ScanProgressBar';

const assetTypes = ['Server', 'Database', 'Application', 'Network Device'];
const deviceCategories = ['Router', 'Switch', 'Hub', 'Modem', 'Bridge', 'Gateway', 'Access Point'];
const serverStatuses = ['Online', 'Offline', 'Maintenance'];
const deviceTypes = ['Physical', 'Virtual'];
const serverStates = ['Active', 'Passive'];
const serverExposures = ['Public', 'Private'];
const dbOptions = ['MySQL 8.0', 'PostgreSQL 13', 'MongoDB 5.0', 'Oracle 19c'];
const webServerOptions = ['Apache 2.4', 'Nginx 1.18', 'IIS 10'];
const osOptions = ['Windows 10', 'Ubuntu 22.04', 'macOS 13 Ventura', 'RedHat 9', 'CentOS 7', 'Microsoft Windows Server', 'Cisco IOS', 'Juniper JUNOS', 'macOS Server', 'Novell NetWare', 'Oracle Solaris', 'IBM AIX'];

// Enhanced scan types
const scanTypes = [
  { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
  { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
  { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
  { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
  { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
];

const Devices = () => {
  const { token } = useContext(AuthContext);

  const { isConnected, scanProgress, resetScanProgress, showScanResults } = useSocket();
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentDevice, setCurrentDevice] = useState({});
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    ip: '',
    deviceCategories: 'Router',
    manufacturer: '',
    model: '',
    // dbType: '',
    // wsType: '',
    nos: '',
    osVersion: '',
    status: 'Online',
    memory: '',
    storageCapacity: '',
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
  const [vulns, setVulns] = useState([]);
  const [sortField, setSortField] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('');
  const [deviceCategoryFilter, setDeviceCategoryFilter] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [showScanOptionsModal, setShowScanOptionsModal] = useState(false);
  const [selectedDeviceForScan, setSelectedDeviceForScan] = useState(null);
  const [selectedScanType, setSelectedScanType] = useState('quick');
  const [scannedDeviceName, setScannedDeviceName] = useState('');
  const [scanningDeviceId, setScanningDeviceId] = useState(null);
  const [scanningAll, setScanningAll] = useState(false);
  // const [scanProgress, setScanProgress] = useState({ percent: 0, message: '', active: false });
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
  const [vulnCountMap, setVulnCountMap] = useState({}); // new

  const openCreateModal = () => {
    setForm({
      name: '',
      ip: '',
      type: 'Server',
      serverType: 'Physical',
      manufacturer: '',
      model: '',
      os: '',
      osVersion: '',
      status: 'Online',
      memory: '',
      diskSpace: '',
      cpuCapacity: '',
      hostDepartment: '',
      serverAdministrator: '',
      description: '',
      owner: '',
      state: 'Active',
      exposure: 'Private',
      activeProtocols: [''],
      dbType: '',
      wsType: ''
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const openEditModal = asset => {
    setForm({ ...asset });
    setEditId(asset._id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${config.API_BASE_URL}/api/devices/${editId}`
        : `${config.API_BASE_URL}/api/devices`;

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      fetchDevices();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save device', error);
    }
  };

  const handleDelete = async id => {
    const confirmed = window.confirm('Are you sure you want to delete this device?');
    if (!confirmed) return;

    try {
      await fetch(`${config.API_BASE_URL}/api/devices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDevices();
    } catch (error) {
      console.error('Failed to delete device', error);
    }
  };

  // Fetch devices with enhanced data
  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log(data);
      setDevices(data);
      setFilteredDevices(data);
    } catch (err) {
      console.error('Failed to fetch devices', err);
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const fetchVulnerabilities = async () => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/vulnerabilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      setVulns(list);

      // build map: deviceId (string) -> open vuln count
      const map = {};
      list.forEach(v => {
        if (!v.device?._id) return;
        if (v.status === 'Open') {
          map[v.device._id] = (map[v.device._id] || 0) + 1;
        }
      });

      setVulnCountMap(map);
    } catch (err) {
      console.error('Failed to fetch vulnerabilities', err);
      setVulns([]);
      setVulnCountMap({});
    }
  };

    // Get vulnerability count for device (you might want to fetch this separately)
  const getVulnerabilityCount = (device) => {
    // This would typically come from a separate API call
    // For now, return a placeholder
    // Replace with actual data
    // return Math.floor(Math.random() * 10); 

    if (!device) return 0;
    return vulnCountMap[String(device._id)] || 0;
  }

  useEffect(() => {
    fetchDevices();
    fetchVulnerabilities();
  }, [token]);

  // Enhanced single device scan with options
  const startScan = async (device, scanType = 'quick') => {
  const { _id, name } = device;
  setScanningDeviceId(_id);
  setError('');
  setSuccess('');
  setScanResults([]);
  resetScanProgress();
  // setScanProgress({ percent: 0, message: `Starting ${scanType} scan for ${name}...`, active: true });

  try {
    const res = await fetch(`${config.API_BASE_URL}/api/scan/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceId: _id, scanType }),
    });

    const data = await res.json();

    if (data.success) {
      setScannedDeviceName(name);

      // CRITICAL: Ensure all scan results are properly formatted
      const formattedResults = (data.scanResults || []).map(result => ({
        ...result,
        // Ensure vulnerabilities is always an array
        vulnerabilities: Array.isArray(result.vulnerabilities) ? 
          result.vulnerabilities.map(vuln => {
            // If vulnerability is already a string, keep it
            if (typeof vuln === 'string') return vuln;
            
            // If it's an object, ensure we have string representations
            if (typeof vuln === 'object' && vuln !== null) {
              return {
                ...vuln,
                title: String(vuln.title || vuln.cve || vuln.name || 'Unknown'),
                severity: String(vuln.severity || 'Unknown'),
                cve: String(vuln.cve || ''),
                cvssScore: vuln.cvssScore ? Number(vuln.cvssScore) : 0
              };
            }
            
            return 'Unknown Vulnerability';
          }) : []
      }));
      
      setScanResults(formattedResults);
      setSuccess(`${scanType.charAt(0).toUpperCase() + scanType.slice(1)} scan completed successfully. Found ${data.newVulnerabilities || 0} new vulnerabilities.`);
      setShowScanModal(true);
      showScanResults({ assetName: name, scanResults: formattedResults, scanSummary: data.scanSummary || {} });

      // Refresh both devices and vulnerabilities
      fetchDevices();
      fetchVulnerabilities();
    } else {
      setError(data.message || 'Scan failed');
    }
  } catch (err) {
    console.error('Scan failed', err);
    setError('Scan failed due to server error.');
  } finally {
    setScanningDeviceId(null);
    // setScanProgress({ percent: 100, message: 'Scan completed', active: false });
  }
};
  // const startScan = async (asset, scanType = 'quick') => {
  //   const { _id, name } = asset;
  //   setScanningAssetId(_id);
  //   setError('');
  //   setSuccess('');
  //   setScanResults([]);
  //   setScanProgress({ percent: 0, message: `Starting ${scanType} scan for ${name}...`, active: true });

  //   try {
  //     const res = await fetch(`${config.API_BASE_URL}/api/scan/asset`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Bearer ${token}`,
  //       },
  //       body: JSON.stringify({ assetId: _id, scanType }),
  //     });

  //     const data = await res.json();

  //     if (data.success) {
  //       setScannedAssetName(name);
  //       // Ensure scanResults is always an array and vulnerabilities are properly formatted
  //       const formattedResults = (data.scanResults || []).map(result => ({
  //         ...result,
  //         vulnerabilities: Array.isArray(result.vulnerabilities) ? result.vulnerabilities : []
  //       }));
  //       setScanResults(formattedResults);
  //       // setScanResults(data.scanResults || []);
  //       setSuccess(`${scanType.charAt(0).toUpperCase() + scanType.slice(1)} scan completed successfully. Found ${data.newVulnerabilities || 0} new vulnerabilities.`);
  //       setShowScanModal(true);
        
  //       // Refresh assets to update last scan date
  //       fetchAssets();
  //     } else {
  //       setError(data.message || 'Scan failed');
  //     }
  //   } catch (err) {
  //     console.error('Scan failed', err);
  //     setError('Scan failed due to server error.');
  //   } finally {
  //     setScanningAssetId(null);
  //     setScanProgress({ percent: 100, message: 'Scan completed', active: false });
  //   }
  // };

  // Test device connectivity
  const testConnectivity = async (device) => {
    const { _id } = device;
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

  // Enhanced quick scan for all devices
  const scanAllDevices = async () => {
    const confirmed = window.confirm('Run quick scan for all online devices? This may take several minutes.');
    if (!confirmed) return;

    setScanningAll(true);
    resetScanProgress();
    // setScanProgress({ percent: 0, message: 'Initializing quick scan for all devices...', active: true });

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/quick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Quick scan completed! Scanned ${data.summary.scannedDevices} devices and found ${data.summary.totalVulnerabilities} vulnerabilities.`);
        fetchDevices(); // Refresh to show updated scan dates
      } else {
        setError(data.message || 'Quick scan failed');
      }
    } catch (err) {
      console.error('Quick scan failed', err);
      setError('Quick scan failed due to server error.');
    } finally {
      setScanningAll(false);
      // setScanProgress({ percent: 100, message: 'Quick scan completed', active: false });
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
    resetScanProgress();
    // setScanProgress({ percent: 0, message: `Starting batch ${scanType} scan...`, active: true });

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
        setSuccess(`Batch scan completed! Successfully scanned ${data.summary.successfulScans} devices.`);
        if (data.summary.failedScans > 0) {
          setError(`${data.summary.failedScans} devices failed to scan.`);
        }
        fetchDevices();
      } else {
        setError(data.message || 'Batch scan failed');
      }
    } catch (err) {
      console.error('Batch scan failed', err);
      setError('Batch scan failed due to server error.');
    } finally {
      setScanningAll(false);
      // setScanProgress({ percent: 100, message: 'Batch scan completed', active: false });
    }
  };

  // Show scan options modal
  const showScanOptions = (device) => {
    setSelectedDeviceForScan(device);
    setShowScanOptionsModal(true);
  };

  // Execute scan with selected options
  const executeScan = () => {
    if (selectedDeviceForScan) {
      startScan(selectedDeviceForScan, selectedScanType);
      setShowScanOptionsModal(false);
    }
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
  const getConnectivityBadge = (device) => {
    const conn = connectivity[device._id];
    const isTesting = testingConnectivity.has(device._id);

    if (isTesting) {
      return <Spinner size="sm" animation="border" />;
    }

    if (conn) {
      return conn.reachable ? 
        <Badge bg="success"><FaCheckCircle /> Online</Badge> :
        <Badge bg="danger"><FaExclamationTriangle /> Offline</Badge>;
    }

    return <Button size="sm" variant="outline-secondary" onClick={() => testConnectivity(device)}>
      <FaSearch /> Test
    </Button>;
  };

const applyFilters = () => {
    let filtered = [...devices];

    if (searchTerm) {
      filtered = filtered.filter(device =>
        Object.values(device).some(field =>
          String(field).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(device => device.status === statusFilter);
    }

    if (deviceCategoryFilter) {
      filtered = filtered.filter(device => device.deviceCategory === deviceCategoryFilter);
    }

    if (deviceTypeFilter) {
      filtered = filtered.filter(device => device.deviceType === deviceTypeFilter);
    }

    if (sortField) {
      filtered.sort((a, b) =>
        a[sortField]?.toLowerCase().localeCompare(b[sortField]?.toLowerCase())
      );
    }

    setFilteredDevices(filtered);
  };

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page on filters change
  }, [searchTerm, statusFilter, deviceTypeFilter, deviceCategoryFilter, sortField, devices]);

  const exportToCSV = () => {
    const csv = Papa.unparse(filteredDevices);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'devices_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Filter and sort devices
  useEffect(() => {
    let filtered = devices.filter(device =>
      Object.values(device).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // Sort devices
    filtered.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      if (sortOrder === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

    setFilteredDevices(filtered);
    setCurrentPage(1);
  }, [devices, searchTerm, sortBy, sortOrder]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDevices = filteredDevices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);

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
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 style={{ color: '#1594EA' }} className="d-flex align-items-center"><FaNetworkWired className="me-2" />Network Devices</h3>
        <div className="d-flex gap-2 flex-wrap">
          <ButtonGroup>
            <Button style={{ backgroundColor: '#1594EA' }} onClick={() => openCreateModal(true)}>
              <FaPlus /> Add New
            </Button>
            <Button 
              variant="success" 
              onClick={scanAllDevices}
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
        </div>
      </div>

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

      {/* Search & Filter Bar */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          type="search"
          placeholder="Search devices..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '250px' }}
        />
        <Form.Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Statuses</option>
          {serverStatuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          value={deviceCategoryFilter}
          onChange={e => setDeviceCategoryFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Device Categories</option>
          {deviceCategories.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          value={deviceTypeFilter}
          onChange={e => setDeviceTypeFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Device Types</option>
          {deviceTypes.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Form.Select>
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            <FaSort /> Sort
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => setSortField('name')}>By Name</Dropdown.Item>
            <Dropdown.Item onClick={() => setSortField('ip')}>By IP</Dropdown.Item>
            <Dropdown.Item onClick={() => setSortField('status')}>By Status</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        <Button
          size="sm"
          variant="outline-success"
          onClick={exportToCSV}
          className="d-flex align-items-center gap-1"
        >
          <FaDownload /> Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline-info"
          onClick={fetchDevices}
          className="d-flex align-items-center gap-1"
        >
          <FaSyncAlt /> Refresh
        </Button>
      </div>

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
              {currentDevices.map((device) => (
                <tr key={device._id}>
                  <td>
                    <strong>{device.name}</strong>
                    {device.description && (
                      <div className="text-muted small">{device.description}</div>
                    )}
                  </td>
                  <td>
                    <code>{device.ip}</code>
                    {device.manufacturer && (
                      <div className="text-muted small">{device.manufacturer} {device.model}</div>
                    )}
                  </td>
                  <td>
                    <Badge bg="info">{device.deviceCategory}</Badge>
                    {device.deviceType && (
                      <div className="text-muted small">{device.deviceType}</div>
                    )}
                  </td>
                  <td>
                    <Badge bg={device.status === 'Online' ? 'success' : device.status === 'Offline' ? 'danger' : 'warning'}>
                      {device.status}
                    </Badge>
                  </td>
                  <td>{getConnectivityBadge(device)}</td>
                  <td>
                    <Badge bg="warning">{getVulnerabilityCount(device)}</Badge>
                  </td>
                  <td>
                    {device.lastScanDate ? (
                      <small>{new Date(device.lastScanDate).toLocaleDateString()}</small>
                    ) : (
                      <small className="text-muted">Never scanned</small>
                    )}
                  </td>
                  <td>{getRiskBadge('Medium')}</td> {/* Replace with actual risk calculation */}
                  <td>
                    <ButtonGroup size="sm">
                      <Button
                        style={{
                          borderColor: '#1594EA',
                          color: '#1594EA',
                        }} 
                        className="d-flex align-items-center gap-1 edit-btn"
                        variant="outline-primary"
                        onClick={() => showScanOptions(device)}
                        disabled={scanningDeviceId === device._id || scanProgress.active}
                      >
                        {scanningDeviceId === device._id ? (
                          <>
                            <Spinner size="sm" animation="border" /> Scanning...
                          </>
                        ) : (
                          <>
                            <FaBug /> Scan
                          </>
                        )}
                      </Button>
                      <Button variant="outline-secondary" onClick={() => openEditModal(device)}>
                        <FaEdit />
                      </Button>
                      <Button variant="outline-danger" onClick={() => handleDelete(device._id)}>
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
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredDevices.length)} of {filteredDevices.length} devices
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
            Scan Options for {selectedDeviceForScan?.name}
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
            Scan Results for {scannedDeviceName}
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
              {scanResults.some(r => r.vulnerabilities && Array.isArray(r.vulnerabilities) && r.vulnerabilities.length > 0) && (
                <div className="mt-4">
                  <h5><FaExclamationTriangle className="me-2 text-warning" />Detected Vulnerabilities</h5>
                  {scanResults
                    .filter(r => r.vulnerabilities && Array.isArray(r.vulnerabilities) && r.vulnerabilities.length > 0)
                    .map((result, idx) => (
                      <Card key={idx} className="mb-2">
                        <Card.Header>
                          <strong>Port {result.port} - {result.service}</strong>
                        </Card.Header>
                        <Card.Body>
                          <ul className="mb-0">
                            {result.vulnerabilities.map((vuln, vIdx) => (
                              <li key={vIdx} className="text-warning">
                                <strong>
                                  {typeof vuln === 'string' ? vuln : 
                                  (vuln?.title || vuln?.cve || vuln?.name || 'Unknown Vulnerability')}
                                </strong>
                                {typeof vuln === 'object' && vuln?.severity && (
                                  <Badge bg={
                                    vuln.severity === 'Critical' ? 'danger' :
                                    vuln.severity === 'High' ? 'warning' :
                                    vuln.severity === 'Medium' ? 'info' : 'success'
                                  } className="ms-2">
                                    {vuln.severity}
                                  </Badge>
                                )}
                                {typeof vuln === 'object' && vuln?.cvssScore && (
                                  <small className="text-muted ms-2">Score: {vuln.cvssScore}</small>
                                )}
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

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>{isEditing ? 'Edit Server Asset' : 'Add Server Asset'}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                {/* Left Form */}
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control name="name" value={form.name} onChange={handleChange} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>IP Address</Form.Label>
                  <Form.Control
                    name="ip"
                    type="text"
                    value={form.ip}
                    onChange={handleChange}
                    pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                    title="Enter a valid IPv4 address"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Device Category</Form.Label>
                  <Form.Select name="deviceCategory" value={form.deviceCategory} onChange={handleChange}>
                    {deviceCategories.map(deviceCategory => (
                      <option key={deviceCategory} value={deviceCategory}>
                        {deviceCategory}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Device Type</Form.Label>
                  <Form.Select name="deviceType" value={form.deviceType} onChange={handleChange}>
                    {deviceTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select name="status" value={form.status} onChange={handleChange}>
                    {serverStatuses.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Administrator</Form.Label>
                  <Form.Control name="owner" value={form.owner} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>State</Form.Label>
                  <Form.Select name="state" value={form.state} onChange={handleChange}>
                    {serverStates.map(state => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Exposure</Form.Label>
                  <Form.Select name="exposure" value={form.exposure} onChange={handleChange}>
                    {serverExposures.map(exposure => (
                      <option key={exposure} value={exposure}>
                        {exposure}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Active Protocols</Form.Label>
                  <Form.Control name="activeProtocols" value={form.activeProtocols} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={6}>
                {/* Right Form */}
                <Form.Group className="mb-3">
                  <Form.Label>Manufacturer</Form.Label>
                  <Form.Control name="manufacturer" value={form.manufacturer} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Model</Form.Label>
                  <Form.Control name="model" value={form.model} onChange={handleChange} />
                </Form.Group>
                {/* <Form.Group>
                  <Form.Label>Database Type & Version</Form.Label>
                  <Form.Select name="dbopt" value={form.dbopt} onChange={handleChange}>
                    <option value="">Select</option>
                    {dbOptions.map(dbopt => (<option key={dbopt} value={dbopt}>{dbopt}</option>))}
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>WebServer Type & Version</Form.Label>
                  <Form.Select name="wsopt" value={form.wsopt} onChange={handleChange}>
                    <option value="">Select</option>
                    {webServerOptions.map(wsopt => <option key={wsopt} value={wsopt}>{wsopt}</option>)}
                  </Form.Select>
                </Form.Group> */}
                <Form.Group className="mb-3">
                  <Form.Label>NOS & Version</Form.Label>
                  {form && (<Form.Control
                    type="text"
                    list="osVersionOptions"
                    name="os"
                    value={form.os}
                    onChange={handleChange}
                    placeholder="Select or type OS & Version"
                  />)}
                  <datalist id="osVersionOptions">
                    {osOptions.map(os => (<option key={os} value={os}>{os}</option>))}
                  </datalist>
                </Form.Group>
                {/* <Form.Group className="mb-3">
                  <Form.Label>OS & Version</Form.Label>
                  <Form.Control name="os" value={form.os} onChange={handleChange} />
                </Form.Group> */}
                {/* <Form.Group className="mb-3">
                  <Form.Label>OS Version</Form.Label>
                  <Form.Control name="osVersion" value={form.osVersion} onChange={handleChange} />
                </Form.Group> */}
                <Form.Group className="mb-3">
                  <Form.Label>CPU Capacity</Form.Label>
                  <Form.Control name="cpuCapacity" value={form.cpuCapacity} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Memory</Form.Label>
                  <Form.Control name="memory" value={form.memory} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Storage Capacity</Form.Label>
                  <Form.Control name="storageCapacity" value={form.storageCapacity} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Host Department</Form.Label>
                  <Form.Control name="hostDepartment" value={form.hostDepartment} onChange={handleChange} />
                </Form.Group>
              </Col>
            </Row>
            {console.log('Submitting form:', form)}
            <div className="text-end">
              <Button
                variant="secondary"
                onClick={() => setShowModal(false)}
                className="me-2"
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: '#1594EA', border: 'none' }}
                type="submit"
                className=""
              >
                {isEditing ? 'Update' : 'Add'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Devices;
