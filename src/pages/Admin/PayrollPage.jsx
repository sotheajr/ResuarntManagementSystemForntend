import { useState, useEffect, useCallback } from 'react';
import { payrollAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  DollarSign, Loader2, Search, X, AlertTriangle, FileText,
  CheckCircle, Trash2, Pencil, CreditCard, Plus, Clock,
  TrendingUp, ArrowDownCircle, Info, Calendar, Layers
} from 'lucide-react';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Approved: 'bg-blue-100 text-blue-700 border-blue-200',
  Paid: 'bg-green-100 text-green-700 border-green-200',
};

const WEEK_OPTIONS = [
  { value: 1, label: 'Week 1 (Days 1-7)' },
  { value: 2, label: 'Week 2 (Days 8-14)' },
  { value: 3, label: 'Week 3 (Days 15-21)' },
  { value: 4, label: 'Week 4 (Days 22-28)' },
  { value: 5, label: 'Week 5 (Day 29-End)' },
];

const PayrollPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();

  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [payrollType, setPayrollType] = useState('Monthly');
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [weekNumber, setWeekNumber] = useState(1);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  // Draft preview
  const [draftData, setDraftData] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    Base_Salary: 0,
    Overtime_Pay: 0,
    Total_OT_Hours: 0,
    Hourly_OT_Rate: 2.50,
    Bonuses_Tips: 0,
    Sales_Commission: 0,
    Tips_Distribution: 0,
    Manual_Bonus: 0,
    Deductions: 0,
    Late_Penalties: 0,
    Manual_Deduction: 0,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // Pay confirmation
  const [payTarget, setPayTarget] = useState(null);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await payrollAPI.getAll();
      setPayrolls(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load payroll records', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchPayrolls();
  }, [fetchPayrolls]);

  const filteredPayrolls = payrolls.filter((p) => {
    const term = searchTerm.toLowerCase();
    const payrollId = String(p.Payroll_ID || '');
    const userName = p.user?.username || p.user?.Username || p.user?.full_name || p.user?.Full_Name || '';
    const monthYear = (p.Month_Year || '').toLowerCase();
    const payrollType = (p.Payroll_Type || '').toLowerCase();
    return payrollId.includes(term) || userName.toLowerCase().includes(term) || monthYear.includes(term) || payrollType.includes(term);
  });

  const formatCurrency = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

  const getField = (obj, ...keys) => {
    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined && val !== null) return val;
    }
    return '';
  };

  const getUserName = (p) => {
    const u = p.user;
    if (u) return u.username || u.Username || u.full_name || u.Full_Name || u.name || u.Name || `${t('User', language)} #${p.User_ID}`;
    return `${t('User', language)} #${p.User_ID}`;
  };

  // ==================== Preview (Generate Draft) ====================
  const handlePreview = async () => {
    setGenerating(true);
    setGenerateError(null);
    setDraftData(null);
    try {
      const payload = {
        payroll_type: payrollType,
        month_year: monthYear,
      };
      if (payrollType === 'Weekly') {
        if (customStartDate && customEndDate) {
          payload.start_date = customStartDate;
          payload.end_date = customEndDate;
        } else {
          payload.week_number = weekNumber;
        }
      }
      const response = await payrollAPI.preview(payload);
      const result = response.data?.data;
      setDraftData(result);
      setShowDraftModal(true);
    } catch (err) {
      setGenerateError(err.response?.data?.message || t('Failed to generate payroll preview', language));
    } finally {
      setGenerating(false);
    }
  };

  // ==================== Confirm & Save ====================
  const handleConfirmSave = async () => {
    if (!draftData || !draftData.records || draftData.records.length === 0) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await payrollAPI.confirmSave(draftData.records);
      showToast('success', `${t('Payroll', language)} (${draftData.payroll_type}) ${t('for', language)} ${draftData.month_year} ${t('saved successfully!', language)}`);
      setShowDraftModal(false);
      setDraftData(null);
      setShowGenerateModal(false);
      await fetchPayrolls();
    } catch (err) {
      setConfirmError(err.response?.data?.message || t('Failed to save payroll', language));
    } finally {
      setConfirming(false);
    }
  };

  // ==================== Edit ====================
  const openEditModal = (payroll) => {
    setEditTarget(payroll);
    setEditForm({
      Base_Salary: parseFloat(payroll.Base_Salary || 0),
      Overtime_Pay: parseFloat(payroll.Overtime_Pay || 0),
      Total_OT_Hours: parseFloat(payroll.Total_OT_Hours || 0),
      Hourly_OT_Rate: parseFloat(payroll.Hourly_OT_Rate || 2.50),
      Bonuses_Tips: parseFloat(payroll.Bonuses_Tips || 0),
      Sales_Commission: parseFloat(payroll.Sales_Commission || 0),
      Tips_Distribution: parseFloat(payroll.Tips_Distribution || 0),
      Manual_Bonus: parseFloat(payroll.Manual_Bonus || 0),
      Deductions: parseFloat(payroll.Deductions || 0),
      Late_Penalties: parseFloat(payroll.Late_Penalties || 0),
      Manual_Deduction: parseFloat(payroll.Manual_Deduction || 0),
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editTarget) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await payrollAPI.update(editTarget.Payroll_ID, editForm);
      showToast('success', `${t('Payroll', language)} #${editTarget.Payroll_ID} ${t('updated', language)}!`);
      setShowEditModal(false);
      setEditTarget(null);
      await fetchPayrolls();
    } catch (err) {
      setEditError(err.response?.data?.message || t('Failed to update payroll', language));
    } finally {
      setEditSubmitting(false);
    }
  };

  // ==================== Mark Paid ====================
  const handlePay = async () => {
    if (!payTarget) return;
    setPaySubmitting(true);
    try {
      await payrollAPI.markPaid(payTarget.Payroll_ID);
      showToast('success', `${t('Payroll', language)} #${payTarget.Payroll_ID} ${t('marked as Paid!', language)}`);
      setShowPayConfirm(false);
      setPayTarget(null);
      await fetchPayrolls();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to mark payroll as paid', language));
      setShowPayConfirm(false);
    } finally {
      setPaySubmitting(false);
    }
  };

  // ==================== Delete ====================
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await payrollAPI.delete(deleteTarget.Payroll_ID);
      showToast('success', `${t('Payroll', language)} #${deleteTarget.Payroll_ID} ${t('deleted', language)}`);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchPayrolls();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to delete payroll', language));
      setShowDeleteConfirm(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Calculate net salary preview
  const calcNetSalary = (form) => {
    const base = parseFloat(form.Base_Salary || 0);
    const ot = parseFloat(form.Overtime_Pay || 0);
    const bonuses = parseFloat(form.Bonuses_Tips || 0);
    const deduct = parseFloat(form.Deductions || 0);
    return Math.max(0, base + ot + bonuses - deduct);
  };

  // Get period label for display
  const getPeriodLabel = (p) => {
    if (p.Payroll_Type === 'Weekly') {
      return `${t('Week', language)} ${p.Week_Number || '?'} (${p.Start_Date || ''} ${t('to', language)} ${p.End_Date || ''})`;
    }
    return p.Month_Year || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Payroll Management', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Automated salary calculation with OT, bonuses, and deductions', language)}
          </p>
        </div>
        <button onClick={() => setShowGenerateModal(true)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" />
          {t('Generate Payroll', language)}
        </button>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder={t('Search payroll by employee, month, type...', language)} value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      </div>

      {/* Loading */}
      {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}

      {/* Empty */}
      {!loading && !error && filteredPayrolls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <DollarSign className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No payroll records', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('Click "Generate Payroll" to create records for a new period.', language)}</p>
          <button onClick={() => setShowGenerateModal(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
            <Plus className="w-4 h-4" /> {t('Generate Payroll', language)}
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && filteredPayrolls.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 font-semibold text-slate-700">{t('ID', language)}</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-slate-700">{t('Employee', language)}</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-slate-700">{t('Type', language)}</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-slate-700">{t('Period', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('Base Salary', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('OT (Hrs)', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('OT Pay', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('Bonuses', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('Deductions', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('Net Salary', language)}</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-slate-700">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-slate-700">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayrolls.map((p) => {
                  const netSalary = (parseFloat(p.Base_Salary || 0) + parseFloat(p.Overtime_Pay || 0) + parseFloat(p.Bonuses_Tips || 0)) - parseFloat(p.Deductions || 0);
                  const status = p.Status || 'Pending';
                  const isPending = status === 'Pending';
                  const totalOtHours = parseFloat(p.Total_OT_Hours || 0).toFixed(2);

                  return (
                    <tr key={p.Payroll_ID} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">#{p.Payroll_ID}</span></td>
                      <td className="px-4 py-3 text-gray-600">{getUserName(p)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          p.Payroll_Type === 'Weekly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {p.Payroll_Type === 'Weekly' ? t('Weekly', language) : t('Monthly', language)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{getPeriodLabel(p)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.Base_Salary)}</td>
                      <td className="px-4 py-3 text-right text-indigo-600">{totalOtHours}h</td>
                      <td className="px-4 py-3 text-right text-green-600">{formatCurrency(p.Overtime_Pay)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{formatCurrency(p.Bonuses_Tips)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(p.Deductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(netSalary)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {t(status, language)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <button onClick={() => openEditModal(p)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('Edit payroll', language)}>
                              <Pencil className="w-5 h-5" />
                            </button>
                          )}
                          {isAdmin && isPending && (
                            <button onClick={() => { setPayTarget(p); setShowPayConfirm(true); }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title={t('Mark as Paid', language)}>
                              <CreditCard className="w-5 h-5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => { setDeleteTarget(p); setShowDeleteConfirm(true); }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('Delete payroll', language)}>
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

      {/* ==================== Generate Modal ==================== */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('Generate Payroll', language)}</h2>
              <button onClick={() => { setShowGenerateModal(false); setDraftData(null); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {generateError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{generateError}</div>
              )}

              {/* Cycle Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Payroll Cycle', language)} <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPayrollType('Monthly')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      payrollType === 'Monthly'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    {t('Monthly Payroll', language)}
                  </button>
                  <button
                    onClick={() => setPayrollType('Weekly')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      payrollType === 'Weekly'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    {t('Weekly Payroll', language)}
                  </button>
                </div>
              </div>

              {/* Month/Year Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Month & Year', language)} <span className="text-red-500">*</span></label>
                <input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Weekly Options */}
              {payrollType === 'Weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Week / Date Range', language)}</label>
                  <div className="space-y-3">
                    <select
                      value={weekNumber}
                      onChange={(e) => { setWeekNumber(parseInt(e.target.value)); setCustomStartDate(''); setCustomEndDate(''); }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {WEEK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{t(opt.label, language)}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="flex-1 border-t border-gray-200" />
                      <span>{t('OR Custom Range', language)}</span>
                      <span className="flex-1 border-t border-gray-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('Start Date', language)}</label>
                        <input type="date" value={customStartDate}
                          onChange={(e) => { setCustomStartDate(e.target.value); setWeekNumber(null); }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('End Date', language)}</label>
                        <input type="date" value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400">
                {t('Auto-calculates OT pay, sales commissions, tips, and late penalties from attendance & order data within the selected period.', language)}
                {payrollType === 'Weekly' && ` ${t('Weekly base salary = Monthly Salary / 4.', language)}`}
              </p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setShowGenerateModal(false); setDraftData(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{t('Cancel', language)}</button>
                <button onClick={handlePreview} disabled={generating || !monthYear}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                  {generating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <FileText className="w-4 h-4" />
                  {t('Preview Payroll', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Draft Preview Modal ==================== */}
      {showDraftModal && draftData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('Payroll Draft Preview', language)}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {draftData.payroll_type === 'Weekly' ? t('Weekly', language) : t('Monthly', language)} {t('Payroll', language)} — {draftData.month_year}
                  {draftData.week_number ? ` — ${t('Week', language)} ${draftData.week_number}` : ''}
                  {' '}({draftData.start_date} {t('to', language)} {draftData.end_date})
                  {' '}— {draftData.total_employees} {t('employee(s)', language)}
                </p>
              </div>
              <button onClick={() => { setShowDraftModal(false); setDraftData(null); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {confirmError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{confirmError}</div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2.5 px-3 font-semibold text-slate-700">{t('Employee', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('Base Salary', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('OT Hrs', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('OT Pay', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('Commission', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('Tips', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('Late Fees', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('Deductions', language)}</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-slate-700">{t('Net Salary', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {draftData.records.map((rec, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-700 font-medium">{rec.User_Name}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{formatCurrency(rec.Base_Salary)}</td>
                        <td className="px-3 py-2.5 text-right text-indigo-600">{rec.Total_OT_Work_Days || rec.Total_OT_Hours || 0}h</td>
                        <td className="px-3 py-2.5 text-right text-green-600">{formatCurrency(rec.Overtime_Pay)}</td>
                        <td className="px-3 py-2.5 text-right text-green-600">{formatCurrency(rec.Sales_Commission)}</td>
                        <td className="px-3 py-2.5 text-right text-green-600">{formatCurrency(rec.Tips_Distribution)}</td>
                        <td className="px-3 py-2.5 text-right text-red-600">{formatCurrency(rec.Late_Penalties)}</td>
                        <td className="px-3 py-2.5 text-right text-red-600">{formatCurrency(rec.Deductions)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900">{formatCurrency(rec.Net_Salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                      <td className="px-3 py-3 text-gray-700">{t('Total', language)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Base_Salary || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-indigo-600"></td>
                      <td className="px-3 py-3 text-right text-green-600">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Overtime_Pay || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-green-600">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Sales_Commission || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-green-600">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Tips_Distribution || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-red-600">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Late_Penalties || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-red-600">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Deductions || 0), 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-900">
                        {formatCurrency(draftData.records.reduce((s, r) => s + parseFloat(r.Net_Salary || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-400">
                {t('Review the draft above. Click "Confirm & Save" to persist all records to the database.', language)}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowDraftModal(false); setDraftData(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg">{t('Cancel', language)}</button>
                <button onClick={handleConfirmSave} disabled={confirming}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                  {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle className="w-4 h-4" />
                  {t('Confirm & Save Payroll', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Edit Modal ==================== */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('Edit Payroll', language)} #{editTarget.Payroll_ID}</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {editError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editError}</div>}
              <p className="text-sm text-gray-500 mb-2">
                {getUserName(editTarget)} — {editTarget.Month_Year}
                {editTarget.Payroll_Type && ` (${editTarget.Payroll_Type === 'Weekly' ? t('Weekly', language) : t('Monthly', language)})`}
              </p>

              {/* Base Salary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Base Salary', language)}</label>
                <input type="number" step="0.01" min="0" value={editForm.Base_Salary}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, Base_Salary: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Overtime Section */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {t('Overtime', language)}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-indigo-700 mb-1">{t('Total OT Hours', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Total_OT_Hours}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Total_OT_Hours: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-700 mb-1">{t('Hourly OT Rate', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Hourly_OT_Rate}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Hourly_OT_Rate: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-700 mb-1">{t('OT Pay (auto)', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Overtime_Pay}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Overtime_Pay: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Bonuses Section */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> {t('Bonuses', language)}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-green-700 mb-1">{t('Sales Commission', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Sales_Commission}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Sales_Commission: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-green-700 mb-1">{t('Tips Distribution', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Tips_Distribution}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Tips_Distribution: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-green-700 mb-1">{t('Manual Bonus', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Manual_Bonus}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Manual_Bonus: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
              </div>

              {/* Deductions Section */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4" /> {t('Deductions', language)}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1">{t('Late Penalties', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Late_Penalties}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Late_Penalties: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1">{t('Manual Deduction', language)}</label>
                    <input type="number" step="0.01" min="0" value={editForm.Manual_Deduction}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, Manual_Deduction: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
              </div>

              {/* Net Salary Preview */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{t('Net Salary Preview:', language)}</span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(calcNetSalary(editForm))}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('Base Salary', language)} ({formatCurrency(editForm.Base_Salary)}) + {t('OT Pay', language)} ({formatCurrency(editForm.Overtime_Pay)}) + {t('Bonuses', language)} ({formatCurrency(editForm.Bonuses_Tips)}) - {t('Deductions', language)} ({formatCurrency(editForm.Deductions)})
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{t('Cancel', language)}</button>
                <button onClick={handleEditSubmit} disabled={editSubmitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                  {editSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Update Payroll', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Pay Confirmation ==================== */}
      {showPayConfirm && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Mark as Paid', language)}</h3>
            <p className="text-sm text-gray-500 mb-2">
              {t('Mark payroll for', language)} <span className="font-medium text-gray-700">{getUserName(payTarget)}</span> ({payTarget.Month_Year}) {t('as Paid?', language)}
            </p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => { setShowPayConfirm(false); setPayTarget(null); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{t('Cancel', language)}</button>
              <button onClick={handlePay} disabled={paySubmitting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
                {paySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('Confirm Payment', language)}
              </button>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Payroll', language)}</h3>
            <p className="text-sm text-gray-500 mb-2">
              {t('Delete payroll for', language)} <span className="font-medium text-gray-700">{getUserName(deleteTarget)}</span> ({deleteTarget.Month_Year})?
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

export default PayrollPage;