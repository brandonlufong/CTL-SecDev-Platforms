import React, { useEffect, useState } from 'react';
import { Modal, Form, Alert, Button } from 'react-bootstrap';
import { FaBug, FaShieldAlt } from 'react-icons/fa';
import { useScan } from '../context/ScanContext';
import { getScanEngines } from '../api/platformApi';

const scanTypes = [
  { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
  { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
  { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
  { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
  { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
];

const ENGINE_LABELS = {
  nmap: 'nmap (built-in)',
  nessus: 'Nessus',
  openvas: 'OpenVAS / Greenbone',
};

const GlobalScanOptionsModal = () => {
  const {
    showScanOptionsModal,
    closeScanOptionsModal,
    selectedTargetForScan,
    selectedScanType,
    setSelectedScanType,
    selectedEngine,
    setSelectedEngine,
    executeScanFromModal
  } = useScan();

  const [engines, setEngines] = useState({ nmap: { available: true } });

  useEffect(() => {
    if (showScanOptionsModal) {
      getScanEngines().then(d => setEngines(d.engines || {})).catch(() => {});
    }
  }, [showScanOptionsModal]);

  const engineUnavailable = selectedEngine !== 'nmap' && !engines[selectedEngine]?.available;

  return (
    <Modal show={showScanOptionsModal} onHide={closeScanOptionsModal}>
      <Modal.Header closeButton style={{ background: 'linear-gradient(135deg,#1594EA,#0D6EBD)', color: 'white' }}>
        <Modal.Title>
          <FaBug className="me-2" />
          Scan Options for {selectedTargetForScan?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Scan engine</Form.Label>
          <Form.Select value={selectedEngine} onChange={(e) => setSelectedEngine(e.target.value)}>
            {['nmap', 'nessus', 'openvas'].map(eng => (
              <option key={eng} value={eng} disabled={eng !== 'nmap' && !engines[eng]?.available}>
                {ENGINE_LABELS[eng]}{eng !== 'nmap' && !engines[eng]?.available ? ' — not configured' : ''}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            Optional engines run only when configured; if one is unreachable the scan falls back to nmap.
          </Form.Text>
        </Form.Group>

        {selectedEngine === 'nmap' && (
          <Form.Group className="mb-3">
            <Form.Label>Scan type</Form.Label>
            <Form.Select value={selectedScanType} onChange={(e) => setSelectedScanType(e.target.value)}>
              {scanTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Form.Select>
            <Form.Text className="text-muted">
              {scanTypes.find(t => t.value === selectedScanType)?.description}
            </Form.Text>
          </Form.Group>
        )}

        {engineUnavailable && (
          <Alert variant="warning">
            <strong>{ENGINE_LABELS[selectedEngine]}</strong> is not configured on the server — the scan will
            run with <strong>nmap</strong> instead. Configure it in the backend env to enable it.
          </Alert>
        )}

        <Alert variant="info" className="mb-0">
          <FaShieldAlt className="me-2" />
          <strong>Note:</strong> vulnerability/authenticated scans may be detected by security systems.
          Use stealth scans in sensitive environments.
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={closeScanOptionsModal}>Cancel</Button>
        <Button variant="primary" onClick={executeScanFromModal}>
          <FaBug className="me-2" /> Start scan
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlobalScanOptionsModal;
