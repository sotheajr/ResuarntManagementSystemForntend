import { useState, useEffect, useCallback } from 'react';
import { menuAPI, categoriesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getDisplayName } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Plus, Pencil, Trash2, Search, X, AlertTriangle,
  Loader2, UtensilsCrossed, ImageOff, Eye, Filter
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const MenuItemsPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const role = user?.role || '';

  // State
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  // Details modal (All roles)
  const [detailItem, setDetailItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Create/Edit modal (Admin only)
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    category_id: '',
    menu_name: '',
    price: '',
    description: '',
    status: 'Available',
    discount_percent: '0',
    image: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ==================== Fetch Data ====================
  const fetchMenuItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = showAvailableOnly ? await menuAPI.getAvailable() : await menuAPI.getAll();
      setMenuItems(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [showAvailableOnly, language]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoriesAPI.getAll();
      setCategories(response.data?.data || []);
    } catch (err) {
      // Silent fail — categories are supplemental
    }
  }, []);

  useEffect(() => {
    fetchMenuItems();
    fetchCategories();
  }, [fetchMenuItems, fetchCategories]);

  // ==================== Filtering ====================
  const filteredItems = menuItems.filter((item) => {
    const name = (item.menu_name || item.Menu_Name || '').toLowerCase();
    const catName = (item.category?.category_name || item.category?.CATEGORY_NAME || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || catName.includes(term);
  });

  // ==================== Helpers ====================
  const getField = (obj, ...keys) => {
    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined && val !== null) return val;
    }
    return '';
  };

  const getImageUrl = (item) => {
    const img = item.image || item.Image;
    if (!img) return null;
    if (img.startsWith('http')) return img;
    const cleanPath = img.replace(/^\/?storage\//, '');
    return `${API_BASE_URL}/storage/${cleanPath}`;
  };

  const getCategoryName = (item) => {
    // Strategy 1: Try the eager-loaded category relation
    if (item.category) {
      const name = item.category.category_name || item.category.CATEGORY_NAME || item.category.Category_Name;
      if (name) return name;
    }

    // Strategy 2: Cross-reference from the categories state array by numeric ID
    // Get the category_id from the item — it could be camelCase, PascalCase, or UPPER
    const itemCatId = Number(item.category_id ?? item.Category_ID ?? item.CATEGORY_ID);
    
    if (itemCatId > 0 && categories.length > 0) {
      // Try matching against each category in the list — check all key casings
      const matched = categories.find((cat) => {
        const catId = Number(cat.category_id ?? cat.Category_ID ?? cat.CATEGORY_ID ?? cat.categoryid);
        return catId === itemCatId;
      });
      if (matched) {
        return matched.category_name || matched.CATEGORY_NAME || matched.Category_Name || matched.name || '';
      }
    }

    return '';
  };

  // ==================== Status Toggle (Admin only) ====================
  const [togglingStatus, setTogglingStatus] = useState(null);

  const handleToggleStatus = async (item) => {
    const itemId = item.menu_id || item.Menu_ID;
    const currentStatus = item.status || item.Status || 'Available';
    const newStatus = currentStatus === 'Available' ? 'Unavailable' : 'Available';

    // Optimistic UI update
    setMenuItems((prev) =>
      prev.map((m) => {
        if ((m.menu_id ?? m.Menu_ID) === itemId) {
          return { ...m, status: newStatus, Status: newStatus };
        }
        return m;
      })
    );

    setTogglingStatus(itemId);
    try {
      const payload = new FormData();
      payload.append('status', newStatus);
      payload.append('_method', 'PUT');
      await menuAPI.update(itemId, payload);
    } catch (err) {
      // Revert on failure
      setMenuItems((prev) =>
        prev.map((m) => {
          if ((m.menu_id ?? m.Menu_ID) === itemId) {
            return { ...m, status: currentStatus, Status: currentStatus };
          }
          return m;
        })
      );
      setError(t('Operation failed', language));
    } finally {
      setTogglingStatus(null);
    }
  };

  // ==================== Detail Modal (All roles) ====================
  const openDetail = (item) => {
    setDetailItem(item);
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setDetailItem(null);
  };

  // ==================== Form Helpers (Admin only) ====================
  const resetForm = () => {
    setFormData({
      category_id: '',
      menu_name: '',
      price: '',
      description: '',
      status: 'Available',
      discount_percent: '0',
      image: null,
    });
    setFormErrors({});
    setImagePreview(null);
    setEditingItem(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormMode('create');
    setShowFormModal(true);
  };

  const openEditForm = (item) => {
    setFormMode('edit');
    setEditingItem(item);
    setFormData({
      category_id: String(item.category_id ?? item.Category_ID ?? ''),
      menu_name: item.menu_name || item.Menu_Name || '',
      price: String(item.price ?? item.Price ?? ''),
      description: item.description || item.Description || '',
      status: item.status || item.Status || 'Available',
      discount_percent: String(item.discount_percent ?? item.Discount_Percent ?? '0'),
      image: null,
    });
    const img = item.image || item.Image;
    if (img) {
      const cleanPath = img.startsWith('http') ? img : `${API_BASE_URL}/storage/${img.replace(/^\/?storage\//, '')}`;
      setImagePreview(cleanPath);
    } else {
      setImagePreview(null);
    }
    setFormErrors({});
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));
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

    if (!formData.menu_name.trim()) {
      setFormErrors({ menu_name: t('Item name is required', language) });
      return;
    }
    if (!formData.category_id) {
      setFormErrors({ category_id: t('Category is required', language) });
      return;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      setFormErrors({ price: t('Valid price is required', language) });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('category_id', formData.category_id);
      payload.append('menu_name', formData.menu_name.trim());
      payload.append('price', formData.price);
      payload.append('description', formData.description || '');
      payload.append('status', formData.status);
      payload.append('discount_percent', formData.discount_percent || '0');
      if (formData.image) payload.append('image', formData.image);

      if (formMode === 'create') {
        await menuAPI.create(payload);
      } else {
        payload.append('_method', 'PUT');
        const itemId = editingItem.menu_id || editingItem.Menu_ID;
        await menuAPI.update(itemId, payload);
      }

      closeFormModal();
      await fetchMenuItems();
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
  const confirmDelete = (item) => {
    setDeleteTarget(item);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const itemId = deleteTarget.menu_id || deleteTarget.Menu_ID;
      await menuAPI.delete(itemId);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchMenuItems();
    } catch (err) {
      setError(err.response?.data?.message || t('Operation failed', language));
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Menu Items Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'Admin'
              ? t('Manage all food & beverage items — create, edit, delete, and view details', language)
              : t('Browse the menu and view item details', language)}
          </p>
        </div>
        {/* "Add New Menu Item" — Admin ONLY */}
        {isAdmin && (
          <button
            onClick={openCreateForm}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
          >
            <Plus className="w-4 h-4" />
            {t('Add New Menu Item', language)}
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

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('Search menu items...', language)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => setShowAvailableOnly(!showAvailableOnly)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
            showAvailableOnly
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          {showAvailableOnly ? t('Showing Available Only', language) : t('Show All Items', language)}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">
            {searchTerm ? t('No menu items found', language) : t('No menu items yet', language)}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm
              ? t('Try adjusting your search term', language)
              : t('Get started by adding your first menu item', language)}
          </p>
          {isAdmin && !searchTerm && (
            <button onClick={openCreateForm} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Plus className="w-4 h-4" />
              {t('Add New Menu Item', language)}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filteredItems.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Image', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Name', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Category', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Price', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => {
                  const itemId = item.menu_id || item.Menu_ID;
                  const name = item.menu_name || item.Menu_Name;
                  const price = item.price ?? item.Price;
                  const status = item.status || item.Status || 'Available';
                  const discount = item.discount_percent ?? item.Discount_Percent ?? 0;
                  const imgUrl = getImageUrl(item);
                  const catName = getCategoryName(item);

                  return (
                    <tr key={itemId} className="hover:bg-gray-50 transition-colors">
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
                        <div className="font-semibold text-gray-900">{getDisplayName(item, 'menu_name', 'NAME_KH', language) || name}</div>
                        <div className="text-xs text-gray-400">{language === 'kh' ? '' : (item.NAME_KH || item.name_kh || item.Name_KH || '')}</div>
                        {(item.description || item.Description || item.DESCRIPTION_KH || item.description_kh) ? (
                          <p className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">
                            {language === 'kh' ? (item.DESCRIPTION_KH || item.description_kh || item.description || item.Description) : (item.description || item.Description)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{catName || '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {parseFloat(discount) > 0 ? (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm text-gray-400 line-through">
                                ${parseFloat(price).toFixed(2)}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">
                                -{discount}%
                              </span>
                            </div>
                            <span className="text-base font-bold text-red-500">
                              ${(parseFloat(price) * (1 - parseFloat(discount) / 100)).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">
                            ${parseFloat(price).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => handleToggleStatus(item)}
                            disabled={togglingStatus === itemId}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                              status === 'Available'
                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                            } disabled:opacity-50 disabled:cursor-wait`}
                            title={`${t('Click to mark as', language)} ${status === 'Available' ? t('Unavailable', language) : t('Available', language)}`}
                          >
                            {togglingStatus === itemId && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            {status === 'Available' ? t('Available', language) : t('Unavailable', language)}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              status === 'Available'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {status === 'Available' ? t('Available', language) : t('Unavailable', language)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Details — ALL roles */}
                          <button
                            onClick={() => openDetail(item)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('View details', language)}
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          {/* Edit — Admin ONLY */}
                          {isAdmin && (
                            <button
                              onClick={() => openEditForm(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={t('Edit item', language)}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          )}

                          {/* Delete — Admin ONLY */}
                          {isAdmin && (
                            <button
                              onClick={() => confirmDelete(item)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('Delete item', language)}
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

      {/* ==================== Detail Modal (All roles) ==================== */}
      {showDetail && detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-end px-6 pt-6">
              <button
                onClick={closeDetail}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pb-6">
              {/* Image */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-gray-100 shadow-sm mb-4">
                  {(() => {
                    const imgUrl = getImageUrl(detailItem);
                    return imgUrl ? (
                      <img src={imgUrl} alt={detailItem.menu_name || detailItem.Menu_Name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                        <UtensilsCrossed className="w-12 h-12 text-white" />
                      </div>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {getDisplayName(detailItem, 'menu_name', 'NAME_KH', language) || detailItem.menu_name || detailItem.Menu_Name}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 mb-3">
                  ID: {detailItem.menu_id || detailItem.Menu_ID}
                </span>
                {(() => {
                  const detailPrice = parseFloat(detailItem.price ?? detailItem.Price);
                  const detailDiscount = parseFloat(detailItem.discount_percent ?? detailItem.Discount_Percent ?? 0);
                  return (
                    <div className="flex items-center gap-2 mb-3">
                      {detailDiscount > 0 ? (
                        <>
                          <span className="text-sm text-gray-400 line-through">
                            ${detailPrice.toFixed(2)}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">
                            -{detailDiscount}%
                          </span>
                          <span className="text-lg font-bold text-red-500">
                            ${(detailPrice * (1 - detailDiscount / 100)).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-gray-900">
                          ${detailPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    (detailItem.status || detailItem.Status) === 'Available'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {(detailItem.status || detailItem.Status) === 'Available' ? t('Available', language) : t('Unavailable', language)}
                </span>
              </div>

              {/* Info grid */}
              <div className="border-t border-gray-200 pt-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('Category', language)}</span>
                  <span className="text-sm font-medium text-gray-900">{getCategoryName(detailItem) || '—'}</span>
                </div>
                {(detailItem.description || detailItem.Description || detailItem.DESCRIPTION_KH || detailItem.description_kh) && (
                  <div>
                    <span className="text-sm text-gray-500 block mb-1">{t('Description', language)}</span>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                      {language === 'kh' ? (detailItem.DESCRIPTION_KH || detailItem.description_kh || detailItem.description || detailItem.Description) : (detailItem.description || detailItem.Description)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeDetail}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('Close', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Create/Edit Form Modal (Admin only) ==================== */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {formMode === 'create' ? t('Add New Menu Item', language) : t('Edit Menu Item', language)}
              </h2>
              <button onClick={closeFormModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formErrors.general}</div>
              )}

              {/* Menu Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Item Name', language)} <span className="text-red-500">*</span></label>
                <input type="text" name="menu_name" value={formData.menu_name} onChange={handleInputChange}
                  placeholder={t('e.g. Margherita Pizza', language)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.menu_name ? 'border-red-400' : 'border-gray-300'}`}
                />
                {formErrors.menu_name && <p className="mt-1 text-xs text-red-500">{formErrors.menu_name}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category', language)} <span className="text-red-500">*</span></label>
                <select name="category_id" value={formData.category_id} onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.category_id ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">{t('Select a category', language)}</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id || cat.Category_ID} value={cat.category_id || cat.Category_ID}>
                      {cat.category_name || cat.Category_Name}
                    </option>
                  ))}
                </select>
                {formErrors.category_id && <p className="mt-1 text-xs text-red-500">{formErrors.category_id}</p>}
              </div>

              {/* Price + Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Price', language)} <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" min="0" name="price" value={formData.price} onChange={handleInputChange}
                    placeholder="0.00"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.price ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.price && <p className="mt-1 text-xs text-red-500">{formErrors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Discount %', language)}</label>
                  <input type="number" step="1" min="0" max="100" name="discount_percent" value={formData.discount_percent} onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Status', language)}</label>
                <select name="status" value={formData.status} onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Available">{t('Available', language)}</option>
                  <option value="Unavailable">{t('Unavailable', language)}</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description', language)}</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange}
                  placeholder={t('Optional description', language)} rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Image', language)}</label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                      <button type="button" onClick={removeImage}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      ><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <ImageOff className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <label className="cursor-pointer px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    {t('Choose Image', language)}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">{t('Allowed: jpeg, png, jpg, gif, webp (max 2MB)', language)}</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeFormModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >{t('Cancel', language)}</button>
                <button type="submit" disabled={submitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formMode === 'create' ? t('Create Item', language) : t('Update Item', language)}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Menu Item', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete', language)}
                <span className="font-medium text-gray-700">
                  {' "'}{getDisplayName(deleteTarget, 'menu_name', 'NAME_KH', language) || deleteTarget.menu_name || deleteTarget.Menu_Name}{'"'}
                </span>?
              </p>
              <p className="text-xs text-red-500">{t('This action cannot be undone.', language)}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >{t('Cancel', language)}</button>
              <button onClick={handleDelete} disabled={submitting}
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

export default MenuItemsPage;