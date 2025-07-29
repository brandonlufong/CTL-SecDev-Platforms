import React, { useState, useEffect, useContext } from 'react';
import {
  Table, Button, Modal, Form, Alert, Spinner, Badge, Dropdown, Pagination, Row, Col
} from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaEdit, FaTrash, FaPlus, FaSyncAlt, FaBug, FaDownload, FaSort, FaNetworkWired
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
    owner: '',
    state: 'Active',
    exposure: 'Private',
    activeProtocols: [''],
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [scanLogs, setScanLogs] = useState([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scannedAssetName, setScannedAssetName] = useState('');
  const [scanningAssetId, setScanningAssetId] = useState(null);
  const [scanningAll, setScanningAll] = useState(false); // For scan all
  const [scanAllProgress, setScanAllProgress] = useState(0); // Progress counter
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAssets(data);
      setFilteredAssets(data);
    } catch (error) {
      console.error('Failed to fetch assets', error);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const applyFilters = () => {
    let filtered = [...assets];

    if (searchTerm) {
      filtered = filtered.filter(asset =>
        Object.values(asset).some(field =>
          String(field).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(asset => asset.serverType === typeFilter);
    }

    if (sortField) {
      filtered.sort((a, b) =>
        a[sortField]?.toLowerCase().localeCompare(b[sortField]?.toLowerCase())
      );
    }

    setFilteredAssets(filtered);
  };

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page on filters change
  }, [searchTerm, statusFilter, typeFilter, sortField, assets]);

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
        ? `${config.API_BASE_URL}/api/assets/${editId}`
        : `${config.API_BASE_URL}/api/assets`;

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      fetchAssets();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save asset', error);
    }
  };

  const handleDelete = async id => {
    const confirmed = window.confirm('Are you sure you want to delete this asset?');
    if (!confirmed) return;

    try {
      await fetch(`${config.API_BASE_URL}/api/assets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAssets();
    } catch (error) {
      console.error('Failed to delete asset', error);
    }
  };

  const startScan = async asset => {
    const { _id, name } = asset;
    setScanningAssetId(_id);
    setError('');
    setSuccess('');
    setScanLogs([]);

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/nmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ assetId: _id }),
      });

      const data = await res.json();

      if (res.ok && data.logs?.length > 0) {
        setScannedAssetName(name);
        setScanLogs(data.logs);
        setSuccess('Scan completed successfully.');
        setShowScanModal(true);
      } else {
        setError(data.message || 'No vulnerabilities found or scan failed.');
      }
    } catch (err) {
      console.error('Scan failed', err);
      setError('Scan failed due to server error.');
    } finally {
      setScanningAssetId(null);
    }
  };

  const scanAllAssets = async () => {
    setScanningAll(true);
    setScanAllProgress(0);
    setError('');
    setSuccess('');
    try {
      let completed = 0;
      for (const asset of assets) {
        const res = await fetch(`${config.API_BASE_URL}/api/scan/nmap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ assetId: asset._id }),
        });

        const data = await res.json();

        // Determine status based on scan result
        const updatedStatus = res.ok && data.logs?.length > 0 ? 'Online' : 'Offline';

        // Update asset status
        await fetch(`${config.API_BASE_URL}/api/assets/${asset._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...asset, status: updatedStatus }),
        });

        // Increment progress
        completed += 1;
        setScanAllProgress(completed);
      }

      // Refresh assets list
      fetchAssets();
      setSuccess('All assets statuses have been updated.');
    } catch (err) {
      console.error('Update failed', err);
      setError('Failed to update assets.');
    } finally {
      setScanningAll(false);
      setScanAllProgress(0); // Reset progress
    }
  };

  const exportToCSV = () => {
    const csv = Papa.unparse(filteredAssets);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'assets_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);

  return (
    <div className="container py-4" style={{ backgroundColor: '#F1F8FD' }}>
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 style={{ color: '#1594EA', marginBottom: '0' }}>Server Assets</h3>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            style={{ backgroundColor: '#1594EA', border: 'none' }}
            onClick={openCreateModal}
            className="rounded-pill shadow-sm d-flex align-items-center gap-2 mt-2 mt-md-0"
          >
            <FaPlus /> Add New
          </Button>
          <Button
            style={{ borderColor: 'green', color: 'green' }}
            size="sm"
            variant="outline-warning"
            onClick={scanAllAssets}
            disabled={scanningAll}
            className="status-update rounded-pill d-flex align-items-center gap-2 mt-2 mt-md-0"
          >
            {scanningAll ? (
              <>
                <Spinner size="sm" animation="border" /> Updating {scanAllProgress}/{assets.length} assets...
              </>
            ) : (
              <>
                <FaNetworkWired /> Update Assets Statuses
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          type="search"
          placeholder="Search assets..."
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
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Server Types</option>
          {serverTypes.map(type => (
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
          onClick={fetchAssets}
          className="d-flex align-items-center gap-1"
        >
          <FaSyncAlt /> Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Table */}
      <Table bordered hover responsive className="align-middle rounded shadow-sm">
        <thead style={{ backgroundColor: '#1594EA', color: '#fff' }}>
          <tr>
            <th>Name</th>
            <th>IP</th>
            <th>Type</th>
            <th>Server Type</th>
            <th>OS</th>
            <th>Status</th>
            <th>CPU</th>
            <th>Memory</th>
            <th>Host Department</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedAssets.map(asset => (
            <tr key={asset._id}>
              <td>{asset.name}</td>
              <td>{asset.ip}</td>
              <td>{asset.type}</td>
              <td>{asset.serverType}</td>
              <td>{asset.os}</td>
              <td>
                <Badge
                  bg={
                    asset.status === 'Online'
                      ? 'success'
                      : asset.status === 'Offline'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {asset.status}
                </Badge>
              </td>
              <td>{asset.cpuCapacity}</td>
              <td>{asset.memory}</td>
              <td>{asset.hostDepartment}</td>
              <td className="text-center">
                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    style={{
                      borderColor: '#1594EA',
                      color: '#1594EA',
                    }}
                    variant="outline-primary"
                    onClick={() => openEditModal(asset)}
                    className="d-flex align-items-center gap-1 edit-btn"
                  >
                    <FaEdit /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => handleDelete(asset._id)}
                    className="d-flex align-items-center gap-1"
                  >
                    <FaTrash /> Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-warning"
                    onClick={() => startScan(asset)}
                    disabled={scanningAssetId === asset._id}
                    className="d-flex align-items-center gap-1"
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
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Pagination */}
      <div className="d-flex justify-content-center mt-3">
        <Pagination>
          {[...Array(totalPages).keys()].map(page => (
            <Pagination.Item
              key={page + 1}
              active={page + 1 === currentPage}
              onClick={() => setCurrentPage(page + 1)}
            >
              {page + 1}
            </Pagination.Item>
          ))}
        </Pagination>
      </div>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>{isEditing ? 'Edit Server Asset' : 'Add Server Asset'}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
<       Form onSubmit={handleSubmit}>
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
                  <Form.Label>Type</Form.Label>
                  <Form.Select name="type" value={form.type} onChange={handleChange}>
                    {assetTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Server Type</Form.Label>
                  <Form.Select name="serverType" value={form.serverType} onChange={handleChange}>
                    {serverTypes.map(type => (
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
                  <Form.Label>Database Type & Version</Form.Label>
                  {form && (
                  <Form.Control
                    type="text"
                    list="dbVersionOptions"
                    name="dbType"
                    value={form.dbType || ''}
                    onChange={handleChange}
                    placeholder="Select or type Database Type & Version"
                  />)}
                  <datalist id="dbVersionOptions">
                    {dbOptions.map(dbType => (<option key={dbType} value={dbType}>{dbType}</option>))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>WebServer Type & Version</Form.Label>
                  {form && (
                  <Form.Control
                    type="text"
                    list="wsVersionOptions"
                    name="wsType"
                    value={form.wsType || ''}
                    onChange={handleChange}
                    placeholder="Select or type WebServer Type & Version"
                  />)}
                  <datalist id="wsVersionOptions">
                    {webServerOptions.map(wsType => (<option key={wsType} value={wsType}>{wsType}</option>))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>OS & Version</Form.Label>
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
                  <Form.Label>Disk Space</Form.Label>
                  <Form.Control name="diskSpace" value={form.diskSpace} onChange={handleChange} />
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

      {/* Scan Results Modal */}
      <Modal show={showScanModal} onHide={() => setShowScanModal(false)} size="xl">
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>Scan Results for {scannedAssetName}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          {scanLogs.length === 0 ? (
            <p>No scan results available.</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Protocol</th>
                  <th>State</th>
                  <th>Service</th>
                  <th>Product</th>
                  <th>Version</th>
                  <th>CPE</th>
                  <th>Score</th>
                  <th>Vulns</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {scanLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td>{log.port}</td>
                    <td>{log.protocol}</td>
                    <td>{log.state}</td>
                    <td>{log.service}</td>
                    <td>{log.product}</td>
                    <td>{log.version}</td>
                    <td>{log.cpe}</td>
                    <td>
                      <Badge
                        bg={
                          log.vulnerabilityScore >= 8
                            ? 'danger'
                            : log.vulnerabilityScore >= 5
                            ? 'warning'
                            : 'secondary'
                        }
                        title={`Severity Score: ${log.vulnerabilityScore}`}
                      >
                        {log.vulnerabilityScore || 0}
                      </Badge>
                    </td>
                    <td>
                      {log.vulnerabilities && log.vulnerabilities.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                          {log.vulnerabilities.map((vuln, i) => (
                            <li key={i}>
                              <a
                                href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {vuln}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span>No vulnerabilities</span>
                      )}
                    </td>
                    <td>{log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Assets;
