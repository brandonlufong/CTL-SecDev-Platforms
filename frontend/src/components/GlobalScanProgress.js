import React from 'react';
import { Card, ProgressBar, Badge, Button } from 'react-bootstrap';
import { FaTimes, FaSyncAlt } from 'react-icons/fa';
import { useSocket } from '../context/SocketContext';

const GlobalScanProgress = () => {
  const { scanProgress, resetScanProgress, isConnected } = useSocket();

  // Don't show if not active and no message
  if (!scanProgress.active && !scanProgress.message) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '400px',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      <Card>
        <Card.Header 
          className="d-flex justify-content-between align-items-center"
          style={{ backgroundColor: '#1594EA', color: 'white' }}
        >
          <div className="d-flex align-items-center gap-2">
            <FaSyncAlt className={scanProgress.active ? 'spin' : ''} />
            <strong>Scan Progress</strong>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg={isConnected ? 'success' : 'danger'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {!scanProgress.active && (
              <Button
                size="sm"
                variant="link"
                className="text-white p-0"
                onClick={resetScanProgress}
              >
                <FaTimes />
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted">
              {scanProgress.active ? 'In Progress' : (scanProgress.percent === 0 ? 'Idle' : 'Completed')}
            </small>
            <Badge bg="info">{scanProgress.percent}%</Badge>
          </div>
          
          <ProgressBar 
            now={scanProgress.percent} 
            animated={scanProgress.active}
            variant={
              scanProgress.percent === 100 ? 'success' :
              scanProgress.active ? 'info' : 'secondary'
            }
            style={{ height: '8px' }}
          />
          
          <small className="text-muted mt-2 d-block">
            {scanProgress.message}
          </small>

          {scanProgress.details && (
            <div className="mt-2 p-2 bg-light rounded">
              <small>
                {scanProgress.details.currentAsset && (
                  <div><strong>Current:</strong> {scanProgress.details.currentAsset}</div>
                )}
                {scanProgress.details.completedAssets !== undefined && scanProgress.details.totalAssets && (
                  <div>
                    <strong>Progress:</strong> {scanProgress.details.completedAssets}/{scanProgress.details.totalAssets} targets
                  </div>
                )}
              </small>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

// Add this CSS for the spinning animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);

export default GlobalScanProgress;