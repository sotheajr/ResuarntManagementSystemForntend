import api from './axiosInstance';

const menuApi = {
  getAll: () => api.get('/menu'),
  getAvailable: () => api.get('/menu/available'),
  getById: (id) => api.get(`/menu/${id}`),
  create: (data) => api.post('/menu', data),
  update: (id, data) => api.put(`/menu/${id}`, data),
  remove: (id) => api.delete(`/menu/${id}`),
};

export default menuApi;
