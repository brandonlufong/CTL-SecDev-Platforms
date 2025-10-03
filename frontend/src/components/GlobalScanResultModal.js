import React from 'react';
import { Modal, Table, Alert, Badge, Button, Card } from 'react-bootstrap';
import { FaShieldAlt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useScan } from '../context/ScanContext';
import { useNavigate } from 'react-router-dom';

const GlobalScanResultModal = () => {
  const { 
    showScanResultModal, 
    closeScanResultModal, 
    latestScanResults 
  } = useScan();
  const navigate = useNavigate();

  if (!latestScanResults) return null;

  const { results, target, scanType, summary } = latestScanResults;

  const handleViewAllVulnerabilities = () => {
    closeScanResultModal();
    navigate('/vulnerabilities');
  };

  return (
    <Modal 
      show={showScanResultModal} 
      onHide={closeScanResultModal} 
      size="xl"
      backdrop="static"
    >
      <Modal.Header closeButton style={{ backgroundColor: '#1594EA', color: 'white' }}>
        <Modal.Title>
          <FaShieldAlt className="me-2" />
          Scan Results for {target.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Summary Card */}
        {summary && (
          <Alert variant="info" className="mb-3">
            <div className="row">
              <div className="col-md-3">
                <strong>Total Ports:</strong> {summary.totalPorts}
              </div>
              <div className="col-md-3">
                <strong>Open Ports:</strong> {summary.openPorts}
              </div>
              <div className="col-md-3">
                <strong>Vulnerabilities:</strong> {summary.totalVulnerabilities}
              </div>
              <div className="col-md-3">
                <strong>Risk Level:</strong> <Badge bg="warning">{summary.riskLevel || 'Medium'}</Badge>
              </div>
            </div>
          </Alert>
        )}

        {results.length === 0 ? (
          <Alert variant="success">
            <FaCheckCircle className="me-2" />
            No open ports or services detected. This is a good sign!
          </Alert>
        ) : (
          <>
            <Alert variant="success" className="mb-3">
              <FaCheckCircle className="me-2" />
              Scan completed successfully! Found {results.length} open ports.
            </Alert>
            
            <Table responsive striped hover>
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
                {results.map((result, idx) => (
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
            {results.some(r => r.vulnerabilities && Array.isArray(r.vulnerabilities) && r.vulnerabilities.length > 0) && (
              <div className="mt-4">
                <h5>
                  <FaExclamationTriangle className="me-2 text-warning" />
                  Detected Vulnerabilities
                </h5>
                {results
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
        <Button variant="secondary" onClick={closeScanResultModal}>
          Close
        </Button>
        <Button variant="primary" onClick={handleViewAllVulnerabilities}>
          <FaShieldAlt className="me-2" />
          View All Vulnerabilities
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlobalScanResultModal;