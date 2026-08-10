import { useState, useEffect, useCallback } from 'react';
import { categoriesAPI, subCategoriesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getDisplayName } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Plus, Pencil, Trash2, Search, X, AlertTriangle,
  Loader2, FolderTree, ImageOff, Eye, ChevronDown, ChevronRight
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const CategoriesPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const role = user?.role || '';

  // State
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state (Admin only)
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingCategory, setEditingCategory] = useState(null);

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
    image: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // New sub-categories input (Create modal only)
  const [newSubCategoryInput, setNewSubCategoryInput] = useState('');
  const [newSubCategories, setNewSubCategories] = useState([]);

  // Sub-categories drawer (All roles)
  const [subDrawerCategory, setSubDrawerCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subDrawerOpen, setSubDrawerOpen] = useState(false);

  // ==================== Fetch Categories ====================
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await categoriesAPI.getAll();
      setCategories(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ==================== Filtering ====================
  const filteredCategories = categories.filter((cat) => {
    const name = (cat.category_name || cat.Category_Name || cat.NAME_KH || cat.name_kh || '').toLowerCase();
    const desc = (cat.description || cat.Description || cat.DESCRIPTION_KH || cat.description_kh || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || desc.includes(term);
  });

  // ==================== Sub-categories Drawer ====================
  const openSubDrawer = async (category) => {
    setSubDrawerCategory(category);
    setSubDrawerOpen(true);
    setSubLoading(true);
    try {
      const catId = category.category_id || category.Category_ID;
      console.log("Fetching sub-categories for ID:", catId);
      const response = await categoriesAPI.getSubCategories(catId);
      console.log("Sub-categories API Response:", response.data);
      // Normalize: handle both response.data.data (paginated wrapper) and direct array
      const rawData = response.data?.data ?? response.data ?? [];
      const normalized = Array.isArray(rawData) ? rawData : [];
      console.log("Normalized sub-categories array:", normalized);
      setSubCategories(normalized);
    } catch (err) {
      console.error("Failed to fetch sub-categories:", err);
      setSubCategories([]);
    } finally {
      setSubLoading(false);
    }
  };

  const closeSubDrawer = () => {
    setSubDrawerOpen(false);
    setSubDrawerCategory(null);
    setSubCategories([]);
  };

  // ==================== Form Helpers (Admin only) ====================
  const resetForm = () => {
    setFormData({ category_name: '', description: '', image: null });
    setFormErrors({});
    setImagePreview(null);
    setEditingCategory(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setNewSubCategories([]);
    setNewSubCategoryInput('');
    setShowModal(true);
  };

  const openEditModal = (category) => {
    setModalMode('edit');
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name || category.Category_Name || '',
      description: category.description || category.Description || '',
      image: null,
    });
    const img = category.image || category.Image;
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

  // ==================== Sub-category Chip Input (Create only) ====================
  const handleAddSubCategoryTag = () => {
    const trimmed = newSubCategoryInput.trim();
    if (trimmed && !newSubCategories.includes(trimmed)) {
      setNewSubCategories((prev) => [...prev, trimmed]);
      setNewSubCategoryInput('');
    }
  };

  const handleSubCategoryInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubCategoryTag();
    }
  };

  const handleRemoveSubCategoryTag = (index) => {
    setNewSubCategories((prev) => prev.filter((_, i) => i !== index));
  };

  // ==================== Submit (Admin only) ====================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category_name.trim()) {
      setFormErrors({ category_name: t('Category name is required', language) });
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        const payload = new FormData();
        payload.append('category_name', formData.category_name.trim());
        if (formData.description) payload.append('description', formData.description.trim());
        if (formData.image) payload.append('image', formData.image);
        if (newSubCategories.length > 0) {
          payload.append('sub_categories', JSON.stringify(newSubCategories));
        }
        await categoriesAPI.create(payload);
      } else {
        const payload = new FormData();
        payload.append('category_name', formData.category_name.trim());
        payload.append('description', formData.description || '');
        if (formData.image) payload.append('image', formData.image);
        payload.append('_method', 'PUT');
        const catId = editingCategory.category_id || editingCategory.Category_ID;
        await categoriesAPI.update(catId, payload);
      }
      closeModal();
      await fetchCategories();
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
  const confirmDelete = (category) => {
    setDeleteTarget(category);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const catId = deleteTarget.category_id || deleteTarget.Category_ID;
      await categoriesAPI.delete(catId);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || t('Operation failed', language));
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== Helpers ====================
  const getImageUrl = (category) => {
    const img = category.image || category.Image;
    if (!img) return null;
    if (img.startsWith('http')) return img;
    const cleanPath = img.replace(/^\/?storage\//, '');
    return `${API_BASE_URL}/storage/${cleanPath}`;
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Categories Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'Admin'
              ? t('Manage menu categories — create, edit, delete, and view sub-categories', language)
              : t('Browse menu categories and view sub-categories', language)}
          </p>
        </div>
        {/* "Create New Category" — Admin ONLY */}
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
          >
            <Plus className="w-4 h-4" />
            {t('Create New Category', language)}
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
          placeholder={t('Search categories...', language)}
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
      {!loading && !error && filteredCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <FolderTree className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">
            {searchTerm ? t('No categories found', language) : t('No categories yet', language)}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm
              ? t('Try adjusting your search term', language)
              : t('Get started by creating your first menu category', language)}
          </p>
          {/* "Create" button in empty state — Admin ONLY */}
          {isAdmin && !searchTerm && (
            <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Plus className="w-4 h-4" />
              {t('Create New Category', language)}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filteredCategories.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Image', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Description', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.map((category) => {
                  const catId = category.category_id || category.Category_ID;
                  const name = category.category_name || category.Category_Name;
                  const description = category.description || category.Description;
                  const imgUrl = getImageUrl(category);

                  return (
                    <tr key={catId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={name}
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-12 h-12 rounded-lg bg-gray-100 items-center justify-center border border-gray-200 ${imgUrl ? 'hidden' : 'flex'}`}
                        >
                          <ImageOff className="w-5 h-5 text-gray-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{getDisplayName(category, 'category_name', 'NAME_KH', language) || name}</div>
                        <div className="text-xs text-gray-400">{language === 'kh' ? '' : (category.NAME_KH || category.name_kh || category.Name_KH || '')}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {language === 'kh' ? (category.DESCRIPTION_KH || category.description_kh || description || <span className="text-gray-400 italic">{t('No description', language)}</span>) : (description || <span className="text-gray-400 italic">{t('No description', language)}</span>)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* "View Sub-categories" — ALL roles (Admin, Waiter, Cashier) */}
                          <button
                            onClick={() => openSubDrawer(category)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('View sub-categories', language)}
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          {/* Edit (Pencil) — Admin ONLY */}
                          {isAdmin && (
                            <button
                              onClick={() => openEditModal(category)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={t('Edit category', language)}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          )}

                          {/* Delete (Trash) — Admin ONLY */}
                          {isAdmin && (
                            <button
                              onClick={() => confirmDelete(category)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('Delete category', language)}
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

      {/* ==================== Category Details Modal (All roles) ==================== */}
      {subDrawerOpen && subDrawerCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in">
            {/* Modal Header — X close */}
            <div className="flex items-center justify-end px-6 pt-6">
              <button
                onClick={closeSubDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 pb-6">
              {/* ===== Category Profile ===== */}
              <div className="flex flex-col items-center text-center mb-6">
                {/* Category Image / Avatar */}
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-gray-100 shadow-sm mb-4 flex-shrink-0">
                  {(() => {
                    const imgUrl = getImageUrl(subDrawerCategory);
                    return imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={subDrawerCategory.category_name || subDrawerCategory.Category_Name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <FolderTree className="w-10 h-10 text-white" />
                      </div>
                    );
                  })()}
                </div>

                {/* Category Name */}
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {getDisplayName(subDrawerCategory, 'category_name', 'NAME_KH', language) || subDrawerCategory.category_name || subDrawerCategory.Category_Name}
                </h2>

                {/* Category ID */}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 mb-3">
                  ID: {subDrawerCategory.category_id || subDrawerCategory.Category_ID}
                </span>

                {/* Category Description */}
                {(subDrawerCategory.description || subDrawerCategory.Description || subDrawerCategory.DESCRIPTION_KH || subDrawerCategory.description_kh) ? (
                  <p className="text-sm text-gray-600 max-w-md leading-relaxed">
                    {language === 'kh' ? (subDrawerCategory.DESCRIPTION_KH || subDrawerCategory.description_kh || subDrawerCategory.description || subDrawerCategory.Description) : (subDrawerCategory.description || subDrawerCategory.Description)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">{language === 'kh' ? t('No description', language) : t('No description', language)}</p>
                )}
              </div>

              {/* ===== Divider ===== */}
              <div className="border-t border-gray-200 pt-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  <h3 className="text-base font-semibold text-gray-900">{t('Sub-categories', language)}</h3>
                </div>

                {/* Sub-categories Content */}
                {subLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                  </div>
                ) : subCategories && subCategories.length > 0 ? (
                  <div className="space-y-2">
                    {subCategories.map((sub, index) => {
                      // Oracle with yajra/oci8 returns lowercase keys
                      const subId = sub.sub_category_id ?? sub.Sub_Category_ID ?? index;
                      const subName = sub.sub_category_name || sub.Sub_Category_Name || sub.sub_category_name || '';
                      const subDesc = sub.description || sub.Description || '';
                      return (
                        <div
                          key={subId}
                          className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{getDisplayName(sub, 'sub_category_name', 'NAME_KH', language) || subName}</p>
                            {subDesc && (
                              <p className="text-xs text-gray-500 mt-0.5">{subDesc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <FolderTree className="w-6 h-6 text-gray-400" />
                    </div>
                  <p className="text-sm text-gray-500">
                    {t('No sub-categories assigned to this category.', language)}
                  </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeSubDrawer}
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
                {modalMode === 'create' ? t('Create New Category', language) : t('Edit Category', language)}
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
                  {t('Category Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="category_name"
                  value={formData.category_name}
                  onChange={handleInputChange}
                  placeholder={t('e.g. Main Course', language)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.category_name ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {formErrors.category_name && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.category_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description', language)}</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('Optional description', language)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Image', language)}</label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-lg object-cover border border-gray-200"
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
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <ImageOff className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <label className="cursor-pointer px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    {t('Choose Image', language)}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">{t('Allowed: jpeg, png, jpg, gif, webp (max 2MB)', language)}</p>
                {formErrors.image && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.image}</p>
                )}
              </div>

              {/* Sub-categories (Create only) */}
              {modalMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Sub-categories', language)} <span className="text-gray-400 font-normal">({t('Optional', language)})</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubCategoryInput}
                      onChange={(e) => setNewSubCategoryInput(e.target.value)}
                      onKeyDown={handleSubCategoryInputKeyDown}
                      placeholder={t('Type sub-category name and press Enter', language)}
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubCategoryTag}
                      className="px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
                    >
                      {t('+ Add', language)}
                    </button>
                  </div>
                  {newSubCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {newSubCategories.map((name, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-blue-100 text-blue-700"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubCategoryTag(index)}
                            className="text-blue-400 hover:text-blue-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {t('Add sub-categories to organize menu items under this category', language)}
                  </p>
                </div>
              )}

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
                  {modalMode === 'create' ? t('Create Category', language) : t('Update Category', language)}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Category', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete', language)}
                <span className="font-medium text-gray-700">
                  {' "'}{getDisplayName(deleteTarget, 'category_name', 'NAME_KH', language) || deleteTarget.category_name || deleteTarget.Category_Name}{'"'}
                </span>?
              </p>
              <p className="text-xs text-red-500">
                {t('This action cannot be undone. Menu items under this category may be affected.', language)}
              </p>
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

export default CategoriesPage;