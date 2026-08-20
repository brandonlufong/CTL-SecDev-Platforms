import React, { useContext } from 'react';
import { Container, Form, Button, Card } from 'react-bootstrap';
import { FaCog } from 'react-icons/fa';
import { useT } from '../context/LanguageContext';
import { ThemeContext } from '../context/ThemeContext';
import '../styles/theme.css';

const Settings = () => {
  const t = useT();
  const handlePasswordChange = e => {
    e.preventDefault();
    alert('Password change submitted (not functional yet)');
  };

  const { darkMode, toggleTheme } = useContext(ThemeContext);

  return (
    <Container className="py-4">
      <h3 className="mb-4 vm-page-title"><FaCog /> {t('Settings')}</h3>

      <Card className="mb-4">
        <Card.Body>
          <h5>Change Password</h5>
          <Form onSubmit={handlePasswordChange}>
            <Form.Group className="mb-3">
              <Form.Label>Current Password</Form.Label>
              <Form.Control type="password" required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control type="password" required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Confirm New Password</Form.Label>
              <Form.Control type="password" required />
            </Form.Group>

            <Button variant="primary" type="submit">Change Password</Button>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <h5>Preferences</h5>
          <Form>
            <Form.Check type="switch" id="darkModeToggle" label="Enable Dark Mode" checked={darkMode} onChange={toggleTheme}/>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Settings;
