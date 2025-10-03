import React from 'react';
import { Modal, Form, Alert, Button } from 'react-bootstrap';
import { FaBug, FaShieldAlt } from 'react-icons/fa';
import { useScan } from '../context/ScanContext';

const scanTypes = [
  { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
  { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
  { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
  { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
  { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
];

const GlobalScanOptionsModal = () => {
  const { 
    showScanOptionsModal, 
    closeScanOptionsModal,
    selectedTargetForScan,
    selectedScanType,
    setSelectedScanType,
    executeScanFromModal
  } = useScan();

  return (
    <Modal show={showScanOptionsModal} onHide={closeScanOptionsModal}>
      <Modal.Header closeButton style={{ backgroundColor: '#1594EA', color: 'white' }}>
        <Modal.Title>
          <FaBug className="me-2" />
          Scan Options for {selectedTargetForScan?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Select Scan Type</Form.Label>
          <Form.Select
            value={selectedScanType}
            onChange={(e) => setSelectedScanType(e.target.value)}
          >
            {scanTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            {scanTypes.find(t => t.value === selectedScanType)?.description}
          </Form.Text>
        </Form.Group>

        <Alert variant="info">
          <FaShieldAlt className="me-2" />
          <strong>Security Note:</strong> Vulnerability scans may be detected by security systems. 
          Use stealth scans in sensitive environments.
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={closeScanOptionsModal}>
          Cancel
        </Button>
        <Button variant="primary" onClick={executeScanFromModal}>
          <FaBug className="me-2" />
          Start {scanTypes.find(t => t.value === selectedScanType)?.label}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlobalScanOptionsModal;