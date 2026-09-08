import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentsAPI, usersAPI, ordersAPI, tablesAPI, customersAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle,
  Loader2, ClipboardList, CheckCircle, Printer,
  ArrowLeft, Receipt, DollarSign, User as UserIcon, Table as TableIcon
} from 'lucide-react';

const PaymentSuccessPage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId');

  const [payments, setPayments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Order-specific receipt state (when arriving from process payment ?orderId=)
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [allTables, setAllTables] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [receiptLoading, setReceiptLoading] = useState(Boolean(orderIdParam));

  // ==================== Fetch order for digital receipt ====================
  const fetchReceiptOrder = useCallback(async () => {
    if (!orderIdParam) return;
    setReceiptLoading(true);
    try {
      const response = await ordersAPI.getById(orderIdParam);
      setReceiptOrder(response.data?.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load order', language));
    } finally {
      setReceiptLoading(false);
    }
  }, [orderIdParam, language]);

  // ==================== Fetch reference data for receipt lookups ====================
  const fetchReference = useCallback(async () => {
    try {
      const [custRes, tabRes] = await Promise.all([customersAPI.getAll(), tablesAPI.getAll()]);
      setAllCustomers(custRes.data?.data || []);
      setAllTables(tabRes.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (orderIdParam) fetchReceiptOrder();
    fetchReference();
  }, [fetchReceiptOrder, fetchReference, orderIdParam]);

  // ==================== Fetch all payments ====================
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await paymentsAPI.getAll();
      const allPayments = response.data?.data || response.data || [];
      // Filter only Paid transactions (case-insensitive — Oracle/yajra returns lowercase values)
      setPayments(allPayments.filter((p) => {
        const s = String(p.payment_status || p.Payment_Status || '').toLowerCase();
        return s === 'paid';
      }));
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  // ==================== Fetch staff list for cashier name resolution ====================
  const fetchStaff = useCallback(async () => {
    try {
      const res = await usersAPI.getAll();
      setStaffList(res.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchStaff();
  }, [fetchPayments, fetchStaff]);

  // ==================== Resolve cashier name from ID ====================
  const resolveCashierName = (payment) => {
    // Try nested cashier relation first
    const c = payment.cashier;
    if (c) {
      const fromRelation = c.username ?? c.Username ?? c.full_name ?? c.Full_Name ?? c.name ?? c.Name;
      if (fromRelation) return fromRelation;
    }

    // Fallback: lookup by cashier_id against staff list
    const cashierId = payment.cashier_id ?? payment.Cashier_ID;
    if (cashierId) {
      const numId = Number(cashierId);
      const matched = staffList.find(
        (u) => Number(u.user_id) === numId || Number(u.User_ID) === numId || Number(u.id) === numId
      );
      if (matched) {
        return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${cashierId}`;
      }
      return `Staff #${cashierId}`;
    }

    return 'N/A';
  };

  // ==================== Filtering ====================
  const filteredPayments = payments.filter((p) => {
    const term = searchTerm.toLowerCase();
    const paymentId = String(p.payment_id || p.Payment_ID || '');
    const orderId = String(p.order_id || p.Order_ID || '');
    const cashierName = resolveCashierName(p).toLowerCase();
    const method = (p.payment_method || p.Payment_Method || '').toLowerCase();
    return paymentId.includes(term) || orderId.includes(term) || cashierName.includes(term) || method.includes(term);
  });

  // ==================== RENDER ====================
// ==================== Receipt resolvers ====================
  const resolveTableNumber = (ord) => {
    const fromRelation = ord?.table?.table_number ?? ord?.table?.Table_Number ?? ord?.table_number ?? ord?.Table_Number;
    if (fromRelation) return fromRelation;
    const tableId = ord?.table_id ?? ord?.Table_ID;
    if (tableId) {
      const matched = allTables.find((tbl) => tbl.table_id === tableId || tbl.Table_ID === tableId);
      return matched?.table_number ?? matched?.Table_Number ?? '—';
    }
    return '—';
  };

  const resolveCustomerName = (ord) => {
    const c = ord?.customer;
    if (c) {
      const fromRelation = c.customer_name ?? c.Customer_Name ?? c.name ?? c.Name;
      if (fromRelation) return fromRelation;
    }
    const customerId = ord?.customer_id ?? ord?.Customer_ID;
    if (customerId) {
      const matched = allCustomers.find((cst) => cst.customer_id === customerId || cst.Customer_ID === customerId);
      return matched?.customer_name ?? matched?.Customer_Name ?? 'Walk-in';
    }
    return 'Walk-in';
  };

  const resolveCashierFromOrder = (ord) => {
    const u = ord?.user;
    if (u) {
      const fromRelation = u.username ?? u.Username ?? u.full_name ?? u.Full_Name ?? u.name ?? u.Name;
      if (fromRelation) return fromRelation;
    }
    const uid = ord?.user_id ?? ord?.User_ID;
    if (uid) {
      const matched = staffList.find((w) => Number(w.user_id) === Number(uid) || Number(w.User_ID) === Number(uid) || Number(w.id) === Number(uid));
      return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? `Staff #${uid}`;
    }
    return '—';
  };

  // ==================== RENDER: Digital Receipt (when ?orderId= is present) ====================
  if (orderIdParam) {
    if (receiptLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t('Loading receipt...', language)}</span>
        </div>
      );
    }

    if (!receiptOrder) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{error || t('Order not found', language)}</p>
          <button onClick={() => navigate('/admin/orders/complete')} className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
            {t('Back to Complete Orders', language)}
          </button>
        </div>
      );
    }

    const ord = receiptOrder;
    const ordTotal = parseFloat(ord.total_amount ?? ord.Total_Amount ?? 0);
    const table = resolveTableNumber(ord);
    const customer = resolveCustomerName(ord);
    const cashier = resolveCashierFromOrder(ord);
    const orderId = ord.id ?? ord.order_id ?? ord.Order_ID;

    const handlePrint = () => {
      try {
        window.print();
      } catch (e) { /* noop */ }
    };

    return (
      <div className="space-y-6" id="printable-receipt">
        {/* Header */}
        <div className="card p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('Payment Successful!', language)}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            {t('Order', language)} #{orderId} — ${ordTotal.toFixed(2)} {t('paid', language)}
          </p>
          <p className="text-sm text-green-600 mb-4">{t('Your payment has been received. Thank you!', language)}</p>
        </div>

        {/* Digital receipt / printable invoice */}
        <div className="card overflow-hidden" id="receipt-section">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" />
              {t('Digital Receipt', language)}
            </h2>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" /> {t('Print Invoice', language)}
            </button>
          </div>
<div className="p-6 print:border print:p-2">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">BELTEI Restaurant</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date().toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('Invoice', language)} #INV-{orderId}</p>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3" /> {t('Paid', language)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="space-y-2">
                <p className="text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">{t('Order ID', language)}:</span> #{orderId}</p>
                <p className="text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">{t('Table', language)}:</span> #{table}</p>
                <p className="text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">{t('Customer', language)}:</span> {customer}</p>
                <p className="text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">{t('Cashier', language)}:</span> {cashier}</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">{t('Payment Status', language)}:</span> {t('Paid', language)}</p>
                <p className="text-gray-500 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">{t('Order Status', language)}:</span> {ord.status || ord.Status || 'completed'}</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('Ordered Items', language)}</p>
              <div className="space-y-2">
                {(ord.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 text-sm border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">
                      {item.name || item.menu_item?.name || item.MenuItem?.Name || t('Menu Item', language)}
                      {parseInt(item.quantity || 1) > 1 && <span className="text-gray-400"> x{item.quantity}</span>}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      ${(parseFloat(item.price || 0) * parseInt(item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 pt-4">
              <div className="flex justify-between text-2xl font-bold">
                <span className="text-gray-900 dark:text-white">{t('TOTAL', language)}</span>
                <span className="text-blue-600">${ordTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50 dark:bg-gray-800 flex justify-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" /> {t('Print Receipt', language)}
            </button>
            <button
              onClick={() => navigate('/admin/orders/complete')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {t('Back to Orders', language)}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Payment Success', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("All successfully paid transactions — records where payment status is 'Paid'", language)}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
            <CheckCircle className="w-3 h-3" /> {t('Paid', language)}
          </span>
          <span className="text-gray-400">{payments.length} {t('transaction(s)', language)}</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('Search payments...', language)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredPayments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No paid transactions found', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('Successfully processed payments will appear here.', language)}</p>
        </div>
      )}

      {/* ==================== Payments Table ==================== */}
      {!loading && filteredPayments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Payment ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Order ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Cashier', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Payment Date', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Payment Method', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Amount', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((payment) => {
                  const paymentId = payment.payment_id || payment.Payment_ID;
                  const orderId = payment.order_id || payment.Order_ID;
                  const cashierName = resolveCashierName(payment);
                  const paymentDate = payment.payment_date || payment.Payment_Date;
                  const paymentMethod = payment.payment_method || payment.Payment_Method;
                  const amount = parseFloat(payment.amount ?? payment.Amount ?? 0);
                  const status = payment.payment_status || payment.Payment_Status || 'Paid';

                  return (
                    <tr key={paymentId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">#{paymentId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-700">#{orderId}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{cashierName}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {paymentDate ? new Date(paymentDate).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700">{paymentMethod}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">${amount.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold border bg-green-100 text-green-700 border-green-200">
                          <CheckCircle className="w-3 h-3" />
                          {t('Paid', language)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSuccessPage;