import React, { useState, useEffect, useContext } from 'react';
import { Modal, Button, Form, ProgressBar, Alert, Badge, Card, ListGroup } from 'react-bootstrap';
import { FaSearch, FaTimes, FaNetworkWired, FaServer, FaClock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import { io } from 'socket.io-client';
import config from '../config';
import NetworkDetector from './NetworkDetector';
import BsPagination from './BsPagination';

const AssetDiscovery = ({ show, onHide }) => {
  const { token, user } = useContext(AuthContext);
  
  // Network selection handlers
  const handleNetworkSelect = (networkInfo) => {
    console.log('Network selected:', networkInfo);
  };

  const handleRangeSelect = (networkRange) => {
    console.log('Network range selected:', networkRange);
    setFormData(prev => ({
      ...prev,
      networkRange
    }));
  };
  
  // Form state
  const [formData, setFormData] = useState({
    networkRange: '192.168.1.0/24',
    ports: '22,23,53,80,135,139,443,445,993,995,1723,3389,5900',
    timeout: 5000,
    maxConcurrent: 50,
    autoImport: true
  });

  // Discovery state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [discoveredAssets, setDiscoveredAssets] = useState([]);
  const [scanResults, setScanResults] = useState(null);
  const [error, setError] = useState('');
  const [discPage, setDiscPage] = useState(1);
  const [discPerPage, setDiscPerPage] = useState(10);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (show && user) {
      console.log('Initializing Socket.IO connection...');
      const newSocket = io(config.API_BASE_URL, {
        transports: ['websocket', 'polling'],
        auth: { token }
      });

      console.log('Socket.IO connection created:', newSocket);

      newSocket.on('connect', () => {
        console.log('Socket.IO connected successfully');
      });

      newSocket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
      });

      // Listen for discovery events
      newSocket.on('discovery:started', (data) => {
        try {
          console.log('Discovery started:', data);
          setScanStatus('Initializing scan...');
          setError('');
        } catch (error) {
          console.error('Error handling discovery started:', error);
        }
      });

      newSocket.on('discovery:progress', (data) => {
        try {
          console.log('Discovery progress:', data);
          setScanProgress(data.progress || 0);
          setScanStatus(data.message || 'Scanning...');
        } catch (error) {
          console.error('Error handling discovery progress:', error);
        }
      });

      newSocket.on('discovery:completed', (data) => {
        try {
          console.log('Discovery completed:', data);
          setScanProgress(100);
          setScanStatus('Scan completed successfully!');
          
          // Safely handle result data
          const result = data.result || {};
          setScanResults(result);
          setDiscoveredAssets(result.assets || []);
          setIsScanning(false);
        } catch (error) {
          console.error('Error handling discovery completed:', error);
          setScanStatus('Scan completed with some errors');
          setIsScanning(false);
        }
      });

      newSocket.on('discovery:importing', (data) => {
        console.log('Importing assets:', data);
        setScanStatus('Importing discovered assets...');
      });

      newSocket.on('discovery:imported', (data) => {
        console.log('Assets imported:', data);
        try {
          const created = data.importResults?.created || 0;
          const updated = data.importResults?.updated || 0;
          setScanStatus(`Import completed: ${created} created, ${updated} updated`);
        } catch (error) {
          console.error('Error handling import completion:', error);
          setScanStatus('Import completed');
        }
      });

      newSocket.on('discovery:cancelled', (data) => {
        console.log('Discovery cancelled:', data);
        setScanStatus('Scan cancelled');
        setIsScanning(false);
      });

      newSocket.on('discovery:error', (data) => {
        console.error('Discovery error:', data);
        setError(data.error || 'Discovery failed');
        setScanStatus('Error occurred during scan');
        setIsScanning(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError('Failed to connect to discovery service');
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        if (newSocket) {
          console.log('Cleaning up Socket.IO connection');
          newSocket.disconnect();
        }
      };
    }
  }, [show, user, token]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Start discovery
  const startDiscovery = async (e) => {
    e.preventDefault();
    setError('');
    setDiscoveredAssets([]);
    setScanResults(null);
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Starting discovery...');

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/discovery/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start discovery');
      }

      const data = await response.json();
      console.log('Discovery started:', data);
      setScanStatus('Discovery initiated...');

      // Fallback polling in case Socket.IO doesn't work
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${config.API_BASE_URL}/api/discovery/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.currentScan && statusData.currentScan.progress !== undefined) {
              setScanProgress(statusData.currentScan.progress);
              setScanStatus(`Scanning... ${statusData.currentScan.progress}% complete`);
            }
            
            if (!statusData.isScanning) {
              clearInterval(pollInterval);
              setScanProgress(100);
              setScanStatus('Scan completed!');
              setIsScanning(false);
            }
          }
        } catch (error) {
          console.error('Status polling error:', error);
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (error) {
      console.error('Start discovery error:', error);
      setError(error.message);
      setIsScanning(false);
      setScanStatus('');
    }
  };

  // Cancel discovery
  const cancelDiscovery = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/discovery/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setScanStatus('Cancelling scan...');
        setIsScanning(false);
      }
    } catch (error) {
      console.error('Cancel discovery error:', error);
      setError('Failed to cancel discovery');
    }
  };

  // Reset form
  const resetForm = () => {
    console.log('Resetting discovery form...');
    setFormData({
      networkRange: '192.168.1.0/24',
      ports: '22,23,53,80,135,139,443,445,993,995,1723,3389,5900',
      timeout: 5000,
      maxConcurrent: 50,
      autoImport: true
    });
    setDiscoveredAssets([]);
    setScanResults(null);
    setScanProgress(0);
    setScanStatus('');
    setError('');
    setIsScanning(false);
  };

  // Close modal
  const handleClose = () => {
    console.log('Modal close requested, isScanning:', isScanning);
    if (isScanning) {
      cancelDiscovery();
    }
    resetForm();
    onHide();
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!show) {
      resetForm();
    }
  }, [show]);

  return (
    <Modal 
      show={show} 
      onHide={handleClose} 
      size="lg"
      backdrop="static"
      keyboard={false}
      enforceFocus={false}
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <FaNetworkWired className="me-2" />
          Asset Discovery
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            <FaExclamationTriangle className="me-2" />
            {error}
          </Alert>
        )}

        {!isScanning && !scanResults && (
          <Form onSubmit={startDiscovery}>
            <Form.Group className="mb-3">
              <Form.Label>Network Range</Form.Label>
              <Form.Control
                type="text"
                name="networkRange"
                value={formData.networkRange}
                onChange={handleInputChange}
                placeholder="e.g., 192.168.1.0/24"
                required
              />
              <Form.Text>
                Enter a network range in CIDR notation (e.g., 192.168.1.0/24) or a single IP address
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Ports to Scan</Form.Label>
              <Form.Control
                type="text"
                name="ports"
                value={formData.ports}
                onChange={handleInputChange}
                placeholder="22,23,53,80,443"
              />
              <Form.Text>
                Comma-separated list of ports to scan (default includes common service ports)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Timeout (ms)</Form.Label>
              <Form.Control
                type="number"
                name="timeout"
                value={formData.timeout}
                onChange={handleInputChange}
                min="1000"
                max="30000"
              />
              <Form.Text>
                Connection timeout in milliseconds (1000-30000)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Max Concurrent Scans</Form.Label>
              <Form.Control
                type="number"
                name="maxConcurrent"
                value={formData.maxConcurrent}
                onChange={handleInputChange}
                min="1"
                max="100"
              />
              <Form.Text>
                Maximum number of concurrent port scans (1-100)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                name="autoImport"
                checked={formData.autoImport}
                onChange={handleInputChange}
                label="Automatically import discovered assets"
              />
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100">
              <FaSearch className="me-2" />
              Start Discovery
            </Button>
          </Form>
        )}

        <NetworkDetector 
          onNetworkSelect={handleNetworkSelect}
          onRangeSelect={handleRangeSelect}
        />

        {(isScanning || scanStatus) && (
          <Card className="mb-3">
            <Card.Header>
              <h6 className="mb-0">Discovery Progress</h6>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <ProgressBar 
                  now={scanProgress} 
                  label={`${scanProgress}%`}
                  variant={scanProgress === 100 ? 'success' : 'info'}
                  animated={isScanning && scanProgress < 100}
                />
              </div>
              
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted">{scanStatus}</span>
                {isScanning && (
                  <Button 
                    variant="outline-danger" 
                    size="sm"
                    onClick={cancelDiscovery}
                  >
                    <FaTimes className="me-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        )}

        {discoveredAssets.length > 0 && (
          <Card>
            <Card.Header>
              <h6 className="mb-0">
                Discovered Assets ({discoveredAssets.length})
              </h6>
            </Card.Header>
            <Card.Body>
              {(() => {
                try {
                  return (
                    <>
                      <ListGroup>
                        {discoveredAssets.slice((discPage - 1) * discPerPage, discPage * discPerPage).map((asset, index) => {
                          // Safely extract asset properties
                          const hostname = asset?.hostname || asset?.ip || 'Unknown';
                          const ip = asset?.ip || 'Unknown IP';
                          const osGuess = asset?.osGuess || asset?.os || 'Unknown OS';
                          const status = asset?.status || 'unknown';
                          const openPorts = asset?.openPorts || [];
                          
                          return (
                            <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                              <div>
                                <div className="fw-bold">
                                  <FaServer className="me-2" />
                                  {hostname}
                                </div>
                                <div className="text-muted small">
                                  {ip} • {osGuess}
                                </div>
                              </div>
                              <div className="text-end">
                                <Badge bg={status === 'online' ? 'success' : 'secondary'}>
                                  {status}
                                </Badge>
                                <div className="small text-muted mt-1">
                                  {openPorts.length || 0} ports open
                                </div>
                              </div>
                            </ListGroup.Item>
                          );
                        })}
                      </ListGroup>

                      <BsPagination
                        currentPage={discPage}
                        totalItems={discoveredAssets.length}
                        itemsPerPage={discPerPage}
                        onPageChange={setDiscPage}
                        onPageSizeChange={(s) => { setDiscPerPage(s); setDiscPage(1); }}
                        label="hosts"
                      />

                      {scanResults && (
                        <div className="mt-3 p-3 bg-light rounded">
                          <h6>Scan Summary</h6>
                          <div className="row">
                            <div className="col-6">
                              <strong>Total Scanned:</strong> {scanResults.summary?.totalScanned || 0}
                            </div>
                            <div className="col-6">
                              <strong>Assets Found:</strong> {scanResults.summary?.assetsFound || 0}
                            </div>
                            <div className="col-6">
                              <strong>Duration:</strong> {Math.round((scanResults.summary?.scanDuration || 0) / 1000)}s
                            </div>
                            <div className="col-6">
                              <strong>Success Rate:</strong> {scanResults.success ? '100%' : 'Failed'}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                } catch (error) {
                  console.error('Error rendering discovered assets:', error);
                  return (
                    <Alert variant="warning">
                      Error displaying discovered assets. Please check the console for details.
                    </Alert>
                  );
                }
              })()}
            </Card.Body>
          </Card>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        {scanResults && (
          <Button variant="primary" onClick={resetForm}>
            <FaSearch className="me-2" />
            New Scan
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default AssetDiscovery;
