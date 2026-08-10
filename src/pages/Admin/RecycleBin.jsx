import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recycleBinAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle, Loader2, RefreshCw,
  RotateCcw, Trash2, Clock, Database, User,
  Calendar, ChevronDown, ChevronRight, Users,
} from 'lucide-react';

const RecycleBin = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (tableFilter) params.table_name = tableFilter;
      const response = await recycleBinAPI.getAll(params);
      const data = response.data?.data || response.data || [];
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch recycle bin records:', err);
      const serverMsg = err.response?.data?.message || err.response?.data?.error || '';
      const detail = serverMsg ? ` (${serverMsg})` : '';
      setError(`${t('Failed to load data', language)}${detail}. ${t('Please try again', language) || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, tableFilter, language]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleRestore = async (id, record) => {
    setActionLoading(`restore-${id}`);
    try {
      if (record?.recycle_type === 'soft_delete' || String(id).startsWith('user_')) {
        const userId = String(id).replace('user_', '');
        await usersAPI.restore(userId);
        showToast('success', t('User', language) + ' ' + t('restored successfully', language) || 'User restored successfully!');
      } else {
        await recycleBinAPI.restore(id);
        showToast('success', t('Record restored successfully', language) || 'Record restored successfully!');
      }
      setRecords((prev) => prev.filter((r) => r.RECYCLE_ID !== id));
      setConfirmAction(null);
    } catch (err) {
      const msg = err.response?.data?.message || t('Operation failed', language);
      showToast('error', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id, record) => {
    setActionLoading(`delete-${id}`);
    try {
      if (record?.recycle_type === 'soft_delete' || String(id).startsWith('user_')) {
        const userId = String(id).replace('user_', '');
        await usersAPI.delete(userId);
        showToast('success', t('Record permanently deleted', language) || 'Record permanently deleted.');
      } else {
        await recycleBinAPI.permanentDelete(id);
        showToast('success', t('Record permanently deleted', language) || 'Record permanently deleted.');
      }
      setRecords((prev) => prev.filter((r) => r.RECYCLE_ID !== id));
      setConfirmAction(null);
    } catch (err) {
      const msg = err.response?.data?.message || t('Operation failed', language);
      showToast('error', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const getTableNames = () => {
    const names = new Set();
    records.forEach((r) => {
      if (r.TABLE_NAME) names.add(r.TABLE_NAME);
    });
    return Array.from(names).sort();
  };

  const getRecordIdentifier = (record) => {
    try {
      const data = typeof record.RECORD_DATA === 'string'
        ? JSON.parse(record.RECORD_DATA)
        : record.RECORD_DATA;
      if (!data) return null;
      const nameField = data.Full_Name || data.full_name || data.ITEM_NAME || data.item_name
        || data.Name || data.name || data.TITLE || data.title
        || data.Supplier_Name || data.supplier_name || data.Partner_Name
        || data.partner_name || data.CATEGORY_NAME || data.category_name
        || data.CUSTOMER_NAME || data.customer_name || data.Table_Name
        || data.table_name || data.USERNAME || data.username
        || data.EMAIL || data.email || data.PHONE || data.phone
        || data.Description || data.description
        || data.NAME_KH || data.name_kh || data.ROLE_NAME_KH
        || data.TABLE_NAME_KH || data.table_name_kh || data.SUPPLIER_NAME_KH
        || data.supplier_name_kh || data.CUSTOMER_NAME_KH || data.customer_name_kh;
      return nameField || null;
    } catch {
      return null;
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const getDeletedByName = (record) => {
    if (record.deleted_by?.Full_Name) return record.deleted_by.Full_Name;
    if (record.deleted_by?.full_name) return record.deleted_by.full_name;
    if (record.deleted_by?.name) return record.deleted_by.name;
    return record.deleted_by?.USERNAME || record.deleted_by?.username || `User #${record.DELETED_BY}`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 text-sm font-medium transition-all animate-slide-in ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <RotateCcw className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80"><X className="w-4 h-4" /></button>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                confirmAction.type === 'restore' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {confirmAction.type === 'restore' ? <RotateCcw className="w-5 h-5 text-green-600" /> : <Trash2 className="w-5 h-5 text-red-600" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {confirmAction.type === 'restore' ? t('Restore Record', language) || 'Restore Record' : t('Permanent Delete', language) || 'Permanent Delete'}
                </h3>
                <p className="text-sm text-gray-500">
                  {confirmAction.type === 'restore'
                    ? t('This will restore the record back to its original table.', language) || 'This will restore the record back to its original table.'
                    : t('This action cannot be undone. The record will be permanently removed.', language) || 'This action cannot be undone.'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg">{confirmAction.label}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                {t('Cancel', language)}
              </button>
              <button onClick={() => {
                if (confirmAction.type === 'restore') handleRestore(confirmAction.id, confirmAction.record);
                else handlePermanentDelete(confirmAction.id, confirmAction.record);
              }} disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                  confirmAction.type === 'restore' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}>
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmAction.type === 'restore' ? t('Restore', language) || 'Restore' : t('Delete Permanently', language) || 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-500" />
            {t('Recycle Bin', language)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('View and manage deleted records. Restore or permanently delete them.', language) || 'View and manage deleted records.'}
          </p>
        </div>
        <button onClick={fetchRecords}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('Refresh', language)}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder={t('Search recycle bin...', language)} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white min-w-[180px]">
          <option value="">{t('All Tables', language) || 'All Tables'}</option>
          {getTableNames().map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={fetchRecords} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700">
            {t('Try Again', language) || 'Try Again'}
          </button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <RotateCcw className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('All Clean!', language) || 'All Clean!'}</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {searchTerm || tableFilter
              ? t('No records match your current search/filter criteria.', language) || 'No records match your search.'
              : t('The recycle bin is empty. No records have been deleted yet.', language) || 'The recycle bin is empty.'}
          </p>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Table', language)}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Original ID', language) || 'Original ID'}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Deleted Item', language) || 'Deleted Item'}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Deleted By', language) || 'Deleted By'}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Deleted At', language) || 'Deleted At'}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((record) => {
                  const identifier = getRecordIdentifier(record);
                  const isExpanded = expandedRow === record.RECYCLE_ID;
                  const isRestoring = actionLoading === `restore-${record.RECYCLE_ID}`;
                  const isDeleting = actionLoading === `delete-${record.RECYCLE_ID}`;
                  const isActioning = isRestoring || isDeleting;

                  return (
                    <tr key={record.RECYCLE_ID} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-700">{record.table_display_name || record.TABLE_NAME}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm text-gray-600 font-mono">#{record.RECORD_ID}</span></td>
                      <td className="px-4 py-3">
                        {identifier ? (
                          <span className="text-sm text-gray-800 font-medium">{identifier}</span>
                        ) : (
                          <button onClick={() => setExpandedRow(isExpanded ? null : record.RECYCLE_ID)}
                            className="text-sm text-brand-600 hover:underline flex items-center gap-1">
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {t('View Details', language)}
                          </button>
                        )}
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                              {typeof record.RECORD_DATA === 'string'
                                ? JSON.stringify(JSON.parse(record.RECORD_DATA), null, 2)
                                : JSON.stringify(record.RECORD_DATA, null, 2)}
                            </pre>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{getDeletedByName(record)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{formatTimestamp(record.DELETED_AT)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setConfirmAction({ type: 'restore', id: record.RECYCLE_ID, label: `${record.table_display_name || record.TABLE_NAME} #${record.RECORD_ID}${identifier ? ` — ${identifier}` : ''}`})}
                            disabled={isActioning}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title={t('Restore', language)}>
                            {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setConfirmAction({ type: 'permanent', id: record.RECYCLE_ID, label: `${record.table_display_name || record.TABLE_NAME} #${record.RECORD_ID}${identifier ? ` — ${identifier}` : ''}`})}
                            disabled={isActioning}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title={t('Permanent Delete', language) || 'Permanent Delete'}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {t('Showing', language) || 'Showing'} {records.length} {t('record', language)}{records.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecycleBin;