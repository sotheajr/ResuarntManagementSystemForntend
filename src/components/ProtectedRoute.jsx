import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldOff } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const AUTH_TOKEN_KEYS = ['token', 'access_token', 'auth_token'];
const getStoredAuthToken = () => AUTH_TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

/**
 * ProtectedRoute component that checks authentication and role-based access.
 * 
 * Props:
 * - children: The component to render if authorized
 * - allowedRoles: Array of role NAMES (strings) that can access this route (e.g., ["Admin", "Waiter", "Cashier"])
 * - requiredPermission: A specific permission string required (e.g., "Manage_Users")
 */
const ProtectedRoute = ({ children, allowedRoles, requiredPermission }) => {
  const { isAuthenticated, user, hasPermission, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-400 via-rose-400 to-pink-500 dark:from-amber-400 dark:via-rose-400 dark:to-pink-500">
        <LoadingSpinner message="Authenticating..." size="lg" />
      </div>
    );
  }

  // After loading complete, if no user or auth token present, redirect to login
  if (!isAuthenticated || !user || !getStoredAuthToken()) {
    AUTH_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    return <Navigate to="/login" replace />;
  }

  // Determine user's role name (normalized)
  const userRole = user.role || '';
  const userRoleId = user.role_id || null;

  // Check role-based access - match by role NAME first, then by role_id
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRoleAccess = allowedRoles.some(allowed => {
      // Check if allowed role matches the user's role name (case-insensitive)
      if (typeof allowed === 'string' && userRole.toLowerCase() === allowed.toLowerCase()) {
        return true;
      }
      // Check if allowed role matches the user's role_id (numeric)
      if (typeof allowed === 'number' && userRoleId === allowed) {
        return true;
      }
      return false;
    });

    if (!hasRoleAccess) {
      // User doesn't have the required role - redirect to their own dashboard
      const rolePath = getRoleDashboardPath(userRole);
      return <Navigate to={rolePath} replace />;
    }
  }

  // Check specific permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-500 text-sm mb-4">
            You do not have the required permission ({requiredPermission}) to access this page.
          </p>
          <button
            onClick={() => {
              const rolePath = getRoleDashboardPath(userRole);
              window.location.href = rolePath;
            }}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Authorized - render children
  return children;
};

// Helper to get dashboard path based on role
const getRoleDashboardPath = (role) => {
  switch (role?.toLowerCase()) {
    case 'admin': return '/admin/dashboard';
    case 'waiter': return '/waiter/dashboard';
    case 'cashier': return '/cashier/dashboard';
    default: return '/login';
  }
};

export default ProtectedRoute;