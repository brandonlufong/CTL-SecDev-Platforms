import React, { useContext, useState, useEffect } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';

const Profile = () => {
  const { user, token, setUser } = useContext(AuthContext);
  const [form, setForm] = useState({ name: '' });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({ name: user.name });
    }
  }, [user]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      let data;
      if (res.headers.get('content-type')?.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('Unexpected HTML response:', text); // shows <html>
        throw new Error('Invalid server response (HTML instead of JSON)');
      }
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      setUser(data); // update context with new user
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user) return null;

  return (
    <Container className="py-4">
      <h3 className="mb-4">Profile</h3>
      <Card>
        <Card.Body>
          {success && <Alert variant="success">{success}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control value={user.email} disabled />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Control value={user.role} disabled />
            </Form.Group>

            <Button type="submit" variant="primary">
              Update Profile
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Profile;