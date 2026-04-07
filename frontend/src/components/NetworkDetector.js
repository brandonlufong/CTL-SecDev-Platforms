import React, { useState, useEffect, useContext } from 'react';
import { Card, Alert, Button, Badge, ListGroup, Spinner, Form } from 'react-bootstrap';
import { FaNetworkWired, FaWifi, FaLaptop, FaServer, FaCheckCircle, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import config from '../config';

const NetworkDetector = ({ onNetworkSelect, onRangeSelect }) => {
  const { token } = useContext(AuthContext);
  
  const [loading, setLoading] = useState(false);
  const [networkConfig, setNetworkConfig] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState('');

  // Detect current network configuration
  const detectNetwork = async () => {
    setLoading(true);
    setError('');
    setNetworkConfig(null);
    
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/discovery/detect`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to detect network configuration');
      }

      const data = await response.json();
      console.log('Network configuration detected:', data);
      
      setNetworkConfig(data.data);
      
      // Auto-select the primary network range
      if (data.data && data.data.recommendedRanges && data.data.recommendedRanges.length > 0) {
        const primaryRange = data.data.recommendedRanges.find(range => range.isPrimary) || data.data.recommendedRanges[0];
        setSelectedRange(primaryRange);
        onRangeSelect(primaryRange.cidr);
      }

    } catch (error) {
      console.error('Network detection error:', error);
      setError(error.message || 'Failed to detect network configuration');
    } finally {
      setLoading(false);
    }
  };

  // Validate a network range
  const validateRange = async (networkRange) => {
    setValidating(true);
    setValidation(null);
    
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/discovery/validate/${networkRange}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to validate network range');
      }

      const data = await response.json();
      setValidation(data.validation);

    } catch (error) {
      console.error('Validation error:', error);
      setValidation({
        reachable: false,
        networkRange,
        message: 'Validation failed'
      });
    } finally {
      setValidating(false);
    }
  };

  // Auto-detect on component mount
  useEffect(() => {
    detectNetwork();
  }, []);

  // Validate selected range when it changes
  useEffect(() => {
    if (selectedRange) {
      validateRange(selectedRange.cidr);
    }
  }, [selectedRange]);

  const handleRangeSelect = (range) => {
    setSelectedRange(range);
    onRangeSelect(range.cidr);
    onNetworkSelect(range);
  };

  const getScanStrategyBadge = (strategy) => {
    const variants = {
      full: 'success',
      sampled: 'warning', 
      targeted: 'info'
    };
    return variants[strategy] || 'secondary';
  };

  const getNetworkTypeIcon = (type) => {
    const icons = {
      home: <FaWifi />,
      office: <FaLaptop />,
      enterprise: <FaServer />
    };
    return icons[type] || <FaNetworkWired />;
  };

  if (loading) {
    return (
      <Card className="mb-3">
        <Card.Body className="text-center py-4">
          <Spinner animation="border" className="me-2" />
          <span>Detecting network configuration...</span>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <FaNetworkWired className="me-2" />
          Network Detection
        </h6>
        <Button variant="outline-primary" size="sm" onClick={detectNetwork}>
          Refresh
        </Button>
      </Card.Header>

      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            <FaExclamationTriangle className="me-2" />
            {error}
          </Alert>
        )}

        {networkConfig && (
          <>
            {/* Current Network Info */}
            <div className="mb-4">
              <h6 className="text-muted mb-3">Current Network Configuration</h6>
              <div className="row">
                <div className="col-md-6">
                  <small className="text-muted">Default Gateway:</small>
                  <div className="fw-bold">{networkConfig.defaultGateway || 'Unknown'}</div>
                </div>
                <div className="col-md-6">
                  <small className="text-muted">DNS Servers:</small>
                  <div className="fw-bold">
                    {networkConfig?.dnsServers?.length > 0 
                      ? networkConfig.dnsServers.join(', ')
                      : 'Unknown'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Network Interfaces */}
            {networkConfig?.interfaces && (
              <div className="mb-4">
                <h6 className="text-muted mb-3">Network Interfaces</h6>
                <ListGroup>
                  {networkConfig.interfaces.map((interfaceInfo, index) => (
                    <ListGroup.Item key={index} className="py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-bold">{interfaceInfo.name}</div>
                          <small className="text-muted">
                            {interfaceInfo.configs?.map(config => config.address).join(', ') || 'No configuration'}
                          </small>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            )}

            {/* Recommended Scan Ranges */}
            {networkConfig?.recommendedRanges && (
              <div className="mb-3">
                <h6 className="text-muted mb-3">Recommended Scan Ranges</h6>
                <ListGroup>
                  {networkConfig.recommendedRanges.map((range, index) => (
                    <ListGroup.Item 
                      key={index} 
                      action
                      active={selectedRange?.cidr === range.cidr}
                    onClick={() => handleRangeSelect(range)}
                    className="py-3"
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-2">
                          <div className="fw-bold me-2">{range.cidr}</div>
                          {range.isPrimary && (
                            <Badge bg="primary" className="me-2">Primary</Badge>
                          )}
                          <Badge bg={getScanStrategyBadge(range.scanStrategy)}>
                            {range.scanStrategy}
                          </Badge>
                        </div>
                        <div className="small text-muted mb-1">
                          Network: {range.network} • Broadcast: {range.broadcast}
                        </div>
                        <div className="small text-muted">
                          <FaClock className="me-1" />
                          Est. {range.scanTime} • ~{range.estimatedHosts} hosts
                        </div>
                      </div>
                      {validating && selectedRange?.cidr === range.cidr && (
                        <Spinner animation="border" size="sm" />
                      )}
                      {validation && validation.networkRange === range.cidr && (
                        <div className="ms-2">
                          {validation.reachable ? (
                            <FaCheckCircle className="text-success" title={validation.message} />
                          ) : (
                            <FaExclamationTriangle className="text-warning" title={validation.message} />
                          )}
                        </div>
                      )}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
            )}

            {/* Common Network Ranges */}
            {networkConfig?.commonRanges && (
              <div>
                <h6 className="text-muted mb-3">Common Network Ranges</h6>
                <ListGroup>
                  {networkConfig.commonRanges.map((range, index) => (
                  <ListGroup.Item 
                    key={index} 
                    action
                    className="py-2"
                    onClick={() => onRangeSelect(range.cidr)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="d-flex align-items-center">
                          {getNetworkTypeIcon(range.type)}
                          <span className="ms-2 fw-bold">{range.cidr}</span>
                          <Badge bg="outline-secondary" className="ms-2">
                            {range.type}
                          </Badge>
                        </div>
                        <div className="small text-muted mt-1">{range.description}</div>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
            )}
          </>
        )}

        {!networkConfig && !loading && !error && (
          <div className="text-center py-3">
            <p className="text-muted">No network configuration detected</p>
            <Button variant="primary" onClick={detectNetwork}>
              Detect Network
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default NetworkDetector;
