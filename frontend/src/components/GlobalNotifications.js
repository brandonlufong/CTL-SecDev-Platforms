import React from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { useScan } from '../context/ScanContext';

const GlobalNotifications = () => {
  const { notifications, removeNotification } = useScan();

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <FaCheckCircle className="text-success me-2" />;
      case 'error': return <FaTimes className="text-danger me-2" />;
      case 'warning': return <FaExclamationTriangle className="text-warning me-2" />;
      default: return <FaInfoCircle className="text-info me-2" />;
    }
  };

  const getBg = (type) => {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          onClose={() => removeNotification(notification.id)}
          bg={getBg(notification.type)}
          delay={5000}
          autohide
        >
          <Toast.Header>
            {getIcon(notification.type)}
            <strong className="me-auto">
              {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
            </strong>
            <small>{new Date(notification.timestamp).toLocaleTimeString()}</small>
          </Toast.Header>
          <Toast.Body className="text-white">
            {notification.message}
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
};

export default GlobalNotifications;