import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { partnersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle, Loader2, Building2,
  Plus, Edit3, Trash2, CheckCircle, RefreshCw,
  Phone, MapPin, User, Image as ImageIcon, FileImage, FileX
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'http://localhost:8000';

const PartnersPage = () => {
  const { isAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Strict admin-only gate
  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  // ==================== State ====================
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    address: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
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
      const res = await partnersAPI.getAll();
      setPartners(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  // ==================== Helpers ====================
  const getField = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return '';
  };

  const getImageUrl = (item) => {
    const rawPath = getField(item, 'IMAGE', 'image');
    if (!rawPath) return null;
    const cleanPath = rawPath.replace(/\\/g, '/');
    return `${API_BASE_URL}/storage/${cleanPath}`;
  };

  // ==================== Filtering ====================
  const filteredPartners = partners.filter((item) => {
    const term = searchTerm.toLowerCase();
    const name = (item.COMPANY_NAME || item.company_name || '').toLowerCase();
    const contact = (item.CONTACT_PERSON || item.contact_person || '').toLowerCase();
    const phone = (item.PHONE || item.phone || '');
    return name.includes(term) || contact.includes(term) || phone.includes(term);
  });

  // ==================== Image handler ====================
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // ==================== Create / Edit Modal ====================
  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      company_name: '',
      contact_person: '',
      phone: '',
      address: '',
    });
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      company_name: getField(item, 'COMPANY_NAME', 'company_name'),
      contact_person: getField(item, 'CONTACT_PERSON', 'contact_person'),
      phone: getField(item, 'PHONE', 'phone'),
      address: getField(item, 'ADDRESS', 'address'),
    });
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
  };

  const handleFormSubmit = async () => {
    if (!formData.company_name.trim()) {
      setFormError(t('Company name is required', language) || 'Company name is required.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const formPayload = new FormData();
      formPayload.append('company_name', formData.company_name);
      formPayload.append('contact_person', formData.contact_person);
      formPayload.append('phone', formData.phone);
      formPayload.append('address', formData.address);

      if (imageFile) {
        formPayload.append('image', imageFile);
      }

      if (editingItem) {
        const id = getField(editingItem, 'PARTNER_ID', 'partner_id');
        await partnersAPI.update(id, formPayload);
        showToast('success', t('Partner', language) + ' ' + t('updated successfully', language));
      } else {
        await partnersAPI.create(formPayload);
        showToast('success', t('Partner', language) + ' ' + t('created successfully', language));
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
      const id = getField(deleteTarget, 'PARTNER_ID', 'partner_id');
      await partnersAPI.delete(id);
      showToast('success', t('Partner', language) + ' ' + t('deleted successfully', language));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Operation failed', language));
      setShowDeleteConfirm(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // If not admin, don't render anything
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
          <h1 className="text-2xl font-bold text-gray-900">{t('Partners Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Manage your business partners', language)}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" />
          {t('Add Partner', language)}
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
          <h3 className="text-sm font-semibold text-gray-700">{t('Partner Companies', language) || 'Partner Companies'}</h3>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('Search partners...', language)}
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

        {!loading && filteredPartners.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('No partner companies', language) || 'No partner companies'}</h3>
            <p className="text-sm text-gray-500">{t('Click "Add Partner" to create your first partner company.', language) || 'Click "Add Partner" to create your first partner company.'}</p>
          </div>
        )}

        {!loading && filteredPartners.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Logo', language) || 'Logo'}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Company Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Contact Person', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Phone', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Address', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPartners.map((item) => {
                  const id = getField(item, 'PARTNER_ID', 'partner_id');
                  const companyName = getField(item, 'COMPANY_NAME', 'company_name');
                  const contactPerson = getField(item, 'CONTACT_PERSON', 'contact_person');
                  const phone = getField(item, 'PHONE', 'phone');
                  const address = getField(item, 'ADDRESS', 'address');
                  const imageUrl = getImageUrl(item);

                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={companyName}
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 items-center justify-center ${imageUrl ? 'hidden' : 'flex'}`}>
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">#{id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900">{companyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {contactPerson ? (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{contactPerson}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{phone}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {address ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{address}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={t('Edit Partner', language)}
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(item)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('Delete Partner', language)}
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
                {editingItem ? t('Edit Partner', language) : t('Add Partner', language)}
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

              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Company Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder={t('Enter company name', language) || 'Enter company name'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Contact Person', language)}
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder={t('Enter contact person name', language) || 'Enter contact person name'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Phone', language)}
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('Enter phone number', language) || 'Enter phone number'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Address', language)}
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t('Enter address', language) || 'Enter address'}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* ========== Image Upload ========== */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Company Logo / Image', language) || 'Company Logo / Image'}
                </label>
                {imagePreview ? (
                  <div className="relative mb-2">
                    <img
                      src={imagePreview}
                      alt={t('Preview', language) || 'Preview'}
                      className="w-full h-40 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      title={t('Remove image', language) || 'Remove image'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-400 mt-1">{t('Supported formats: JPG, PNG, WEBP (max 2MB)', language) || 'Supported formats: JPG, PNG, WEBP (max 2MB)'}</p>
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
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                  {formSubmitting ? t('Saving', language) : editingItem ? t('Update Partner', language) : t('Save Partner', language) || 'Save Partner'}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Partner', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete this item?', language) || 'Are you sure you want to permanently delete'}{' '}
                <span className="font-medium text-gray-700">
                  {getField(deleteTarget, 'COMPANY_NAME', 'company_name')}
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

export default PartnersPage;