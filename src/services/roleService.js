import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://restaurant-management-system-backend-8cs5.onrender.com/api';

const roleAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach Bearer token
roleAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getRolesWithPermissions = async () => {
  const response = await roleAxios.get('/roles');
  return response.data;
};

export const updateRolePermissions = async (roleId, permissionsArray) => {
  const response = await roleAxios.put(`/roles/${roleId}/permissions`, {
    permissions: permissionsArray,
  });
  return response.data;
};

export const createRole = async (data) => {
  const response = await roleAxios.post('/roles', data);
  return response.data;
};

export const updateRole = async (roleId, data) => {
  const response = await roleAxios.put(`/roles/${roleId}`, data);
  return response.data;
};

export const deleteRole = async (roleId) => {
  const response = await roleAxios.delete(`/roles/${roleId}`);
  return response.data;
};
