import axios from 'axios';

/**
 * API Service with central interceptors.
 * Base URL defaults to the Backend API.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://restaurant-management-system-backend-8cs5.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, config } = error.response;

      // Handle 401 Unauthorized
      if (status === 401) {
        // Prevent redirect loop if already on login page
        if (!config.url.includes('/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          localStorage.removeItem('permissions');
          window.location.href = '/login';
        }
      }

      // Handle 403 Forbidden
      if (status === 403) {
        console.error('Access denied:', error.response.data?.message || 'Forbidden');
      }
      
      // Note: 404s are intentionally left to be handled by individual components
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== AUTH ENDPOINTS ====================
export const authAPI = {
  login: (credentials) => api.post('/login', credentials),
  register: (data) => api.post('/register', data),
  profile: () => api.get('/profile'),
  logout: () => api.post('/logout'),
  updateProfileImage: (formData) => api.put('/profile/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateProfile: (data) => api.put('/profile/update', data),
};

export const ordersAPI = {
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
};
