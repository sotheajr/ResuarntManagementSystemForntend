import { useState, useEffect, useCallback, useRef } from 'react';
import { attendanceAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Clock, Loader2, Search, X, AlertTriangle, CheckCircle,
  Trash2, Pencil, Plus, User, Filter, ChevronDown
} from 'lucide-react';

const STATUS_OPTIONS = ['Present', 'Late', 'Half Day', 'Absent'];
const STATUS_COLORS = {
  Present: 'bg-green-100 text-green-700 border-green-200',
  Late: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Half Day': 'bg-orange-100 text-orange-700 border-orange-200',
  Absent: 'bg-red-100 text-red-700 border-red-200',
};

// ==================== Searchable Employee Select Component ====================
const EmployeeSelect = ({
  value,
  onChange,
  users,
  placeholder,
  disabled,
}) => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const filteredUsers = users.filter((u) => {
    const name = (u.Full_Name || u.full_name || u.Username || u.username || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const selectedUser = users.find((u) => {
    const uid = u.User_ID || u.user_id;
    return String(uid) === String(value);
  });

  const selectedLabel = selectedUser
    ? selectedUser.Full_Name || selectedUser.full_name || selectedUser.Username || selectedUser.username
    : '';

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-base outline-none transition-colors
          ${disabled
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
            : 'bg-white border-gray-300 hover:border-gray-400 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          }`}
      >
        <span className={`truncate ${!selectedUser ? 'text-gray-400' : ''}`}>
          {selectedUser ? selectedLabel : (placeholder || t('All Employees', language))}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search inside dropdown */}
          <div className="relative p-2 border-b border-gray-100">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search employee...', language)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {/* All Employees option */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-blue-50
                ${!value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
            >
              {t('All Employees', language)}
            </button>

            {filteredUsers.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                {t('No results found', language)}
              </div>
            )}

            {filteredUsers.map((u) => {
              const uid = u.User_ID || u.user_id;
              const name = u.Full_Name || u.full_name || u.Username || u.username;
              return (
                <button
                  key={uid}
                  type="button"
                  onClick={() => { onChange(uid); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-blue-50
                    ${String(uid) === String(value) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Main Page Component ====================
const AttendancePage = () => {
  const { user, isAdmin, isCashier } = useAuth();
  const { language } = useLanguage();
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [filterUserId, setFilterUserId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    clock_in: '08:00',
    clock_out: '17:00',
    status: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Get the current user's ID from the auth context (handles Oracle lowercase/uppercase)
  const currentUserId = user?.User_ID || user?.user_id || user?.id || '';

  // Calculated preview
  const preview = calculateHours(formData.clock_in, formData.clock_out, formData.status);

  // Only Admin can manually create/edit/delete attendance records
  // Cashier must use the strict Clock-In / Clock-Out flow
  const canManage = isAdmin;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      // Non-admin users can only see their own records (backend enforces this too)
      if (!isAdmin) {
        params.user_id = currentUserId;
      } else if (filterUserId) {
        params.user_id = filterUserId;
      }
      if (filterMonth) params.month_year = filterMonth;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      const response = await attendanceAPI.getAll(params);
      setRecords(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load attendance records', language));
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterUserId, filterDateFrom, filterDateTo, isAdmin, currentUserId, language]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchUsers();
  }, [fetchRecords, fetchUsers]);

  const openCreateModal = () => {
    setEditTarget(null);
    setValidationError(null);
    setSubmitError(null);
    // For non-admin: pre-fill with current user's ID. For admin: empty (must select).
    const prefillUserId = isAdmin ? '' : currentUserId;
    setFormData({
      user_id: prefillUserId,
      date: new Date().toISOString().split('T')[0],
      clock_in: '08:00',
      clock_out: '17:00',
      status: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditTarget(record);
    setValidationError(null);
    setSubmitError(null);
    setFormData({
      user_id: record.User_ID || record.user_id || '',
      date: record.Date || record.date || '',
      clock_in: record.Clock_In || record.clock_in || '08:00',
      clock_out: record.Clock_Out || record.clock_out || '17:00',
      status: record.Status || record.status || '',
      notes: record.Notes || record.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setSubmitError(null);
    setValidationError(null);

    // STEP 1: Ensure user_id is never empty for non-admin
    const effectiveUserId = formData.user_id || currentUserId;
    if (!effectiveUserId) {
      setValidationError(t('Employee is required. Please select an employee.', language));
      return;
    }

    // STEP 2: Validate clock_in and clock_out
    if (formData.clock_in && formData.clock_out) {
      const inMinutes = timeToMinutes(formData.clock_in);
      const outMinutes = timeToMinutes(formData.clock_out);
      if (inMinutes !== null && outMinutes !== null && outMinutes <= inMinutes) {
        setValidationError(t('Clock Out time must be after Clock In time.', language));
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: effectiveUserId,
        date: formData.date,
        clock_in: formData.clock_in || null,
        clock_out: formData.clock_out || null,
        status: formData.status || null,
        notes: formData.notes || null,
      };

      console.log('Submitting attendance payload:', payload);

      if (editTarget) {
        const attId = editTarget.Attendance_ID || editTarget.attendance_id;
        const response = await attendanceAPI.update(attId, {
          clock_in: payload.clock_in,
          clock_out: payload.clock_out,
          status: payload.status,
          notes: payload.notes,
        });
        console.log('Update response:', response.data);
        showToast('success', `${t('Attendance', language)} #${attId} ${t('updated', language)}!`);
      } else {
        const response = await attendanceAPI.create(payload);
        console.log('Create response:', response.data);
        showToast('success', t('Attendance logged successfully!', language));
      }
      setShowModal(false);
      setEditTarget(null);
      await fetchRecords();
    } catch (err) {
      console.error('Attendance submit error:', err);
      const serverMsg = err.response?.data?.message || '';
      const serverErrors = err.response?.data?.errors;
      let errorMsg = t('Failed to save attendance', language);
      if (serverMsg) errorMsg = serverMsg;
      if (serverErrors) {
        const firstKey = Object.keys(serverErrors)[0];
        if (firstKey) errorMsg = serverErrors[firstKey][0] || errorMsg;
      }
      setSubmitError(errorMsg);
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await attendanceAPI.delete(deleteTarget.Attendance_ID || deleteTarget.attendance_id);
      showToast('success', t('Attendance record deleted', language));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchRecords();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to delete attendance', language));
      setShowDeleteConfirm(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Client-side name search filter applied on top of server-side filtering
  const filteredRecords = records.filter((r) => {
    // If a specific employee is selected in the dropdown, the backend already filters,
    // but we keep this for the case where no filter is applied and the user types in the search.
    // However since we now have the combobox, we can skip the separate name search.
    // For safety, we still apply it in case records are loaded for all employees.
    return true;
  });

  const formatTime = (val) => {
    if (!val) return '--:--';
    if (typeof val === 'string' && val.length >= 5) {
      const parts = val.split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parts[1];
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
      }
    }
    return val;
  };

  const getUserName = (r) => {
    const u = r.user;
    if (u) return u.username || u.Username || u.full_name || u.Full_Name || u.name || u.Name || `${t('User', language)} #${r.User_ID || r.user_id}`;
    return `${t('User', language)} #${r.User_ID || r.user_id}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Attendance / Timesheet', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Clock-In / Clock-Out tracking with auto-calculated work hours and overtime', language)}
          </p>
        </div>
        {canManage && (
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
            <Plus className="w-4 h-4" />
            {t('Log Attendance', language)}
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-slide-in ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="text-sm font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <EmployeeSelect
              value={filterUserId}
              onChange={setFilterUserId}
              users={users}
              placeholder={t('All Employees', language)}
            />
          </div>
        )}
        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" placeholder={t('From', language)} />
        <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" placeholder={t('To', language)} />
      </div>

      {/* Loading */}
      {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}

      {/* Empty */}
      {!loading && !error && filteredRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No attendance records', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('Click "Log Attendance" to record a new entry.', language)}</p>
          {canManage && (
            <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Plus className="w-4 h-4" /> {t('Log Attendance', language)}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filteredRecords.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 font-semibold text-slate-700">{t('Date', language)}</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-slate-700">{t('Employee', language)}</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-slate-700">{t('Clock In', language)}</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-slate-700">{t('Clock Out', language)}</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-slate-700">{t('Total Hrs', language)}</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-slate-700">{t('OT Hrs', language)}</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-slate-700">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((r) => {
                  const attId = r.Attendance_ID || r.attendance_id;
                  const status = r.Status || r.status || 'Present';

                  return (
                    <tr key={attId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 font-medium">{r.Date || r.date}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {getUserName(r)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-gray-700">{formatTime(r.Clock_In || r.clock_in)}</td>
                      <td className="px-4 py-3 text-center font-mono text-gray-700">{formatTime(r.Clock_Out || r.clock_out)}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">{r.Work_Hours || r.work_hours || '0.00'}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">+{r.OT_Hours || r.ot_hours || '0.00'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {language === 'kh' ? (r.STATUS_KH || r.status_kh || status) : status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && (
                            <button onClick={() => openEditModal(r)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('Edit', language)}>
                              <Pencil className="w-5 h-5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => { setDeleteTarget(r); setShowDeleteConfirm(true); }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('Delete', language)}>
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

      {/* ==================== Add / Edit Modal ==================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editTarget ? t('Edit Attendance', language) : t('Log Attendance', language)}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{submitError}</div>
              )}
              {validationError && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <span className="font-medium">{t('Validation:', language)}</span> {validationError}
                </div>
              )}

              {/* Employee Select - Admin: dropdown, Cashier/Staff: locked to self */}
              {!editTarget && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Employee', language)} <span className="text-red-500">*</span>
                  </label>
                  {isAdmin ? (
                    <EmployeeSelect
                      value={formData.user_id}
                      onChange={(val) => setFormData((p) => ({ ...p, user_id: val }))}
                      users={users}
                      placeholder={t('-- Select Employee --', language)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={user?.full_name || user?.Full_Name || user?.username || user?.Username || 'You'}
                      disabled
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base bg-gray-100 text-gray-700 cursor-not-allowed outline-none"
                    />
                  )}
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Date', language)} <span className="text-red-500">*</span></label>
                <input type="date" value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Clock In */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Clock In', language)}</label>
                  <input type="time" value={formData.clock_in}
                    onChange={(e) => setFormData((p) => ({ ...p, clock_in: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Clock Out */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Clock Out', language)}</label>
                  <input type="time" value={formData.clock_out}
                    onChange={(e) => setFormData((p) => ({ ...p, clock_out: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Clock Out < Clock In warning */}
              {formData.clock_in && formData.clock_out && (() => {
                const inMin = timeToMinutes(formData.clock_in);
                const outMin = timeToMinutes(formData.clock_out);
                if (inMin !== null && outMin !== null && outMin <= inMin) {
                  return (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      {t('Clock Out time must be after Clock In time.', language)}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Status', language)}</label>
                <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('-- Auto Detect --', language)}</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Preview Calculations */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">{t('Calculated Preview', language)}</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-blue-600">{t('Work Hours:', language)}</span>
                    <span className="ml-1 font-semibold text-blue-900">{preview.workHours} {t('hrs', language)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">{t('OT Hours:', language)}</span>
                    <span className="ml-1 font-semibold text-green-600">+{preview.otHours} {t('hrs', language)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">{t('Status:', language)}</span>
                    <span className="ml-1 font-semibold">{preview.status}</span>
                  </div>
                </div>
                <p className="text-xs text-blue-500 mt-2">
                  {formData.clock_in && formData.clock_out
                    ? `${t('Based on', language)} ${formatTime(formData.clock_in)} → ${formatTime(formData.clock_out)}`
                    : t('Enter Clock In and Clock Out times to see auto-calculation', language)}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Notes / Remarks', language)}</label>
                <textarea value={formData.notes} rows={2} placeholder={t('Optional notes...', language)}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{t('Cancel', language)}</button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editTarget ? t('Update Attendance', language) : t('Save Attendance', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Delete Confirmation ==================== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Attendance', language)}</h3>
            <p className="text-sm text-gray-500 mb-2">
              {t('Delete attendance for', language)} <span className="font-medium text-gray-700">{getUserName(deleteTarget)}</span> {t('on', language)} {deleteTarget.Date || deleteTarget.date}?
            </p>
            <p className="text-xs text-red-500">{t('This action cannot be undone.', language)}</p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{t('Cancel', language)}</button>
              <button onClick={handleDelete} disabled={deleteSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
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

/**
 * Convert a time string (HH:mm or HH:mm:ss) to total minutes since midnight.
 * Returns null if parsing fails.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Calculate work hours & overtime from clock in/out times.
 * Both times are expected in 24h HH:mm format (from <input type="time">).
 */
function calculateHours(clockIn, clockOut, manualStatus) {
  // If status is "Half Day" or "Absent", override
  if (manualStatus === 'Absent') return { workHours: '0.00', otHours: '0.00', status: 'Absent' };
  if (manualStatus === 'Half Day') return { workHours: '4.00', otHours: '0.00', status: 'Half Day' };

  if (!clockIn || !clockOut) return { workHours: '0.00', otHours: '0.00', status: manualStatus || 'Present' };

  const inMinutes = timeToMinutes(clockIn);
  const outMinutes = timeToMinutes(clockOut);

  if (inMinutes === null || outMinutes === null) {
    return { workHours: '0.00', otHours: '0.00', status: manualStatus || 'Present' };
  }

  // If clock_out <= clock_in, assume next day (overnight shift)
  let totalMinutes = outMinutes - inMinutes;
  if (totalMinutes <= 0) {
    totalMinutes += 24 * 60; // add 24 hours
  }

  const standardMinutes = 480; // 8 hours

  let workMinutes, otMinutes;
  if (totalMinutes > standardMinutes) {
    workMinutes = standardMinutes;
    otMinutes = totalMinutes - standardMinutes;
  } else {
    workMinutes = totalMinutes;
    otMinutes = 0;
  }

  // Auto-detect status: if clock_in is after 9:00 AM (540 minutes), mark as Late
  const status = manualStatus || (inMinutes >= 540 ? 'Late' : 'Present');

  return {
    workHours: (workMinutes / 60).toFixed(2),
    otHours: (otMinutes / 60).toFixed(2),
    status,
  };
}

export default AttendancePage;