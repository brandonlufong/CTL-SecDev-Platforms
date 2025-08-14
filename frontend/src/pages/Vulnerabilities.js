import React, { useState, useEffect, useContext } from 'react';
import {
  Table, Button, Modal, Form, Badge, Dropdown, Pagination, Card, ButtonGroup, Spinner,
} from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaEdit, FaTrash, FaPlus, FaSyncAlt, FaDownload, FaSort, FaShieldAlt
} from 'react-icons/fa';
import Papa from 'papaparse'; // For CSV Export
import config from '../config';
import '../App.css'; // Import custom styles

const Vulnerabilities = () => {
  const { token } = useContext(AuthContext);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [vulns, setVulns] = useState([]);
  const [assets, setAssets] = useState([]);
  // const [filteredVulns, setFilteredVulns] = useState([]);

  const [form, setForm] = useState({
    title: '',
    severity: 'Low',
    status: 'Open',
    asset: '',
    description: '',
    cve: '',
    discoveredDate: '',
    remediation: '',
    exploitAvailable: false,
    references: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  // const [filteredAssets, setFilteredAssets] = useState([]);
  const [filteredVulns, setFilteredVulns] = useState([]);
  // const [sortKey, setSortKey] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const itemsPerPage = 5;


  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Fetch all vulnerabilities
  const fetchVulnerabilities = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/vulnerabilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setVulns(data);
      setFilteredVulns(data);
    } catch (err) {
      console.error('Failed to fetch vulnerabilities', err); 
      setError('Failed to load vulnerabilities');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...vulns];

    if (searchTerm) {
      filtered = filtered.filter(vuln =>
        Object.values(vuln).some(field =>
          String(field).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(vuln => vuln.status === statusFilter);
    }

    if (severityFilter) {
      filtered = filtered.filter(vuln => vuln.severity === severityFilter);
    }

    if (sortField) {
      filtered.sort((a, b) =>
        a[sortField]?.toLowerCase().localeCompare(b[sortField]?.toLowerCase())
      );
    }

    setFilteredVulns(filtered);
  };

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page on filters change
  }, [searchTerm, statusFilter, severityFilter, sortField, vulns]);

  // Filter and sort vulns
  useEffect(() => {
    let filtered = vulns.filter(vuln =>
      Object.values(vuln).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // Sort vulns
    filtered.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      if (sortOrder === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

    setFilteredVulns(filtered);
    setCurrentPage(1);
  }, [vulns, searchTerm, sortBy, sortOrder]);

  // Fetch assets with enhanced data
  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAssets(data);
      // setFilteredAssets(data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchVulnerabilities();
  }, [token]);

  // const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openCreateModal = () => {
    setForm({
      title: '',
      severity: 'Low',
      status: 'Open',
      asset: '',
      description: '',
      cve: '',
      discoveredDate: '',
      remediation: '',
      exploitAvailable: false,
      references: '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = vuln => {
    setForm({
      title: vuln.title,
      severity: vuln.severity,
      status: vuln.status,
      asset: vuln.asset ? vuln.asset._id : '',
      description: vuln.description || '',
      cve: vuln.cve || '',
      discoveredDate: vuln.discoveredDate ? vuln.discoveredDate.substring(0, 10) : '',
      remediation: vuln.remediation || '',
      exploitAvailable: vuln.exploitAvailable || false,
      references: vuln.references || '',
    });
    setEditId(vuln._id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.asset) {
      alert('Please select an asset.');
      return;
    }

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${config.API_BASE_URL}/api/vulnerabilities/${editId}`
        : `${config.API_BASE_URL}/api/vulnerabilities`;

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      fetchVulnerabilities();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save vulnerability', err);
    }
  };

  const exportToCSV = () => {
    const csv = Papa.unparse(filteredVulns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'vulnerabilities_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async id => {
    const confirmed = window.confirm('Are you sure you want to delete this vulnerability?');
    if (!confirmed) return;

    try {
      await fetch(`${config.API_BASE_URL}/api/vulnerabilities/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchVulnerabilities();
    } catch (err) {
      console.error('Failed to delete vulnerability', err);
    }
  };

  const handleStatusToggle = async (id, newStatus) => {
    try {
      await fetch(`${config.API_BASE_URL}/api/vulnerabilities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchVulnerabilities();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const renderSeverityBadge = severity => {
    switch (severity) {
      case 'Critical':
        return <Badge bg="danger">Critical</Badge>;
      case 'High':
        return <Badge bg="warning">High</Badge>;
      case 'Medium':
        return <Badge bg="info">Medium</Badge>;
      case 'Low':
      default:
        return <Badge bg="secondary">Low</Badge>;
    }
  };

  // Filter, Search, and Sort logic
  // const filteredVulns = vulns
  //   .filter(v =>
  //     v.title.toLowerCase().includes(searchTerm.toLowerCase())
  //   )
  //   .filter(v => (filterSeverity ? v.severity === filterSeverity : true))
  //   .filter(v => (filterStatus ? v.status === filterStatus : true))
  //   .sort((a, b) =>
  //     sortKey
  //       ? a[sortKey].localeCompare(b[sortKey])
  //       : 0
  //   );

  // const paginatedVulns = filteredVulns.slice(
  //   (currentPage - 1) * itemsPerPage,
  //   currentPage * itemsPerPage
  // );

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedVulns = filteredVulns.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredVulns.length / itemsPerPage);

  
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
    <div className="container py-4" style={{ backgroundColor: '#F1F8FD' }}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 style={{ color: '#1594EA' }}>
          <FaShieldAlt className="me-2" /> Vulnerability List
        </h3>
        <Button
          style={{
            backgroundColor: '#1594EA',
            border: 'none',
            color: '#fff',
          }}
          onClick={openCreateModal}
          className="d-flex align-items-center gap-2 px-3 shadow-sm"
        >
          <FaPlus /> Add New
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          type="search"
          placeholder="Search vulnerabilities..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '250px' }}
        />
        <Form.Select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          style={{ maxWidth: '150px' }}
        >
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </Form.Select>
        <Form.Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ maxWidth: '150px' }}
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </Form.Select>
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            <FaSort /> Sort
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => setSortField('severity')}>
              By Severity
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setSortField('status')}>
              By Status
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setSortField('title')}>
              By Title
            </Dropdown.Item>
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
          onClick={fetchVulnerabilities}
          className="d-flex align-items-center gap-1"
        >
          <FaSyncAlt /> Refresh
        </Button>
      </div>

      <Card>
        <Card.Body>
          {/* <Table bordered hover responsive className="align-middle rounded shadow-sm"> */}
          <Table responsive hover>
            <thead style={{ backgroundColor: '#1594EA', color: '#fff' }}>
              <tr>
                <th>Name</th>
                <th>Severity</th>
                <th>CVSS Score</th>
                <th>Status</th>
                <th>Asset</th>
                <th>CVE</th>
                <th>Discovery Date</th>
                {/* <th>Exploit</th> */}
                <th>Remediation</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVulns.map(v => (
                <tr key={v._id}>
                  <td>
                    <strong>{v.title}</strong>
                    {v.description && (
                      <div className="text-muted small">{v.description}</div>
                    )}
                  </td>
                  <td>{renderSeverityBadge(v.severity)}</td>
                  <td>
                    <Badge
                      bg={
                        v.cvssScore >= 9
                          ? 'danger'
                          : v.cvssScore >= 7
                          ? 'warning'
                          : v.cvssScore >= 4
                          ? 'info'
                          : v.cvssScore > 0
                          ? 'secondary'
                          : 'light'
                      }
                      className="rounded-pill px-3"
                    >
                      {v.cvssScore ? v.cvssScore.toFixed(1) : 'N/A'}
                    </Badge>
                  </td>
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle
                        variant={
                          v.status === 'Resolved'
                            ? 'success'
                            : v.status === 'In Progress'
                            ? 'warning'
                            : 'danger'
                        }
                        size="sm"
                      >
                        {v.status}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {['Open', 'In Progress', 'Resolved'].map(status => (
                          <Dropdown.Item
                            key={status}
                            onClick={() => handleStatusToggle(v._id, status)}
                          >
                            {status}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                  <td>
                    {/* {v.asset ? `${v.asset.name} (${v.asset.ip})` : 'N/A'} */}
                    <strong>{v.asset.name}</strong>
                    <br/>
                    {v.asset.ip && (
                      <code>{v.asset.ip}</code>
                    )}
                  </td>
                  <td>
                    <small>{v.cve}</small>
                  </td>
                  <td>
                    <small>{v.discoveredDate?.slice(0, 10)}</small>
                  </td>
                  <td>
                    <small>{v.remediation || 'N/A'}</small>
                  </td>
                  {/* <td>{v.exploitAvailable ? 'Yes' : 'No'}</td> */}
                  {/* <td>{v.description}</td> */}
                  <td className="text-center">
                    <div className="d-flex justify-content-center gap-2">
                      {/* <Button
                        style={{
                          borderColor: '#1594EA',
                          color: '#1594EA',
                        }}
                        variant="outline-primary"
                        size="sm"
                        onClick={() => openEditModal(v)}
                        className="d-flex align-items-center gap-1 edit-btn"
                      >
                        <FaEdit /> Edit
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(v._id)}
                        className="d-flex align-items-center gap-1"
                      >
                        <FaTrash /> Delete
                      </Button> */}
                    <ButtonGroup size="sm">
                      <Button 
                        // style={{ borderColor: 'grey', color: 'grey' }} 
                        variant="outline-primary" 
                        onClick={() => openEditModal(v)}>
                        <FaEdit />
                      </Button>
                      <Button 
                        // style={{ borderColor: 'red', borderLeft: 'none', color: 'red' }}
                        variant="outline-danger" 
                        onClick={() => handleDelete(v._id)}>
                        <FaTrash />
                      </Button>
                    </ButtonGroup>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, vulns.length)} of {vulns.length} vulnerabilities
            </div>
            <Pagination>
              <Pagination.Prev 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              />
              {[...Array(totalPages).keys()].map(page => (
                <Pagination.Item
                  key={page + 1}
                  active={page + 1 === currentPage}
                  onClick={() => setCurrentPage(page + 1)}
                >
                  {page + 1}
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

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>{isEditing ? 'Edit Vulnerability' : 'Add Vulnerability'}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                name="title"
                value={form.title}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>CVE ID</Form.Label>
              <Form.Control name="cve" value={form.cve} onChange={handleChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Severity</Form.Label>
              <Form.Select
                name="severity"
                value={form.severity}
                onChange={handleChange}
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option>Open</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Discovery Date</Form.Label>
              <Form.Control type="date" name="discoveredDate" value={form.discoveredDate} onChange={handleChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Asset</Form.Label>
              <Form.Select
                name="asset"
                value={form.asset}
                onChange={handleChange}
                required
              >
                <option value="">-- Select an Asset --</option>
                {assets.map(asset => (
                  <option key={asset._id} value={asset._id}>
                    {asset.name} ({asset.ip})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={form.description}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Remediation</Form.Label>
              <Form.Control as="textarea" rows={2} name="remediation" value={form.remediation} onChange={handleChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Exploit Available"
                name="exploitAvailable"
                checked={form.exploitAvailable}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>References (comma-separated)</Form.Label>
              <Form.Control name="references" value={form.references} onChange={handleChange} />
            </Form.Group>

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

export default Vulnerabilities;
