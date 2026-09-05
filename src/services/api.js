import axios from 'axios';

/**
 * API Service with central interceptors.
 * Base URL defaults to the Backend API.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

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
    }
    return Promise.reject(error);
  }
);

export default api;

// ==================== API HELPERS ====================

const isFormData = (data) => data instanceof FormData;

const createApiHelper = (endpoint) => ({
  getAll: (params = {}) => api.get(`/${endpoint}`, { params }),
  getById: (id) => api.get(`/${endpoint}/${id}`),
  create: (data) => api.post(`/${endpoint}`, data, isFormData(data) ? {
    headers: { 'Content-Type': 'multipart/form-data' },
  } : {}),
  // For FormData (file uploads), use POST with _method=PUT spoofing
  // For JSON data, use PUT directly
  update: (id, data) => {
    if (isFormData(data)) {
      return api.post(`/${endpoint}/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/${endpoint}/${id}`, data);
  },
  delete: (id) => api.delete(`/${endpoint}/${id}`),
  getSubCategories: (categoryId) => api.get(`/${endpoint}/${categoryId}/sub-categories`),
});

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

export const ordersAPI = createApiHelper('orders');
export const paymentsAPI = createApiHelper('payments');
export const customersAPI = createApiHelper('customers');
export const tablesAPI = createApiHelper('tables');
export const menuAPI = createApiHelper('menu');
export const usersAPI = createApiHelper('users');
export const attendanceAPI = {
  ...createApiHelper('attendance'),
  // Self-service endpoints (all authenticated users)
  todayStatus: () => api.get('/attendance/today-status'),
  clockIn: () => api.post('/attendance/clock-in', {}),
  clockOut: () => api.post('/attendance/clock-out', {}),
  // TESTING UTILITY: reset today's attendance for the current user
  resetToday: () => api.post('/attendance/reset-today', {}),
};
export const categoriesAPI = createApiHelper('categories');
export const subCategoriesAPI = createApiHelper('sub-categories');
export const inventoryAPI = {
  ...createApiHelper('inventory'),
  // GET /api/inventory/low-stock — items where quantity <= minimum_stock
  getLowStock: () => api.get('/inventory/low-stock'),
  // PUT /api/inventory/{id}/stock — adjust stock by a positive/negative quantity
  updateStock: (id, quantity) => api.put(`/inventory/${id}/stock`, { quantity }),
};
export const partnersAPI = createApiHelper('partners');
export const stripePaymentAPI = {
    createPaymentIntent: (data) => api.post('/stripe/payment-intent', data),
    confirmPayment: (data) => api.post('/stripe/confirm', data),
};
export const payrollAPI = {
  ...createApiHelper('payroll'),
  // Calculate a draft (nothing saved) for the generate-preview modal
  preview: (payload) => api.post('/payroll/preview', payload),
  // Persist a confirmed draft's records
  confirmSave: (records) => api.post('/payroll/confirm-save', { records }),
  // Mark a payroll as Paid (payment date defaults to today)
  markPaid: (id) => api.put(`/payroll/${id}/pay`, {}),
};
export const purchasesAPI = createApiHelper('purchases');
export const suppliersAPI = createApiHelper('suppliers');
export const recycleBinAPI = createApiHelper('recycle-bin');
export const reportsAPI = createApiHelper('reports');
export const reservationsAPI = createApiHelper('reservations');
export const rolesAPI = {
  ...createApiHelper('roles'),
  updatePermissions: (roleId, permissions) => api.put(`/roles/${roleId}/permissions`, { permissions }),
};

