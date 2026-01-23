// Development configuration for localhost
export const DEV_CONFIG = {
  API_BASE_URL: 'http://localhost:5004',
  SERVER_BASE_URL: 'http://localhost:5004',
  FRONTEND_PORT: 1222
};

// Override API URL for development
if (process.env.NODE_ENV === 'development') {
  window.REACT_APP_API_URL = 'http://localhost:5004';
  window.REACT_APP_API_BASE_URL = 'http://localhost:5004';
  window.PORT = 1222;
}
