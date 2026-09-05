import { useState, useEffect, useCallback } from 'react';
import { tablesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getDisplayName } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Plus, Pencil, Trash2, Search, X, AlertTriangle,
  Loader2, Table, Filter, Eye, ImageOff, UtensilsCrossed
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const TablesPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const role = user?.role || '';

  // State
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  // Modal state (Admin only)
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingTable, setEditingTable] = useState(null);

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    table_number: '',
    capacity: '',
    location: '',
    status: 'Available',
    image: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Detail view modal (All roles)
  const [detailTarget, setDetailTarget] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ==================== Fetch Tables ====================
  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tablesAPI.getAll();
      setTables(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // ==================== Filtering ====================
  const filteredTables = tables.filter((table) => {
    const number = String(table.table_number || table.Table_Number || '');
    const location = (table.location || table.Location || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch = number.includes(term) || location.includes(term);
    const status = table.status || table.Status || '';
    const matchesAvailable = showAvailableOnly ? status === 'Available' : true;
    return matchesSearch && matchesAvailable;
  });

  // ==================== Image Helpers ====================
  const getImageUrl = (table) => {
    const img = table.image || table.Image;
    if (!img) return null;
    if (img.startsWith('http')) return img;
    const cleanPath = img.replace(/^\/?storage\//, '');
    return `${API_BASE_URL}/storage/${cleanPath}`;
  };

  // ==================== Form Helpers (Admin only) ====================
  const resetForm = () => {
    setFormData({ table_number: '', capacity: '', location: '', status: 'Available', image: null });
    setFormErrors({});
    setImagePreview(null);
    setEditingTable(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (table) => {
    setModalMode('edit');
    setEditingTable(table);
    setFormData({
      table_number: table.table_number || table.Table_Number || '',
      capacity: table.capacity || table.Capacity || '',
      location: table.location || table.Location || '',
      status: table.status || table.Status || 'Available',
      image: null,
    });
    const img = table.image || table.Image;
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

    if (!formData.table_number) {
      setFormErrors({ table_number: t('Table number is required', language) || 'Table number is required' });
      return;
    }
    if (!formData.capacity || Number(formData.capacity) < 1) {
      setFormErrors({ capacity: t('Capacity must be at least 1', language) || 'Capacity must be at least 1' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('table_number', formData.table_number);
      payload.append('capacity', formData.capacity);
      if (formData.location) payload.append('location', formData.location);
      payload.append('status', formData.status);
      if (formData.image) payload.append('image', formData.image);

      if (modalMode === 'create') {
        await tablesAPI.create(payload);
      } else {
        payload.append('_method', 'PUT');
        const tableId = editingTable.id || editingTable.table_id || editingTable.Table_ID;
        if (!tableId) {
          setFormErrors({ general: t('Table ID is missing for update', language) || 'Table ID is missing for update' });
          setSubmitting(false);
          return;
        }
        await tablesAPI.update(tableId, payload);
      }
      closeModal();
      await fetchTables();
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
  const confirmDelete = (table) => {
    setDeleteTarget(table);
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setDeleteError(null);
    try {
      const tableId = deleteTarget.id || deleteTarget.table_id || deleteTarget.Table_ID;
      if (!tableId) {
        setDeleteError(t('Table ID is missing for delete', language) || 'Table ID is missing for delete');
        return;
      }
      await tablesAPI.delete(tableId);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setDeleteError(null);
      await fetchTables();
    } catch (err) {
      const serverMessage = err.response?.data?.message || t('Operation failed', language);
      setDeleteError(serverMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== Detail View (All roles) ====================
  const openDetailModal = (table) => {
    setDetailTarget(table);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailTarget(null);
  };

  // ==================== Helpers ====================
  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'available') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
        {t('Available', language)}
      </span>
    );
  }
  if (s === 'occupied' || s === 'in use') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
        {t('Occupied', language)}
      </span>
    );
  }
  if (s === 'reserved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        {t('Reserved', language)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
      {status || t('Unknown', language) || 'Unknown'}
    </span>
  );
  };

  const getTableNumber = (table) => table.table_number || table.Table_Number;
  const getTableName = (table) => getDisplayName(table, 'table_number', 'TABLE_NAME_KH', language) || table.table_number || table.Table_Number;
  const getCapacity = (table) => table.capacity || table.Capacity;
  const getLocation = (table) => table.location || table.Location;
  const getStatus = (table) => table.status || table.Status;
  const getTableId = (table) => table.table_id || table.Table_ID;

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Tables Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? t('Manage your restaurant tables', language)
              : t('Browse restaurant tables and view live availability status', language) || 'Browse restaurant tables and view live availability status'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
          >
            <Plus className="w-4 h-4" />
            {t('Add New Table', language)}
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
            placeholder={t('Search tables...', language)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => setShowAvailableOnly(!showAvailableOnly)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
            showAvailableOnly
              ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          {showAvailableOnly ? t('Showing Available Only', language) || 'Showing Available Only' : t('Show Available Only', language) || 'Show Available Only'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredTables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Table className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">
            {searchTerm || showAvailableOnly ? t('No tables found', language) || 'No tables found' : t('No tables yet', language) || 'No tables yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm
              ? t('Try adjusting your search term', language) || 'Try adjusting your search term'
              : showAvailableOnly
                ? t('No available tables at the moment', language) || 'No available tables at the moment'
                : t('Get started by adding your first restaurant table', language) || 'Get started by adding your first restaurant table'}
          </p>
          {isAdmin && !searchTerm && !showAvailableOnly && (
            <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Plus className="w-4 h-4" />
              {t('Add New Table', language)}
            </button>
          )}
        </div>
      )}

      {/* Tables Grid */}
      {!loading && filteredTables.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.map((table) => {
            const tableId = getTableId(table);
            const tableNumber = getTableNumber(table);
            const capacity = getCapacity(table);
            const location = getLocation(table);
            const status = getStatus(table);
            const imgUrl = getImageUrl(table);

            return (
              <div
                key={tableId}
                className="card hover:shadow-md transition-shadow duration-200 group overflow-hidden"
              >
                {/* Card Image Header */}
                <div className="relative h-36 bg-gray-100 overflow-hidden">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={`${t('Table', language)} #${tableNumber}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                    imgUrl ? 'hidden' : 'flex'
                  }`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-2 ${
                      (status || '').toLowerCase() === 'available'
                        ? 'bg-gradient-to-br from-green-500 to-green-600'
                        : (status || '').toLowerCase() === 'occupied'
                          ? 'bg-gradient-to-br from-red-500 to-red-600'
                          : (status || '').toLowerCase() === 'reserved'
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                            : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                      {tableNumber}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{t('Table', language)} #{tableNumber}</p>
                  </div>

                  {/* Status badge overlay */}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(status)}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {language === 'kh' ? (table.TABLE_NAME_KH || table.table_name_kh || `${t('Table', language)} #${tableNumber}`) : `${t('Table', language)} #${tableNumber}`}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {capacity} {Number(capacity) === 1 ? t('seat', language) || 'seat' : t('seats', language) || 'seats'}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="mb-3">
                    {location ? (
                      <p className="text-sm text-gray-600">
                        <span className="text-gray-400">{t('Location', language)}:</span> {location}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">{t('No location specified', language) || 'No location specified'}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openDetailModal(table)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={t('View Details', language)}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => openEditModal(table)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('Edit Table', language)}
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => confirmDelete(table)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('Delete Table', language)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-gray-100 shadow-sm mb-4 flex-shrink-0">
                  {(() => {
                    const imgUrl = getImageUrl(detailTarget);
                    return imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={`${t('Table', language)} #${getTableNumber(detailTarget)}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        (getStatus(detailTarget) || '').toLowerCase() === 'available'
                          ? 'bg-gradient-to-br from-green-500 to-green-600'
                          : (getStatus(detailTarget) || '').toLowerCase() === 'occupied'
                            ? 'bg-gradient-to-br from-red-500 to-red-600'
                            : (getStatus(detailTarget) || '').toLowerCase() === 'reserved'
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                              : 'bg-gradient-to-br from-gray-500 to-gray-600'
                      }`}>
                        <span className="text-white font-bold text-4xl">
                          {getTableNumber(detailTarget)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {t('Table', language)} #{getTableNumber(detailTarget)}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 mb-3">
                  {t('ID', language)}: {getTableId(detailTarget)}
                </span>
                <div className="mb-3">
                  {getStatusBadge(getStatus(detailTarget))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-5 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-600">{t('Capacity', language)}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {getCapacity(detailTarget)} {Number(getCapacity(detailTarget)) === 1 ? t('seat', language) || 'seat' : t('seats', language) || 'seats'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-600">{t('Location', language)}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {getLocation(detailTarget) || (
                      <span className="text-gray-400 italic">{t('Not specified', language) || 'Not specified'}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-600">{t('Status', language)}</span>
                  <span className="text-sm font-semibold text-gray-900 capitalize">
                    {(getStatus(detailTarget) || t('Unknown', language) || 'Unknown').toLowerCase()}
                  </span>
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
                {modalMode === 'create' ? t('Add New Table', language) : t('Edit Table', language)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Table Number', language)} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="table_number"
                    value={formData.table_number}
                    onChange={handleInputChange}
                    placeholder={t('e.g. 5', language) || 'e.g. 5'}
                    min="1"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.table_number ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.table_number && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.table_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Capacity', language)} ({t('Seats', language) || 'Seats'}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    placeholder={t('e.g. 4', language) || 'e.g. 4'}
                    min="1"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.capacity ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.capacity && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.capacity}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Location', language)}</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder={t('e.g. Main Hall, VIP Room, Outdoor Patio', language) || 'e.g. Main Hall, VIP Room, Outdoor Patio'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">{t('Optional — specify where the table is located', language) || 'Optional — specify where the table is located'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Status', language)}</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Available">{t('Available', language)}</option>
                  <option value="Occupied">{t('Occupied', language)}</option>
                  <option value="Reserved">{t('Reserved', language)}</option>
                </select>
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Table Image', language) || 'Table Image'}</label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt={t('Preview', language) || 'Preview'}
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
                  {modalMode === 'create' ? t('Create Table', language) || 'Create Table' : t('Update Table', language) || 'Update Table'}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Table', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete this item?', language) || 'Are you sure you want to delete'}
                <span className="font-medium text-gray-700">
                  {' "'}{language === 'kh' ? (deleteTarget.TABLE_NAME_KH || deleteTarget.table_name_kh || `${t('Table', language)} #${deleteTarget.table_number || deleteTarget.Table_Number}`) : `${t('Table', language)} #${deleteTarget.table_number || deleteTarget.Table_Number}`}{'"'}
                </span>?
              </p>
              <p className="text-xs text-red-500">
                {t('This action cannot be undone.', language)} {t('Active orders or reservations linked to this table may be affected.', language) || 'Active orders or reservations linked to this table may be affected.'}
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

export default TablesPage;