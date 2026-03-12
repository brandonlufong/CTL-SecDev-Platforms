import React, { useState, useEffect, useContext } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  InputGroup,
  Badge,
  Alert,
  Spinner,
  Tabs,
  Tab,
  Table,
  Modal,
  ListGroup,
  Collapse,
  Accordion,
  ToggleButton,
  ToggleButtonGroup
} from 'react-bootstrap';
import {
  FaUsers,
  FaUserShield,
  FaLock,
  FaUnlock,
  FaEye,
  FaEyeSlash,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSave,
  FaCopy,
  FaShieldAlt,
  FaKey,
  FaClock,
  FaNetworkWired,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaSync,
  FaHistory
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import config from '../config';

const AccessControl = () => {
  const { token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('roles');

  // Roles and Permissions
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});

  // User Access Management
  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  // Access Policies
  const [accessPolicies, setAccessPolicies] = useState({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventReuse: 5,
      maxAge: 90,
      lockoutThreshold: 5,
      lockoutDuration: 15
    },
    sessionPolicy: {
      maxDuration: 8,
      idleTimeout: 30,
      concurrentSessions: 3,
      requireReauth: false,
      ipWhitelist: [],
      ipBlacklist: []
    },
    accessPolicy: {
      twoFactorRequired: false,
      allowedIps: [],
      blockedIps: [],
      workingHoursOnly: false,
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      emergencyAccess: false
    }
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [lastLogUpdate, setLastLogUpdate] = useState(new Date());
  const [logFilters, setLogFilters] = useState({
    action: 'all',
    user: 'all',
    dateRange: '7days',
    severity: 'all'
  });

  // Modal States
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] });

  useEffect(() => {
    fetchRolesAndPermissions();
    fetchUsers();
    fetchAccessPolicies();
    fetchAuditLogs();
  }, []);

  // Auto-refresh audit logs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuditLogs();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [logFilters]); // Re-establish interval when filters change

  const fetchRolesAndPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/admin/users/roles-permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
        setPermissions(data.permissions || []);
        setRolePermissions(data.rolePermissions || {});
      }
    } catch (error) {
      console.error('Failed to fetch roles and permissions:', error);
      setError('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setUserRoles(data.userRoles || {});
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchAccessPolicies = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/access/policies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccessPolicies(data);
      }
    } catch (error) {
      console.error('Failed to fetch access policies:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const queryParams = new URLSearchParams(logFilters);
      const url = `${config.API_BASE_URL}/api/access/audit-logs?${queryParams}`;
      console.log('Fetching audit logs from:', url);
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Audit logs response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Audit logs data:', data);
        setAuditLogs(data.logs || []);
        setLastLogUpdate(new Date());
      } else {
        const errorData = await response.json();
        console.error('Audit logs error response:', errorData);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  };

  const openCreateRoleModal = () => {
    setNewRole({ name: '', description: '', permissions: [] });
    setIsEditingRole(false);
    setEditingRoleId(null);
    setShowRoleModal(true);
  };

  const openEditRoleModal = (roleName) => {
    const currentPermissions = rolePermissions[roleName] || [];
    setNewRole({ 
      name: roleName, 
      description: `Edit permissions for ${roleName} role`, 
      permissions: currentPermissions 
    });
    setIsEditingRole(true);
    setEditingRoleId(roleName);
    setShowRoleModal(true);
  };

  const handleRoleSubmit = async () => {
    try {
      setSaving(true);
      setError('');

      let response;
      if (isEditingRole) {
        // Update existing role
        response = await fetch(`${config.API_BASE_URL}/api/admin/roles/${editingRoleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ permissions: newRole.permissions })
        });
        
        if (response.ok) {
          setSuccess('Role updated successfully');
        } else {
          setError('Failed to update role');
        }
      } else {
        // Create new role
        response = await fetch(`${config.API_BASE_URL}/api/admin/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(newRole)
        });
        
        if (response.ok) {
          setSuccess('Role created successfully');
        } else {
          setError('Failed to create role');
        }
      }

      if (response.ok) {
        setShowRoleModal(false);
        setNewRole({ name: '', description: '', permissions: [] });
        setIsEditingRole(false);
        setEditingRoleId(null);
        fetchRolesAndPermissions();
      }
    } catch (error) {
      console.error('Role operation error:', error);
      setError(isEditingRole ? 'Failed to update role' : 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (roleName, permissions) => {
    try {
      setSaving(true);
      setError('');

      const response = await fetch(`${config.API_BASE_URL}/api/admin/roles/${roleName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions })
      });

      if (response.ok) {
        setSuccess('Role permissions updated successfully');
        fetchRolesAndPermissions();
      } else {
        setError('Failed to update role permissions');
      }
    } catch (error) {
      console.error('Update role error:', error);
      setError('Failed to update role permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleName) => {
    if (!window.confirm(`Are you sure you want to delete the "${roleName}" role?`)) {
      return;
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/admin/roles/${roleName}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('Role deleted successfully');
        fetchRolesAndPermissions();
      } else {
        setError('Failed to delete role');
      }
    } catch (error) {
      console.error('Delete role error:', error);
      setError('Failed to delete role');
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      setSaving(true);
      setError('');

      const response = await fetch(`${config.API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setSuccess('User role updated successfully');
        fetchUsers();
      } else {
        setError('Failed to update user role');
      }
    } catch (error) {
      console.error('Update user role error:', error);
      setError('Failed to update user role');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserLock = async (userId, isActive) => {
    try {
      setSaving(true);
      setError('');

      const response = await fetch(`${config.API_BASE_URL}/api/access/users/${userId}/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: isActive ? 'unlock' : 'lock' })
      });

      if (response.ok) {
        setSuccess(`User ${isActive ? 'unlocked' : 'locked'} successfully`);
        fetchUsers();
      } else {
        setError(`Failed to ${isActive ? 'unlock' : 'lock'} user`);
      }
    } catch (error) {
      console.error('Toggle user lock error:', error);
      setError(`Failed to ${isActive ? 'unlock' : 'lock'} user`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Are you sure you want to reset this user\'s password? A temporary password will be generated.')) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      
      const response = await fetch(`${config.API_BASE_URL}/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: tempPassword })
      });

      if (response.ok) {
        setSuccess(`Password reset successfully. Temporary password: ${tempPassword}`);
      } else {
        setError('Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAccessPolicies = async (category, policies) => {
    try {
      setSaving(true);
      setError('');

      const response = await fetch(`${config.API_BASE_URL}/api/access/policies/${category}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(policies)
      });

      if (response.ok) {
        setSuccess(`${category} policies updated successfully`);
        fetchAccessPolicies();
      } else {
        setError('Failed to update access policies');
      }
    } catch (error) {
      console.error('Update policies error:', error);
      setError('Failed to update access policies');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionCategory = (permission) => {
    const category = permission.split(':')[0];
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getSeverityBadge = (severity) => {
    const variants = {
      low: 'success',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    };
    return variants[severity] || 'secondary';
  };

  const renderRolesManagement = () => (
    <>
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FaUserShield className="me-2" />
                Roles & Permissions
              </h5>
              <Button 
                variant="primary" 
                onClick={openCreateRoleModal}
                style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
              >
                <FaPlus className="me-2" />
                Create Role
              </Button>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                </div>
              ) : (
                <Accordion>
                  {roles.map((role) => (
                    <Accordion.Item key={role} eventKey={role}>
                      <Accordion.Header>
                        <div className="d-flex justify-content-between align-items-center w-100">
                          <div>
                            <strong>{role}</strong>
                            <Badge bg="secondary" className="ms-2">
                              {rolePermissions[role]?.length || 0} permissions
                            </Badge>
                          </div>
                          <div>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="me-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditRoleModal(role);
                              }}
                            >
                              <FaEdit />
                            </Button>
                            {role !== 'super_admin' && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(role);
                                }}
                              >
                                <FaTrash />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        <h6 className="text-muted mb-3">Permissions</h6>
                        <Row>
                          {Object.entries(
                            permissions.reduce((acc, permission) => {
                              const category = getPermissionCategory(permission);
                              if (!acc[category]) acc[category] = [];
                              acc[category].push(permission);
                              return acc;
                            }, {})
                          ).map(([category, categoryPermissions]) => (
                            <Col md={6} key={category} className="mb-3">
                              <h6 className="text-primary">{category}</h6>
                              <div className="d-flex flex-wrap gap-2">
                                {categoryPermissions.map((permission) => (
                                  <Form.Check
                                    key={permission}
                                    type="checkbox"
                                    label={permission}
                                    checked={rolePermissions[role]?.includes(permission) || false}
                                    disabled
                                    style={{ opacity: 0.7 }}
                                  />
                                ))}
                              </div>
                            </Col>
                          ))}
                        </Row>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderUserAccess = () => (
    <>
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h5 className="mb-0">
                <FaUsers className="me-2" />
                User Access Management
              </h5>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Current Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" 
                               style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="fw-semibold">{user.name}</div>
                            <small className="text-muted">@{user.username}</small>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={userRoles[user._id] || user.role}
                          onChange={(e) => handleUpdateUserRole(user._id, e.target.value)}
                          style={{ width: '150px' }}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Badge bg={user.isActive ? 'success' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <small className="text-muted">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserDetailsModal(true);
                            }}
                            title="View Details"
                          >
                            <FaEye />
                          </Button>
                          <Button
                            variant={user.isActive ? "outline-warning" : "outline-success"}
                            size="sm"
                            onClick={() => handleToggleUserLock(user._id, !user.isActive)}
                            title={user.isActive ? "Lock User" : "Unlock User"}
                          >
                            {user.isActive ? <FaLock /> : <FaUnlock />}
                          </Button>
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => handleResetPassword(user._id)}
                            title="Reset Password"
                          >
                            <FaKey />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderAccessPolicies = () => (
    <>
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h5 className="mb-0">
                <FaLock className="me-2" />
                Access Policies
              </h5>
            </Card.Header>
            <Card.Body>
              <Tabs className="mb-4">
                <Tab eventKey="password" title="Password Policy">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Minimum Password Length</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.passwordPolicy.minLength}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.passwordPolicy, minLength: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                          }}
                          min="6"
                          max="32"
                        />
                      </Form.Group>
                      <Form.Check
                        type="checkbox"
                        label="Require Uppercase Letters"
                        checked={accessPolicies.passwordPolicy.requireUppercase}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.passwordPolicy, requireUppercase: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                        }}
                        className="mb-2"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Require Lowercase Letters"
                        checked={accessPolicies.passwordPolicy.requireLowercase}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.passwordPolicy, requireLowercase: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                        }}
                        className="mb-2"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Require Numbers"
                        checked={accessPolicies.passwordPolicy.requireNumbers}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.passwordPolicy, requireNumbers: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                        }}
                        className="mb-2"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Require Special Characters"
                        checked={accessPolicies.passwordPolicy.requireSpecialChars}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.passwordPolicy, requireSpecialChars: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                        }}
                        className="mb-3"
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Prevent Password Reuse (last N passwords)</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.passwordPolicy.preventReuse}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.passwordPolicy, preventReuse: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                          }}
                          min="0"
                          max="24"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Password Max Age (days)</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.passwordPolicy.maxAge}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.passwordPolicy, maxAge: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                          }}
                          min="0"
                          max="365"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Lockout Threshold (failed attempts)</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.passwordPolicy.lockoutThreshold}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.passwordPolicy, lockoutThreshold: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                          }}
                          min="3"
                          max="10"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Lockout Duration (minutes)</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.passwordPolicy.lockoutDuration}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.passwordPolicy, lockoutDuration: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, passwordPolicy: updated }));
                          }}
                          min="5"
                          max="1440"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-flex justify-content-end">
                    <Button 
                      variant="primary" 
                      onClick={() => handleUpdateAccessPolicies('password', accessPolicies.passwordPolicy)}
                      style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
                    >
                      <FaSave className="me-2" />
                      Save Password Policy
                    </Button>
                  </div>
                </Tab>

                <Tab eventKey="session" title="Session Policy">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Maximum Session Duration (hours)</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.sessionPolicy.maxDuration}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.sessionPolicy, maxDuration: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, sessionPolicy: updated }));
                          }}
                          min="1"
                          max="24"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Idle Timeout (minutes)</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.sessionPolicy.idleTimeout}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.sessionPolicy, idleTimeout: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, sessionPolicy: updated }));
                          }}
                          min="5"
                          max="480"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Concurrent Sessions</Form.Label>
                        <Form.Control
                          type="number"
                          value={accessPolicies.sessionPolicy.concurrentSessions}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.sessionPolicy, concurrentSessions: parseInt(e.target.value) };
                            setAccessPolicies(prev => ({ ...prev, sessionPolicy: updated }));
                          }}
                          min="1"
                          max="10"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Check
                        type="checkbox"
                        label="Require Re-authentication for Sensitive Actions"
                        checked={accessPolicies.sessionPolicy.requireReauth}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.sessionPolicy, requireReauth: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, sessionPolicy: updated }));
                        }}
                        className="mb-3"
                      />
                      <Form.Group className="mb-3">
                        <Form.Label>IP Whitelist (one per line)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={accessPolicies.sessionPolicy.ipWhitelist.join('\n')}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.sessionPolicy, ipWhitelist: e.target.value.split('\n').filter(ip => ip.trim()) };
                            setAccessPolicies(prev => ({ ...prev, sessionPolicy: updated }));
                          }}
                          placeholder="192.168.1.1&#10;10.0.0.0/8"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>IP Blacklist (one per line)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={accessPolicies.sessionPolicy.ipBlacklist.join('\n')}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.sessionPolicy, ipBlacklist: e.target.value.split('\n').filter(ip => ip.trim()) };
                            setAccessPolicies(prev => ({ ...prev, sessionPolicy: updated }));
                          }}
                          placeholder="192.168.1.100&#10;10.0.0.50"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-flex justify-content-end">
                    <Button 
                      variant="primary" 
                      onClick={() => handleUpdateAccessPolicies('session', accessPolicies.sessionPolicy)}
                      style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
                    >
                      <FaSave className="me-2" />
                      Save Session Policy
                    </Button>
                  </div>
                </Tab>

                <Tab eventKey="access" title="Access Control">
                  <Row>
                    <Col md={6}>
                      <Form.Check
                        type="checkbox"
                        label="Require Two-Factor Authentication"
                        checked={accessPolicies.accessPolicy.twoFactorRequired}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.accessPolicy, twoFactorRequired: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                        }}
                        className="mb-3"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Restrict Access to Working Hours Only"
                        checked={accessPolicies.accessPolicy.workingHoursOnly}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.accessPolicy, workingHoursOnly: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                        }}
                        className="mb-3"
                      />
                      <Form.Check
                        type="checkbox"
                        label="Enable Emergency Access"
                        checked={accessPolicies.accessPolicy.emergencyAccess}
                        onChange={(e) => {
                          const updated = { ...accessPolicies.accessPolicy, emergencyAccess: e.target.checked };
                          setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                        }}
                        className="mb-3"
                      />
                      {accessPolicies.accessPolicy.workingHoursOnly && (
                        <>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Working Hours Start</Form.Label>
                                <Form.Control
                                  type="time"
                                  value={accessPolicies.accessPolicy.workingHoursStart}
                                  onChange={(e) => {
                                    const updated = { ...accessPolicies.accessPolicy, workingHoursStart: e.target.value };
                                    setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                                  }}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Working Hours End</Form.Label>
                                <Form.Control
                                  type="time"
                                  value={accessPolicies.accessPolicy.workingHoursEnd}
                                  onChange={(e) => {
                                    const updated = { ...accessPolicies.accessPolicy, workingHoursEnd: e.target.value };
                                    setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                                  }}
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Form.Group className="mb-3">
                            <Form.Label>Working Days</Form.Label>
                            <div>
                              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                                <Form.Check
                                  key={day}
                                  type="checkbox"
                                  label={day.charAt(0).toUpperCase() + day.slice(1)}
                                  checked={accessPolicies.accessPolicy.workingDays.includes(day)}
                                  onChange={(e) => {
                                    const updated = e.target.checked
                                      ? [...accessPolicies.accessPolicy.workingDays, day]
                                      : accessPolicies.accessPolicy.workingDays.filter(d => d !== day);
                                    setAccessPolicies(prev => ({
                                      ...prev,
                                      accessPolicy: { ...prev.accessPolicy, workingDays: updated }
                                    }));
                                  }}
                                  inline
                                />
                              ))}
                            </div>
                          </Form.Group>
                        </>
                      )}
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Allowed IPs (one per line)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={accessPolicies.accessPolicy.allowedIps.join('\n')}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.accessPolicy, allowedIps: e.target.value.split('\n').filter(ip => ip.trim()) };
                            setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                          }}
                          placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Blocked IPs (one per line)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={accessPolicies.accessPolicy.blockedIps.join('\n')}
                          onChange={(e) => {
                            const updated = { ...accessPolicies.accessPolicy, blockedIps: e.target.value.split('\n').filter(ip => ip.trim()) };
                            setAccessPolicies(prev => ({ ...prev, accessPolicy: updated }));
                          }}
                          placeholder="192.168.1.100&#10;10.0.0.50"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-flex justify-content-end">
                    <Button 
                      variant="primary" 
                      onClick={() => handleUpdateAccessPolicies('access', accessPolicies.accessPolicy)}
                      style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
                    >
                      <FaSave className="me-2" />
                      Save Access Policy
                    </Button>
                  </div>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderAuditLogs = () => (
    <>
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h5 className="mb-0">
                <FaEye className="me-2" />
                Audit Logs
              </h5>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Action</Form.Label>
                    <Form.Select
                      value={logFilters.action}
                      onChange={(e) => setLogFilters(prev => ({ ...prev, action: e.target.value }))}
                    >
                      <option value="all">All Actions</option>
                      <option value="login">Login</option>
                      <option value="logout">Logout</option>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                      <option value="access">Access</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>User</Form.Label>
                    <Form.Select
                      value={logFilters.user}
                      onChange={(e) => setLogFilters(prev => ({ ...prev, user: e.target.value }))}
                    >
                      <option value="all">All Users</option>
                      {users.map((user) => (
                        <option key={user._id} value={user.username}>{user.username}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Date Range</Form.Label>
                    <Form.Select
                      value={logFilters.dateRange}
                      onChange={(e) => setLogFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    >
                      <option value="1day">Last 24 Hours</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="90days">Last 90 Days</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Severity</Form.Label>
                    <Form.Select
                      value={logFilters.severity}
                      onChange={(e) => setLogFilters(prev => ({ ...prev, severity: e.target.value }))}
                    >
                      <option value="all">All Severities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Button variant="outline-secondary" onClick={fetchAuditLogs}>
                  <FaSync className="me-2" />
                  Refresh Logs
                </Button>
                <small className="text-muted">
                  Last updated: {lastLogUpdate.toLocaleTimeString()}
                  <span className="ms-2 text-success">
                    ● Auto-refresh every 30s
                  </span>
                </small>
              </div>
              <Table responsive hover size="sm">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>IP Address</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        <div className="text-muted">
                          <FaHistory className="mb-2" style={{ fontSize: '2rem' }} />
                          <p className="mb-0">No audit logs available yet.</p>
                          <small>Audit logs will appear here as users perform actions in the system.</small>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log._id}>
                        <td>
                          <small>{new Date(log.timestamp).toLocaleString()}</small>
                        </td>
                        <td>{log.user}</td>
                        <td>
                          <Badge bg="secondary">{log.action}</Badge>
                        </td>
                        <td>{log.resource || '-'}</td>
                        <td>
                          <code>{log.ipAddress}</code>
                        </td>
                        <td>
                          <Badge bg={log.success ? 'success' : 'danger'}>
                            {log.success ? 'Success' : 'Failed'}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={getSeverityBadge(log.severity)}>
                            {log.severity}
                          </Badge>
                        </td>
                        <td>
                          <small className="text-muted">{log.details}</small>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );

  if (loading && activeTab === 'roles') {
    return (
      <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <p className="text-muted mt-2">Loading access control settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ color: '#1594EA', fontWeight: '600' }}>
            <FaLock className="me-2" style={{ color: '#1594EA' }} />
            Access Control
          </h2>
          <p className="text-muted mb-0">Manage roles, permissions, and access policies</p>
        </div>
        <div>
          <Button 
            variant="outline-secondary" 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #6c757d',
              color: '#6c757d'
            }}
          >
            <FaSync className="me-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}><FaExclamationTriangle className="me-2" />{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}><FaCheckCircle className="me-2" />{success}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="roles" title="Roles & Permissions">
          {renderRolesManagement()}
        </Tab>
        <Tab eventKey="users" title="User Access">
          {renderUserAccess()}
        </Tab>
        <Tab eventKey="policies" title="Access Policies">
          {renderAccessPolicies()}
        </Tab>
        <Tab eventKey="audit" title="Audit Logs">
          {renderAuditLogs()}
        </Tab>
      </Tabs>

      {/* Create/Edit Role Modal */}
      <Modal show={showRoleModal} onHide={() => setShowRoleModal(false)} size="lg">
        <Modal.Header 
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>
            {isEditingRole ? 'Edit Role' : 'Create New Role'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          <Form.Group className="mb-3">
            <Form.Label>Role Name</Form.Label>
            <Form.Control
              type="text"
              value={newRole.name}
              onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter role name"
              disabled={isEditingRole} // Disable name editing for existing roles
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={newRole.description}
              onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter role description"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Permissions</Form.Label>
            <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {permissions.map((permission) => (
                <Form.Check
                  key={permission}
                  type="checkbox"
                  label={permission}
                  checked={newRole.permissions.includes(permission)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...newRole.permissions, permission]
                      : newRole.permissions.filter(p => p !== permission);
                    setNewRole(prev => ({ ...prev, permissions: updated }));
                  }}
                />
              ))}
            </div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#F8F9FA' }}>
          <Button variant="secondary" onClick={() => setShowRoleModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleRoleSubmit} 
            disabled={saving}
            style={{ backgroundColor: '#1594EA', borderColor: '#1594EA' }}
          >
            {saving ? <Spinner animation="border" size="sm" /> : (isEditingRole ? <FaSave className="me-2" /> : <FaPlus className="me-2" />)}
            {isEditingRole ? 'Update Role' : 'Create Role'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* User Details Modal */}
      <Modal show={showUserDetailsModal} onHide={() => setShowUserDetailsModal(false)} size="lg">
        <Modal.Header 
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          {selectedUser && (
            <Row>
              <Col md={6}>
                <h6 className="text-primary mb-3">Basic Information</h6>
                <ListGroup>
                  <ListGroup.Item>
                    <strong>Name:</strong> {selectedUser.name}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Username:</strong> @{selectedUser.username}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Email:</strong> {selectedUser.email}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Role:</strong> 
                    <Badge bg="info" className="ms-2">{selectedUser.role}</Badge>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Status:</strong> 
                    <Badge bg={selectedUser.isActive ? 'success' : 'secondary'} className="ms-2">
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </ListGroup.Item>
                </ListGroup>
              </Col>
              <Col md={6}>
                <h6 className="text-primary mb-3">Activity Information</h6>
                <ListGroup>
                  <ListGroup.Item>
                    <strong>Last Login:</strong> 
                    <div className="text-muted small">
                      {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Account Created:</strong> 
                    <div className="text-muted small">
                      {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Last Updated:</strong> 
                    <div className="text-muted small">
                      {selectedUser.updatedAt ? new Date(selectedUser.updatedAt).toLocaleString() : 'N/A'}
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Login Attempts:</strong> {selectedUser.loginAttempts || 0}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Account Locked:</strong> 
                    <Badge bg={selectedUser.lockUntil && new Date(selectedUser.lockUntil) > new Date() ? 'warning' : 'success'} className="ms-2">
                      {selectedUser.lockUntil && new Date(selectedUser.lockUntil) > new Date() ? 'Yes' : 'No'}
                    </Badge>
                  </ListGroup.Item>
                </ListGroup>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#F8F9FA' }}>
          <Button variant="secondary" onClick={() => setShowUserDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AccessControl;
