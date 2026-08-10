import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AUTH_TOKEN_KEYS = ['token', 'access_token', 'auth_token'];

const getStoredToken = () => AUTH_TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

const normalizeAuthResponse = (response) => {
  const responseBody = response?.data || {};
  const payload = responseBody.data || responseBody;

  const token = payload.token || payload.access_token || payload.auth_token || responseBody.token || responseBody.access_token || responseBody.auth_token;
  const user = payload.user || responseBody.user || payload.data?.user || responseBody.data?.user;
  const permissions = payload.permissions || responseBody.permissions || [];

  return { token, user, permissions };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedPermissions = localStorage.getItem('permissions');
    const token = getStoredToken();

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Validate that the user has the expected structure
        if (parsedUser && (parsedUser.role || parsedUser.role_id)) {
          setUser(parsedUser);
          if (storedPermissions) {
            setPermissions(JSON.parse(storedPermissions));
          }
        } else {
          // Invalid user data in storage - clear it
          clearAuthStorage();
        }
      } catch (e) {
        console.error('Failed to parse stored user data:', e);
        clearAuthStorage();
      }
    }
    setLoading(false);
  }, []);

  const clearAuthStorage = () => {
    AUTH_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('permissions');
  };

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login({ username, password });
      const { token, user: userData, permissions: userPermissions } = normalizeAuthResponse(response);

      if (!token || !userData) {
        throw new Error('Invalid response from server');
      }

      // Store in localStorage under all standard auth keys
      localStorage.setItem('token', token);
      localStorage.setItem('access_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('user_role', userData.role || userData.role_name || 'Admin');

      if (Array.isArray(userPermissions) && userPermissions.length > 0) {
        localStorage.setItem('permissions', JSON.stringify(userPermissions));
      } else {
        localStorage.removeItem('permissions');
      }

      setUser(userData);
      setPermissions(userPermissions);
      setError(null);
      
      return { success: true, user: userData, token };
    } catch (err) {
      let message;
      
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        message = 'Cannot connect to the server. Please check if the Backend is running.';
      } else if (err.response) {
        // Server responded with an error
        message = err.response.data?.message || err.response.data?.error || 'Login failed. Please check your credentials.';
      } else if (err.request) {
        // Request was made but no response received
        message = 'No response from server. Please check your connection.';
      } else {
        message = err.message || 'An unexpected error occurred. Please try again.';
      }
      
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuthStorage();
      setUser(null);
      setPermissions([]);
      setError(null);
    }
  }, []);

  const updateUserImage = useCallback(async (formData) => {
    try {
      const response = await authAPI.updateProfileImage(formData);
      const { data } = response.data;
      
      if (data && data.image) {
        // Update user in state
        const updatedUser = { ...user, image: data.image };
        setUser(updatedUser);
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        return { success: true, image: data.image };
      }
      return { success: false, message: 'No image data returned' };
    } catch (err) {
      let message = 'Failed to update profile image.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      }
      return { success: false, message };
    }
  }, [user]);

  const updateUserProfile = useCallback(async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      const { data } = response.data;
      
      if (data && data.user) {
        // Merge updated fields into existing user state
        const updatedUser = { ...user, ...data.user };
        setUser(updatedUser);
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        return { success: true, user: data.user };
      }
      return { success: false, message: 'No user data returned' };
    } catch (err) {
      let message = 'Failed to update profile.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      } else if (err.response?.data?.errors) {
        // Handle validation errors
        const errors = err.response.data.errors;
        const firstError = Object.values(errors)[0]?.[0];
        if (firstError) {
          message = firstError;
        }
      }
      return { success: false, message };
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await authAPI.profile();
      const { data } = response.data;
      
      if (data && data.user) {
        const freshUser = data.user;
        const freshPermissions = data.permissions || [];
        
        // Update state
        setUser(freshUser);
        setPermissions(freshPermissions);
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(freshUser));
        localStorage.setItem('permissions', JSON.stringify(freshPermissions));
        
        return { success: true, user: freshUser };
      }
      return { success: false, message: 'No user data returned' };
    } catch (err) {
      console.error('Failed to refresh profile:', err);
      return { success: false, message: 'Failed to refresh profile data.' };
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hasPermission = useCallback((permissionName) => {
    return permissions.includes(permissionName);
  }, [permissions]);

  const isAdmin = user?.role === 'Admin' || user?.role_id === 1;
  const isWaiter = user?.role === 'Waiter' || user?.role_id === 2;
  const isCashier = user?.role === 'Cashier' || user?.role_id === 3;

  const value = {
    user,
    permissions,
    loading,
    error,
    login,
    logout,
    clearError,
    hasPermission,
    updateUserImage,
    updateUserProfile,
    refreshProfile,
    isAdmin,
    isWaiter,
    isCashier,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;