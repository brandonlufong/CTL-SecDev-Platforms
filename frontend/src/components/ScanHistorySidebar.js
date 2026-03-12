import React from 'react';
import { Offcanvas, ListGroup, Badge } from 'react-bootstrap';
import { FaHistory, FaClock, FaBug, FaServer } from 'react-icons/fa';
import { useScan } from '../context/ScanContext';

const ScanHistorySidebar = ({ show, onHide }) => {
  const { scanHistory } = useScan();

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const getScanTypeBadge = (scanType) => {
    const colors = {
      quick: 'primary',
      comprehensive: 'info',
      stealth: 'secondary',
      vulnerability: 'warning',
      batch: 'success'
    };
    return <Badge bg={colors[scanType] || 'secondary'}>{scanType}</Badge>;
  };

  return (
    <Offcanvas show={show} onHide={onHide} placement="end">
      <Offcanvas.Header closeButton style={{ backgroundColor: '#1594EA', color: 'white' }}>
        <Offcanvas.Title>
          <FaHistory className="me-2" />
          Scan History
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {scanHistory.length === 0 ? (
          <div className="text-center text-muted mt-4">
            <FaBug size={40} className="mb-3" />
            <p>No scan history yet</p>
          </div>
        ) : (
          <ListGroup variant="flush">
            {scanHistory.map((scan) => (
              <ListGroup.Item key={scan.id}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <strong className="d-flex align-items-center gap-1">
                      <FaServer size={14} />
                      {scan.target.name}
                    </strong>
                    <small className="text-muted">
                      {scan.target.targetType === 'batch' ? 'Batch Scan' : scan.target.targetType}
                    </small>
                  </div>
                  {getScanTypeBadge(scan.scanType)}
                </div>
                <div className="d-flex justify-content-between text-muted small">
                  <span>
                    <FaBug className="me-1" />
                    {scan.vulnerabilityCount} vulnerabilities
                  </span>
                  <span>
                    <FaClock className="me-1" />
                    {formatTimestamp(scan.timestamp)}
                  </span>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default ScanHistorySidebar;