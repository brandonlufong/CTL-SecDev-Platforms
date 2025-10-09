import React from 'react';
import {
  Modal,
  Table,
  Badge,
  Card,
  Alert,
  Button,
  Tabs,
  Tab,
  Row,
  Col,
  ListGroup,
} from 'react-bootstrap';
import {
  FaShieldAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaBug,
  FaInfoCircle,
  FaExternalLinkAlt,
  FaDownload,
} from 'react-icons/fa';

/**
 * Enhanced Scan Results Modal Component
 * Displays comprehensive scan results with vulnerability details
 */
const ScanResultsModal = ({
  show,
  onHide,
  scanResults = [],
  assetName = '',
  scanSummary = {},
  onViewVulnerabilities,
  onExportResults,
}) => {
  // Get severity badge color
  const getSeverityBadge = (severity) => {
    const colors = {
      'Critical': 'danger',
      'High': 'warning',
      'Medium': 'info',
      'Low': 'success',
      'Informational': 'secondary'
    };
    return <Badge bg={colors[severity] || 'secondary'}>{severity}</Badge>;
  };

  // Get risk score badge
  const getRiskScoreBadge = (score) => {
    const color = score >= 8 ? 'danger' : score >= 5 ? 'warning' : score > 0 ? 'info' : 'success';
    return <Badge bg={color}>{score?.toFixed(1) || '0.0'}</Badge>;
  };

  // Get unique vulnerabilities from all scan results
  const getAllVulnerabilities = () => {
    const vulnerabilities = [];
    scanResults.forEach(result => {
      const details = Array.isArray(result.detectionDetails) ? result.detectionDetails : [];
      const flatVulns = Array.isArray(result.vulnerabilities) ? result.vulnerabilities : [];

      // Prefer rich detectionDetails if present, otherwise use basic vulnerabilities strings
      const source = details.length > 0 ? details : flatVulns;
      if (source && source.length > 0) {
        source.forEach(vuln => {
          // Check if vulnerability already exists
          const keyTitle = typeof vuln === 'object' ? (vuln.title || vuln.cve || String(vuln)) : String(vuln);
          const keyCve = typeof vuln === 'object' ? (vuln.cve || '') : '';
          if (!vulnerabilities.find(v => v.cve === keyCve && v.title === keyTitle)) {
            vulnerabilities.push({
              ...(typeof vuln === 'object' ? vuln : { title: keyTitle, cve: keyCve }),
              port: result.port,
              service: result.service,
              product: result.product,
              version: result.version
            });
          }
        });
      }
    });
    return vulnerabilities.sort((a, b) => (b.cvssScore || 0) - (a.cvssScore || 0));
  };

  // Get scan statistics
  const getStatistics = () => {
    const stats = {
      totalPorts: scanResults.length,
      openPorts: scanResults.filter(r => r.state === 'open').length,
      servicesDetected: new Set(scanResults.map(r => r.service)).size,
      totalVulnerabilities: getAllVulnerabilities().length,
      highestRiskScore: Math.max(...scanResults.map(r => r.vulnerabilityScore || 0)),
      averageConfidence: scanResults.reduce((acc, r) => acc + (r.confidence || 0), 0) / scanResults.length || 0,
    };

    // Count vulnerabilities by severity
    const vulnerabilities = getAllVulnerabilities();
    stats.severityBreakdown = {
      Critical: vulnerabilities.filter(v => v.severity === 'Critical').length,
      High: vulnerabilities.filter(v => v.severity === 'High').length,
      Medium: vulnerabilities.filter(v => v.severity === 'Medium').length,
      Low: vulnerabilities.filter(v => v.severity === 'Low').length,
      Informational: vulnerabilities.filter(v => v.severity === 'Informational').length,
    };

    return stats;
  };

  const statistics = getStatistics();
  const allVulnerabilities = getAllVulnerabilities();

  // Export scan results to CSV
  const handleExportCSV = () => {
    const csvData = scanResults.map(result => ({
      Port: result.port,
      Protocol: result.protocol,
      State: result.state,
      Service: result.service,
      Product: result.product || '',
      Version: result.version || '',
      'Risk Score': result.vulnerabilityScore || 0,
      'Vulnerability Count': result.vulnerabilities?.length || 0,
      Confidence: result.confidence || 0,
      'Scan Date': new Date(result.scannedAt).toLocaleString(),
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-results-${assetName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaShieldAlt className="me-2" />
          Scan Results for {assetName}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '80vh' }}>
        {scanResults.length === 0 ? (
          <Alert variant="info">
            <FaCheckCircle className="me-2" />
            No open ports or services detected on this asset.
          </Alert>
        ) : (
          <Tabs defaultActiveKey="overview" className="mb-3">
            {/* Overview Tab */}
            <Tab eventKey="overview" title="Overview">
              <Row className="mb-4">
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>
                      <h6 className="mb-0">Scan Statistics</h6>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col xs={6}>
                          <div className="text-center mb-3">
                            <h4 className="text-primary">{statistics.totalPorts}</h4>
                            <small className="text-muted">Total Ports</small>
                          </div>
                        </Col>
                        <Col xs={6}>
                          <div className="text-center mb-3">
                            <h4 className="text-success">{statistics.openPorts}</h4>
                            <small className="text-muted">Open Ports</small>
                          </div>
                        </Col>
                        <Col xs={6}>
                          <div className="text-center mb-3">
                            <h4 className="text-info">{statistics.servicesDetected}</h4>
                            <small className="text-muted">Services</small>
                          </div>
                        </Col>
                        <Col xs={6}>
                          <div className="text-center mb-3">
                            <h4 className="text-warning">{statistics.totalVulnerabilities}</h4>
                            <small className="text-muted">Vulnerabilities</small>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>
                      <h6 className="mb-0">Risk Assessment</h6>
                    </Card.Header>
                    <Card.Body>
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Highest Risk Score:</span>
                          {getRiskScoreBadge(statistics.highestRiskScore)}
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Average Confidence:</span>
                          <Badge bg="info">{statistics.averageConfidence.toFixed(1)}%</Badge>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Overall Risk:</span>
                          <Badge bg={statistics.highestRiskScore >= 8 ? 'danger' : statistics.highestRiskScore >= 5 ? 'warning' : 'success'}>
                            {statistics.highestRiskScore >= 8 ? 'High' : statistics.highestRiskScore >= 5 ? 'Medium' : 'Low'}
                          </Badge>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Vulnerability Severity Breakdown */}
              {statistics.totalVulnerabilities > 0 && (
                <Card className="mb-4">
                  <Card.Header>
                    <h6 className="mb-0">Vulnerability Breakdown by Severity</h6>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      {Object.entries(statistics.severityBreakdown).map(([severity, count]) => (
                        count > 0 && (
                          <Col key={severity} xs={6} md={2} className="text-center mb-2">
                            <div>
                              <h5 className="mb-1">{count}</h5>
                              {getSeverityBadge(severity)}
                            </div>
                          </Col>
                        )
                      ))}
                    </Row>
                  </Card.Body>
                </Card>
              )}
            </Tab>

            {/* Port Scan Results Tab */}
            <Tab eventKey="ports" title={`Ports (${scanResults.length})`}>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <Table responsive striped hover>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
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
                    {scanResults.map((result, idx) => (
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
                        <td>{getRiskScoreBadge(result.vulnerabilityScore)}</td>
                        <td>
                          <Badge bg="info">{result.confidence || 0}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Tab>

            {/* Vulnerabilities Tab */}
            <Tab eventKey="vulnerabilities" title={`Vulnerabilities (${allVulnerabilities.length})`}>
              {allVulnerabilities.length === 0 ? (
                <Alert variant="success">
                  <FaCheckCircle className="me-2" />
                  No vulnerabilities detected on this asset.
                </Alert>
              ) : (
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {allVulnerabilities.map((vuln, idx) => (
                    <Card key={idx} className="mb-3">
                      <Card.Header className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{vuln.title}</strong>
                          {vuln.cve && (
                            <Badge bg="secondary" className="ms-2">{vuln.cve}</Badge>
                          )}
                        </div>
                        <div>
                          {getSeverityBadge(vuln.severity)}
                          <Badge bg="info" className="ms-1">
                            Score: {vuln.cvssScore?.toFixed(1) || 'N/A'}
                          </Badge>
                        </div>
                      </Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={8}>
                            <p className="mb-2">{vuln.description}</p>
                            <div className="mb-2">
                              <strong>Affected Service:</strong> {vuln.service} on port {vuln.port}
                              {vuln.product && ` (${vuln.product}${vuln.version ? ` ${vuln.version}` : ''})`}
                            </div>
                            {vuln.remediation && (
                              <div className="mb-2">
                                <strong>Remediation:</strong> {vuln.remediation}
                              </div>
                            )}
                            {vuln.exploitAvailable && (
                              <Alert variant="danger" className="py-2">
                                <FaExclamationTriangle className="me-2" />
                                <strong>Exploit Available:</strong> Public exploits are available for this vulnerability.
                              </Alert>
                            )}
                          </Col>
                          <Col md={4}>
                            {vuln.references && vuln.references.length > 0 && (
                              <div>
                                <strong>References:</strong>
                                <ListGroup variant="flush">
                                  {vuln.references.slice(0, 3).map((ref, refIdx) => (
                                    <ListGroup.Item key={refIdx} className="px-0 py-1">
                                      <a href={ref} target="_blank" rel="noopener noreferrer" className="small">
                                        <FaExternalLinkAlt className="me-1" />
                                        {ref.length > 40 ? `${ref.substring(0, 40)}...` : ref}
                                      </a>
                                    </ListGroup.Item>
                                  ))}
                                </ListGroup>
                              </div>
                            )}
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </Tab>

            {/* Recommendations Tab */}
            <Tab eventKey="recommendations" title="Recommendations">
              <Card>
                <Card.Header>
                  <h6 className="mb-0">Security Recommendations</h6>
                </Card.Header>
                <Card.Body>
                  <ListGroup variant="flush">
                    {statistics.totalVulnerabilities > 0 && (
                      <ListGroup.Item>
                        <FaExclamationTriangle className="text-warning me-2" />
                        <strong>Critical Action Required:</strong> {statistics.totalVulnerabilities} vulnerabilities detected. 
                        Prioritize {statistics.severityBreakdown.Critical + statistics.severityBreakdown.High} critical/high severity issues.
                      </ListGroup.Item>
                    )}
                    
                    {statistics.openPorts > 10 && (
                      <ListGroup.Item>
                        <FaInfoCircle className="text-info me-2" />
                        <strong>Port Management:</strong> {statistics.openPorts} open ports detected. 
                        Review and close unnecessary services to reduce attack surface.
                      </ListGroup.Item>
                    )}

                    {statistics.averageConfidence < 70 && (
                      <ListGroup.Item>
                        <FaInfoCircle className="text-info me-2" />
                        <strong>Scan Enhancement:</strong> Average detection confidence is {statistics.averageConfidence.toFixed(1)}%. 
                        Consider running more comprehensive scans for better accuracy.
                      </ListGroup.Item>
                    )}

                    <ListGroup.Item>
                      <FaCheckCircle className="text-success me-2" />
                      <strong>Regular Scanning:</strong> Schedule regular vulnerability scans to maintain security posture.
                    </ListGroup.Item>

                    <ListGroup.Item>
                      <FaCheckCircle className="text-success me-2" />
                      <strong>Patch Management:</strong> Implement a systematic patch management process for identified vulnerabilities.
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100 align-items-center">
          <div>
            <small className="text-muted">
              Scanned on {scanResults[0] ? new Date(scanResults[0].scannedAt).toLocaleString() : 'N/A'}
            </small>
          </div>
          <div>
            <Button variant="outline-secondary" onClick={handleExportCSV} className="me-2">
              <FaDownload className="me-1" />
              Export CSV
            </Button>
            {onViewVulnerabilities && (
              <Button variant="primary" onClick={onViewVulnerabilities} className="me-2">
                <FaBug className="me-1" />
                View All Vulnerabilities
              </Button>
            )}
            <Button variant="secondary" onClick={onHide}>
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ScanResultsModal;