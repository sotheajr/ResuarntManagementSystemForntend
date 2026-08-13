import axios from 'axios';

/**
 * Resolves the API base URL dynamically.
 *
 * Priority:
 *  1. VITE_API_BASE_URL env var (for explicit configuration / production)
 *  2. Relative '/api' path — works in dev (Vite proxy) & same-origin production
 *  3. If VITE_API_BASE_URL is NOT set and we're NOT on localhost,
 *     fall back to http://<current-hostname>:8000/api so mobile devices
 *     on the LAN (e.g. http://192.168.1.10:5173) automatically route
 *     API calls to http://192.168.1.10:8000/api
 */
function resolveApiBaseUrl() {
  // Explicit env override (highest priority)
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // Use the same hostname the page was loaded from, but port 8000.
  // This works for:
  //   - Local desktop:  http://localhost:3000  -> http://localhost:8000/api
  //   - LAN / mobile:   http://172.20.10.2:3000 -> http://172.20.10.2:8000/api
  // This avoids relying on the Vite proxy (which targets localhost:8000)
  // and prevents CORS issues when accessing from a different hostname.
  const hostname = window.location.hostname;
  return `http://${hostname}:8000/api`;
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
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

// Response interceptor to handle 401 and 403 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      
      if (status === 401) {
        // Token expired or invalid - clear auth and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        localStorage.removeItem('permissions');
        window.location.href = '/login';
      }
      
      if (status === 403) {
        // Forbidden - user doesn't have permission
        console.error('Access denied:', error.response.data?.message || 'Forbidden');
      }
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

// ==================== USERS ENDPOINTS ====================
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.post(`/users/${id}`, { ...data, _method: 'PUT' }),
  delete: (id) => api.delete(`/users/${id}`),
  toggleStatus: (id, status) => api.put(`/users/${id}/status`, { status }),
  getDeleted: () => api.get('/users/deleted'),
  restore: (id) => api.post(`/users/${id}/restore`),
};

// ==================== ROLES ENDPOINTS ====================
export const rolesAPI = {
  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  updatePermissions: (id, permissions) => api.put(`/roles/${id}/permissions`, { permissions }),
};

/**
 * Helper to append _method to FormData for Laravel "fake PUT" requests.
 * When data is a FormData, appending _method directly is required;
 * spreading FormData ({ ...data }) results in an empty object.
 */
const withMethod = (data, method) => {
  if (data instanceof FormData) {
    data.append('_method', method);
    return data;
  }
  return { ...data, _method: method };
};

// ==================== CATEGORIES ENDPOINTS ====================
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.post(`/categories/${id}`, withMethod(data, 'PUT')),
  delete: (id) => api.delete(`/categories/${id}`),
  getSubCategories: (id) => api.get(`/categories/${id}/sub-categories`),
};

// ==================== SUB-CATEGORIES ENDPOINTS ====================
export const subCategoriesAPI = {
  getAll: () => api.get('/sub-categories'),
  getById: (id) => api.get(`/sub-categories/${id}`),
  create: (data) => api.post('/sub-categories', data),
  update: (id, data) => api.put(`/sub-categories/${id}`, data),
  delete: (id) => api.delete(`/sub-categories/${id}`),
};

// ==================== MENU ENDPOINTS ====================
export const menuAPI = {
  getAll: () => api.get('/menu'),
  getAvailable: () => api.get('/menu/available'),
  getById: (id) => api.get(`/menu/${id}`),
  create: (data) => api.post('/menu', data),
  update: (id, data) => api.post(`/menu/${id}`, withMethod(data, 'PUT')),
  delete: (id) => api.delete(`/menu/${id}`),
};

