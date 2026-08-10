import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, AlertCircle, WifiOff } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isConnectionError, setIsConnectionError] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const { login, error, loading, isAuthenticated, user, clearError } = useAuth();
  const navigate = useNavigate();

  // Clear any stale errors on mount
  useEffect(() => {
    clearError();
  }, []);

  // If already authenticated, redirect to the appropriate dashboard
  useEffect(() => {
    if (isAuthenticated && user && !redirecting) {
      setRedirecting(true);
      const role = user.role?.toLowerCase();
      let path = '/login';
      if (role === 'admin') path = '/admin/dashboard';
      else if (role === 'waiter') path = '/waiter/dashboard';
      else if (role === 'cashier') path = '/cashier/dashboard';
      navigate(path, { replace: true });
    }
  }, [isAuthenticated, user, navigate, redirecting]);

  // Show a simple redirecting state
  if (redirecting || (isAuthenticated && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-400 via-rose-400 to-pink-500 dark:from-amber-400 dark:via-rose-400 dark:to-pink-500">
        <LoadingSpinner message="Redirecting to dashboard..." size="lg" />
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsConnectionError(false);
    setIsPendingApproval(false);

    if (!username.trim() || !password.trim()) {
      setFormError('Please enter both username and password.');
      return;
    }

    const result = await login(username.trim(), password);
    if (result.success) {
      const authToken = result.token;
      const loggedUser = result.user;
      const role = loggedUser?.role?.toLowerCase();
      let path = '/admin/dashboard';
      if (role === 'waiter') path = '/waiter/dashboard';
      else if (role === 'cashier') path = '/cashier/dashboard';

      if (authToken) {
        localStorage.setItem('token', authToken);
        localStorage.setItem('access_token', authToken);
        localStorage.setItem('auth_token', authToken);
      }

      if (loggedUser) {
        localStorage.setItem('user', JSON.stringify(loggedUser));
        localStorage.setItem('user_role', loggedUser.role || loggedUser.role_name || 'Admin');
      }

      window.location.href = path;
      return;
    } else {
      if (result.message?.includes('Cannot connect') || 
          result.message?.includes('No response') ||
          result.message?.includes('ERR_CONNECTION')) {
        setIsConnectionError(true);
      } else if (result.message?.toLowerCase().includes('pending approval')) {
        setIsPendingApproval(true);
      }
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-lg p-1.5 mb-4 overflow-hidden">
            <img
              src="/images/Logo.jpg"
              alt="Restaurant Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <h1 className="text-3xl font-bold text-white">Restaurant MS</h1>
          <p className="text-blue-200 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Connection Error Banner */}
            {isConnectionError && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <WifiOff className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-red-800 text-sm">Connection Error</p>
                    <p className="text-red-600 text-xs mt-1">
                      Cannot connect to the server. Please check:
                    </p>
                    <ul className="text-red-600 text-xs mt-1 list-disc list-inside space-y-0.5">
                      <li>The Laravel backend is running (php artisan serve)</li>
                      <li>The backend URL is correct (http://localhost:8000)</li>
                      <li>No firewall is blocking the connection</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Approval Warning */}
            {isPendingApproval && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 text-sm">Account Pending Approval</p>
                    <p className="text-yellow-700 text-xs mt-1">
                      Your account is pending approval from the System Administrator. Please try again later.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generic Error Display */}
            {displayError && !isConnectionError && !isPendingApproval && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{displayError}</p>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="input-field"
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors bg-transparent border-none p-0 cursor-pointer"
              >
                Register here
              </button>
            </p>
          </div>

          {/* Demo Credentials */}
          <div className="mt-4 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">Demo Accounts</p>
            <div className="space-y-2 text-xs">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-medium text-blue-800">Admin</p>
                <p className="text-blue-600">Username: <strong>admin</strong> | Password: <strong>admin123</strong></p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="font-medium text-green-800">Waiter</p>
                <p className="text-green-600">Username: <strong>waiter</strong> | Password: <strong>123456</strong></p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="font-medium text-orange-800">Cashier</p>
                <p className="text-orange-600">Username: <strong>cashier</strong> | Password: <strong>123456</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;