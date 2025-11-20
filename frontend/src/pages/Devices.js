import React, { useState, useEffect, useContext } from 'react';
import {
  Table, Button, Modal, Form, Alert, Spinner, Badge, Dropdown, Pagination, Row, Col, Card, ProgressBar, ButtonGroup
} from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaEdit, FaTrash, FaPlus, FaSyncAlt, FaBug, FaDownload, FaSort, FaNetworkWired, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSearch, FaServer
} from 'react-icons/fa';
import Select from 'react-select';
import Papa from 'papaparse';
import '../App.css'
import config from '../config';
import ScanProgressBar from '../components/ScanProgressBar';
import { useScan } from '../context/ScanContext';
import { useSocket } from '../context/SocketContext';
import { useConnectivity } from '../hooks/useConnectivity';

const assetTypes = ['Server', 'Database', 'Application', 'Network Device'];
const deviceCategories = ['Router', 'Switch', 'Hub', 'Modem', 'Bridge', 'Gateway', 'Access Point'];
const serverStatuses = ['Online', 'Offline', 'Maintenance'];
const deviceTypes = ['Physical', 'Virtual'];
const serverStates = ['Active', 'Passive'];
const serverExposures = ['Public', 'Private'];
const dbOptions = ['MySQL 8.0', 'PostgreSQL 13', 'MongoDB 5.0', 'Oracle 19c'];
const webServerOptions = ['Apache 2.4', 'Nginx 1.18', 'IIS 10'];
const osOptions = ['Windows 10', 'Ubuntu 22.04', 'macOS 13 Ventura', 'RedHat 9', 'CentOS 7', 'Microsoft Windows Server', 'Cisco IOS', 'Juniper JUNOS', 'macOS Server', 'Novell NetWare', 'Oracle Solaris', 'IBM AIX'];

const scanTypes = [
  { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
  { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
  { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
  { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
  { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
];

const Devices = () => {
  const { token } = useContext(AuthContext);

  const {
    scanningTargetId,
    showScanOptions,
    scanningAll,
    startScan,
    scanAllTargets,
    batchScan,
    addNotification,
  } = useScan();

  const { isConnected, scanProgress, resetScanProgress } = useSocket(token);
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

  const [scanResults, setScanResults] = useState([]);
  const [vulns, setVulns] = useState([]);
  const [sortField, setSortField] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('');
  const [deviceCategoryFilter, setDeviceCategoryFilter] = useState('');
  const [connectivity, setConnectivity] = useState({});
  const [testingConnectivity, setTestingConnectivity] = useState(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [vulnCountMap, setVulnCountMap] = useState({});

  const handleScanAll = async () => {
    const confirmed = window.confirm('Run quick scan for all online devices?');
    if (!confirmed) return; 
    await scanAllTargets();
  };

  const openCreateModal = () => {
    setForm({
      name: '',
      ip: '',
      deviceCategory: 'Router',
      deviceType: 'Physical',
      manufacturer: '',
      model: '',
      os: '',
      osVersion: '',
      status: 'Online',
      memory: '',
      storageCapacity: '',
      cpuCapacity: '',
      hostDepartment: '',
      serverAdministrator: '',
      description: '',
      owner: '',
      state: 'Active',
      exposure: 'Private',
      activeProtocols: ['']
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const openEditModal = device => {
    setForm({ ...device });
    setEditId(device._id);
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

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const normalizedData = data.map(device => ({
        ...device,
        targetType: 'device'
      }));
      setDevices(normalizedData);
      setFilteredDevices(normalizedData);
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

  const getVulnerabilityCount = (device) => {
    if (!device) return 0;
    return vulnCountMap[String(device._id)] || 0;
  }

  useEffect(() => {
    fetchDevices();
    fetchVulnerabilities();
  }, [token]);

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

  const getRiskBadge = (riskLevel) => {
    const riskColors = {
      'Critical': 'danger',
      'High': 'warning',
      'Medium': 'info',
      'Low': 'success'
    };
    return <Badge bg={riskColors[riskLevel] || 'secondary'}>{riskLevel || 'Unknown'}</Badge>;
  };

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
    setCurrentPage(1);
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
  
  useEffect(() => {
    let filtered = devices.filter(device =>
      Object.values(device).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDevices = filteredDevices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        endPage = 4;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - 3;
      }
      
      if (startPage > 2) {
        pages.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

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
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 style={{ color: '#1594EA' }} className="d-flex align-items-center"><FaNetworkWired className="me-2" />Network Devices</h3>
        <div className="d-flex gap-2 flex-wrap">
          <ButtonGroup>
            <Button style={{ backgroundColor: '#1594EA' }} onClick={() => openCreateModal(true)}>
              <FaPlus /> Add New
            </Button>
            <Button 
              variant="success" 
              onClick={handleScanAll}
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

      <div className="mb-3">
        <Badge bg={isConnected ? 'success' : 'danger'}>
          {isConnected ? '● Connected' : '● Disconnected'}
        </Badge>
        {scanProgress.active && (
          <Badge bg="info" className="ms-2">
            <FaSyncAlt className="spin me-1" />
            Scan in Progress
          </Badge>
        )}
      </div>

      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

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
        <Form.Select
          value={itemsPerPage}
          onChange={e => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          style={{ maxWidth: '120px' }}
        >
          <option value={5}>5 per page</option>
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
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
              {currentDevices.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted py-4">
                    No devices found
                  </td>
                </tr>
              ) : (
                currentDevices.map((device) => (
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
                    <td>{getRiskBadge('Medium')}</td>
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
                          disabled={scanningTargetId === device._id || scanProgress.active}
                        >
                          {scanningTargetId === device._id ? (
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
                ))
              )}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-3 gap-3">
              <div className="text-muted">
                Showing <strong>{indexOfFirstItem + 1}</strong> to{' '}
                <strong>{Math.min(indexOfLastItem, filteredDevices.length)}</strong> of{' '}
                <strong>{filteredDevices.length}</strong> devices
              </div>
              
              <Pagination className="mb-0">
                <Pagination.First 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="First Page"
                />
                
                <Pagination.Prev 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  title="Previous Page"
                />
                
                {getPageNumbers().map((page, index) => {
                  if (page === '...') {
                    return (
                      <Pagination.Ellipsis 
                        key={`ellipsis-${index}`} 
                        disabled 
                      />
                    );
                  }
                  
                  return (
                    <Pagination.Item
                      key={page}
                      active={page === currentPage}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Pagination.Item>
                  );
                })}
                
                <Pagination.Next
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  title="Next Page"
                />
                
                <Pagination.Last
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last Page"
                />
              </Pagination>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>{isEditing ? 'Edit Network Device' : 'Add Network Device'}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
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
                <Form.Group className="mb-3">
                  <Form.Label>Manufacturer</Form.Label>
                  <Form.Control name="manufacturer" value={form.manufacturer} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Model</Form.Label>
                  <Form.Control name="model" value={form.model} onChange={handleChange} />
                </Form.Group>
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