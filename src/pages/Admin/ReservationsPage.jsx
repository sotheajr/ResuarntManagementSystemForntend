import { useState, useEffect, useCallback } from 'react';
import { reservationsAPI, customersAPI, tablesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Plus, Trash2, Search, X, AlertTriangle,
  Loader2, CalendarDays, Eye, CheckCircle,
  DoorOpen, Pencil, Ban, CalendarRange, IdCard
} from 'lucide-react';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  Seated: 'bg-green-100 text-green-700 border-green-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
  'No Show': 'bg-gray-100 text-gray-600 border-gray-200',
};

const ReservationsPage = () => {
  const { user, isAdmin, isWaiter, isCashier } = useAuth();
  const { language } = useLanguage();
  const role = user?.role || '';
  const roleId = user?.role_id || user?.Role_ID;
  const canManageAll = isAdmin || isCashier;  // Admin (1) & Cashier (3) manage reservations
  const canDelete = isAdmin;                  // Admin (1) only

  // Tab state — only meaningful for Admin/Cashier
  const [activeTab, setActiveTab] = useState('all');

  // Data state
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Detail modal
  const [detailReservation, setDetailReservation] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Waiter lookup state
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  // Create/Edit modal (Admin/Cashier only)
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingReservation, setEditingReservation] = useState(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    table_id: '',
    reservation_date: '',
    guest_number: '2',
    status: 'Pending',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reference data for forms (also used for cross-referencing table rows)
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ==================== Resolve Customer Name (Oracle UPPERCASE / lowercase fallback) ====================
  const resolveCustomerName = (reservation) => {
    if (!reservation) return '—';
    // Strategy 1: Nested eager-loaded customer relation (Oracle returns lowercase)
    const nested =
      reservation.customer?.customer_name ||
      reservation.customer?.Customer_Name ||
      reservation.customer?.name ||
      null;
    if (nested) return nested;
    // Strategy 2: Direct property on the reservation row
    const direct = reservation.customer_name || reservation.Customer_Name || null;
    if (direct) return direct;
    // Strategy 3: Cross-reference by CUSTOMER_ID against the fetched customers array
    const custId = reservation.customer_id ?? reservation.Customer_ID ?? reservation.customer?.customer_id ?? reservation.customer?.Customer_ID;
    if (custId && customers.length > 0) {
      const matched = customers.find((c) => {
        const cId = c.customer_id ?? c.Customer_ID ?? c.id;
        return Number(cId) === Number(custId);
      });
      if (matched) {
        return matched.customer_name || matched.Customer_Name || matched.name || '—';
      }
    }
    return '—';
  };

  // ==================== Resolve Table Label (Oracle UPPERCASE / lowercase fallback) ====================
  const resolveTableLabel = (reservation) => {
    if (!reservation) return '—';
    // Strategy 1: Nested eager-loaded table relation (Oracle returns lowercase)
    const nested =
      reservation.table?.table_number ||
      reservation.table?.Table_Number ||
      reservation.table?.number ||
      null;
    if (nested) return `${t('Table', language)} ${nested}`;
    // Strategy 2: Direct property on the reservation row
    const direct = reservation.table_number || reservation.Table_Number || null;
    if (direct) return `${t('Table', language)} ${direct}`;
    // Strategy 3: Cross-reference by TABLE_ID against the fetched tables array
    const tblId = reservation.table_id ?? reservation.Table_ID ?? reservation.table?.table_id ?? reservation.table?.Table_ID;
    if (tblId && tables.length > 0) {
      const matched = tables.find((t) => {
        const tId = t.table_id ?? t.Table_ID ?? t.id;
        return Number(tId) === Number(tblId);
      });
      if (matched) {
        const num = matched.table_number || matched.Table_Number || matched.number || '';
        return num ? `${t('Table', language)} ${num}` : '—';
      }
    }
    return '—';
  };

  // ==================== Fetch Reservations (Admin/Cashier only) ====================
  const fetchReservations = useCallback(async () => {
    if (!canManageAll) return;
    setLoading(true);
    setError(null);
    try {
      let response;
      switch (activeTab) {
        case 'today':
          response = await reservationsAPI.getToday();
          break;
        default:
          response = await reservationsAPI.getAll();
      }
      setReservations(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [activeTab, canManageAll, language]);

  useEffect(() => {
    if (canManageAll) {
      fetchReservations();
    }
  }, [fetchReservations, canManageAll]);

  // ==================== Fetch reference data ====================
  const fetchReferenceData = useCallback(async () => {
    try {
      const [custRes, tabRes] = await Promise.all([
        customersAPI.getAll(),
        tablesAPI.getAll(),
      ]);
      // Store full arrays for cross-referencing in resolveCustomerName / resolveTableLabel
      setCustomers(custRes.data?.data || []);
      setTables(tabRes.data?.data || []);
    } catch (err) {
      // Silent
    }
  }, []);

  // Also fetch reference data on mount so resolve functions have data
  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // ==================== Waiter Lookup ====================
  const handleLookup = async (e) => {
    e?.preventDefault();
    const id = parseInt(lookupId);
    if (!id || isNaN(id)) {
      setLookupError(t('Please enter a valid Reservation ID', language));
      setLookupResult(null);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const response = await reservationsAPI.getById(id);
      setLookupResult(response.data?.data || null);
    } catch (err) {
      setLookupError(err.response?.data?.message || t('Reservation not found', language));
    } finally {
      setLookupLoading(false);
    }
  };

  const clearLookup = () => {
    setLookupId('');
    setLookupResult(null);
    setLookupError(null);
  };

  // ==================== Filtering ====================
  const filteredReservations = reservations.filter((r) => {
    const term = searchTerm.toLowerCase();
    const resvId = String(r.reservation_id || r.Reservation_ID || '');
    const customerName = resolveCustomerName(r).toLowerCase();
    const tableLabel = resolveTableLabel(r).toLowerCase();
    return resvId.includes(term) || customerName.includes(term) || tableLabel.includes(term);
  });

  // ==================== Detail Modal (All roles) ====================
  const openDetail = async (reservation) => {
    setDetailReservation(null);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const response = await reservationsAPI.getById(reservation.reservation_id || reservation.Reservation_ID);
      setDetailReservation(response.data?.data || reservation);
    } catch (err) {
      setDetailReservation(reservation);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setDetailReservation(null);
  };

  // ==================== Confirm (Admin/Cashier only) ====================
  const [actionLoading, setActionLoading] = useState(null);

  const handleConfirm = async (reservation) => {
    const resvId = reservation.reservation_id || reservation.Reservation_ID;
    setActionLoading(`confirm-${resvId}`);
    try {
      await reservationsAPI.confirm(resvId);
      await fetchReservations();
      if (lookupResult && (lookupResult.reservation_id || lookupResult.Reservation_ID) === resvId) {
        setLookupResult((prev) => ({ ...prev, status: 'Confirmed', Status: 'Confirmed' }));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setActionLoading(null);
    }
  };

  // ==================== Seat Guest (ALL roles) ====================
  const handleSeat = async (reservation) => {
    const resvId = reservation.reservation_id || reservation.Reservation_ID;
    setActionLoading(`seat-${resvId}`);
    try {
      await reservationsAPI.seat(resvId);
      if (canManageAll) await fetchReservations();
      if (lookupResult && (lookupResult.reservation_id || lookupResult.Reservation_ID) === resvId) {
        setLookupResult((prev) => ({ ...prev, status: 'Seated', Status: 'Seated' }));
      }
      if (detailReservation && (detailReservation.reservation_id || detailReservation.Reservation_ID) === resvId) {
        setDetailReservation((prev) => ({ ...prev, status: 'Seated', Status: 'Seated' }));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('Operation failed', language));
    } finally {
      setActionLoading(null);
    }
  };

  // ==================== Create/Edit (Admin/Cashier only) ====================
  const resetForm = () => {
    setFormData({
      customer_id: '',
      table_id: '',
      reservation_date: '',
      guest_number: '2',
      status: 'Pending',
    });
    setFormErrors({});
    setEditingReservation(null);
  };

  const openCreateForm = () => {
    resetForm();
    fetchReferenceData();
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 1);
    defaultDate.setMinutes(0);
    defaultDate.setSeconds(0);
    const formatted = defaultDate.toISOString().slice(0, 16);
    setFormData((prev) => ({ ...prev, reservation_date: formatted }));
    setFormMode('create');
    setShowFormModal(true);
  };

  const openEditForm = (reservation) => {
    fetchReferenceData();
    setFormMode('edit');
    setEditingReservation(reservation);
    const rawDate = reservation.reservation_date || reservation.Reservation_Date || '';
    let formattedDate = '';
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().slice(0, 16);
        } else {
          formattedDate = rawDate.slice(0, 16);
        }
      } catch (e) {
        formattedDate = rawDate.slice(0, 16);
      }
    }
    setFormData({
      customer_id: String(reservation.customer_id ?? reservation.Customer_ID ?? ''),
      table_id: String(reservation.table_id ?? reservation.Table_ID ?? ''),
      reservation_date: formattedDate,
      guest_number: String(reservation.guest_number ?? reservation.Guest_Number ?? '2'),
      status: reservation.status || reservation.Status || 'Pending',
    });
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer_id) {
      setFormErrors({ customer_id: t('Customer is required', language) });
      return;
    }
    if (!formData.table_id) {
      setFormErrors({ table_id: t('Table is required', language) });
      return;
    }
    if (!formData.reservation_date) {
      setFormErrors({ reservation_date: t('Date & time is required', language) });
      return;
    }
    if (!formData.guest_number || parseInt(formData.guest_number) < 1) {
      setFormErrors({ guest_number: t('At least 1 guest is required', language) });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: parseInt(formData.customer_id),
        table_id: parseInt(formData.table_id),
        reservation_date: formData.reservation_date,
        guest_number: parseInt(formData.guest_number),
        status: formData.status,
      };

      if (formMode === 'create') {
        await reservationsAPI.create(payload);
      } else {
        const resvId = editingReservation.reservation_id || editingReservation.Reservation_ID;
        await reservationsAPI.update(resvId, payload);
      }

      closeFormModal();
      if (canManageAll) await fetchReservations();
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
  const confirmDelete = (reservation) => {
    setDeleteTarget(reservation);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const resvId = deleteTarget.reservation_id || deleteTarget.Reservation_ID;
      await reservationsAPI.delete(resvId);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      if (canManageAll) await fetchReservations();
    } catch (err) {
      setError(err.response?.data?.message || t('Operation failed', language));
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER HELPERS ====================
  const renderStatusBadge = (status) => {
    const s = status || 'Pending';
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${
          STATUS_COLORS[s] || 'bg-gray-100 text-gray-700 border-gray-200'
        }`}
      >
        {s === 'Pending' ? t('Pending', language) : s === 'Confirmed' ? t('Confirmed', language) : s === 'Seated' ? t('Seated', language) : s === 'Cancelled' ? t('Cancelled', language) : s === 'No Show' ? t('No Show', language) : s}
      </span>
    );
  };

  const renderActionButtons = (reservation) => {
    const resvId = reservation.reservation_id || reservation.Reservation_ID;
    const status = reservation.status || reservation.Status || 'Pending';
    const isPending = status === 'Pending';
    const isSeated = status === 'Seated';
    const isCancelled = status === 'Cancelled' || status === 'No Show';

    return (
      <div className="flex items-center justify-end gap-1.5">
        {/* View — ALL roles */}
        <button
          onClick={() => openDetail(reservation)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title={t('View details', language)}
        >
          <Eye className="w-5 h-5" />
        </button>

        {/* Confirm — Admin/Cashier only, only when Pending */}
        {canManageAll && isPending && (
          <button
            onClick={() => handleConfirm(reservation)}
            disabled={actionLoading === `confirm-${resvId}`}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
            title={t('Confirm reservation', language)}
          >
            {actionLoading === `confirm-${resvId}` ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Seat Guest — ALL roles, only when Pending or Confirmed */}
        {!isSeated && !isCancelled && (
          <button
            onClick={() => handleSeat(reservation)}
            disabled={actionLoading === `seat-${resvId}`}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
            title={t('Seat guest', language)}
          >
            {actionLoading === `seat-${resvId}` ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <DoorOpen className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Edit — Admin/Cashier only */}
        {canManageAll && (
          <button
            onClick={() => openEditForm(reservation)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={t('Edit reservation', language)}
          >
            <Pencil className="w-5 h-5" />
          </button>
        )}

        {/* Delete — Admin only */}
        {canDelete && (
          <button
            onClick={() => confirmDelete(reservation)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={t('Delete reservation', language)}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Reservations Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'Admin'
              ? t('Manage all restaurant reservations — create, confirm, seat guests, and track status', language)
              : role === 'Cashier'
              ? t('Manage reservations — create, edit, confirm, and seat guests', language)
              : t('Look up reservations and seat arriving guests', language)}
          </p>
        </div>
        {/* New Reservation — Admin/Cashier only */}
        {canManageAll && (
          <button
            onClick={openCreateForm}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
          >
            <Plus className="w-4 h-4" />
            {t('New Reservation', language)}
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

      {/* ==================== WAITER: Lookup Section ==================== */}
      {isWaiter && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <IdCard className="w-4 h-4" />
            {t('Look Up Reservation', language)}
          </h3>
          <form onSubmit={handleLookup} className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs text-gray-500 mb-1">{t('Reservation ID', language)}</label>
              <input
                type="number"
                min="1"
                value={lookupId}
                onChange={(e) => {
                  setLookupId(e.target.value);
                  setLookupError(null);
                }}
                placeholder={t('Enter reservation ID...', language)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={lookupLoading || !lookupId}
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {lookupLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Search className="w-4 h-4" />
              {t('Lookup', language)}
            </button>
            {lookupResult && (
              <button
                type="button"
                onClick={clearLookup}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('Clear', language)}
              </button>
            )}
          </form>

          {lookupError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {lookupError}
            </div>
          )}

          {lookupResult && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  {t('Reservation', language)} #{lookupResult.reservation_id || lookupResult.Reservation_ID}
                </h4>
                {renderStatusBadge(lookupResult.status || lookupResult.Status)}
              </div>
              <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-gray-500 mb-0.5">{t('Customer', language)}</span>
                  <span className="font-medium text-gray-900">
                    {resolveCustomerName(lookupResult)}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 mb-0.5">{t('Table', language)}</span>
                  <span className="font-medium text-gray-900">
                    {resolveTableLabel(lookupResult)}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 mb-0.5">{t('Date & Time', language)}</span>
                  <span className="font-medium text-gray-900">
                    {lookupResult.reservation_date || lookupResult.Reservation_Date
                      ? new Date(lookupResult.reservation_date || lookupResult.Reservation_Date).toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 mb-0.5">{t('Guests', language)}</span>
                  <span className="font-medium text-gray-900">
                    {lookupResult.guest_number || lookupResult.Guest_Number || '—'}
                  </span>
                </div>
              </div>
              {/* Waiter can only Seat — no Confirm/Edit/Delete */}
              <div className="px-4 pb-4 flex justify-end">
                {(() => {
                  const status = lookupResult.status || lookupResult.Status || 'Pending';
                  const isSeated = status === 'Seated';
                  const isCancelled = status === 'Cancelled' || status === 'No Show';
                  if (!isSeated && !isCancelled) {
                    const resvId = lookupResult.reservation_id || lookupResult.Reservation_ID;
                    return (
                      <button
                        onClick={() => handleSeat(lookupResult)}
                        disabled={actionLoading === `seat-${resvId}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `seat-${resvId}` && <Loader2 className="w-4 h-4 animate-spin" />}
                        <DoorOpen className="w-4 h-4" />
                        {t('Seat Guest', language)}
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== Admin/Cashier: Tabs + Search ==================== */}
      {canManageAll && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('all')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarRange className="w-4 h-4" />
                {t('All Reservations', language)}
              </button>
              <button
                onClick={() => setActiveTab('today')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'today'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                {t("Today's Schedule", language)}
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('Search reservations...', language)}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}

          {!loading && !error && filteredReservations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <CalendarDays className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-1">
                {searchTerm ? t('No reservations found', language) : t('No reservations yet', language)}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchTerm
                  ? t('Try adjusting your search term', language)
                  : t('Create a new reservation to get started', language)}
              </p>
              <button onClick={openCreateForm} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                <Plus className="w-4 h-4" />
                {t('New Reservation', language)}
              </button>
            </div>
          )}

          {/* ==================== Reservations Table ==================== */}
          {!loading && filteredReservations.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Reservation ID', language)}</th>
                      <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Customer', language)}</th>
                      <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Table', language)}</th>
                      <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Date & Time', language)}</th>
                      <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Guests', language)}</th>
                      <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                      <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReservations.map((reservation) => {
                      const resvId = reservation.reservation_id || reservation.Reservation_ID;
                      const status = reservation.status || reservation.Status || 'Pending';
                      const customerName = resolveCustomerName(reservation);
                      const tableLabel = resolveTableLabel(reservation);
                      const rawDate = reservation.reservation_date || reservation.Reservation_Date || '';
                      const guestNum = reservation.guest_number || reservation.Guest_Number || '—';

                      return (
                        <tr key={resvId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono font-medium text-gray-900">#{resvId}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{customerName}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-700">{tableLabel}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {rawDate ? new Date(rawDate).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                              {guestNum}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderStatusBadge(status)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {renderActionButtons(reservation)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== Detail Modal (All roles) ==================== */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('Reservation', language)} #{detailReservation?.reservation_id || detailReservation?.Reservation_ID || ''}
              </h2>
              <button onClick={closeDetail} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : detailReservation ? (
              <div className="px-6 py-4 space-y-5">
                <div className="flex items-center justify-between">
                  {renderStatusBadge(detailReservation.status || detailReservation.Status)}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{t('Guests', language)}:</span>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                      {detailReservation.guest_number || detailReservation.Guest_Number || '—'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-gray-500 mb-0.5">{t('Customer', language)}</span>
                    <span className="font-medium text-gray-900">
                      {resolveCustomerName(detailReservation)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-0.5">{t('Table', language)}</span>
                    <span className="font-medium text-gray-900">
                      {resolveTableLabel(detailReservation)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-500 mb-0.5">{t('Date & Time', language)}</span>
                    <span className="font-medium text-gray-900">
                      {detailReservation.reservation_date || detailReservation.Reservation_Date
                        ? new Date(detailReservation.reservation_date || detailReservation.Reservation_Date).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                  {(() => {
                    const status = detailReservation.status || detailReservation.Status || 'Pending';
                    const isSeated = status === 'Seated';
                    const isCancelled = status === 'Cancelled' || status === 'No Show';
                    if (!isSeated && !isCancelled) {
                      const resvId = detailReservation.reservation_id || detailReservation.Reservation_ID;
                      return (
                        <button
                          onClick={() => handleSeat(detailReservation)}
                          disabled={actionLoading === `seat-${resvId}`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `seat-${resvId}` && <Loader2 className="w-4 h-4 animate-spin" />}
                          <DoorOpen className="w-4 h-4" />
                          {t('Seat Guest', language)}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-500">
                {t('Failed to load reservation details', language)}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button onClick={closeDetail} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                {t('Close', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Create/Edit Form Modal (Admin/Cashier only) ==================== */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {formMode === 'create' ? t('New Reservation', language) : t('Edit Reservation', language)}
              </h2>
              <button onClick={closeFormModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formErrors.general}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Customer', language)} <span className="text-red-500">*</span></label>
                <select
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.customer_id ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">{t('Select a customer', language)}</option>
                  {customers.map((c) => (
                    <option key={c.customer_id || c.Customer_ID} value={c.customer_id || c.Customer_ID}>
                      {c.customer_name || c.Customer_Name || c.name || 'Customer'}
                    </option>
                  ))}
                </select>
                {formErrors.customer_id && <p className="mt-1 text-xs text-red-500">{formErrors.customer_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Table', language)} <span className="text-red-500">*</span></label>
                <select
                  name="table_id"
                  value={formData.table_id}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.table_id ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">{t('Select a table', language)}</option>
                  {tables.map((t) => {
                    const tableId = t.table_id || t.Table_ID;
                    const tableNum = t.table_number || t.Table_Number;
                    const tableStatus = t.status || t.Status || 'Available';
                    return (
                      <option key={tableId} value={tableId}>
                        {t('Table', language)} {tableNum} ({tableStatus === 'Available' ? t('Available', language) : tableStatus === 'Occupied' ? t('Occupied', language) : tableStatus === 'Reserved' ? t('Reserved', language) : tableStatus})
                      </option>
                    );
                  })}
                </select>
                {formErrors.table_id && <p className="mt-1 text-xs text-red-500">{formErrors.table_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Date & Time', language)} <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  name="reservation_date"
                  value={formData.reservation_date}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.reservation_date ? 'border-red-400' : 'border-gray-300'}`}
                />
                {formErrors.reservation_date && <p className="mt-1 text-xs text-red-500">{formErrors.reservation_date}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Guests', language)} <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="guest_number"
                    min="1"
                    value={formData.guest_number}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.guest_number ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {formErrors.guest_number && <p className="mt-1 text-xs text-red-500">{formErrors.guest_number}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Status', language)}</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Pending">{t('Pending', language)}</option>
                    <option value="Confirmed">{t('Confirmed', language)}</option>
                    <option value="Cancelled">{t('Cancelled', language)}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeFormModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >{t('Cancel', language)}</button>
                <button type="submit" disabled={submitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formMode === 'create' ? t('Create Reservation', language) : t('Update Reservation', language)}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Reservation', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to delete', language)}{' '}
                <span className="font-medium text-gray-700">
                  {t('Reservation', language)} #{deleteTarget.reservation_id || deleteTarget.Reservation_ID}
                </span>
                ?
              </p>
              <p className="text-xs text-red-500">{t('This action cannot be undone.', language)}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >{t('Cancel', language)}</button>
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

export default ReservationsPage;