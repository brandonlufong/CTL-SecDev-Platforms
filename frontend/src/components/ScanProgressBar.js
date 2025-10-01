// frontend/src/components/ScanProgressBar.js

import React from 'react';
import { ProgressBar, Alert, Spinner } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const ScanProgressBar = ({ scanProgress, show = true }) => {
  if (!show || !scanProgress) return null;

  const { active, percent, message, currentAsset, completedAssets, totalAssets } = scanProgress;

  // Don't show if not active and no message
  if (!active && !message) return null;

  // Determine variant based on status
  const getVariant = () => {
    if (!active && percent === 100) return 'success';
    if (!active && percent === 0) return 'danger';
    if (percent < 30) return 'info';
    if (percent < 70) return 'warning';
    return 'primary';
  };

  return (
    <Alert 
      variant={active ? 'info' : (percent === 100 ? 'success' : 'warning')}
      className="mb-3"
      style={{ 
        position: 'sticky', 
        top: '10px', 
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          {active && <Spinner animation="border" size="sm" />}
          {!active && percent === 100 && <FaCheckCircle className="text-success" />}
          {!active && percent === 0 && <FaExclamationTriangle className="text-danger" />}
          <strong>
            {active ? 'Scanning in Progress' : (percent === 100 ? 'Scan Complete' : 'Scan Status')}
          </strong>
        </div>
        <span className="text-muted">
          {percent}%
          {totalAssets > 1 && ` (${completedAssets || 0}/${totalAssets} assets)`}
        </span>
      </div>
      
      <ProgressBar 
        now={percent} 
        variant={getVariant()}
        animated={active}
        striped={active}
        className="mb-2"
        style={{ height: '20px' }}
      />
      
      <div className="small">
        {currentAsset && <div><strong>Current:</strong> {currentAsset}</div>}
        <div className="text-muted">{message}</div>
      </div>
    </Alert>
  );
};

export default ScanProgressBar;