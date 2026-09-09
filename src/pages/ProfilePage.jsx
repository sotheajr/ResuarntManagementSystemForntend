import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, Loader2, CheckCircle, AlertCircle, X, User, Mail, Phone, Calendar, Shield, Pencil, Check, ChevronDown } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

const ProfilePage = () => {
  const { user, updateUserImage, updateUserProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const fileInputRef = useRef(null);

  // Inline editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [hoveredField, setHoveredField] = useState(null);
  const inputRef = useRef(null);
  const selectRef = useRef(null);

  // Build the full image URL from the path stored in DB
  const userImageUrl = user?.avatar || user?.avatar_url || user?.image
    ? (user?.avatar || user?.avatar_url || user?.image).startsWith('http')
      ? (user?.avatar || user?.avatar_url || user?.image)
      : (() => {
          let cleanPath = user?.avatar || user?.avatar_url || user?.image;
          if (cleanPath.startsWith('/storage/')) {
            cleanPath = cleanPath.replace('/storage/', '');
          } else if (cleanPath.startsWith('storage/')) {
            cleanPath = cleanPath.replace('storage/', '');
          }
          return `${API_BASE_URL}/storage/${cleanPath}`;
        })()
    : null;

  // Reset error state when image path changes
  useEffect(() => {
    setImgLoadFailed(false);
  }, [user?.image]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (editingField === 'gender') {
      selectRef.current?.focus();
    } else if (editingField) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editingField]);

  // Clear success message after timeout
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  // Fetch fresh profile data from backend on mount (ensures hire_date, role_id, etc. are loaded)
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const hasImage = !!userImageUrl && !imgLoadFailed;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, PNG, GIF, or WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image size must be less than 2MB.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const result = await updateUserImage(formData);

      if (result.success) {
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        setUploadError(result.message || 'Failed to upload image.');
      }
    } catch (err) {
      setUploadError('An unexpected error occurred. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper to safely read nested user properties with fallback for both casings
  const getUserField = (field) => {
    const lower = field.toLowerCase();
    const upper = field.toUpperCase();
    // Try camelCase (JS convention), lowercase, then uppercase
    return user?.[field] ?? user?.[lower] ?? user?.[upper] ?? user?.[field === 'hireDate' ? 'hire_date' : null] ?? null;
  };

  const getHireDate = () => {
    return user?.hire_date || user?.Hire_Date || user?.HIRE_DATE || user?.hiredate || null;
  };

  const getRoleId = () => {
    return user?.role_id || user?.Role_ID || user?.ROLE_ID || null;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getRoleBadgeColor = () => {
    const role = user?.role?.toLowerCase();
    if (role === 'admin') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (role === 'waiter') return 'bg-green-100 text-green-800 border-green-200';
    if (role === 'cashier') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusBadge = () => {
    const status = user?.status?.toLowerCase();
    if (status === 'active') return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  // ============ INLINE EDITING HANDLERS ============

  const startEditing = useCallback((field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }, []);

  const saveField = useCallback(async (field) => {
    if (!field || editValue.trim() === '') {
      // Don't allow empty values for required fields
      const currentVal = user?.[field === 'full_name' ? 'full_name' : field] || '';
      if (!currentVal && field !== 'phone') {
        setSaveError('This field cannot be empty.');
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      const payload = { [field === 'full_name' ? 'full_name' : field]: editValue.trim() };
      const result = await updateUserProfile(payload);

      if (result.success) {
        setSaveSuccess(`${field === 'full_name' ? 'Name' : field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
        setEditingField(null);
        setEditValue('');
      } else {
        setSaveError(result.message || 'Failed to update.');
      }
    } catch (err) {
      setSaveError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  }, [editValue, user, updateUserProfile]);

  const handleKeyDown = useCallback((e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveField(field);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }, [saveField, cancelEditing]);

  const getFieldValue = (field) => {
    if (field === 'full_name') return user?.full_name || 'N/A';
    if (field === 'email') return user?.email || 'N/A';
    if (field === 'phone') return user?.phone || 'N/A';
    if (field === 'gender') return user?.gender || 'N/A';
    return 'N/A';
  };

  const isEditableField = (field) => {
    return ['full_name', 'email', 'phone', 'gender'].includes(field);
  };

  // ============ RENDER INLINE EDITABLE FIELD ============

  const renderEditableField = (field, label, value) => {
    const isEditing = editingField === field;
    const isHovered = hoveredField === field;
    const fieldKey = field === 'full_name' ? 'full_name' : field;
    const displayValue = value || 'N/A';

    return (
      <div
        className="relative group"
        onMouseEnter={() => setHoveredField(field)}
        onMouseLeave={() => setHoveredField(null)}
      >
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>

        {isEditing ? (
          <div className="flex items-center gap-2">
            {field === 'gender' ? (
              <div className="relative flex-1">
                <select
                  ref={selectRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, field)}
                  className="w-full px-3 py-2 text-sm border-2 border-blue-400 rounded-lg bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none cursor-pointer"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            ) : (
              <input
                ref={inputRef}
                type={field === 'email' ? 'email' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, field)}
                className="flex-1 px-3 py-2 text-sm border-2 border-blue-400 rounded-lg bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder={`Enter ${label.toLowerCase()}`}
              />
            )}

            {/* Save Button */}
            <button
              onClick={() => saveField(field)}
              disabled={saving}
              className="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Save"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>

            {/* Cancel Button */}
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{displayValue}</p>

            {/* Pencil icon on hover */}
            {isHovered && (
              <button
                onClick={() => startEditing(field, getFieldValue(field) === 'N/A' ? '' : getFieldValue(field))}
                className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"
                title={`Edit ${label}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Inline error for this field */}
        {isEditing && saveError && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {saveError}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your personal information and profile picture
        </p>
      </div>

      {/* Global Save Success/Error Messages */}
      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveError && !editingField && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ============ LEFT CARD - Avatar & Basic Info ============ */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Avatar Section */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-8 flex flex-col items-center">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-28 h-28 aspect-square rounded-full border-4 border-white/50 shadow-xl overflow-hidden">
                  {hasImage ? (
                    <img
                      src={userImageUrl}
                      alt={user?.full_name || 'User'}
                      className="w-full h-full object-cover object-top"
                      onError={() => setImgLoadFailed(true)}
                      onLoad={() => setImgLoadFailed(false)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-4xl">
                      {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {/* Hover overlay for camera icon */}
                <button
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                  title="Change profile picture"
                >
                  <Camera className="w-8 h-8 text-white" />
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Name & Role */}
              <h2 className="text-xl font-bold text-white mt-4">
                {user?.full_name || 'User'}
              </h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border mt-2 ${getRoleBadgeColor()}`}>
                <Shield className="w-3 h-3" />
                {user?.role || 'Unknown'}
              </span>
            </div>

            {/* Upload Status Messages */}
            <div className="px-6 pb-6 -mt-2">
              {uploading && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm mt-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading image...
                </div>
              )}

              {uploadSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm mt-4">
                  <CheckCircle className="w-4 h-4" />
                  Profile image updated successfully!
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mt-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Change Avatar Button */}
              {!uploading && (
                <button
                  onClick={handleAvatarClick}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Change Avatar
                </button>
              )}
            </div>

            {/* Quick Stats */}
            <div className="border-t border-gray-100 px-6 py-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Username</p>
                  <p className="font-medium text-gray-900 font-mono text-sm">{user?.username || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 text-sm">{user?.email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="font-medium text-gray-900 text-sm">{user?.phone || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ RIGHT CARD - Detailed Info ============ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
              <p className="text-sm text-gray-400 mt-0.5">Hover over any field to edit. Press Enter to save or Escape to cancel.</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name - Editable */}
                {renderEditableField('full_name', 'Full Name', user?.full_name)}

                {/* Username - Read Only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <p className="text-sm font-medium text-gray-900 font-mono">{user?.username || 'N/A'}</p>
                </div>

                {/* Email - Editable */}
                {renderEditableField('email', 'Email Address', user?.email)}

                {/* Phone - Editable */}
                {renderEditableField('phone', 'Phone Number', user?.phone)}

                {/* Gender - Editable */}
                {renderEditableField('gender', 'Gender', user?.gender)}

                {/* Role - Read Only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Role
                  </label>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor()}`}>
                    <Shield className="w-3 h-3" />
                    {user?.role || 'Unknown'}
                  </span>
                </div>

                {/* Status - Read Only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Account Status
                  </label>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge()}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user?.status?.toLowerCase() === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                    {user?.status || 'Active'}
                  </span>
                </div>

                {/* Hire Date - Read Only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Hire Date
                  </label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(getHireDate())}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
              <p className="text-sm text-gray-400 mt-0.5">Security and account details</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User ID - Read Only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    User ID
                  </label>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    #{user?.id || user?.user_id || 'N/A'}
                  </p>
                </div>

                {/* Role ID - Read Only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Role ID
                  </label>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    {getRoleId() || 'N/A'}
                  </p>
                </div>

                {/* Salary - Read Only */}
                {user?.salary && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Salary
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      ${parseFloat(user.salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;