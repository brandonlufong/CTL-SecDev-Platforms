// Use environment variable for production, otherwise use localhost for development
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://localhost:5001`;

const config = {
  API_BASE_URL,
  SOCKET_URL: API_BASE_URL
};

export default config;