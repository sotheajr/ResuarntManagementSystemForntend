import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { suppliersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getDisplayName } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle, Loader2, Plus,
  Edit3, Trash2, CheckCircle, RefreshCw,
  Building2, Phone, MapPin, Users
} from 'lucide-react';

const SuppliersPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Strict admin-only gate
  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  // ==================== State ====================
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    Supplier_Name: '',
    Phone: '',
    Address: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ==================== Data fetching ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersAPI.getAll();
      setSuppliers(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  // ==================== Filtering ====================
  const filteredSuppliers = suppliers.filter((item) => {
    const term = searchTerm.toLowerCase();
    const name = (item.Supplier_Name || item.supplier_name || '').toLowerCase();
    const phone = (item.Phone || item.phone || '').toLowerCase();
    const address = (item.Address || item.address || '').toLowerCase();
    return name.includes(term) || phone.includes(term) || address.includes(term);
  });

  // ==================== Helpers ====================
  const getField = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return '';
  };

  // ==================== Create / Edit Modal ====================
  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ Supplier_Name: '', Phone: '', Address: '' });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      Supplier_Name: getField(item, 'Supplier_Name', 'supplier_name'),
      Phone: getField(item, 'Phone', 'phone'),
      Address: getField(item, 'Address', 'address'),
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormError(null);
  };

  const handleFormSubmit = async () => {
    if (!formData.Supplier_Name) {
      setFormError(t('Supplier Name', language) + ' ' + t('required', language) + '.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        supplier_name: formData.Supplier_Name,
        phone: formData.Phone || null,
        address: formData.Address || null,
      };

      if (editingItem) {
        const id = getField(editingItem, 'Supplier_ID', 'supplier_id');
        await suppliersAPI.update(id, payload);
        showToast('success', t('Supplier', language) + ' ' + t('updated successfully', language));
      } else {
        await suppliersAPI.create(payload);
        showToast('success', t('Supplier', language) + ' ' + t('created successfully', language));
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setFormSubmitting(false);
    }
  };

  // ==================== Delete ====================
  const confirmDelete = (item) => {
    setDeleteTarget(item);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const id = getField(deleteTarget, 'Supplier_ID', 'supplier_id');
      await suppliersAPI.delete(id);
      showToast('success', t('Supplier', language) + ' ' + t('deleted successfully', language));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to delete supplier', language));
      setShowDeleteConfirm(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ==================== Format ====================
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  // If not admin, don't render anything (redirect effect handles navigation)
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-slide-in ${
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Suppliers Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Manage your ingredient and product suppliers', language)}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" />
          {t('Add Supplier', language)}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">{t('All Suppliers', language) || 'All Suppliers'}</h3>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('Search suppliers...', language)}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={t('Refresh', language)}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {!loading && filteredSuppliers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('No suppliers found', language) || 'No suppliers found'}</h3>
            <p className="text-sm text-gray-500">{t('Click "Add Supplier" to create your first supplier record.', language) || 'Click "Add Supplier" to create your first supplier record.'}</p>
          </div>
        )}

        {!loading && filteredSuppliers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Supplier Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Phone', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Address', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.map((item) => {
                  const id = getField(item, 'Supplier_ID', 'supplier_id');
                  const name = getField(item, 'Supplier_Name', 'supplier_name');
                  const phone = getField(item, 'Phone', 'phone');
                  const address = getField(item, 'Address', 'address');

                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">#{id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{getDisplayName(item, 'Supplier_Name', 'SUPPLIER_NAME_KH', language) || name}</div>
                            <div className="text-xs text-gray-400">{language === 'kh' ? '' : (item.SUPPLIER_NAME_KH || item.supplier_name_kh || item.Supplier_Name_KH || '')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {phone || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {address || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={t('Edit', language)}
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => confirmDelete(item)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('Delete', language)}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== Create / Edit Modal ==================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingItem ? t('Edit Supplier', language) : t('Add New Supplier', language)}
              </h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Supplier Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Supplier Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.Supplier_Name}
                  onChange={(e) => setFormData({ ...formData, Supplier_Name: e.target.value })}
                  placeholder={t('e.g. Fresh Foods Co.', language)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Phone Number', language) || 'Phone Number'}
                </label>
                <input
                  type="text"
                  value={formData.Phone}
                  onChange={(e) => setFormData({ ...formData, Phone: e.target.value })}
                  placeholder={t('e.g. 012-999-888', language)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Address', language)}
                </label>
                <textarea
                  value={formData.Address}
                  onChange={(e) => setFormData({ ...formData, Address: e.target.value })}
                  placeholder={t('e.g. 123 Market Street, Phnom Penh', language)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('Cancel', language)}
                </button>
                <button
                  onClick={handleFormSubmit}
                  disabled={formSubmitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingItem ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {formSubmitting ? t('Saving', language) : editingItem ? t('Update Supplier', language) : t('Create Supplier', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Delete Confirmation ==================== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Supplier', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete this item?', language) || 'Are you sure you want to permanently delete'}{' '}
                <span className="font-medium text-gray-700">
                  {getDisplayName(deleteTarget, 'Supplier_Name', 'SUPPLIER_NAME_KH', language) || getField(deleteTarget, 'Supplier_Name', 'supplier_name')}
                </span>?
              </p>
              <p className="text-xs text-red-500">{t('This action cannot be undone.', language)}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('Cancel', language)}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('Delete', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;