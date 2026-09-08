import { useState, useEffect, useCallback } from 'react';
import { ordersAPI, tablesAPI, usersAPI, customersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Trash2, Search, X, AlertTriangle,
  Loader2, ClipboardList, Eye,
  Ban, CheckCircle
} from 'lucide-react';

const STATUS_COLORS = {
  Paid: 'bg-green-100 text-green-700 border-green-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  paid: 'Paid',
  cancelled: 'Cancelled',
  completed: 'Paid',
};

const OrderHistoryPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();

  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);        // For Table_ID → Table_Number lookup
  const [waiters, setWaiters] = useState([]);      // For Waiter_ID / Cashier_ID → display name lookup
  const [customers, setCustomers] = useState([]);  // For Customer_ID → Customer_Name lookup
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const resolveStatusLabel = (order) => {
    const rawStatus = String(order?.status || order?.Status || order?.payment_status || order?.Payment_Status || 'paid').toLowerCase();
    if (rawStatus === 'cancelled') return 'Cancelled';
    return 'Paid';
  };

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  // ==================== Fetch Tables ====================
  const fetchTables = useCallback(async () => {
    try {
      const res = await tablesAPI.getAll();
      setTables(res.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // ==================== Fetch Waiters / Staff ====================
  const fetchWaiters = useCallback(async () => {
    try {
      const res = await usersAPI.getAll();
      setWaiters(res.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // ==================== Fetch Customers ====================
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await customersAPI.getAll();
      setCustomers(res.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // ==================== Fetch Order History ====================
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ordersAPI.getByType('history', { paginate: true, per_page: 15 });
      const data = response.data?.data;
      setOrders(data?.data || []);
      setPagination({
        currentPage: data?.current_page || 1,
        lastPage: data?.last_page || 1,
        total: data?.total || 0,
      });
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load data', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchOrders();
    fetchTables();
    fetchWaiters();
    fetchCustomers();
  }, [fetchOrders, fetchTables, fetchWaiters, fetchCustomers]);

  // ==================== Helper: resolve table number from nested relation or ID fallback ====================
  const resolveTableNumber = (order) => {
    // Try nested relation first (lowercase / uppercase)
    const fromRelation = order.table?.table_number ?? order.table?.Table_Number ?? order.table_number ?? order.Table_Number;
    if (fromRelation) return fromRelation;

    // Fallback: lookup by Table_ID
    const tableId = order.table_id ?? order.Table_ID;
    if (tableId) {
      const matched = tables.find(
        (t) => t.table_id === tableId || t.Table_ID === tableId
      );
      return matched?.table_number ?? matched?.Table_Number ?? '—';
    }
    return '—';
  };

  // ==================== Helper: resolve waiter name from nested relation or ID fallback ====================
  const resolveWaiterName = (order) => {
    // Try nested relation first — check all possible name fields
    const w = order.waiter;
    if (w) {
      const fromRelation = w.username ?? w.Username ?? w.full_name ?? w.Full_Name ?? w.name ?? w.Name;
      if (fromRelation) return fromRelation;
    }
    const flatName = order.waiter_name ?? order.Waiter_Name;
    if (flatName) return flatName;

    // Fallback: lookup by Waiter_ID against fetched staff list
    const waiterId = order.waiter_id ?? order.Waiter_ID;
    if (waiterId) {
      const numId = Number(waiterId);
      const matched = waiters.find(
        (w) => Number(w.user_id) === numId || Number(w.User_ID) === numId || Number(w.id) === numId
      );
      if (matched) {
        return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${waiterId}`;
      }
      // Users list not yet loaded or no match — render a meaningful placeholder
      return `Staff #${waiterId}`;
    }
    return '—';
  };

  // ==================== Helper: resolve customer name from nested relation or ID fallback ====================
  const resolveCustomerName = (order) => {
    // Try nested relation first
    const c = order.customer;
    if (c) {
      const fromRelation = c.customer_name ?? c.Customer_Name ?? c.name ?? c.Name;
      if (fromRelation) return fromRelation;
    }
    const flatName = order.customer_name ?? order.Customer_Name;
    if (flatName) return flatName;

    // Fallback: lookup by Customer_ID against fetched customers list
    const customerId = order.customer_id ?? order.Customer_ID;
    if (customerId) {
      const matched = customers.find(
        (c) => c.customer_id === customerId || c.Customer_ID === customerId
      );
      return matched?.customer_name ?? matched?.Customer_Name ?? 'Walk-in';
    }
    return 'Walk-in';
  };

  // ==================== Helper: resolve creator name from CREATED_BY column ====================
  const resolveCreatorName = (order) => {
    const creatorId = order.created_by ?? order.CREATED_BY;
    if (!creatorId) return '—';
    const numId = Number(creatorId);
    const matched = waiters.find(
      (u) => Number(u.user_id) === numId || Number(u.User_ID) === numId || Number(u.id) === numId
    );
    if (matched) {
      return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${creatorId}`;
    }
    return `Staff #${creatorId}`;
  };

  // ==================== Helper: resolve cashier name from payment.cashier relation, CHECKOUT_BY, or ID fallback ====================
  const resolveCashierName = (order) => {
    // Try nested payment → cashier relation (backend must eager-load payment.cashier)
    const p = order.payment;
    if (p) {
      const c = p.cashier;
      if (c) {
        const fromRelation = c.username ?? c.Username ?? c.full_name ?? c.Full_Name ?? c.name ?? c.Name;
        if (fromRelation) return fromRelation;
      }

      // Try the CHECKOUT_BY column on the payment record itself (our new dedicated field)
      const checkoutByOnPayment = p.checkout_by ?? p.CHECKOUT_BY;
      if (checkoutByOnPayment) {
        const numId = Number(checkoutByOnPayment);
        const matched = waiters.find(
          (w) => Number(w.user_id) === numId || Number(w.User_ID) === numId || Number(w.id) === numId
        );
        if (matched) {
          return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${checkoutByOnPayment}`;
        }
        return `Staff #${checkoutByOnPayment}`;
      }

      // Payment exists but no cashier nested — try flat cashier_id on payment
      const cashierIdOnPayment = p.cashier_id ?? p.Cashier_ID;
      if (cashierIdOnPayment) {
        const numId = Number(cashierIdOnPayment);
        const matched = waiters.find(
          (w) => Number(w.user_id) === numId || Number(w.User_ID) === numId || Number(w.id) === numId
        );
        if (matched) {
          return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${cashierIdOnPayment}`;
        }
        return `Staff #${cashierIdOnPayment}`;
      }
    }

    // Fallback: resolve from the CHECKOUT_BY column on the order itself
    const checkoutById = order.checkout_by ?? order.CHECKOUT_BY;
    if (checkoutById) {
      const numId = Number(checkoutById);
      const matched = waiters.find(
        (u) => Number(u.user_id) === numId || Number(u.User_ID) === numId || Number(u.id) === numId
      );
      if (matched) {
        return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${checkoutById}`;
      }
      return `Staff #${checkoutById}`;
    }

    // No payment record and no CHECKOUT_BY — show N/A
    return 'N/A';
  };

  // ==================== Filtering ====================
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    const orderId = String(o.order_id || o.Order_ID || '');
    const customerName = resolveCustomerName(o).toLowerCase();
    const waiterName = resolveWaiterName(o).toLowerCase();
    const cashierName = resolveCashierName(o).toLowerCase();
    const tableNum = String(resolveTableNumber(o));
    return orderId.includes(term) || customerName.includes(term) || waiterName.includes(term) || cashierName.includes(term) || tableNum.includes(term);
  });

  // ==================== Detail Modal ====================
  const openDetail = async (order) => {
    setDetailOrder(null);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const response = await ordersAPI.getById(order.id);
      setDetailOrder(response.data?.data || order);
    } catch (err) {
      setDetailOrder(order);
    } finally {
      setDetailLoading(false);
    }
  };
  const closeDetail = () => { setShowDetail(false); setDetailOrder(null); };

  // ==================== Delete (Admin only) ====================
  const confirmDelete = (order) => { setDeleteTarget(order); setShowDeleteConfirm(true); };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await ordersAPI.delete(deleteTarget.id);
      setShowDeleteConfirm(false); setDeleteTarget(null);
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || t('Operation failed', language));
      setShowDeleteConfirm(false);
    } finally { setSubmitting(false); }
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Order History', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Archived orders — paid and cancelled records', language)}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm"><CheckCircle className="w-3 h-3" /> {t('Paid', language)}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-semibold text-sm"><Ban className="w-3 h-3" /> {t('Cancelled', language)}</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder={t('Search order history...', language)} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
      )}

      {!loading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No order history', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('Paid and cancelled orders will appear here.', language)}</p>
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Order ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Table', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Customer', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Waiter', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Created By', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Checkout By', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Total', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const orderId = order.id;
                  const status = String(order.status || order.Status || order.payment_status || order.Payment_Status || 'paid').toLowerCase();
                  const customerName = resolveCustomerName(order);
                  const waiterName = resolveWaiterName(order);
                  const createdBy = resolveCreatorName(order);
                  const checkoutBy = resolveCashierName(order);
                  const tableNumber = resolveTableNumber(order);
                  const totalAmount = parseFloat(order.total_amount ?? 0);
                  const label = resolveStatusLabel(order);

                  return (
                    <tr key={orderId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">#{orderId}</span></td>
                      <td className="px-4 py-3"><span className="font-medium text-gray-700">{tableNumber}</span></td>
                      <td className="px-4 py-3 text-gray-600">{customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{waiterName}</td>
                      <td className="px-4 py-3 text-gray-600">{createdBy}</td>
                      <td className="px-4 py-3 text-gray-600">{checkoutBy}</td>
                      <td className="px-4 py-3 text-right"><span className="font-semibold text-gray-900">${totalAmount.toFixed(2)}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${status === 'cancelled' ? STATUS_COLORS.Cancelled : STATUS_COLORS.Paid}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openDetail(order)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title={t('View details', language)}><Eye className="w-5 h-5" /></button>

                          {isAdmin && (
                            <button onClick={() => confirmDelete(order)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('Delete order', language)}>
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

      {/* ==================== Detail Modal ==================== */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('Order', language)} #{detailOrder?.id || ''}</h2>
              <button onClick={closeDetail} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
            ) : detailOrder ? (
              <div className="px-6 py-4 space-y-5">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_COLORS[detailOrder.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {STATUS_LABELS[detailOrder.status] || detailOrder.status}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">${parseFloat(detailOrder.total_amount ?? 0).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="block text-gray-500 mb-0.5">{t('Customer', language)}</span><span className="font-medium text-gray-900">{resolveCustomerName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Table', language)}</span><span className="font-medium text-gray-900">{resolveTableNumber(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Waiter', language)}</span><span className="font-medium text-gray-900">{resolveWaiterName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Order Date', language)}</span><span className="font-medium text-gray-900">{detailOrder.created_at ? new Date(detailOrder.created_at).toLocaleString() : '—'}</span></div>
                </div>
                {/* Order Items */}
                {detailOrder.items && detailOrder.items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 border-b border-gray-100 pb-1">{t('Order Items', language)}</h4>
                    <div className="space-y-1.5">
                      {detailOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{item.menuItem?.menu_name || item.menu_item_id || 'Item'}</span>
                            <span className="text-gray-500">x{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">@ ${parseFloat(item.price || 0).toFixed(2)}</span>
                            <span className="font-medium text-gray-700">${(item.quantity * parseFloat(item.price || 0)).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-500">{t('Failed to load order details', language)}</div>
            )}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button onClick={closeDetail} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">{t('Close', language)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Delete Confirmation (Admin only) ==================== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Order from History', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">{t('Are you sure you want to permanently delete', language)} <span className="font-medium text-gray-700">{t('Order', language)} #{deleteTarget.id}</span> {t('from history?', language)}</p>
              <p className="text-xs text-red-500">{t('This action cannot be undone.', language)}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">{t('Cancel', language)}</button>
              <button onClick={handleDelete} disabled={submitting} className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {t('Delete', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;