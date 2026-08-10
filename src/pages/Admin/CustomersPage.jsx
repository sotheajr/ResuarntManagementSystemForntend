import { useState, useEffect, useCallback } from 'react';
import { customersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getDisplayName } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Plus, Pencil, Trash2, Search, X, AlertTriangle,
  Loader2, UsersRound, Eye, Phone, Mail, MapPin, ImageOff
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const CustomersPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const role = user?.role || '';

  // State
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state (Admin only)
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    address: '',
    image: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Detail view modal (All roles)
  const [detailTarget, setDetailTarget] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ==================== Fetch Customers ====================
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await customersAPI.getAll();
      setCustomers(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ==================== Filtering ====================
  const filteredCustomers = customers.filter((customer) => {
    const name = (customer.customer_name || customer.Customer_Name || '').toLowerCase();
    const phone = (customer.phone || customer.Phone || '').toLowerCase();
    const email = (customer.email || customer.Email || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || phone.includes(term) || email.includes(term);
  });

  // ==================== Image Helpers ====================
  const getImageUrl = (customer) => {
    const img = customer.image || customer.Image;
    if (!img) return null;
    if (img.startsWith('http')) return img;
    const cleanPath = img.replace(/^\/?storage\//, '');
    return `${API_BASE_URL}/storage/${cleanPath}`;
  };

  // ==================== Form Helpers (Admin only) ====================
  const resetForm = () => {
    setFormData({ customer_name: '', phone: '', email: '', address: '', image: null });
    setFormErrors({});
    setImagePreview(null);
    setEditingCustomer(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setModalMode('edit');
    setEditingCustomer(customer);
    setFormData({
      customer_name: customer.customer_name || customer.Customer_Name || '',
      phone: customer.phone || customer.Phone || '',
      email: customer.email || customer.Email || '',
      address: customer.address || customer.Address || '',
      image: null,
    });
    const img = customer.image || customer.Image;
    if (img) {
      const cleanPath = img.startsWith('http') ? img : `${API_BASE_URL}/storage/${img.replace(/^\/?storage\//, '')}`;
      setImagePreview(cleanPath);
    } else {
      setImagePreview(null);
    }
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setImagePreview(null);
  };

  // ==================== Submit (Admin only) ====================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer_name.trim()) {
      setFormErrors({ customer_name: t('Customer name is required', language) || 'Customer name is required' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('customer_name', formData.customer_name.trim());
      if (formData.phone) payload.append('phone', formData.phone);
      if (formData.email) payload.append('email', formData.email);
      if (formData.address) payload.append('address', formData.address);
      if (formData.image) payload.append('image', formData.image);

      if (modalMode === 'create') {
        await customersAPI.create(payload);
      } else {
        payload.append('_method', 'PUT');
        const customerId = editingCustomer.customer_id || editingCustomer.Customer_ID;
        await customersAPI.update(customerId, payload);
      }
      closeModal();
      await fetchCustomers();
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      if (err.response?.data?.errors) {
        const fieldErrors = {};
        Object.entries(err.response.data.errors).forEach(([key, msgs]) => {
          fieldErrors[key] = Array.isArray(msgs) ? msgs[0] : msgs;
        });
        setFormErrors(fieldErrors);
      } else {
        setFormErrors({ general: serverMsg || t('Operation failed', language) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== Delete (Admin only) ====================
  const confirmDelete = (customer) => {
    setDeleteTarget(customer);
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setDeleteError(null);
    try {
      const customerId = deleteTarget.customer_id || deleteTarget.Customer_ID;
      await customersAPI.delete(customerId);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setDeleteError(null);
      await fetchCustomers();
    } catch (err) {
      const serverMessage = err.response?.data?.message || t('Operation failed', language);
      setDeleteError(serverMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== Detail View (All roles) ====================
  const openDetailModal = (customer) => {
    setDetailTarget(customer);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailTarget(null);
  };

  // ==================== Helpers ====================
  const getField = (obj, ...keys) => {
    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined && val !== null) return val;
    }
    return '';
  };

  const getCustomerId = (customer) => customer.customer_id || customer.Customer_ID;
  const getCustomerName = (customer) => customer.customer_name || customer.Customer_Name;
  const getPhone = (customer) => customer.phone || customer.Phone;
  const getEmail = (customer) => customer.email || customer.Email;
  const getAddress = (customer) => customer.address || customer.Address;

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Customers Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? t('Manage your customer records', language)
              : t('Browse customer records and view contact information', language) || 'Browse customer records and view contact information'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
          >
            <Plus className="w-4 h-4" />
            {t('Add New Customer', language)}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('Search customers...', language)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredCustomers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <UsersRound className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">
            {searchTerm ? t('No customers found', language) || 'No customers found' : t('No customers yet', language) || 'No customers yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm
              ? t('Try adjusting your search term', language) || 'Try adjusting your search term'
              : t('Get started by adding your first customer', language) || 'Get started by adding your first customer'}
          </p>
          {isAdmin && !searchTerm && (
            <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Plus className="w-4 h-4" />
              {t('Add New Customer', language)}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filteredCustomers.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Avatar', language) || 'Avatar'}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Customer Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Phone', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Email', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Address', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => {
                  const customerId = getCustomerId(customer);
                  const name = getCustomerName(customer);
                  const phone = getPhone(customer);
                  const email = getEmail(customer);
                  const address = getAddress(customer);
                  const imgUrl = getImageUrl(customer);

                  return (
                    <tr key={customerId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center text-white text-sm font-bold ${imgUrl ? 'hidden' : 'flex'}`}>
                          {(name || '?').charAt(0).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">
                          #{customerId}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{getDisplayName(customer, 'customer_name', 'CUSTOMER_NAME_KH', language) || name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {phone}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-[180px]">{email}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                        {address || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openDetailModal(customer)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('View Details', language)}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => openEditModal(customer)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={t('Edit Customer', language)}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => confirmDelete(customer)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('Delete Customer', language)}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== Detail View Modal (All roles) ==================== */}
      {showDetailModal && detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-end px-6 pt-6">
              <button
                onClick={closeDetailModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pb-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-gray-100 shadow-sm mb-4 flex-shrink-0">
                  {(() => {
                    const imgUrl = getImageUrl(detailTarget);
                    return imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={getCustomerName(detailTarget)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-white font-bold text-3xl">
                          {(getCustomerName(detailTarget) || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {getCustomerName(detailTarget)}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 mb-3">
                  {t('ID', language)}: {getCustomerId(detailTarget)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-5 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">{t('Phone', language)}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {getPhone(detailTarget) || <span className="text-gray-400 italic">{t('Not provided', language) || 'Not provided'}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">{t('Email', language)}</p>
                    <p className="text-sm font-medium text-gray-900 break-all">
                      {getEmail(detailTarget) || <span className="text-gray-400 italic">{t('Not provided', language) || 'Not provided'}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">{t('Address', language)}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {getAddress(detailTarget) || <span className="text-gray-400 italic">{t('Not provided', language) || 'Not provided'}</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeDetailModal}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('Close', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Create/Edit Modal (Admin only) ==================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {modalMode === 'create' ? t('Add New Customer', language) : t('Edit Customer', language)}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formErrors.general}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Customer Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  placeholder={t('e.g. John Doe', language) || 'e.g. John Doe'}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.customer_name ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {formErrors.customer_name && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.customer_name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Phone Number', language) || 'Phone Number'}</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder={t('e.g. 012-345-678', language) || 'e.g. 012-345-678'}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Email', language)}</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder={t('e.g. john@example.com', language) || 'e.g. john@example.com'}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Address', language)}</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder={t('e.g. 123 Main Street, Phnom Penh', language) || 'e.g. 123 Main Street, Phnom Penh'}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Profile Image', language) || 'Profile Image'}</label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt={t('Preview', language) || 'Preview'}
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <ImageOff className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <label className="cursor-pointer px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    {t('Choose Image', language) || 'Choose Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">{t('Allowed: jpeg, png, jpg, gif, webp (max 2MB)', language) || 'Allowed: jpeg, png, jpg, gif, webp (max 2MB)'}</p>
                {formErrors.image && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.image}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('Cancel', language)}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalMode === 'create' ? t('Create Customer', language) || 'Create Customer' : t('Update Customer', language) || 'Update Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Delete Confirmation Modal (Admin only) ==================== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Customer', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete this item?', language) || 'Are you sure you want to delete'}
                <span className="font-medium text-gray-700">
                  {' "'}{getDisplayName(deleteTarget, 'customer_name', 'CUSTOMER_NAME_KH', language) || deleteTarget.customer_name || deleteTarget.Customer_Name}{'"'}
                </span>?
              </p>
              <p className="text-xs text-red-500">
                {t('This action cannot be undone.', language)} {t('Orders or reservations linked to this customer may prevent deletion.', language) || 'Orders or reservations linked to this customer may prevent deletion.'}
              </p>

              {deleteError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-left animate-scale-in">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-800 mb-1">{t('Deletion Failed', language) || 'Deletion Failed'}</p>
                      <p className="text-xs text-red-700 leading-relaxed">{deleteError}</p>
                    </div>
                    <button
                      onClick={() => setDeleteError(null)}
                      className="p-1 text-red-400 hover:text-red-600 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('Cancel', language)}
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('Delete', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;