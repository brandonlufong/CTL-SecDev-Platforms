import React, { useState, useEffect, useContext } from 'react';
import { Modal, Button, Table, Form, Badge, Dropdown, Pagination, Card, Spinner, ButtonGroup } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaSort, FaDownload, FaSyncAlt, FaBug } from 'react-icons/fa';
import config from '../config';
import '../App.css'; // Import custom styles
import { useLocation } from 'react-router-dom';
import Papa from 'papaparse'; // For CSV Export

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const ALL_VULN_STATUSES = [
  'Open', 'In Progress', 'Resolved'
];

const statusToVariant = (status) => {
  if (status === 'Resolved' || status === 'Remediated' || status === 'Closed' || status === 'Mitigated') return 'success';
  if (status === 'In Progress' || status === 'Pending' || status === 'Under Review' || status === 'Acknowledged' || status === 'Reviewed' || status === 'Escalated' || status === 'Deferred') return 'warning';
  if (status === 'False Positive' || status === 'Not Applicable' || status === 'Duplicate' || status === 'Wont Fix') return 'secondary';
  return 'danger'; // Open and others default to danger
};

const Vulnerabilities = () => {
  const query = useQuery();
  const filterSeverity = query.get("severity");

  const { token } = useContext(AuthContext);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [vulns, setVulns] = useState([]);
  const [assets, setAssets] = useState([]);
  const [devices, setDevices] = useState([]);

  const [form, setForm] = useState({
    title: '',
    severity: 'Low',
    cvssScore: '',
    status: 'Open',
    asset: '',
    device: '',
    description: '',
    cve: '',
    discoveredDate: '',
    remediation: '',
    exploitAvailable: false,
    references: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredVulns, setFilteredVulns] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemsPerPage = 5;
  const location = useLocation();

  // Parse query params
  const queryParams = new URLSearchParams(location.search);
  const severityParam = queryParams.get("severity");
  const statusParam = queryParams.get("status");

  useEffect(() => {
    fetchVulnerabilities(severityParam, statusParam);
  }, [severityParam, statusParam]);

  // Fetch all vulnerabilities with proper error handling
  const fetchVulnerabilities = async (severity, status) => {
    try {
      setLoading(true);
      let url = '/api/vulnerabilities';
      const params = new URLSearchParams();
      if (severity) params.append('severity', severity);
      if (status) params.append('status', status);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(`${config.API_BASE_URL}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setVulns(data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch vulnerabilities', err);
      setError('Failed to load vulnerabilities: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all assets
  const fetchAssets = async () => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (err) {
      console.error('Failed to fetch assets', err);
    }
  };

  // Fetch all devices
  const fetchDevices = async () => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchDevices();
  }, [token]);

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
      cvssScore: '',
      asset: '',
      device: '',
      description: '',
      cve: '',
      discoveredDate: '',
      remediation: '',
      exploitAvailable: false,
      references: '',
    });
    setIsEditing(false);
    setEditId(null);
    setShowModal(true);
  };

  const openEditModal = vuln => {
    setForm({
      title: vuln.title,
      severity: vuln.severity,
      cvssScore: vuln.cvssScore || '',
      status: vuln.status,
      asset: vuln.asset ? vuln.asset._id : '',
      device: vuln.device ? vuln.device._id : '',
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
    
    if (!form.asset && !form.device) {
      alert('Please select an asset or a device.');
      return;
    }

    if (!form.title.trim()) {
      alert('Please enter a title.');
      return;
    }

    setIsSubmitting(true);

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${config.API_BASE_URL}/api/vulnerabilities/${editId}`
        : `${config.API_BASE_URL}/api/vulnerabilities`;

      // Clean up the form data before sending
      const submitData = {
        ...form,
        // Convert empty strings to null for optional fields
        cvssScore: form.cvssScore ? parseFloat(form.cvssScore) : null,
        discoveredDate: form.discoveredDate || null,
        description: form.description || null,
        cve: form.cve || null,
        remediation: form.remediation || null,
        references: form.references || null,
        // Ensure we only send either asset OR device, not both
        asset: form.asset || null,
        device: form.device || null,
      };

      // Remove empty device/asset field if the other is selected
      if (submitData.asset) {
        submitData.device = null;
      } else if (submitData.device) {
        submitData.asset = null;
      }

      console.log('Submitting data:', submitData);
      console.log('URL:', url);
      console.log('Method:', method);

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response text:', errorText);
        
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (parseErr) {
          console.error('Failed to parse error response as JSON:', parseErr);
        }
        
        throw new Error(errorData.message || errorText || `HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      console.log('Success:', result);
      
      await fetchVulnerabilities(severityParam, statusParam);
      setShowModal(false);
      setError('');
      
    } catch (err) {
      console.error('Failed to save vulnerability', err);
      setError('Failed to save vulnerability: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this vulnerability?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/vulnerabilities/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete vulnerability");
      }

      await fetchVulnerabilities(severityParam, statusParam);
      setError('');

    } catch (err) {
      console.error("Delete failed:", err);
      setError('Delete failed: ' + err.message);
    }
  };

  const handleStatusToggle = async (id, newStatus) => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/vulnerabilities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
      }

      await fetchVulnerabilities(severityParam, statusParam);
      setError('');
      
    } catch (err) {
      console.error('Failed to update status', err);
      setError('Failed to update status: ' + err.message);
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

  const renderCvssScoreBadge = score => {
    if (score === null || score === undefined || isNaN(score)) {
      return <Badge bg="secondary">N/A</Badge>;
    }

    let severity = "";
    let color = "";

    if (score <= 3.9) {
      severity = "Low";
      color = "secondary";
    } else if (score <= 6.9) {
      severity = "Medium";
      color = "info";
    } else if (score <= 8.9) { // Fixed: was 8,9
      severity = "High";
      color = "warning";
    } else {
      severity = "Critical";
      color = "danger";
    }

    return (
      <Badge bg={color}>
        {score.toFixed(1)} - {severity}
      </Badge>
    );
  };

  // Filter and search logic
  useEffect(() => {
    let filtered = [...vulns];

    if (searchTerm) {
      filtered = filtered.filter(vuln => {
        const searchFields = [
          vuln.title,
          vuln.description,
          vuln.cve,
          vuln.severity,
          vuln.status,
          vuln.asset?.name,
          vuln.device?.name,
        ];
        
        return searchFields.some(field => 
          field && String(field).toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (statusFilter) {
      filtered = filtered.filter(vuln => vuln.status === statusFilter);
    }

    if (severityFilter) {
      filtered = filtered.filter(vuln => vuln.severity === severityFilter);
    }

    setFilteredVulns(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, severityFilter, vulns]);

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

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVulns = filteredVulns.slice(indexOfFirstItem, indexOfLastItem);
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
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD'}}>
      {error && (
        <div className="alert alert-danger mb-3" role="alert">
          {error}
        </div>
      )}
      
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 style={{ color: '#1594EA' }} className="mb-4 d-flex align-items-center">
          <FaBug className="me-2" />Vulnerability List
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
          {ALL_VULN_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Form.Select>
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
          onClick={() => fetchVulnerabilities(severityParam, statusParam)}
          className="d-flex align-items-center gap-1"
        >
          <FaSyncAlt /> Refresh
        </Button>
      </div>

      <Card>
        <Card.Body>
          <Table responsive hover>
            <thead style={{ backgroundColor: '#1594EA', color: '#fff' }}>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>CVSS Score</th>
                <th>Status</th>
                <th>Asset</th>
                <th>CVE</th>
                <th>Discovery Date</th>
                <th>Remediation</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentVulns.map(v => (
                <tr key={v._id}>
                  <td>
                    <strong>{v.title}</strong>
                    {v.description && (
                      <div className="text-muted small">{v.description}</div>
                    )}
                  </td>
                  <td>{renderSeverityBadge(v.severity)}</td>
                  <td>{renderCvssScoreBadge(v.cvssScore)}</td>
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle
                        variant={statusToVariant(v.status)}
                        size="sm"
                      >
                        {v.status}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {ALL_VULN_STATUSES.map(status => (
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
                    <strong>
                      {v.asset
                        ? (
                          <>
                            {v.asset.name}<br/>
                            {v.asset.ip && <code>{v.asset.ip}</code>}
                          </>
                        )
                        : v.device
                        ? (
                          <>
                            {v.device.name}<br/>
                            {v.device.ip && <code>{v.device.ip}</code>}
                          </>
                        )
                        : "N/A"}
                    </strong>
                  </td>
                  <td><div className="small">{v.cve}</div></td>
                  <td><div className="small">{v.discoveredDate?.slice(0, 10)}</div></td>
                  <td><div className="small">{v.remediation}</div></td>
                  <td className="text-center">
                    <ButtonGroup size="sm">
                      <Button 
                        style={{
                          borderColor: '#1594EA',
                          color: '#1594EA',
                        }} 
                        variant="outline-secondary" 
                        onClick={() => openEditModal(v)} 
                        className="d-flex align-items-center gap-1 edit-btn"
                      >
                        <FaEdit />
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        onClick={() => handleDelete(v._id)}
                      >
                        <FaTrash />
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div>
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredVulns.length)} of {filteredVulns.length} vulnerabilities
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
          )}
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
              <Form.Label>CVSS Score</Form.Label>
              <Form.Control
                type="number"
                name="cvssScore"
                step="0.1"
                min="0"
                max="10"
                value={form.cvssScore}
                onChange={handleChange}
                placeholder="e.g. 7.5"
              />
              <Form.Text className="text-muted">
                Enter a score between 0.0 and 10.0
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {ALL_VULN_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Discovery Date</Form.Label>
              <Form.Control type="date" name="discoveredDate" value={form.discoveredDate} onChange={handleChange} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Select Server Asset</Form.Label>
              <Form.Select
                name="asset"
                value={form.asset}
                onChange={handleChange}
              >
                <option value="">-- Select a Server Asset --</option>
                {/* <optgroup label="Assets"> */}
                  {assets.map(asset => (
                    <option key={`asset-${asset._id}`} value={asset._id}>
                      {asset.name} ({asset.ip})
                    </option>
                  ))}
                {/* </optgroup> */}
                {/* <optgroup label="Devices">
                  {devices.map(device => (
                    <option key={`device-${device._id}`} value={device._id}>
                      Device: {device.name} ({device.ip})
                    </option>
                  ))}
                </optgroup> */}
              </Form.Select>
            </Form.Group>

            {/* Device dropdowns */}
            <Form.Group className="mb-3">
              <Form.Label>or Select Network Device</Form.Label>
              <Form.Select
                name="device"
                value={form.device}
                onChange={(e) => {
                  setForm(prev => ({
                    ...prev,
                    device: e.target.value,
                    asset: e.target.value ? '' : prev.asset // Clear asset if device is selected
                  }));
                }}
              >
                <option value="">-- Select a Network Device --</option>
                {devices.map(device => (
                  <option key={device._id} value={device._id}>
                    {device.name} ({device.ip})
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
              <Form.Control 
                as="textarea" 
                rows={2} 
                name="remediation" 
                value={form.remediation} 
                onChange={handleChange} 
              />
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
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: '#1594EA', border: 'none' }}
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Vulnerabilities;