import api from './axiosInstance';

const orderApi = {
  getAll: () => api.get('/orders'),
  getPending: () => api.get('/orders/pending'),
  getMyOrders: () => api.get('/orders/my-orders'),
  getById: (id) => api.get(`/orders/${id}`),
  create: (payload) => api.post('/orders', payload),
  update: (id, payload) => api.put(`/orders/${id}`, payload),
  complete: (id) => api.put(`/orders/${id}/complete`),
  remove: (id) => api.delete(`/orders/${id}`),
};

export default orderApi;