// ==================== TABLES ENDPOINTS ====================
export const tablesAPI = {
  getAll: () => api.get('/tables'),
  getAvailable: () => api.get('/tables/available'),
  getById: (id) => api.get(`/tables/${id}`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`),
};

// ==================== CUSTOMERS ENDPOINTS ====================
export const customersAPI = {
  getAll: () => api.get('/customers'),
  getAvailable: () => api.get('/customers/available'),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// ==================== ORDERS ENDPOINTS ====================
export const ordersAPI = {
  getAll: () => api.get('/orders'),
  getPending: () => api.get('/orders/pending'),
  getMyOrders: () => api.get('/orders/my-orders'),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  complete: (id) => api.put(`/orders/${id}/complete`),
  delete: (id) => api.delete(`/orders/${id}`),
};

// ==================== PAYMENTS ENDPOINTS ====================
export const paymentsAPI = {
  getAll: () => api.get('/payments'),
  getToday: () => api.get('/payments/today'),
  getById: (id) => api.get(`/payments/${id}`),
  process: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  getReceipt: (id) => api.get(`/payments/${id}/receipt`),
};

// ==================== RESERVATIONS ENDPOINTS ====================
export const reservationsAPI = {
  getAll: () => api.get('/reservations'),
  getToday: () => api.get('/reservations/today'),
  getById: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  delete: (id) => api.delete(`/reservations/${id}`),
  confirm: (id) => api.put(`/reservations/${id}/confirm`),
  seat: (id) => api.put(`/reservations/${id}/seat`),
};

// ==================== REPORTS ENDPOINTS ====================
export const reportsAPI = {
  getAll: () => api.get('/reports'),
  getById: (id) => api.get(`/reports/${id}`),
  generate: (data) => api.post('/reports', data),
  update: (id, data) => api.put(`/reports/${id}`, data),
// ==================== ORDERS ENDPOINTS ====================


  delete: (id) => api.delete(`/reports/${id}`),
  salesSummary: (params) => api.get('/reports/sales/summary', { params }),
  paymentMethods: (params) => api.get('/reports/sales/payment-methods', { params }),
  topItems: (params) => api.get('/reports/sales/top-items', { params }),
};

// ==================== INVENTORY ENDPOINTS ====================
export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getLowStock: () => api.get('/inventory/low-stock'),
  getById: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
  update: (id, data) => {
    // If data is FormData, append _method for Laravel "fake PUT"
    if (data instanceof FormData) {
      data.append('_method', 'PUT');
      return api.post(`/inventory/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/inventory/${id}`, data);
  },
  updateStock: (id, quantity) => api.put(`/inventory/${id}/stock`, { quantity }),
  delete: (id) => api.delete(`/inventory/${id}`),
};

// ==================== SUPPLIERS ENDPOINTS ====================
export const suppliersAPI = {
  getAll: () => api.get('/suppliers'),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// ==================== PARTNERS ENDPOINTS ====================
export const partnersAPI = {
  getAll: () => api.get('/partners'),
  getById: (id) => api.get(`/partners/${id}`),
  create: (data) => {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    return api.post('/partners', data, config);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      data.append('_method', 'PUT');
      return api.post(`/partners/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/partners/${id}`, data);
  },
  delete: (id) => api.delete(`/partners/${id}`),
};

// ==================== ABA PAYWAY / KHQR ENDPOINTS ====================
export const abaPaymentAPI = {
  createPayment: (data) => api.post('/create-payment', data),
  generate: (data) => api.post('/payments/aba-generate', data),
  checkStatus: (data) => api.post('/payments/aba-check-status', data),
  checkStatusById: (transactionId) => api.get('/check-status', { params: { id: transactionId } }),
  checkByReference: (reference) => api.get(`/payments/aba-check-reference/${reference}`),
  getTransactions: (params) => api.get('/payments/aba-transactions', { params }),
};

// ==================== STRIPE PAYMENT ENDPOINTS ====================
export const stripePaymentAPI = {
  createCheckoutSession: (data) => api.post('/payments/stripe-checkout', data),
};

// ==================== PAYROLL ENDPOINTS ====================
export const payrollAPI = {
  getAll: () => api.get('/payroll'),
  getMyPayslip: () => api.get('/payroll/my-payslip'),
  getById: (id) => api.get(`/payroll/${id}`),
  generate: (monthYear) => api.post('/payroll/generate', { month_year: monthYear }),
  preview: (data) => api.post('/payroll/preview', data),
  confirmSave: (records) => api.post('/payroll/confirm-save', { records }),
  update: (id, data) => api.put(`/payroll/${id}`, data),
  markPaid: (id) => api.post(`/payroll/${id}/pay`),
  delete: (id) => api.delete(`/payroll/${id}`),
};

// ==================== ATTENDANCE / TIMESHEET ENDPOINTS ====================
export const attendanceAPI = {
  getAll: (params) => api.get('/attendances', { params }),
  getById: (id) => api.get(`/attendances/${id}`),
  create: (data) => api.post('/attendances', data),
  manual: (data) => api.post('/attendances/manual', data),
  update: (id, data) => api.put(`/attendances/${id}`, data),
  delete: (id) => api.delete(`/attendances/${id}`),
  summary: (userId, monthYear) => api.get(`/attendances/summary/${userId}`, { params: { month_year: monthYear } }),
  // Real-time Clock-In / Clock-Out workflow
  todayStatus: () => api.get('/attendances/today-status'),
  clockIn: () => api.post('/attendances/clock-in'),
  clockOut: () => api.post('/attendances/clock-out'),
};

// ==================== PURCHASES ENDPOINTS ====================
export const purchasesAPI = {
  getAll: () => api.get('/purchases'),
  getById: (id) => api.get(`/purchases/${id}`),
  create: (data) => {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    return api.post('/purchases', data, config);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      data.append('_method', 'PUT');
      return api.post(`/purchases/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/purchases/${id}`, data);
  },
  delete: (id) => api.delete(`/purchases/${id}`),
};

// ==================== RECYCLE BIN ENDPOINTS ====================
export const recycleBinAPI = {
  getAll: (params) => api.get('/recycle-bin', { params }),
  getById: (id) => api.get(`/recycle-bin/${id}`),
  restore: (id) => api.post(`/recycle-bin/${id}/restore`),
  permanentDelete: (id) => api.delete(`/recycle-bin/${id}`),
  stats: () => api.get('/recycle-bin/stats'),
};
