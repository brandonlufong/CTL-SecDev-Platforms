import axios from 'axios';
import config from '../config';

const API = axios.create({
  baseURL: `${config.API_BASE_URL}/api`,
});

API.interceptors.request.use(requestConfig => {
  const token = localStorage.getItem('token');
  if (token) requestConfig.headers.Authorization = `Bearer ${token}`;
  return requestConfig;
});

export default API;
