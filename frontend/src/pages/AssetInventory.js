import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  ListGroup,
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Alert,
  Spinner,
  Table,
  Modal,
  Form,
  Dropdown,
  ProgressBar,
  Tab,
  Tabs,
  Nav,
  NavItem,
  NavLink
} from 'react-bootstrap';
import {
  FaServer,
  FaNetworkWired,
  FaDatabase,
  FaDesktop,
  FaCloud,
  FaSearch,
  FaFilter,
  FaPlus,
  FaSync,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaGlobe,
  FaTags,
  FaChartBar,
  FaMapMarkedAlt,
  FaShieldAlt,
  FaCog,
  FaRouter,
  FaSwitch,
  FaWifi
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import config from '../config';
import AssetDiscovery from '../components/AssetDiscovery';
import BsPagination from '../components/BsPagination';
import { getMonitoringStatus, triggerMonitoringCheck } from '../api/platformApi';
import { useT } from '../context/LanguageContext';

const AssetInventory = () => {
  const t = useT();
  const { token } = useContext(AuthContext);
  
  // State management
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Client-side pagination for the assets table
  const [aiPage, setAiPage] = useState(1);
  const [aiPageSize, setAiPageSize] = useState(25);
  // assets is refetched when search/filters change, so reset the page on new data.
  useEffect(() => { setAiPage(1); }, [assets]);

  // Real-time monitoring tab state
  const [monitoring, setMonitoring] = useState(null);
  const [monLoading, setMonLoading] = useState(false);
  const loadMonitoring = useCallback(async () => {
    setMonLoading(true);
    try { setMonitoring(await getMonitoringStatus()); } catch (e) { /* ignore */ } finally { setMonLoading(false); }
  }, []);
  useEffect(() => {
    if (activeTab !== 'monitoring') return undefined;
    loadMonitoring();
    const t = setInterval(loadMonitoring, 15000);
    return () => clearInterval(t);
  }, [activeTab, loadMonitoring]);
  const runMonitoringCheck = async () => {
    setMonLoading(true);
    try { await triggerMonitoringCheck(); await loadMonitoring(); } catch (e) { /* ignore */ } finally { setMonLoading(false); }
  };

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    assetType: 'all', // 'all', 'servers', 'devices'
    type: '',
    status: '',
    category: '',
    tags: [],
    criticality: '',
    complianceStatus: '',
    country: '',
    exposure: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Classification form state
  const [classificationForm, setClassificationForm] = useState({
    category: '',
    tags: [],
    criticality: 'medium',
    businessImpact: 'medium',
    technicalImpact: 'medium',
    notes: ''
  });

  
  // Fetch unified dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/inventory/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  // Fetch unified assets with filters
  const fetchAssets = async () => {
    try {
      const params = new URLSearchParams();
      
      if (searchQuery) params.append('query', searchQuery);
      Object.entries(filters).forEach(([key, value]) => {
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, value);
          }
        }
      });

      const response = await fetch(`${config.API_BASE_URL}/api/inventory/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    }
  };

  // Fetch categories and tags
  const fetchCategoriesAndTags = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}/api/inventory/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${config.API_BASE_URL}/api/inventory/tags`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setTags(tagsData);
      }
    } catch (error) {
      console.error('Failed to fetch categories and tags:', error);
    }
  };

  
  
  // Update asset classification (only for server assets)
  const updateAssetClassification = async () => {
    try {
      setError('');
      setSuccess('');

      // Only allow classification for server assets
      if (selectedAsset.assetType !== 'Server') {
        setError('Classification is only available for Server Assets');
        return;
      }

      const response = await fetch(`${config.API_BASE_URL}/api/inventory/classification/${selectedAsset._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(classificationForm)
      });

      if (response.ok) {
        setSuccess('Asset classification updated successfully');
        setShowClassificationModal(false);
        setSelectedAsset(null);
        fetchAssets();
        fetchDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update classification');
      }
    } catch (error) {
      setError('Failed to update classification');
      console.error('Classification error:', error);
    }
  };

  // Auto-classify assets (only server assets)
  const autoClassifyAssets = async () => {
    try {
      setError('');
      setSuccess('');

      const response = await fetch(`${config.API_BASE_URL}/api/inventory/classification/auto-classify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`Auto-classification completed: ${data.results.classified} assets classified`);
        fetchAssets();
        fetchDashboardData();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to auto-classify assets');
      }
    } catch (error) {
      setError('Failed to auto-classify assets');
      console.error('Auto-classification error:', error);
    }
  };

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboardData(),
        fetchCategoriesAndTags(),
        fetchAssets()
      ]);
      setLoading(false);
    };

    loadData();

    // Set up real-time updates
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Update assets when filters change
  useEffect(() => {
    fetchAssets();
  }, [searchQuery, filters]);

  // Get appropriate icon for asset type
  const getAssetIcon = (assetType, deviceCategory) => {
    if (assetType === 'Server') {
      return <FaServer className="text-primary" />;
    } else if (assetType === 'Network Device') {
      if (deviceCategory === 'Router') return <FaNetworkWired className="text-info" />;
      if (deviceCategory === 'Switch') return <FaCog className="text-info" />;
      if (deviceCategory === 'Access Point') return <FaWifi className="text-info" />;
      return <FaNetworkWired className="text-info" />;
    }
    return <FaDesktop className="text-secondary" />;
  };

  // Render overview dashboard
  const renderOverview = () => {
    if (!dashboardData) return null;

    const { overview, assetTypes, serverBreakdown, deviceBreakdown, classification, geoDistribution } = dashboardData;

    return (
      <>
        {/* Overview Cards */}
        <Row className="mb-4">
          <Col md={2}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <FaServer className="text-primary mb-2" size={32} />
                <h3 className="mb-1">{overview.totalAssets}</h3>
                <p className="text-muted mb-0">Total Assets</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <FaCheckCircle className="text-success mb-2" size={32} />
                <h3 className="mb-1">{overview.onlineAssets}</h3>
                <p className="text-muted mb-0">Online</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <FaTimesCircle className="text-danger mb-2" size={32} />
                <h3 className="mb-1">{overview.offlineAssets}</h3>
                <p className="text-muted mb-0">Offline</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <FaClock className="text-warning mb-2" size={32} />
                <h3 className="mb-1">{overview.maintenanceAssets}</h3>
                <p className="text-muted mb-0">Maintenance</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <FaServer className="text-info mb-2" size={32} />
                <h3 className="mb-1">{overview.serverAssets}</h3>
                <p className="text-muted mb-0">Server Assets</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center">
                <FaNetworkWired className="text-success mb-2" size={32} />
                <h3 className="mb-1">{overview.networkDevices}</h3>
                <p className="text-muted mb-0">Network Devices</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Asset Type Distribution */}
        <Row className="mb-4">
          <Col md={6}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white">
                <h6 className="mb-0">Asset Type Distribution</h6>
              </Card.Header>
              <Card.Body>
                {assetTypes.map((type, index) => (
                  <div key={index} className="d-flex justify-content-between align-items-center mb-2">
                    <span>{type._id}</span>
                    <Badge bg="primary">{type.count}</Badge>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white">
                <h6 className="mb-0">Server Breakdown</h6>
              </Card.Header>
              <Card.Body>
                {Object.entries(serverBreakdown || {}).map(([type, count]) => (
                  <div key={type} className="d-flex justify-content-between align-items-center mb-2">
                    <span>{type}</span>
                    <Badge bg="info">{count}</Badge>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Device Breakdown */}
        <Row className="mb-4">
          <Col md={6}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white">
                <h6 className="mb-0">Network Device Breakdown</h6>
              </Card.Header>
              <Card.Body>
                {Object.entries(deviceBreakdown || {}).map(([type, count]) => (
                  <div key={type} className="d-flex justify-content-between align-items-center mb-2">
                    <span>{type}</span>
                    <Badge bg="success">{count}</Badge>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white">
                <h6 className="mb-0">
                  <FaGlobe className="me-2" />
                  Geographic Distribution
                </h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  {geoDistribution.map((country, index) => (
                    <Col md={6} key={index} className="text-center mb-3">
                      <div className="d-flex align-items-center justify-content-center">
                        <FaMapMarkedAlt className="text-primary me-2" />
                        <div>
                          <strong>{country._id}</strong>
                          <div className="text-muted">{country.count} assets</div>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
  };

  // Render assets table
  const renderAssetsTable = () => {
    return (
      <>
        {/* Search and Filter Bar */}
        <Row className="mb-3">
          <Col md={6}>
            <Form.Control
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Col>
          <Col md={6} className="text-end">
            <Button
              variant="outline-secondary"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="me-2"
            >
              <FaFilter className="me-2" />
              Advanced Filters
            </Button>
            <Button
              variant="outline-primary"
              onClick={() => setShowDiscoveryModal(true)}
              className="me-2"
            >
              <FaSearch className="me-2" />
              Discover Assets
            </Button>
            <Button
              variant="outline-success"
              onClick={autoClassifyAssets}
            >
              <FaTags className="me-2" />
              Auto-Classify
            </Button>
          </Col>
        </Row>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <Card className="mb-3">
            <Card.Body>
              <Row>
                <Col md={3}>
                  <Form.Label>Asset Type</Form.Label>
                  <Form.Select
                    value={filters.assetType}
                    onChange={(e) => setFilters({ ...filters, assetType: e.target.value })}
                  >
                    <option value="all">All Types</option>
                    <option value="servers">Server Assets Only</option>
                    <option value="devices">Network Devices Only</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">All Statuses</option>
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="Maintenance">Maintenance</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label>Exposure</Form.Label>
                  <Form.Select
                    value={filters.exposure}
                    onChange={(e) => setFilters({ ...filters, exposure: e.target.value })}
                  >
                    <option value="">All Exposure</option>
                    <option value="Public">Public</option>
                    <option value="Private">Private</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label>Criticality</Form.Label>
                  <Form.Select
                    value={filters.criticality}
                    onChange={(e) => setFilters({ ...filters, criticality: e.target.value })}
                  >
                    <option value="">All Criticality</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Form.Select>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Assets Table */}
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white">
            <h6 className="mb-0">Assets ({assets.length})</h6>
          </Card.Header>
          <Card.Body>
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IP Address</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Criticality</th>
                  <th>Compliance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.slice((aiPage - 1) * aiPageSize, aiPage * aiPageSize).map((asset) => (
                  <tr key={asset._id}>
                    <td>
                      <div className="d-flex align-items-center">
                        {getAssetIcon(asset.assetType, asset.deviceCategory)}
                        <span className="ms-2">{asset.name}</span>
                      </div>
                    </td>
                    <td>{asset.ip}</td>
                    <td>
                      <Badge bg={asset.assetType === 'Server' ? 'primary' : 'success'}>
                        {asset.assetType}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        bg={asset.status === 'Online' ? 'success' : asset.status === 'Offline' ? 'danger' : 'warning'}
                      >
                        {asset.status}
                      </Badge>
                    </td>
                    <td>
                      {asset.classification?.category ? (
                        <Badge bg="secondary">{asset.classification.category.name}</Badge>
                      ) : (
                        <span className="text-muted">Unclassified</span>
                      )}
                    </td>
                    <td>
                      {asset.classification?.criticality && (
                        <Badge
                          bg={
                            asset.classification.criticality === 'critical' ? 'danger' :
                            asset.classification.criticality === 'high' ? 'warning' :
                            asset.classification.criticality === 'medium' ? 'info' : 'secondary'
                          }
                        >
                          {asset.classification.criticality}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {asset.classification?.complianceStatus && (
                        <Badge
                          bg={
                            asset.classification.complianceStatus === 'compliant' ? 'success' :
                            asset.classification.complianceStatus === 'non-compliant' ? 'danger' : 'warning'
                          }
                        >
                          {asset.classification.complianceStatus}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowClassificationModal(true);
                        }}
                        disabled={asset.assetType !== 'Server'}
                        title={asset.assetType !== 'Server' ? 'Classification only available for Server Assets' : ''}
                      >
                        Classify
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <BsPagination
              currentPage={aiPage}
              totalItems={assets.length}
              itemsPerPage={aiPageSize}
              onPageChange={setAiPage}
              onPageSizeChange={(s) => { setAiPageSize(s); setAiPage(1); }}
              label="assets"
            />
          </Card.Body>
        </Card>
      </>
    );
  };

  
  // Render classification modal
  const renderClassificationModal = () => (
    <Modal show={showClassificationModal} onHide={() => setShowClassificationModal(false)} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaTags className="me-2" />
          Classify Asset: {selectedAsset?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {selectedAsset?.assetType !== 'Server' && (
          <Alert variant="warning">
            Classification is only available for Server Assets. Network Devices cannot be classified.
          </Alert>
        )}
        
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={classificationForm.category}
                  onChange={(e) => setClassificationForm({ ...classificationForm, category: e.target.value })}
                  disabled={selectedAsset?.assetType !== 'Server'}
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Criticality</Form.Label>
                <Form.Select
                  value={classificationForm.criticality}
                  onChange={(e) => setClassificationForm({ ...classificationForm, criticality: e.target.value })}
                  disabled={selectedAsset?.assetType !== 'Server'}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Business Impact</Form.Label>
                <Form.Select
                  value={classificationForm.businessImpact}
                  onChange={(e) => setClassificationForm({ ...classificationForm, businessImpact: e.target.value })}
                  disabled={selectedAsset?.assetType !== 'Server'}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Technical Impact</Form.Label>
                <Form.Select
                  value={classificationForm.technicalImpact}
                  onChange={(e) => setClassificationForm({ ...classificationForm, technicalImpact: e.target.value })}
                  disabled={selectedAsset?.assetType !== 'Server'}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Tags</Form.Label>
            <Form.Select
              multiple
              value={classificationForm.tags}
              onChange={(e) => setClassificationForm({ ...classificationForm, tags: Array.from(e.target.selectedOptions).map(opt => opt.value) })}
              disabled={selectedAsset?.assetType !== 'Server'}
            >
              {tags.map((tag) => (
                <option key={tag._id} value={tag._id}>
                  {tag.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={classificationForm.notes}
              onChange={(e) => setClassificationForm({ ...classificationForm, notes: e.target.value })}
              disabled={selectedAsset?.assetType !== 'Server'}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowClassificationModal(false)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={updateAssetClassification} disabled={selectedAsset?.assetType !== 'Server'}>
          Save Classification
        </Button>
      </Modal.Footer>
    </Modal>
  );

  if (loading) {
    return (
      <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <p className="text-muted mt-2">Loading Asset Inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ backgroundColor: '#F1F8FD', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1 vm-page-title">
            <FaDatabase />
            {t('Unified Asset Inventory')}
          </h2>
          <p className="text-muted mb-0">Comprehensive asset management for servers and network devices</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-info" onClick={() => fetchDashboardData()}>
            <FaSync className="me-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Navigation Tabs */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="overview" title="Overview">
          {renderOverview()}
        </Tab>
        <Tab eventKey="assets" title="Assets">
          {renderAssetsTable()}
        </Tab>
        <Tab eventKey="monitoring" title="Monitoring">
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="mb-0"><FaShieldAlt className="text-primary me-2" />Real-time Monitoring</h5>
                <div className="d-flex gap-2 align-items-center">
                  <Badge bg={monitoring?.isMonitoring ? 'success' : 'secondary'}>
                    {monitoring?.isMonitoring ? '● Active' : '○ Idle'}
                  </Badge>
                  <Button size="sm" variant="outline-info" onClick={loadMonitoring} disabled={monLoading}>
                    <FaSync className={monLoading ? 'spin' : ''} /> Refresh
                  </Button>
                  <Button size="sm" style={{ backgroundColor: '#1594EA' }} onClick={runMonitoringCheck} disabled={monLoading}>
                    {monLoading ? <><Spinner size="sm" animation="border" /> Checking...</> : <>Run Check Now</>}
                  </Button>
                </div>
              </div>

              {!monitoring ? (
                <div className="text-muted py-3 text-center">Loading monitoring data…</div>
              ) : (
                <>
                  <Row className="g-2 mb-3">
                    <Col xs={6} md={3}><Card className="text-center"><Card.Body className="py-2"><h4 className="text-success mb-0">{monitoring.summary?.healthy || 0}</h4><small className="text-muted">Healthy</small></Card.Body></Card></Col>
                    <Col xs={6} md={3}><Card className="text-center"><Card.Body className="py-2"><h4 className="text-warning mb-0">{monitoring.summary?.warning || 0}</h4><small className="text-muted">Warning</small></Card.Body></Card></Col>
                    <Col xs={6} md={3}><Card className="text-center"><Card.Body className="py-2"><h4 className="text-danger mb-0">{monitoring.summary?.unhealthy || 0}</h4><small className="text-muted">Unhealthy</small></Card.Body></Card></Col>
                    <Col xs={6} md={3}><Card className="text-center"><Card.Body className="py-2"><h4 className="mb-0" style={{ color: '#1594EA' }}>{monitoring.totalAssets || 0}</h4><small className="text-muted">Monitored</small></Card.Body></Card></Col>
                  </Row>

                  <Table responsive hover>
                    <thead>
                      <tr><th>Asset</th><th>IP Address</th><th>Status</th><th>Response</th><th>Last Check</th></tr>
                    </thead>
                    <tbody>
                      {(monitoring.healthChecks || []).length === 0 ? (
                        <tr><td colSpan="5" className="text-center text-muted py-4">No health data yet — click “Run Check Now”.</td></tr>
                      ) : (
                        monitoring.healthChecks.map((h, i) => (
                          <tr key={i}>
                            <td><strong>{h.name || h.assetName || h.asset || '—'}</strong></td>
                            <td><code>{h.ip || '—'}</code></td>
                            <td>
                              <Badge bg={h.status === 'healthy' ? 'success' : h.status === 'warning' ? 'warning' : 'danger'}>
                                {h.status || 'unknown'}
                              </Badge>
                            </td>
                            <td>{h.responseTime != null ? `${Math.round(h.responseTime)}ms` : '—'}</td>
                            <td><small className="text-muted">{h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : '—'}</small></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>

                  {(monitoring.recentAlerts || []).length > 0 && (
                    <>
                      <h6 className="mt-3">Recent Alerts</h6>
                      <ListGroup>
                        {monitoring.recentAlerts.slice().reverse().map((a, i) => (
                          <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                            <span><FaExclamationTriangle className="text-warning me-2" />{a.message || a.type || 'Alert'}</span>
                            <small className="text-muted">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</small>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modals */}
      <AssetDiscovery 
        show={showDiscoveryModal} 
        onHide={() => setShowDiscoveryModal(false)} 
      />
      {renderClassificationModal()}
    </div>
  );
};

export default AssetInventory;
