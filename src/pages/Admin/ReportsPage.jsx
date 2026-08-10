import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportsAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle, Loader2, ClipboardList,
  BarChart3, DollarSign, CreditCard, Wallet, Smartphone,
  TrendingUp, ShoppingCart, Calendar, Plus, Edit3,
  Trash2, CheckCircle, Download, FileText, RefreshCw
} from 'lucide-react';

const REPORT_TYPES = [
  'Daily Sales',
  'Weekly Sales',
  'Monthly Sales',
  'Yearly Sales',
  'Custom Range',
];

const ReportsPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const roleId = user?.role_id || 0;

  // ==================== State ====================
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Date range for analytics
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  // Analytics data
  const [salesSummary, setSalesSummary] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Staff list for resolver
  const [staffList, setStaffList] = useState([]);

  // ==================== Report Type -> DB Enum Mapping ====================
  const REPORT_TYPE_ENUM_MAP = {
    'Daily Sales': 'Daily',
    'Weekly Sales': 'Weekly',
    'Monthly Sales': 'Monthly',
    'Yearly Sales': 'Yearly',
    'Custom Range': 'Custom',
  };

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [formData, setFormData] = useState({
    report_type: 'Daily Sales',
    report_date: today,
    start_date: today,
    end_date: today,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

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

  // ==================== Fetch Reports ====================
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reportsAPI.getAll();
      const data = response.data?.data || [];
      // Debug: log the first record's keys to inspect the API response shape
      if (data.length > 0) {
        console.log("Reports API Response Data Sample:", data[0]);
      }
      setReports(data);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load reports', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  // ==================== Fetch Staff ====================
  const fetchStaff = useCallback(async () => {
    try {
      const res = await usersAPI.getAll();
      setStaffList(res.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // ==================== Fetch Analytics ====================
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      const [summaryRes, methodsRes, itemsRes] = await Promise.all([
        reportsAPI.salesSummary(params),
        reportsAPI.paymentMethods(params),
        reportsAPI.topItems(params),
      ]);
      setSalesSummary(summaryRes.data?.data || null);
      setPaymentMethods(methodsRes.data?.data || []);
      setTopItems(itemsRes.data?.data || []);
    } catch (_) {
      // Non-critical — analytics may fail independently
    } finally {
      setAnalyticsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
    fetchStaff();
  }, [fetchReports, fetchStaff]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ==================== Resolve generator name ====================
  // ==================== Safe case-insensitive field reader ====================
  /**
   * Reads a numeric user ID from a report object, checking all possible
   * key names the backend may return (Oracle uppercase, Eloquent snake_case, etc.)
   * and handling the case where the eager-loaded relation object shadows the raw key.
   */
  const readGeneratorId = (report) => {
    // 1. Check generated_by_raw (Eloquent $appends accessor — always a raw number)
    if (report.generated_by_raw !== undefined) {
      const val = Number(report.generated_by_raw);
      if (!isNaN(val)) return val;
    }
    // 2. Check GENERATED_BY (uppercase — Oracle raw column)
    if (report.GENERATED_BY !== undefined && typeof report.GENERATED_BY !== 'object') {
      const val = Number(report.GENERATED_BY);
      if (!isNaN(val)) return val;
    }
    // 3. Check Generated_By (mixed case — another possible Oracle return)
    if (report.Generated_By !== undefined && typeof report.Generated_By !== 'object') {
      const val = Number(report.Generated_By);
      if (!isNaN(val)) return val;
    }
    // 4. Check generated_by as a primitive (numeric string/number, not the relation object)
    const gb = report.generated_by;
    if (gb !== undefined && gb !== null && typeof gb !== 'object') {
      const val = Number(gb);
      if (!isNaN(val)) return val;
    }
    return null;
  };

  /**
   * Map role_id values to display names when staffList lookup fails.
   * This provides a reliable fallback using the system's known role definitions.
   * role_id 1 = Admin, 3 = Cashier.
   */
  const ROLE_NAMES = {
    1: 'Admin',
    3: 'Cashier',
  };

  const resolveGeneratorName = (report) => {
    const creatorId = readGeneratorId(report);

    // If we got a numeric ID, try to resolve it from staffList
    if (creatorId !== null) {
      // 1. Try to find the user in the loaded staffList
      const matched = staffList.find(
        (u) => Number(u.user_id) === creatorId || Number(u.User_ID) === creatorId || Number(u.id) === creatorId
      );
      if (matched) {
        return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${creatorId}`;
      }

      // 2. If the creatorId matches the current logged-in user, use the auth user's name
      const currentUserId = Number(user?.user_id || user?.User_ID || user?.id || 0);
      if (creatorId === currentUserId && user) {
        return user?.username || user?.Username || user?.full_name || user?.Full_Name || user?.name || user?.Name || `Staff #${creatorId}`;
      }

      // 3. Fallback: use role-based name mapping (Admin=1, Cashier=3)
      const roleName = ROLE_NAMES[creatorId];
      if (roleName) return roleName;

      return `Staff #${creatorId}`;
    }

    // Fallback: try the nested generated_by relation object (eager-loaded via Report::with('generatedBy'))
    const g = report.generated_by;
    if (g && typeof g === 'object' && g !== null) {
      const fromRelation = g.username ?? g.Username ?? g.full_name ?? g.Full_Name ?? g.name ?? g.Name;
      if (fromRelation) return fromRelation;
    }

    return 'N/A';
  };

  // ==================== Filtering ====================
  const filteredReports = reports.filter((r) => {
    const term = searchTerm.toLowerCase();
    const reportId = String(r.report_id || r.Report_ID || '');
    const reportType = (r.report_type || r.Report_Type || '').toLowerCase();
    const generatorName = resolveGeneratorName(r).toLowerCase();
    return reportId.includes(term) || reportType.includes(term) || generatorName.includes(term);
  });

  // ==================== URL Query Param Sync ====================
  const [searchParams] = useSearchParams();
  const reportTypeParam = searchParams.get('type'); // 'Daily', 'Weekly', 'Monthly', 'Yearly', or null

  // Map URL param to display label
  const paramToDisplayLabel = {
    Daily: 'Daily Sales',
    Weekly: 'Weekly Sales',
    Monthly: 'Monthly Sales',
    Yearly: 'Yearly Sales',
  };

  // When the URL query param changes, auto-set the date range and trigger analytics fetch
  useEffect(() => {
    if (reportTypeParam && paramToDisplayLabel[reportTypeParam]) {
      const displayLabel = paramToDisplayLabel[reportTypeParam];
      const dateRange = computeDateRangeFromBase(displayLabel, today);
      setStartDate(dateRange.start_date);
      setEndDate(dateRange.end_date);
    }
  }, [reportTypeParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Date Calculation Helpers ====================
  /**
   * Compute start_date and end_date based on report type and a base date.
   * @param {string} reportType - e.g. 'Daily Sales', 'Weekly Sales', etc.
   * @param {string} baseDateStr - The user-picked date in YYYY-MM-DD format.
   * @returns {{ start_date: string, end_date: string }}
   */
  const computeDateRangeFromBase = (reportType, baseDateStr) => {
    const baseDate = new Date(baseDateStr + 'T00:00:00');
    const end = new Date(baseDate);
    let start;

    switch (reportType) {
      case 'Daily Sales':
        start = new Date(baseDate);
        break;
      case 'Weekly Sales':
        start = new Date(baseDate);
        start.setDate(start.getDate() - 6);
        break;
      case 'Monthly Sales':
        start = new Date(baseDate);
        start.setDate(start.getDate() - 29);
        break;
      case 'Yearly Sales':
        start = new Date(baseDate.getFullYear(), 0, 1); // January 1st
        break;
      case 'Custom Range':
      default:
        // For Custom Range, use the user-provided start_date/end_date from formData
        return {
          start_date: formData.start_date || baseDateStr,
          end_date: formData.end_date || baseDateStr,
        };
    }

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return { start_date: fmt(start), end_date: fmt(end) };
  };

  // ==================== Modal Handlers ====================
  const openCreateModal = () => {
    setEditingReport(null);
    setFormData({
      report_type: 'Daily Sales',
      report_date: today,
      start_date: today,
      end_date: today,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (report) => {
    setEditingReport(report);
    setFormData({
      report_type: report.report_type || report.Report_Type || '',
      report_date: report.report_date || report.Report_Date || today,
      start_date: today,
      end_date: today,
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingReport(null);
    setFormError(null);
  };

  const handleFormSubmit = async () => {
    if (!formData.report_type || !formData.report_date) {
      setFormError(t('Please fill in all required fields.', language));
      return;
    }
    // For Custom Range, require both start_date and end_date
    if (formData.report_type === 'Custom Range' && (!formData.start_date || !formData.end_date)) {
      setFormError(t('Please provide both Start Date and End Date for Custom Range.', language));
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingReport) {
        await reportsAPI.update(editingReport.report_id || editingReport.Report_ID, formData);
        showToast('success', t('Report updated successfully!', language));
      } else {
        // Compute date range based on the user's selected base date (report_date)
        const dateRange = computeDateRangeFromBase(formData.report_type, formData.report_date);

        // Build the API payload with start_date, end_date, REPORT_TYPE (DB enum), and GENERATED_BY
        const payload = {
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          REPORT_TYPE: REPORT_TYPE_ENUM_MAP[formData.report_type] || formData.report_type,
          GENERATED_BY: user?.user_id || user?.User_ID || user?.id || 0,
        };
        await reportsAPI.generate(payload);
        showToast('success', t('Report generated successfully!', language));

        // Also update the analytics date pickers to reflect the computed range
        setStartDate(dateRange.start_date);
        setEndDate(dateRange.end_date);
      }
      closeModal();
      await fetchReports();
      await fetchAnalytics();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || t('Operation failed', language);
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ==================== Delete Handler (Admin only) ====================
  const confirmDelete = (report) => {
    setDeleteTarget(report);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await reportsAPI.delete(deleteTarget.report_id || deleteTarget.Report_ID);
      showToast('success', t('Report deleted successfully!', language));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchReports();
    } catch (err) {
      showToast('error', err.response?.data?.message || t('Failed to delete report', language));
      setShowDeleteConfirm(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ==================== Weekly Aggregation Helper ====================
  /**
   * Groups daily sales summary rows into 7-day (weekly) blocks.
   * @param {Array} dailyRows - Array of { sale_date, transaction_count, total_sales } objects.
   * @param {string} startDateStr - The overall range start (YYYY-MM-DD).
   * @returns {Array} Array of { weekLabel, transaction_count, total_sales } objects.
   */
  const aggregateWeekly = (dailyRows, startDateStr) => {
    if (!dailyRows || dailyRows.length === 0) return [];

    // Sort rows by sale_date ascending
    const sorted = [...dailyRows].sort(
      (a, b) => new Date(a.sale_date) - new Date(b.sale_date)
    );

    // Determine the first day of the first week (aligned to startDateStr)
    const start = new Date(startDateStr + 'T00:00:00');
    const weeks = [];
    let currentWeek = null;

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    sorted.forEach((row) => {
      const rowDate = new Date(row.sale_date + 'T00:00:00');

      // Determine which week block this date belongs to
      // Calculate the offset in days from the start date
      const diffDays = Math.floor((rowDate - start) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);

      if (!currentWeek || currentWeek.weekIndex !== weekIndex) {
        // Calculate the start/end of this week block
        const weekStart = new Date(start);
        weekStart.setDate(weekStart.getDate() + weekIndex * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        currentWeek = {
          weekIndex,
          weekLabel: `${t('Week Period', language)} ${weekIndex + 1}: ${fmt(weekStart)} - ${fmt(weekEnd)}`,
          transaction_count: 0,
          total_sales: 0,
        };
        weeks.push(currentWeek);
      }

      currentWeek.transaction_count += Number(row.transaction_count) || 0;
      currentWeek.total_sales += Number(row.total_sales) || 0;
    });

    return weeks;
  };

  // ==================== Breakdown Mode Detection ====================
  // Derives the table breakdown mode from the selected date range
  // so the summary table can adapt its grouping (daily, weekly, etc.)
  const getBreakdownType = () => {
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    const diffDays = Math.floor((e - s) / (1000 * 60 * 60 * 24));
    if (diffDays === 6) return 'weekly';
    if (diffDays === 29) return 'monthly';
    if (diffDays === 0) return 'daily';
    return 'daily'; // default fallback
  };
  const breakdownType = getBreakdownType();

  // ==================== Format helpers ====================
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  // ==================== Print / Download Report Handler ====================
  /**
   * Opens a styled printable report window with restaurant branding,
   * summary section, breakdown table, and payment-method details.
   * Hides all app UI because it writes a standalone HTML document.
   */
  const handlePrintReport = (report) => {
    const reportId = report.report_id || report.Report_ID;
    const reportType = report.report_type || report.Report_Type || 'Sales Report';
    const reportDate = report.report_date || report.Report_Date;
    const totalSales = parseFloat(report.total_sales ?? report.Total_Sales ?? 0);
    const generatedByName = resolveGeneratorName(report);

    // Pull analytics data that is already loaded in the page
    const summary = salesSummary?.totals || {};
    const breakdownRows = salesSummary?.summary || [];
    const breakMode = getBreakdownType();
    const weeklyRows = breakMode === 'weekly' ? aggregateWeekly(breakdownRows, startDate) : [];

    const totalOrders = summary.total_transactions ?? '—';
    const totalSalesAmount = summary.total_sales ?? totalSales;
    const startDateStr = summary.start_date || startDate;
    const endDateStr = summary.end_date || endDate;

    const now = new Date();
    const createdDate = formatDate(reportDate) || now.toLocaleDateString();
    const createdTime = now.toLocaleTimeString();
    const currentUser = user?.username || user?.Username || user?.full_name || user?.Full_Name || user?.name || user?.Name || generatedByName || 'N/A';

    // Build breakdown table rows HTML
    let breakdownRowsHtml = '';
    if (weeklyRows.length > 0) {
      breakdownRowsHtml = weeklyRows.map((w) => `
        <tr>
          <td>${w.weekLabel}</td>
          <td>${w.transaction_count}</td>
          <td>$${Number(w.total_sales).toFixed(2)}</td>
        </tr>
      `).join('');
    } else if (breakdownRows.length > 0) {
      breakdownRowsHtml = breakdownRows.map((row) => `
        <tr>
          <td>${formatDate(row.sale_date)}</td>
          <td>${row.transaction_count}</td>
          <td>$${Number(row.total_sales).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // Build payment-methods table rows HTML
    const paymentRowsHtml = paymentMethods.length > 0
      ? paymentMethods.map((pm) => `
          <tr>
            <td>${pm.payment_method || pm.Payment_Method || 'N/A'}</td>
            <td>${pm.count || 0}</td>
            <td>$${Number(pm.total || 0).toFixed(2)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" style="text-align:center;color:#888;">No payment data</td></tr>';

    // Build top-items table rows HTML
    // Supports both the new top_selling_items shape (name, qty_sold, revenue)
    // and the legacy shape (menu_name, total_quantity, total_revenue)
    const topItemsHtml = topItems.length > 0
      ? topItems.map((item, idx) => {
          const itemName = item.name || item.item_name || item.menu_name || item.Menu_Name || 'Item';
          const qtySold = item.qty_sold ?? item.quantity ?? item.total_quantity ?? 0;
          const revenue = item.revenue ?? item.total_revenue ?? 0;
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${itemName}</td>
              <td>${qtySold}</td>
              <td>$${Number(revenue).toFixed(2)}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#888;">No item data</td></tr>';

    // Escape report type to avoid HTML injection
    // (use char-code replacements so the formatter doesn't mangle entities)
    const safeType = String(reportType)
      .replace(/&/g, String.fromCharCode(38) + 'amp;')
      .replace(/</g, String.fromCharCode(38) + 'lt;')
      .replace(/>/g, String.fromCharCode(38) + 'gt;')
      .replace(/"/g, String.fromCharCode(38) + 'quot;');

    // Open a standalone print window (hides all app UI automatically)
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      showToast('error', 'Please allow pop-ups to print reports.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Report #${reportId} — ${safeType}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Khmer OS Battambang', 'Khmer OS', Arial, sans-serif;
              background: #ffffff;
              color: #111111;
              padding: 30px;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #333;
              padding-bottom: 14px;
              margin-bottom: 20px;
            }
            .header h1 { font-size: 24px; letter-spacing: 1px; }
            .header .restaurant-name { font-size: 28px; font-weight: bold; }
            .header .subtitle { font-size: 13px; color: #555; margin-top: 4px; }
            .info-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 8px 30px;
              margin-bottom: 18px;
              font-size: 14px;
            }
            .info-grid div { display: flex; gap: 6px; }
            .info-grid strong { min-width: 110px; }
            .summary-cards {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              margin-bottom: 20px;
            }
            .summary-card {
              flex: 1 1 150px;
              border: 1px solid #ccc;
              border-radius: 6px;
              padding: 12px 14px;
              text-align: center;
            }
            .summary-card .label { font-size: 12px; color: #666; }
            .summary-card .value { font-size: 20px; font-weight: bold; margin-top: 4px; }
            h3 {
              font-size: 15px;
              margin: 18px 0 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-left: 4px solid #333;
              padding-left: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #ccc;
              padding: 8px;
              text-align: center;
            }
            th { background-color: #f0f0f0; font-weight: bold; }
            td { color: #111; }
            .total-line {
              text-align: right;
              margin-top: 22px;
              font-size: 18px;
              font-weight: bold;
              border-top: 2px solid #333;
              padding-top: 10px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 11px;
              color: #777;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            @media print {
              body { padding: 10mm; }
              .no-print { display: none; }
              thead { display: table-header-group; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <!-- Restaurant Branding -->
          <div class="header">
            <div class="restaurant-name">RESTAURANT</div>
            <div class="subtitle">ភោជនីយដ្ឋាន — Sales Report</div>
            <div style="font-size:12px;color:#777;margin-top:4px;">123 Main Street, Phnom Penh, Cambodia — Tel: +855 23 000 000</div>
            <div style="font-size:14px;margin-top:8px;">
              <strong>${safeType}</strong> &nbsp;|&nbsp; Report #${reportId}
            </div>
          </div>

          <!-- Report Info -->
          <div class="info-grid">
            <div><strong>Report Type:</strong> ${safeType}</div>
            <div><strong>Report ID:</strong> #${reportId}</div>
            <div><strong>Report Date:</strong> ${createdDate}</div>
            <div><strong>Period:</strong> ${formatDate(startDateStr)} — ${formatDate(endDateStr)}</div>
            <div><strong>Generated By:</strong> ${generatedByName}</div>
            <div><strong>Created At:</strong> ${createdDate} ${createdTime}</div>
          </div>

          <!-- Summary Section -->
          <h3>Summary</h3>
          <div class="summary-cards">
            <div class="summary-card">
              <div class="label">Total Sales</div>
              <div class="value">${Number(totalSalesAmount).toFixed(2)}$</div>
            </div>
            <div class="summary-card">
              <div class="label">Total Orders</div>
              <div class="value">${totalOrders}</div>
            </div>
            <div class="summary-card">
              <div class="label">Avg / Transaction</div>
              <div class="value">${totalOrders !== '—' && Number(totalOrders) > 0 ? '$' + (Number(totalSalesAmount) / Number(totalOrders)).toFixed(2) : '$0.00'}</div>
            </div>
            <div class="summary-card">
              <div class="label">Generated By</div>
              <div class="value" style="font-size:14px;">${generatedByName}</div>
            </div>
          </div>

          <!-- Order Breakdown Table -->
          <h3>${breakMode === 'weekly' ? 'Weekly Sales Breakdown' : 'Daily Sales Breakdown'}</h3>
          <table>
            <thead>
              <tr>
                <th>${breakMode === 'weekly' ? 'Week Period' : 'Date'}</th>
                <th>Transactions</th>
                <th>Total Sales</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRowsHtml || '<tr><td colspan="3" style="text-align:center;color:#888;">No sales data for this period</td></tr>'}
            </tbody>
          </table>

          <!-- Cashier Info (Payment Methods) -->
          <h3>Cashier Info — Payment Methods</h3>
          <table>
            <thead>
              <tr>
                <th>Payment Method</th>
                <th>Transactions</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${paymentRowsHtml}</tbody>
          </table>

          <!-- Top Selling Items -->
          <h3>Top Selling Items</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>${topItemsHtml}</tbody>
          </table>

          <!-- Grand Total -->
          <div class="total-line">
            Total Sales: <span>${Number(totalSalesAmount).toFixed(2)}$</span>
          </div>

          <div class="footer">
            <p>Generated by Restaurant Management System — ${createdDate} ${createdTime}</p>
            <p class="no-print" style="margin-top:8px;display:block;">
              <button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;border:1px solid #333;background:#333;color:#fff;border-radius:4px;">Print / Save as PDF</button>
            </p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Reports & Analytics', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Sales analytics dashboard and report management', language)}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" />
          {t('Generate Report', language)}
        </button>
      </div>

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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ==================== Date Range Picker ==================== */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{t('Date Range:', language)}</span>
          </div>
          <div className="flex items-center gap-3 flex-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('Start Date', language)}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <span className="text-gray-400 mt-5">—</span>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('End Date', language)}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
              {t('Refresh', language)}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== Analytics Summary Cards ==================== */}
      {analyticsLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
      ) : (
        <>
          {/* Totals Cards */}
          {salesSummary?.totals && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('Total Sales', language)}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesSummary.totals.total_sales)}</p>
                  <p className="text-xs text-gray-400">{salesSummary.totals.start_date} → {salesSummary.totals.end_date}</p>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('Transactions', language)}</p>
                  <p className="text-2xl font-bold text-gray-900">{salesSummary.totals.total_transactions}</p>
                  <p className="text-xs text-gray-400">{t('Completed payments', language)}</p>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('Avg per Transaction', language)}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {salesSummary.totals.total_transactions > 0
                      ? formatCurrency(salesSummary.totals.total_sales / salesSummary.totals.total_transactions)
                      : '$0.00'}
                  </p>
                  <p className="text-xs text-gray-400">{t('Average order value', language)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sales Breakdown Table — adapts to weekly aggregation */}
          {salesSummary?.summary && salesSummary.summary.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">
                  {breakdownType === 'weekly' ? t('Weekly Sales Breakdown', language) : t('Daily Sales Breakdown', language)}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">
                        {breakdownType === 'weekly' ? t('Week Period', language) : t('Date', language)}
                      </th>
                      <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Transactions', language)}</th>
                      <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Total Sales', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {breakdownType === 'weekly'
                      ? aggregateWeekly(salesSummary.summary, startDate).map((week, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-medium">{week.weekLabel}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{week.transaction_count}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(week.total_sales)}</td>
                          </tr>
                        ))
                      : salesSummary.summary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 font-medium">{formatDate(row.sale_date)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{row.transaction_count}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.total_sales)}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Methods + Top Items Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Methods */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">{t('Payment Methods', language)}</h3>
              </div>
              {paymentMethods.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">{t('No payment data for this period.', language)}</div>
              ) : (
                <div className="p-4 space-y-3">
                  {paymentMethods.map((pm, idx) => {
                    const total = parseFloat(pm.total || 0);
                    const count = parseInt(pm.count || 0);
                    const grandTotal = paymentMethods.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
                    const percentage = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : 0;

                    let Icon = CreditCard;
                    const method = (pm.payment_method || pm.Payment_Method || '').toLowerCase();
                    if (method.includes('cash')) Icon = Wallet;
                    else if (method.includes('qr') || method.includes('aba') || method.includes('khqr')) Icon = Smartphone;

                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                          <Icon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{pm.payment_method || pm.Payment_Method}</p>
                          <p className="text-xs text-gray-500">{count} {t('transaction(s)', language)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</p>
                          <p className="text-xs text-gray-500">{percentage}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Selling Items */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">{t('Top Selling Items', language)}</h3>
              </div>
              {topItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">{t('No item data for this period.', language)}</div>
              ) : (
                <div className="p-4 space-y-3">
                  {topItems.map((item, idx) => {
                    const itemName = item.name || item.item_name || item.menu_name || item.Menu_Name || 'Item';
                    const qtySold = item.qty_sold ?? item.quantity ?? item.total_quantity ?? 0;
                    const revenue = item.revenue ?? item.total_revenue ?? 0;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-blue-600">#{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{itemName}</p>
                          <p className="text-xs text-gray-500">{qtySold} {t('sold', language)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(revenue)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== Reports List ==================== */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">{t('Generated Reports', language)}</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('Search reports...', language)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        )}

        {!loading && filteredReports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('No reports generated', language)}</h3>
            <p className="text-sm text-gray-500">{t('Click "Generate Report" to create your first report.', language)}</p>
          </div>
        )}

        {!loading && filteredReports.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Report ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Type', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Generated By', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Date', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Total Sales', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReports.map((report) => {
                  const reportId = report.report_id || report.Report_ID;
                  const reportType = report.report_type || report.Report_Type;
                  const reportDate = report.report_date || report.Report_Date;
                  const totalSales = parseFloat(report.total_sales ?? report.Total_Sales ?? 0);
                  // Use the robust resolveGeneratorName which tries staffList lookup,
                  // current user match, and role-based name mapping (Admin=1, Cashier=3)
                  const inlineGenName = resolveGeneratorName(report);

                  return (
                    <tr key={reportId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">#{reportId}</span></td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
                          {t(reportType, language)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{inlineGenName}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(reportDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(totalSales)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View / Download / Print */}
                          <button
                            onClick={() => handlePrintReport(report)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('Print / Download report', language)}
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Edit — Admin and Cashier */}
                          {(roleId === 1 || roleId === 3) && (
                            <button
                              onClick={() => openEditModal(report)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={t('Edit report', language)}
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                          )}

                          {/* Delete — Admin ONLY (role_id === 1) */}
                          {roleId === 1 && (
                            <button
                              onClick={() => confirmDelete(report)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('Delete report', language)}
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
        )}
      </div>

      {/* ==================== Create / Edit Modal ==================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingReport ? t('Edit Report', language) : t('Generate Report', language)}
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
                  {t('Report Type', language)} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.report_type}
                  onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {REPORT_TYPES.map((type) => (
                    <option key={type} value={type}>{t(type, language)}</option>
                  ))}
                </select>
              </div>

              {formData.report_type === 'Custom Range' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('Start Date', language)} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('End Date', language)} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.report_type === 'Yearly Sales' ? t('Reference Year', language) : t('Report Date', language)} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.report_date}
                    onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.report_type === 'Daily Sales' && t('The exact date for this daily report.', language)}
                    {formData.report_type === 'Weekly Sales' && t('The last date (end) of the 7-day period.', language)}
                    {formData.report_type === 'Monthly Sales' && t('The last date (end) of the 30-day period.', language)}
                    {formData.report_type === 'Yearly Sales' && t('Pick any date within the target year; the report will cover Jan 1 to Dec 31.', language)}
                  </p>
                </div>
              )}

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
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {formSubmitting ? t('Saving...', language) : editingReport ? t('Update Report', language) : t('Generate Report', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Delete Confirmation (Admin only) ==================== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Report', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">
                {t('Are you sure you want to permanently delete', language)}{' '}
                <span className="font-medium text-gray-700">
                  {t('Report', language)} #{deleteTarget.report_id || deleteTarget.Report_ID}
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

export default ReportsPage;