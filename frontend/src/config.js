import axios from 'axios';

// Frontend API Configuration
const config = {
  // Backend API URL
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',

  // API Endpoints
  endpoints: {
    auth:        '/api/auth',
    users:       '/api/users',
    restaurants: '/api/restaurants',
    menu:        '/api/menu',
    orders:      '/api/orders',
    reviews:     '/api/reviews',
    favorites:   '/api/favorites'
  },

  // Helper function to get full URL
  getApiUrl: (endpoint) => {
    return `${config.API_URL}${endpoint}`;
  }
};

// ── Global axios defaults ────────────────────────────────────────────────────
// Set timeout so requests never hang forever
axios.defaults.timeout = 30000; // 30 seconds

// Auto-attach auth token to every request
axios.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token && !cfg.headers['Authorization']) {
    cfg.headers['Authorization'] = `Bearer ${token}`;
  }
  return cfg;
});

// Global error handler — auto-logout on 401/403, log timeouts
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timed out');
    }
    const status = error.response?.status;
    // 401 = token expired/invalid, 403 = account deactivated
    // Auto-clear token and redirect to login so user doesn't stay stuck
    if (status === 401 || status === 403) {
      const isAuthRoute = error.config?.url?.includes('/api/auth/login') ||
                          error.config?.url?.includes('/api/auth/forgot') ||
                          error.config?.url?.includes('/api/auth/reset');
      if (!isAuthRoute) {
        localStorage.removeItem('token');
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login') &&
            !window.location.pathname.includes('/register') &&
            !window.location.pathname.includes('/forgot-password')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default config;
