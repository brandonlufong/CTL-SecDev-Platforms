import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Button, 
  Table, 
  Modal, 
  Form, 
  Badge,
  Alert,
  Spinner,
  InputGroup,
  FormControl,
  Dropdown,
  Pagination,
  ButtonGroup
} from 'react-bootstrap';
import { 
  FaUsers, 
  FaCog, 
  FaEdit, 
  FaTrash, 
  FaPlus, 
  FaSearch,
  FaSync,
  FaLock,
  FaUnlock,
  FaKey,
  FaUserShield,
  FaChartBar,
  FaUserCheck,
  FaUserTimes,
  FaFilter
} from 'react-icons/fa';
import axios from 'axios';
import config from '../config';
import '../App.css'; // Import custom styles

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    permissions: [],
    isActive: true
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchRolesAndPermissions();
  }, [search, roleFilter, statusFilter, currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search,
        role: roleFilter,
        isActive: statusFilter
      });

      const response = await axios.get(`${config.API_BASE_URL}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setUsers(response.data.users);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      setError('Failed to fetch users');
      console.error('Fetch users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${config.API_BASE_URL}/api/admin/users/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const fetchRolesAndPermissions = async () => {
    try {
      const response = await axios.get(`${config.API_BASE_URL}/api/admin/users/roles-permissions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRoles(response.data.roles);
      setPermissions(response.data.permissions);
    } catch (error) {
      console.error('Fetch roles and permissions error:', error);
    }
  };

  const handleShowModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'user',
        permissions: [],
        isActive: true
      });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      permissions: [],
      isActive: true
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        await axios.put(
          `${config.API_BASE_URL}/api/admin/users/${editingUser._id}`,
          formData,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setSuccess('User updated successfully');
      } else {
        await axios.post(
          `${config.API_BASE_URL}/api/admin/users`,
          formData,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setSuccess('User created successfully');
      }

      handleCloseModal();
      fetchUsers();
      fetchStats();
    } catch (error) {
      setError(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`${config.API_BASE_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSuccess('User deleted successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await axios.patch(`${config.API_BASE_URL}/api/admin/users/${userId}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSuccess('User status updated successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
    setError('');
    setSuccess('');
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await axios.post(
        `${config.API_BASE_URL}/api/admin/users/${selectedUser._id}/reset-password`,
        { newPassword: passwordForm.newPassword },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setSuccess('Password reset successfully');
      setShowPasswordModal(false);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to reset password');
    }
  };

  const getRoleBadgeVariant = (role) => {
    const variants = {
      super_admin: 'danger',
      admin: 'warning',
      security_analyst: 'info',
      auditor: 'secondary',
      user: 'primary'
    };
    return variants[role] || 'secondary';
  };

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-2" style={{ color: '#1594EA' }}>
            <FaUserShield className="me-2" />
            Admin Dashboard
          </h3>
          <p className="text-muted mb-0">Manage users, roles, and system permissions</p>
        </div>
        <Button 
          style={{
            backgroundColor: '#1594EA',
            border: 'none',
            color: '#fff',
          }}
          onClick={() => handleShowModal()}
          className="d-flex align-items-center gap-2 px-3 shadow-sm"
        >
          <FaPlus className="me-2" />
          Add User
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Statistics Cards */}
      {stats && (
        <Row className="mb-4">
          <Col md={3}>
            <Card className="text-center h-100 border-0 shadow-sm">
              <Card.Body className="py-3">
                <FaUsers size={32} className="text-primary mb-2" />
                <h3 className="mb-1">{stats.overview.totalUsers}</h3>
                <p className="text-muted mb-0">Total Users</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center h-100 border-0 shadow-sm">
              <Card.Body className="py-3">
                <FaUserCheck size={32} className="text-success mb-2" />
                <h3 className="mb-1">{stats.overview.activeUsers}</h3>
                <p className="text-muted mb-0">Active Users</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center h-100 border-0 shadow-sm">
              <Card.Body className="py-3">
                <FaUserTimes size={32} className="text-danger mb-2" />
                <h3 className="mb-1">{stats.overview.inactiveUsers}</h3>
                <p className="text-muted mb-0">Inactive Users</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center h-100 border-0 shadow-sm">
              <Card.Body className="py-3">
                <FaChartBar size={32} className="text-info mb-2" />
                <h3 className="mb-1">{stats.roleDistribution.length}</h3>
                <p className="text-muted mb-0">Role Types</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0">
            <FaFilter className="me-2" />
            Filters
          </h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <FormControl
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role.replace('_', ' ').toUpperCase()}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button variant="outline-secondary" onClick={fetchUsers} className="w-100">
                <FaSync className="me-2" />
                Refresh
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Users Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0">
            <FaUsers className="me-2" />
            User Management
          </h6>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" className="text-primary" />
              <p className="text-muted mt-2">Loading users...</p>
            </div>
          ) : (
            <Table responsive hover className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <Badge bg={getRoleBadgeVariant(user.role)}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <small className="text-muted">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                      </small>
                    </td>
                    <td>
                      <div className="d-flex justify-content-center">
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-primary"
                            onClick={() => handleShowModal(user)}
                            className="edit-btn"
                            title="Edit User"
                          >
                            <FaEdit />
                          </Button>
                          <Button
                            variant="outline-warning"
                            onClick={() => handleResetPassword(user)}
                            title="Reset Password"
                          >
                            <FaKey />
                          </Button>
                          <Button
                            variant={user.isActive ? "outline-danger" : "outline-success"}
                            onClick={() => handleToggleStatus(user._id)}
                            title={user.isActive ? "Deactivate" : "Activate"}
                          >
                            {user.isActive ? <FaLock /> : <FaUnlock />}
                          </Button>
                          <Dropdown>
                            <Dropdown.Toggle variant="outline-secondary" size="sm" title="More Actions">
                              <FaCog />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item 
                                className="text-danger"
                                onClick={() => handleDeleteUser(user._id)}
                              >
                                <FaTrash className="me-2" />
                                Delete User
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        </ButtonGroup>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {users.length === 0 && !loading && (
            <div className="text-center py-4">
              <FaUsers size={48} className="text-muted mb-3" />
              <p className="text-muted">No users found matching your criteria</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Button
                variant="outline-primary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="mx-3 align-self-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline-primary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Add/Edit User Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>
            <FaUserShield className="me-2" />
            {editingUser ? 'Edit User' : 'Add New User'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Control
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
            </Row>
            {!editingUser && (
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required={!editingUser}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Confirm Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required={!editingUser}
                    />
                  </Form.Group>
                </Col>
              </Row>
            )}
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    name="isActive"
                    label="Active User"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer style={{ backgroundColor: '#F8F9FA' }}>
            <Button
              variant="secondary"
              onClick={handleCloseModal}
              className="me-2"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
            >
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)} centered>
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>
            <FaKey className="me-2" />
            Reset Password
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handlePasswordReset}>
          <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
            <p className="text-muted mb-3">
              Reset password for: <strong>{selectedUser?.name}</strong> ({selectedUser?.email})
            </p>
            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                placeholder="Enter new password"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                placeholder="Confirm new password"
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ backgroundColor: '#F8F9FA' }}>
            <Button
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
              className="me-2"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
            >
              Reset Password
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Admin;
