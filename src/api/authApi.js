import api from './axiosInstance';

const authApi = {
  login: (credentials) => api.post('/login', credentials),
  logout: () => api.post('/logout'),
  register: (data) => api.post('/register', data),
  profile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile/update', data),
  updateProfileImage: (formData) => api.put('/profile/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default authApi;
