import React, { useState } from 'react';
import { Modal, Table, Alert, Badge, Button, Card, Dropdown } from 'react-bootstrap';
import { FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaDownload, FaFileExport } from 'react-icons/fa';
import { useScan } from '../context/ScanContext';
import { useNavigate } from 'react-router-dom';

const GlobalScanResultModal = () => {
  const { 
    showScanResultModal, 
    closeScanResultModal, 
    latestScanResults 
  } = useScan();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  if (!latestScanResults) return null;

  const { results, target, scanType, timestamp, summary } = latestScanResults;

  const handleViewAllVulnerabilities = () => {
    closeScanResultModal();
    navigate('/vulnerabilities');
  };

  // Generate filename with timestamp
  const generateFilename = (extension) => {
    const date = new Date(timestamp || Date.now());
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const targetName = target.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `scan_${targetName}_${dateStr}_${timeStr}.${extension}`;
  };

  // Download as JSON
  const downloadJSON = () => {
    setDownloading(true);
    try {
      const scanData = {
        metadata: {
          target: {
            id: target._id,
            name: target.name,
            type: target.targetType
          },
          scanType: scanType,
          timestamp: timestamp,
          generatedAt: new Date().toISOString()
        },
        summary: summary || {},
        results: results,
        statistics: {
          totalPorts: results.length,
          openPorts: results.filter(r => r.state === 'open').length,
          totalVulnerabilities: results.reduce((acc, r) => 
            acc + (r.vulnerabilities?.length || 0), 0
          ),
          servicesDetected: results.filter(r => r.service).length
        }
      };

      const blob = new Blob([JSON.stringify(scanData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFilename('json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading JSON:', error);
      alert('Failed to download JSON file');
    } finally {
      setDownloading(false);
    }
  };

  // Download as CSV
  const downloadCSV = () => {
    setDownloading(true);
    try {
      // CSV Headers
      const headers = [
        'Port',
        'Protocol',
        'State',
        'Service',
        'Product',
        'Version',
        'Vulnerabilities Count',
        'Risk Score',
        'Confidence',
        'Vulnerability Details'
      ];

      // CSV Rows
      const rows = results.map(result => [
        result.port,
        result.protocol || '',
        result.state || '',
        result.service || '',
        result.product || '',
        result.version || '',
        result.vulnerabilities?.length || 0,
        result.vulnerabilityScore?.toFixed(1) || '0.0',
        result.confidence || 0,
        result.vulnerabilities?.map(v => 
          typeof v === 'string' ? v : (v?.title || v?.cve || v?.name || 'Unknown')
        ).join('; ') || ''
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFilename('csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Failed to download CSV file');
    } finally {
      setDownloading(false);
    }
  };

  // Download as HTML Report
  const downloadHTML = () => {
    setDownloading(true);
    try {
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scan Report - ${target.name}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1594EA;
            border-bottom: 3px solid #1594EA;
            padding-bottom: 10px;
        }
        .metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .summary-card {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
        }
        .summary-card strong {
            display: block;
            font-size: 24px;
            color: #1594EA;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border: 1px solid #ddd;
        }
        th {
            background-color: #1594EA;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-success { background: #28a745; color: white; }
        .badge-warning { background: #ffc107; color: black; }
        .badge-danger { background: #dc3545; color: white; }
        .badge-info { background: #17a2b8; color: white; }
        .vuln-section {
            margin: 20px 0;
            padding: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ Security Scan Report</h1>
        
        <div class="metadata">
            <p><strong>Target:</strong> ${target.name}</p>
            <p><strong>Target Type:</strong> ${target.targetType}</p>
            <p><strong>Scan Type:</strong> ${scanType}</p>
            <p><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        ${summary ? `
        <h2>Summary</h2>
        <div class="summary">
            <div class="summary-card">
                <strong>${summary.totalPorts || 0}</strong>
                <span>Total Ports</span>
            </div>
            <div class="summary-card">
                <strong>${summary.openPorts || 0}</strong>
                <span>Open Ports</span>
            </div>
            <div class="summary-card">
                <strong>${summary.totalVulnerabilities || 0}</strong>
                <span>Vulnerabilities</span>
            </div>
            <div class="summary-card">
                <strong>${summary.riskLevel || 'Medium'}</strong>
                <span>Risk Level</span>
            </div>
        </div>
        ` : ''}

        <h2>Scan Results</h2>
        <table>
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
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td><code>${result.port}</code></td>
                        <td>${result.protocol || '-'}</td>
                        <td><span class="badge badge-${result.state === 'open' ? 'success' : 'info'}">${result.state || '-'}</span></td>
                        <td>${result.service || '-'}</td>
                        <td>${result.product || '-'}</td>
                        <td>${result.version || '-'}</td>
                        <td>
                            ${result.vulnerabilities?.length > 0 
                                ? `<span class="badge badge-warning">${result.vulnerabilities.length} found</span>`
                                : `<span class="badge badge-success">None</span>`
                            }
                        </td>
                        <td>
                            <span class="badge badge-${
                                result.vulnerabilityScore >= 8 ? 'danger' :
                                result.vulnerabilityScore >= 5 ? 'warning' : 'info'
                            }">
                                ${result.vulnerabilityScore?.toFixed(1) || '0.0'}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${results.some(r => r.vulnerabilities?.length > 0) ? `
        <h2>⚠️ Detected Vulnerabilities</h2>
        ${results
          .filter(r => r.vulnerabilities?.length > 0)
          .map(result => `
            <div class="vuln-section">
                <h3>Port ${result.port} - ${result.service}</h3>
                <ul>
                    ${result.vulnerabilities.map(vuln => `
                        <li>
                            <strong>${typeof vuln === 'string' ? vuln : (vuln?.title || vuln?.cve || 'Unknown')}</strong>
                            ${typeof vuln === 'object' && vuln?.severity ? 
                                `<span class="badge badge-${
                                    vuln.severity === 'Critical' ? 'danger' : 
                                    vuln.severity === 'High' ? 'warning' : 'info'
                                }">${vuln.severity}</span>` : ''
                            }
                            ${typeof vuln === 'object' && vuln?.cvssScore ? 
                                `<span style="color: #666;"> (Score: ${vuln.cvssScore})</span>` : ''
                            }
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('')}
        ` : ''}

        <div class="footer">
            <p>This report was generated automatically by the Security Scanning System</p>
            <p>Report generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFilename('html');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading HTML:', error);
      alert('Failed to download HTML report');
    } finally {
      setDownloading(false);
    }
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
        
        {/* Download Dropdown */}
        <Dropdown>
          <Dropdown.Toggle 
            variant="success" 
            disabled={downloading || results.length === 0}
          >
            <FaDownload className="me-2" />
            {downloading ? 'Downloading...' : 'Download Report'}
          </Dropdown.Toggle>

          <Dropdown.Menu>
            <Dropdown.Item onClick={downloadJSON}>
              <FaFileExport className="me-2" />
              Download as JSON
            </Dropdown.Item>
            <Dropdown.Item onClick={downloadCSV}>
              <FaFileExport className="me-2" />
              Download as CSV
            </Dropdown.Item>
            <Dropdown.Item onClick={downloadHTML}>
              <FaFileExport className="me-2" />
              Download as HTML Report
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Button variant="primary" onClick={handleViewAllVulnerabilities}>
          <FaShieldAlt className="me-2" />
          View All Vulnerabilities
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlobalScanResultModal;