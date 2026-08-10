import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import { usersAPI } from '../../services/api';
import {
  UserPlus, Loader2, AlertCircle, Search, X, Trash2, Users,
  Pencil, ToggleLeft, ToggleRight, Eye,
} from 'lucide-react';

// Helper to safely extract a role string from various possible formats
const extractRole = (role) => {
  if (!role) return '';
  if (typeof role === 'object' && role !== null) {
    return role.role_name || role.role || '';
  }
  return String(role);
};

const UsersManagement = () => {
  const { user: currentUser, isAdmin: isCurrentUserAdmin } = useAuth();
  const { language } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // View Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role_id: 2,
  });

  // Fetch users on mount
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await usersAPI.getAll();
      const userData = response.data?.data?.data || response.data?.data || response.data || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err.response?.data?.message || t('Failed to load data', language));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle create user form submission
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    if (!formData.full_name.trim()) {
      setFormError(t('Full Name', language) + ' ' + t('required', language));
      setSubmitting(false);
      return;
    }
    if (!formData.username.trim()) {
      setFormError(t('Username', language) + ' ' + t('required', language));
      setSubmitting(false);
      return;
    }
    if (!formData.password.trim()) {
      setFormError(t('Password', language) + ' ' + t('required', language));
      setSubmitting(false);
      return;
    }
    if (formData.password.length < 6) {
      setFormError(t('Password', language) + ' ' + t('must be at least 6 characters', language));
      setSubmitting(false);
      return;
    }

    try {
      await usersAPI.create({
        full_name: formData.full_name.trim(),
        username: formData.username.trim(),
        password: formData.password,
        password_confirmation: formData.password,
        role_id: parseInt(formData.role_id),
      });

      setFormData({ full_name: '', username: '', password: '', role_id: 2 });
      setShowCreateModal(false);
      setSuccessMessage(t('User', language) + ' ' + t('created successfully', language));
      await fetchUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
      let errorMsg = t('Operation failed', language);
      if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.errors && typeof err.response.data.errors === 'object') {
        try {
          errorMsg = Object.values(err.response.data.errors).flat().join(', ');
        } catch { /* fallback */ }
      }
      setFormError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit user - open modal with pre-filled data
  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormError(null);
    setFormData({
      full_name: user.full_name || '',
      username: user.username || '',
      password: '',
      role_id: user.role_id || 2,
    });
    setShowEditModal(true);
  };

  // Handle update user form submission
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    if (!formData.full_name.trim()) {
      setFormError(t('Full Name', language) + ' ' + t('required', language));
      setSubmitting(false);
      return;
    }
    if (!formData.username.trim()) {
      setFormError(t('Username', language) + ' ' + t('required', language));
      setSubmitting(false);
      return;
    }
    if (formData.password && formData.password.length < 6) {
      setFormError(t('Password', language) + ' ' + t('must be at least 6 characters', language));
      setSubmitting(false);
      return;
    }

    try {
      const updateData = {
        full_name: formData.full_name.trim(),
        username: formData.username.trim(),
        role_id: parseInt(formData.role_id),
      };
      if (formData.password.trim()) {
        updateData.password = formData.password;
      }

      const userId = editingUser.id || editingUser.user_id;
      await usersAPI.update(userId, updateData);

      setFormData({ full_name: '', username: '', password: '', role_id: 2 });
      setEditingUser(null);
      setShowEditModal(false);
      setSuccessMessage(t('User', language) + ' ' + t('updated successfully', language));
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
      let errorMsg = t('Operation failed', language);
      if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.errors && typeof err.response.data.errors === 'object') {
        try {
          errorMsg = Object.values(err.response.data.errors).flat().join(', ');
        } catch { /* fallback */ }
      }
      setFormError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(t('Are you sure you want to delete this item?', language))) {
      return;
    }
    try {
      await usersAPI.delete(userId);
      setSuccessMessage(t('User', language) + ' "' + userName + '" ' + t('deleted successfully', language));
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(err.response?.data?.message || t('Operation failed', language));
    }
  };

  // Handle view user details
  const handleViewDetails = (user) => {
    setDetailUser(user);
    setEditingField(null);
    setFieldValues({});
    setShowDetailModal(true);
  };

  // ============================================================
  // Detail Modal — CRM-style per-field inline edit
  // ============================================================
  const [editingField, setEditingField] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [savingField, setSavingField] = useState(null);

  const startEditing = (fieldName) => {
    setFieldValues({
      full_name: detailUser.full_name || '',
      email: detailUser.email || '',
      phone: detailUser.phone || '',
      role_id: detailUser.role_id || 2,
      status: getUserStatus(detailUser),
      gender: detailUser.gender || '',
      salary: detailUser.salary || detailUser.Salary || '',
    });
    setEditingField(fieldName);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setFieldValues({});
  };

  const saveField = async (fieldName) => {
    const userId = detailUser.id || detailUser.user_id;
    setSavingField(fieldName);
    try {
      const payload = {};
      const val = fieldValues[fieldName];
      if (fieldName === 'full_name') payload.full_name = val.trim();
      else if (fieldName === 'email') payload.email = val.trim() || null;
      else if (fieldName === 'phone') payload.phone = val.trim() || null;
      else if (fieldName === 'role_id') payload.role_id = val;
      else if (fieldName === 'status') payload.status = val;
      else if (fieldName === 'gender') payload.gender = val || null;
      else if (fieldName === 'salary') payload.salary = val !== '' ? parseFloat(val) : null;

      await usersAPI.update(userId, payload);

      setSuccessMessage(t('Field updated successfully', language) || 'Field updated successfully!');
      setEditingField(null);
      setFieldValues({});

      const updatedDetail = { ...detailUser };
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'full_name') updatedDetail.full_name = value;
        else if (key === 'email') updatedDetail.email = value;
        else if (key === 'phone') updatedDetail.phone = value;
        else if (key === 'role_id') {
          updatedDetail.role_id = value;
          if (value === 1) updatedDetail.role = { role_name: 'Admin' };
          else if (value === 2) updatedDetail.role = { role_name: 'Waiter' };
          else if (value === 3) updatedDetail.role = { role_name: 'Cashier' };
        }
        else if (key === 'status') updatedDetail.status = value;
        else if (key === 'gender') updatedDetail.gender = value;
        else if (key === 'salary') updatedDetail.salary = value;
      }
      setDetailUser(updatedDetail);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to save field:', err);
      setError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setSavingField(null);
    }
  };

  const handleFieldKeyDown = (e, fieldName) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveField(fieldName);
    }
    if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // ============================================================
  // Enhanced search: also matches by User ID (numeric)
  // ============================================================
  const filteredUsers = users.filter((user) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const roleStr = extractRole(user.role).toLowerCase();
    const userId = String(user.id || user.user_id || '');

    const isNumeric = /^\d+$/.test(term.trim());

    return (
      String(user.full_name || '').toLowerCase().includes(term) ||
      String(user.username || '').toLowerCase().includes(term) ||
      roleStr.includes(term) ||
      (isNumeric && userId === term.trim())
    );
  });

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Get role badge color
  const getRoleBadge = (role) => {
    const roleStr = extractRole(role).toLowerCase();
    if (roleStr === 'admin' || roleStr === '1') return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800 border border-purple-200';
    if (roleStr === 'waiter' || roleStr === '2') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800 border border-blue-200';
    if (roleStr === 'cashier' || roleStr === '3') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800 border border-amber-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 border border-gray-200';
  };

  // Get display role label
  const getRoleLabel = (role) => {
    const roleStr = extractRole(role).toLowerCase();
    if (roleStr === 'admin' || roleStr === '1') return t('Admin', language);
    if (roleStr === 'waiter' || roleStr === '2') return t('Waiter', language);
    if (roleStr === 'cashier' || roleStr === '3') return t('Cashier', language);
    return roleStr || 'N/A';
  };

  // Handle toggling user status
  const [togglingStatus, setTogglingStatus] = useState(null);
  const handleToggleStatus = async (user) => {
    const userId = user.id || user.user_id;
    const currentStatus = user.status || user.Status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setTogglingStatus(userId);
    try {
      await usersAPI.toggleStatus(userId, newStatus);
      setSuccessMessage(t('User', language) + ' "' + user.full_name + '" ' + t('status changed to', language) + ' ' + newStatus);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setTogglingStatus(null);
    }
  };

  const getUserStatus = (user) => user.status || user.Status || 'Active';

  const getStatusBadge = (status) => {
    if (status === 'Active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800 border border-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900/60';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800 border border-rose-200 hover:bg-rose-200 dark:hover:bg-rose-900/60';
  };

  const isUserAdmin = (role) => {
    const roleStr = extractRole(role).toLowerCase();
    return roleStr === 'admin' || roleStr === '1';
  };

  // ============================================================
  // Status toggle component
  // ============================================================
  const StatusBadge = ({ user }) => {
    const userId = user.id || user.user_id;
    const status = getUserStatus(user);
    const isUpdating = togglingStatus === userId;
    const isActive = status === 'Active';

    return (
      <button
        onClick={() => handleToggleStatus(user)}
        disabled={isUpdating || isUserAdmin(user.role)}
        title={isUserAdmin(user.role) ? t('Cannot change Admin status', language) : t('Click to', language) + ' ' + (isActive ? t('deactivate', language) : t('activate', language)) + ' ' + t('user', language)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-all ${
          isUserAdmin(user.role)
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
            : getStatusBadge(status)
        }`}
      >
        {isUpdating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isActive ? (
          <ToggleRight className="w-4 h-4" />
        ) : (
          <ToggleLeft className="w-4 h-4" />
        )}
        {isUpdating ? t('Updating...', language) || 'Updating...' : status}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Users Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Manage your users and their roles', language)}
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setFormData({ full_name: '', username: '', password: '', role_id: 2 });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          {t('Create New User', language) || 'Create New User'}
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('Search users...', language)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-500">{t('Loading...', language)}</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-1">
              {searchTerm ? t('No users found', language) || 'No users found' : t('No users yet', language) || 'No users yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm
                ? t('Try adjusting your search term', language) || 'Try adjusting your search term'
                : t('Create your first user to get started', language) || 'Create your first user to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => {
                  setFormError(null);
                  setFormData({ full_name: '', username: '', password: '', role_id: 2 });
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <UserPlus className="w-4 h-4" />
                {t('Create New User', language) || 'Create New User'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Username', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Role', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Created At', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id || user.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                          {(user.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.full_name || t('Unknown', language) || 'Unknown'}
                          </p>
                          {user.email && (
                            <p className="text-xs text-gray-500">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 font-mono">
                        {user.username || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadge(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {formatDate(user.hire_date || user.HIRE_DATE)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge user={user} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(user)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('View Details', language)}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('Edit User', language)}
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        {!isUserAdmin(user.role) && (
                          <button
                            onClick={() => handleDeleteUser(user.id || user.user_id, user.full_name)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('Delete User', language)}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with count */}
        {!loading && filteredUsers.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {t('Showing', language) || 'Showing'} {filteredUsers.length} {t('of', language) || 'of'} {users.length} {t('user', language)}{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* CRM-STYLE USER DETAILS MODAL */}
      {/* ============================================================ */}
      {showDetailModal && detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setShowDetailModal(false); setDetailUser(null); setEditingField(null); setFieldValues({}); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in flex flex-col md:flex-row max-h-[90vh]">
            {/* ============ LEFT SIDEBAR ============ */}
            <div className="w-full md:w-72 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 p-6 flex flex-col items-center shrink-0">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4">
                {(detailUser.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              {/* Name under avatar */}
              <h3 className="text-lg font-bold text-gray-900 text-center">{detailUser.full_name || t('Unknown', language) || 'Unknown'}</h3>
              <p className="text-xs text-gray-400 mb-6">{t('User ID', language) || 'User ID'}: #{detailUser.id || detailUser.user_id || 'N/A'}</p>

              {/* Sidebar Navigation */}
              <nav className="w-full space-y-1">
                {[
                  { label: t('My Profile', language), icon: '👤', active: true },
                  { label: t('Sync Calendars & Contacts', language) || 'Sync Calendars & Contacts', icon: '📅', active: false },
                  { label: t('Notifications', language) || 'Notifications', icon: '🔔', active: false },
                  { label: t('Account Security', language) || 'Account Security', icon: '🔒', active: false },
                ].map((item) => (
                  <button
                    key={item.label}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                      item.active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* ============ RIGHT CONTENT ============ */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{t('My Profile', language)}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{t('Manage your personal information', language) || 'Manage your personal information'}</p>
                </div>
                <button
                  onClick={() => { setShowDetailModal(false); setDetailUser(null); setEditingField(null); setFieldValues({}); }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ============================================================ */}
              {/* Inline Edit Field Component */}
              {/* ============================================================ */}
              {[
                { key: 'full_name', label: t('Full Name', language), type: 'text' },
                { key: 'username', label: t('Username', language), type: 'text', readOnly: true },
                { key: 'email', label: t('Email', language), type: 'email' },
                { key: 'phone', label: t('Phone', language), type: 'text' },
                { key: 'role_id', label: t('Role', language), type: 'select', options: [
                    { value: 1, label: t('Admin', language) },
                    { value: 2, label: t('Waiter', language) },
                    { value: 3, label: t('Cashier', language) },
                  ]},
                { key: 'status', label: t('Account Status', language) || 'Account Status', type: 'select', options: [
                    { value: 'Active', label: t('Active', language) },
                    { value: 'Inactive', label: t('Inactive', language) },
                  ]},
                { key: 'gender', label: t('Gender', language) || 'Gender', type: 'select', options: [
                    { value: '', label: t('Select gender', language) || 'Select gender' },
                    { value: 'Male', label: t('Male', language) || 'Male' },
                    { value: 'Female', label: t('Female', language) || 'Female' },
                    { value: 'Other', label: t('Other', language) || 'Other' },
                  ]},
                { key: 'hire_date', label: t('Hire Date', language) || 'Hire Date', type: 'text', readOnly: true },
                { key: 'salary', label: t('Salary', language) || 'Salary', type: 'number', readOnly: !isCurrentUserAdmin, min: 0 },
              ].map((field) => {
                const isEditing = editingField === field.key;
                const isSaving = savingField === field.key;
                const isReadOnly = field.readOnly;

                // Get the display value
                let displayValue;
                if (field.key === 'role_id') {
                  displayValue = getRoleLabel(detailUser.role);
                } else if (field.key === 'status') {
                  displayValue = getUserStatus(detailUser);
                } else if (field.key === 'hire_date') {
                  displayValue = formatDate(detailUser.hire_date || detailUser.HIRE_DATE);
                } else if (field.key === 'salary') {
                  const salary = detailUser.salary || detailUser.Salary;
                  displayValue = salary !== null && salary !== undefined && salary !== ''
                    ? `$${parseFloat(salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'N/A';
                } else {
                  displayValue = detailUser[field.key] || 'N/A';
                }

                return (
                  <div
                    key={field.key}
                    className="group flex items-center border-b border-gray-100 py-3.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-gray-50/50"
                  >
                    {/* Label */}
                    <div className="w-1/3 shrink-0">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{field.label}</span>
                    </div>

                    {/* Value / Editor */}
                    <div className="flex-1 min-w-0">
                      {isEditing && !isReadOnly ? (
                        <div className="flex items-center gap-2">
                          {field.type === 'select' ? (
                            <select
                              value={fieldValues[field.key] ?? ''}
                              onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: field.key === 'role_id' ? parseInt(e.target.value) : e.target.value }))}
                              onKeyDown={(e) => handleFieldKeyDown(e, field.key)}
                              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                              autoFocus
                            >
                              {field.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type}
                              value={fieldValues[field.key] ?? ''}
                              onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                              onKeyDown={(e) => handleFieldKeyDown(e, field.key)}
                              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                              placeholder={t('Enter', language) + ' ' + field.label.toLowerCase()}
                              autoFocus
                            />
                          )}
                          {/* Save button */}
                          <button
                            onClick={() => saveField(field.key)}
                            disabled={isSaving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors shrink-0"
                            title={t('Save', language)}
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          {/* Cancel button */}
                          <button
                            onClick={cancelEditing}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                            title={t('Cancel', language)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          {field.key === 'status' ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                              displayValue === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {displayValue === 'Active' ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                              {displayValue}
                            </span>
                          ) : (
                            <span className={`text-sm ${field.key === 'username' ? 'font-mono' : 'font-medium'} text-gray-900`}>
                              {displayValue}
                            </span>
                          )}

                          {/* Pencil icon on hover (only for editable fields) */}
                          {!isReadOnly && (
                            <button
                              onClick={() => startEditing(field.key)}
                              className="p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-all"
                              title={t('Edit', language) + ' ' + field.label}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Close button at bottom */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowDetailModal(false); setDetailUser(null); setEditingField(null); setFieldValues({}); }}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('Close', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EDIT USER MODAL */}
      {/* ============================================================ */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowEditModal(false);
              setEditingUser(null);
              setFormError(null);
            }}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('Edit User', language)}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('Update user information for', language) || 'Update user information for'} <span className="font-medium text-gray-700">{editingUser?.full_name}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingUser(null); setFormError(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Full Name', language)} <span className="text-red-500">*</span></label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange}
                  placeholder={t('Enter full name', language) || 'Enter full name'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Username', language)} <span className="text-red-500">*</span></label>
                <input type="text" name="username" value={formData.username} onChange={handleInputChange}
                  placeholder={t('Enter username', language) || 'Enter username'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('New Password', language) || 'New Password'} <span className="text-gray-400 text-xs">({t('optional', language) || 'optional'})</span>
                </label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange}
                  placeholder={t('Leave blank to keep current password', language) || 'Leave blank to keep current password'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" minLength={6} />
                <p className="text-xs text-gray-400 mt-1">{t('Only fill this in if you want to change the password', language) || 'Only fill this in if you want to change the password'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Role', language)} <span className="text-red-500">*</span></label>
                <select name="role_id" value={formData.role_id} onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white" required>
                  <option value={2}>{t('Waiter', language)}</option>
                  <option value={3}>{t('Cashier', language)}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('Role_ID 2 = Waiter, Role_ID 3 = Cashier', language) || 'Role_ID 2 = Waiter, Role_ID 3 = Cashier'}</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingUser(null); setFormError(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">{t('Cancel', language)}</button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('Updating...', language) || 'Updating...'}</> : <><Pencil className="w-5 h-5" /> {t('Update User', language)}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE USER MODAL */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('Create New User', language) || 'Create New User'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t('Add a new employee to the system', language) || 'Add a new employee to the system'}</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Full Name', language)} <span className="text-red-500">*</span></label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange}
                  placeholder={t('Enter full name', language) || 'Enter full name'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Username', language)} <span className="text-red-500">*</span></label>
                <input type="text" name="username" value={formData.username} onChange={handleInputChange}
                  placeholder={t('Enter username', language) || 'Enter username'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Password', language)} <span className="text-red-500">*</span></label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange}
                  placeholder={t('Enter password (min. 6 characters)', language) || 'Enter password (min. 6 characters)'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required minLength={6} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('Role', language)} <span className="text-red-500">*</span></label>
                <select name="role_id" value={formData.role_id} onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white" required>
                  <option value={2}>{t('Waiter', language)}</option>
                  <option value={3}>{t('Cashier', language)}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('Role_ID 2 = Waiter, Role_ID 3 = Cashier', language) || 'Role_ID 2 = Waiter, Role_ID 3 = Cashier'}</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">{t('Cancel', language)}</button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('Creating...', language) || 'Creating...'}</> : <><UserPlus className="w-4 h-4" /> {t('Create User', language)}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;