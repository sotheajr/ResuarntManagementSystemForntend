import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle, Loader2, Package,
  Plus, Edit3, Trash2, CheckCircle, RefreshCw,
  Minus, Plus as PlusIcon, TrendingDown, Box, Upload
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'https://restaurant-backend-api-xsjc.onrender.com';

const InventoryPage = () => {
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
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    Ingredient_Name: '',
    Quantity: '',
    Unit: '',
    Minimum_Stock: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Adjust Stock modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockTarget, setStockTarget] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [stockSubmitting, setStockSubmitting] = useState(false);

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
      const [allRes, lowRes] = await Promise.all([
        inventoryAPI.getAll(),
        inventoryAPI.getLowStock(),
      ]);
      setItems(allRes.data?.data || []);
      setLowStockItems(lowRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load inventory', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  // ==================== Filtering ====================
  const filteredItems = items.filter((item) => {
    const term = searchTerm.toLowerCase();
    const name = (item.Ingredient_Name || item.ingredient_name || '').toLowerCase();
    const unit = (item.Unit || item.unit || '').toLowerCase();
    return name.includes(term) || unit.includes(term);
  });

  // ==================== Helpers ====================
  const getField = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return '';
  };

  // ==================== Image file handler ====================
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
    setFormData({ Ingredient_Name: '', Quantity: '', Unit: '', Minimum_Stock: '' });
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      Ingredient_Name: getField(item, 'Ingredient_Name', 'ingredient_name'),
      Quantity: getField(item, 'Quantity', 'quantity'),
      Unit: getField(item, 'Unit', 'unit'),
      Minimum_Stock: getField(item, 'Minimum_Stock', 'minimum_stock'),
    });
    setImageFile(null);
    setFormError(null);
    
    // Set image preview from existing item
    const existingImageUrl = getField(item, 'image_url', 'IMAGE_URL') 
      || getField(item, 'image', 'IMAGE') 
      || getField(item, 'photo', 'PHOTO');
    
    if (existingImageUrl) {
      // If it's already an absolute URL, use it directly
      // Otherwise, prepend the API base URL
      const previewUrl = existingImageUrl.startsWith('http://') || existingImageUrl.startsWith('https://')
        ? existingImageUrl
        : `${API_BASE_URL}/storage/${existingImageUrl.replace(/^\//, '')}`;
      setImagePreview(previewUrl);
    } else {
      setImagePreview(null);
    }
    
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
    if (!formData.Ingredient_Name || formData.Quantity === '' || !formData.Unit || formData.Minimum_Stock === '') {
      setFormError(t('Please fill in all required fields.', language));
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const formPayload = new FormData();
      formPayload.append('ingredient_name', formData.Ingredient_Name);
      formPayload.append('quantity', Number(formData.Quantity));
      formPayload.append('unit', formData.Unit);
      formPayload.append('minimum_stock', Number(formData.Minimum_Stock));

      if (imageFile) {
        formPayload.append('image', imageFile);
      }

      if (editingItem) {
        const id = getField(editingItem, 'inventory_id', 'Inventory_ID');
        if (!id) {
          setFormError(t('Item ID is missing for update', language) || 'Item ID is missing for update');
          setFormSubmitting(false);
          return;
        }
        // Method spoofing: Laravel defines PUT /inventory/{id}; FormData must POST with _method=PUT
        formPayload.append('_method', 'PUT');
        await inventoryAPI.update(id, formPayload);
        showToast('success', t('Item updated successfully!', language));
      } else {
        await inventoryAPI.create(formPayload);
        showToast('success', t('Item created successfully!', language));
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setFormSubmitting(false);
    }
  };

  // ==================== Adjust Stock ====================
  const openStockModal = (item) => {
    setStockTarget(item);
    setAdjustQuantity('');
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setStockTarget(null);
    setAdjustQuantity('');
  };

  const handleStockSubmit = async () => {
    const qty = Number(adjustQuantity);
    if (isNaN(qty) || qty === 0) {
      showToast('error', t('Please enter a valid non-zero quantity.', language));
      return;
    }
    setStockSubmitting(true);
    try {
      const id = getField(stockTarget, 'inventory_id', 'Inventory_ID');
      if (!id) {
        showToast('error', t('Item ID is missing', language) || 'Item ID is missing');
        setStockSubmitting(false);
        return;
      }
      await inventoryAPI.updateStock(id, qty);
      showToast('success', `${t('Stock adjusted by', language)} ${qty >= 0 ? '+' : ''}${qty}`);
      closeStockModal();
      await fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to adjust stock', language));
    } finally {
      setStockSubmitting(false);
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
      const id = getField(deleteTarget, 'Inventory_ID', 'inventory_id');
      await inventoryAPI.delete(id);
      showToast('success', t('Item deleted successfully!', language));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to delete item', language));
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
          <h1 className="text-2xl font-bold text-gray-900">{t('Inventory Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Manage stock levels and ingredient inventory', language)}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" />
          {t('Add Item', language)}
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

      {/* Low Stock Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-800">
                {t('Low Stock Alert', language)} — {lowStockItems.length} {t('item(s) below minimum threshold', language)}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {lowStockItems.map((item, idx) => {
                  const name = getField(item, 'Ingredient_Name', 'ingredient_name');
                  const qty = getField(item, 'Quantity', 'quantity');
                  const unit = getField(item, 'Unit', 'unit');
                  const min = getField(item, 'Minimum_Stock', 'minimum_stock');
                  return (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                      <AlertTriangle className="w-3 h-3" />
                      {name} ({qty} {unit}) — {t('Min', language)}: {min}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">{t('Stock Items', language)}</h3>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('Search inventory...', language)}
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

        {!loading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Box className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('No inventory items', language)}</h3>
            <p className="text-sm text-gray-500">{t('Click "Add Item" to create your first inventory record.', language)}</p>
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Image', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Ingredient', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Quantity', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Unit', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Min. Stock', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => {
                  const id = getField(item, 'Inventory_ID', 'inventory_id');
                  const name = getField(item, 'Ingredient_Name', 'ingredient_name');
                  const qty = Number(getField(item, 'Quantity', 'quantity'));
                  const unit = getField(item, 'Unit', 'unit');
                  const min = Number(getField(item, 'Minimum_Stock', 'minimum_stock'));
                  const isLow = qty <= min;

                  const rawImageUrl = getField(item, 'IMAGE_URL', 'image_url');
                  const rawImage = getField(item, 'IMAGE', 'image');
                  const rawPhoto = getField(item, 'PHOTO', 'photo');
                  
                  // Get the image URL, checking multiple possible field names
                  const imagePath = rawImageUrl || rawImage || rawPhoto;
                  
                  // Build the final image URL
                  // If it's already an absolute URL (e.g., Cloudinary), use it directly
                  // Otherwise, prepend the API base URL for local storage
                  const imageUrl = imagePath
                    ? (imagePath.startsWith('http://') || imagePath.startsWith('https://')
                      ? imagePath
                      : `${API_BASE_URL}/storage/${imagePath.replace(/^\//, '')}`)
                    : null;

                  return (
                    <tr key={id} className={`hover:bg-gray-50 transition-colors ${isLow ? 'bg-red-50/50' : ''}`}>
                      {/* Image thumbnail column */}
                      <td className="px-4 py-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-12 h-12 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}>
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">#{id}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                        {qty}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{unit}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{min}</td>
                      <td className="px-4 py-3 text-right">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" />
                            {t('Low Stock', language)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            {t('In Stock', language)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Adjust Stock */}
                          <button
                            onClick={() => openStockModal(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('Adjust quantity', language)}
                          >
                            <PlusIcon className="w-5 h-5" />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={t('Edit item', language)}
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => confirmDelete(item)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('Delete item', language)}
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
                {editingItem ? t('Edit Inventory Item', language) : t('Add Inventory Item', language)}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Ingredient Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.Ingredient_Name}
                  onChange={(e) => setFormData({ ...formData, Ingredient_Name: e.target.value })}
                  placeholder={t('e.g. Chicken Breast', language)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Quantity', language)} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.Quantity}
                    onChange={(e) => setFormData({ ...formData, Quantity: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Unit', language)} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.Unit}
                    onChange={(e) => setFormData({ ...formData, Unit: e.target.value })}
                    placeholder={t('kg, pieces, liters', language)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Minimum Stock Level', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.Minimum_Stock}
                  onChange={(e) => setFormData({ ...formData, Minimum_Stock: e.target.value })}
                  placeholder={t('Threshold for low-stock alerts', language)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* ========== Image Upload Field ========== */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('Inventory Image', language)}
                </label>
                {imagePreview ? (
                  <div className="relative mb-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      title={t('Remove image', language)}
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
                <p className="text-xs text-gray-400 mt-1">{t('Supported formats: JPG, PNG, WEBP', language)}</p>
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
                    <Package className="w-4 h-4" />
                  )}
                  {formSubmitting ? t('Saving...', language) : editingItem ? t('Update Item', language) : t('Add Item', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Adjust Stock Modal ==================== */}
      {showStockModal && stockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-in">
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{t('Adjust Stock', language)}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {getField(stockTarget, 'Ingredient_Name', 'ingredient_name')} — {t('Current:', language)}{' '}
                  <span className="font-semibold text-gray-700">
                    {getField(stockTarget, 'Quantity', 'quantity')} {getField(stockTarget, 'Unit', 'unit')}
                  </span>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Quantity Change', language)}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAdjustQuantity(String(Number(adjustQuantity || 0) - 1))}
                      className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      placeholder={t('+10 or -5', language)}
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-base text-center outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => setAdjustQuantity(String(Number(adjustQuantity || 0) + 1))}
                      className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('Use positive values to add stock, negative values to deduct.', language)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={closeStockModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('Cancel', language)}
                </button>
                <button
                  onClick={handleStockSubmit}
                  disabled={stockSubmitting || !adjustQuantity}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                >
                  {stockSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {stockSubmitting ? t('Updating...', language) : t('Confirm Adjustment', language)}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Item', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to permanently delete', language)}{' '}
                <span className="font-medium text-gray-700">
                  {getField(deleteTarget, 'Ingredient_Name', 'ingredient_name')}
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

export default InventoryPage;