import axios from 'axios';
import config from '../config';

// Derive the API base from config (env-driven) so the same build works in dev
// and production instead of a hardcoded localhost. config.API_BASE_URL is the
// server origin; the REST API lives under /api.
const API = axios.create({
  baseURL: `${config.API_BASE_URL.replace(/\/$/, '')}/api`,
});

// Optional: attach token if available
API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
