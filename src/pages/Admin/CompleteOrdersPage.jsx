import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI, paymentsAPI, tablesAPI, customersAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Search, X, AlertTriangle,
  Loader2, ClipboardList, Eye, CreditCard, CheckCircle,
  Printer, DollarSign, Wallet, Landmark, Smartphone
} from 'lucide-react';

const STATUS_COLORS = {
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Wallet },
  { value: 'Card', label: 'Credit/Debit Card', icon: CreditCard },
  { value: 'Bank Transfer', label: 'Bank Transfer', icon: Landmark },
  { value: 'Mobile Payment', label: 'Mobile Payment', icon: Smartphone },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const CompleteOrdersPage = () => {
  const { user, isAdmin, isCashier } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const rolePrefix = isAdmin ? '/admin' : isCashier ? '/cashier' : '/waiter';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reference data for ID lookups
  const [allTables, setAllTables] = useState([]);
  const [allWaiters, setAllWaiters] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Notification / Toast
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message }

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ==================== Helper resolvers ====================
  const resolveTableNumber = (order) => {
    const fromRelation = order.table?.table_number ?? order.table?.Table_Number ?? order.table_number ?? order.Table_Number;
    if (fromRelation) return fromRelation;
    const tableId = order.table_id ?? order.Table_ID;
    if (tableId) {
      const matched = allTables.find((tbl) => tbl.table_id === tableId || tbl.Table_ID === tableId);
      return matched?.table_number ?? matched?.Table_Number ?? '—';
    }
    return '—';
  };

  const resolveWaiterName = (order) => {
    const w = order.waiter;
    if (w) {
      const fromRelation = w.username ?? w.Username ?? w.full_name ?? w.Full_Name ?? w.name ?? w.Name;
      if (fromRelation) return fromRelation;
    }
    const flatName = order.waiter_name ?? order.Waiter_Name;
    if (flatName) return flatName;
    const waiterId = order.waiter_id ?? order.Waiter_ID;
    if (waiterId) {
      const numId = Number(waiterId);
      const matched = allWaiters.find(
        (wr) => Number(wr.user_id) === numId || Number(wr.User_ID) === numId || Number(wr.id) === numId
      );
      if (matched) return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${waiterId}`;
      return `Staff #${waiterId}`;
    }
    return '—';
  };

  const resolveCustomerName = (order) => {
    const c = order.customer;
    if (c) {
      const fromRelation = c.customer_name ?? c.Customer_Name ?? c.name ?? c.Name;
      if (fromRelation) return fromRelation;
    }
    const flatName = order.customer_name ?? order.Customer_Name;
    if (flatName) return flatName;
    const customerId = order.customer_id ?? order.Customer_ID;
    if (customerId) {
      const matched = allCustomers.find((cst) => cst.customer_id === customerId || cst.Customer_ID === customerId);
      return matched?.customer_name ?? matched?.Customer_Name ?? 'Walk-in';
    }
    return 'Walk-in';
  };

  // ==================== Fetch Completed Orders ====================
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ordersAPI.getAll();
      const allOrders = response.data?.data || [];
      setOrders(allOrders.filter((o) => {
        const s = o.status || o.Status || '';
        return s === 'Served' || s === 'Completed';
      }));
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load completed orders', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  // ==================== Fetch reference data for lookups ====================
  const fetchReferenceData = useCallback(async () => {
    try {
      const [custRes, tabRes, usersRes] = await Promise.all([
        customersAPI.getAll(),
        tablesAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setAllCustomers(custRes.data?.data || []);
      setAllTables(tabRes.data?.data || []);
      setAllWaiters(usersRes.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchReferenceData();
  }, [fetchOrders, fetchReferenceData]);

  // ==================== Filtering ====================
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    const orderId = String(o.order_id || o.Order_ID || '');
    const customerName = resolveCustomerName(o).toLowerCase();
    const waiterName = resolveWaiterName(o).toLowerCase();
    const tableNum = String(resolveTableNumber(o));
    return orderId.includes(term) || customerName.includes(term) || waiterName.includes(term) || tableNum.includes(term);
  });

  // ==================== Detail Modal ====================
  const openDetail = async (order) => {
    setDetailOrder(null);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const response = await ordersAPI.getById(order.order_id || order.Order_ID);
      setDetailOrder(response.data?.data || order);
    } catch (err) {
      setDetailOrder(order);
    } finally {
      setDetailLoading(false);
    }
  };
  const closeDetail = () => { setShowDetail(false); setDetailOrder(null); };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Complete Orders', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Orders waiting for final checkout — process payment to move to Order History', language)}
          </p>
        </div>
      </div>

      {/* ==================== Toast Notification ==================== */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-slide-in ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-50 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">{t('Completed', language)}</span>
          <span className="text-gray-400">— {t('Ready for payment', language)}</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder={t('Search completed orders...', language)} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No orders awaiting checkout', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('Completed orders will appear here when they are ready for payment.', language)}</p>
        </div>
      )}

      {/* ==================== Orders Table ==================== */}
      {!loading && filteredOrders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Order ID', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Table', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Customer', language)}</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Waiter', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Total', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const orderId = order.order_id || order.Order_ID;
                  const status = order.status || order.Status || 'Completed';
                  const customerName = resolveCustomerName(order);
                  const waiterName = resolveWaiterName(order);
                  const tableNumber = resolveTableNumber(order);
                  const totalAmount = parseFloat(order.total_amount ?? order.Total_Amount ?? 0);

                  return (
                    <tr key={orderId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">#{orderId}</span></td>
                      <td className="px-4 py-3"><span className="font-medium text-gray-700">{tableNumber}</span></td>
                      <td className="px-4 py-3 text-gray-600">{customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{waiterName}</td>
                      <td className="px-4 py-3 text-right"><span className="font-semibold text-gray-900">${totalAmount.toFixed(2)}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{t(status, language)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openDetail(order)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title={t('View details', language)}><Eye className="w-5 h-5" /></button>
                          <button
                            onClick={() => navigate(`${rolePrefix}/payments?orderId=${orderId}`)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            title={t('Process payment', language)}
                          >
                            <CreditCard className="w-4 h-4" />
                            {t('Pay / Checkout', language)}
                          </button>
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
              <h2 className="text-lg font-semibold text-gray-900">{t('Order', language)} #{detailOrder?.order_id || detailOrder?.Order_ID || ''}</h2>
              <button onClick={closeDetail} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
            ) : detailOrder ? (
              <div className="px-6 py-4 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border bg-gray-100 text-gray-700 border-gray-200">
                    {t(detailOrder.status || detailOrder.Status || 'Completed', language)}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">${parseFloat(detailOrder.total_amount ?? detailOrder.Total_Amount ?? 0).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="block text-gray-500 mb-0.5">{t('Customer', language)}</span><span className="font-medium text-gray-900">{resolveCustomerName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Table', language)}</span><span className="font-medium text-gray-900">{resolveTableNumber(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Waiter', language)}</span><span className="font-medium text-gray-900">{resolveWaiterName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Order Date', language)}</span><span className="font-medium text-gray-900">{detailOrder.order_date || detailOrder.Order_Date ? new Date(detailOrder.order_date || detailOrder.Order_Date).toLocaleString() : '—'}</span></div>
                </div>
                {/* Order Items — parsed safely from the single ITEMS JSON column */}
                {(detailOrder.ITEMS || detailOrder.items) && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 border-b border-gray-100 pb-1">{t('Order Items', language)}</h4>
                    <div className="space-y-1.5">
                      {(() => {
                        const rawItems = detailOrder.ITEMS || detailOrder.items;
                        const itemsList = typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || []);
                        return itemsList.map((foodItem, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{foodItem.name || foodItem.Name || foodItem.item_name || 'Item'}</span>
                              <span className="text-gray-500">x{foodItem.qty || foodItem.Qty || foodItem.quantity || 1}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">@ ${parseFloat(foodItem.price || foodItem.Price || 0).toFixed(2)}</span>
                              <span className="font-medium text-gray-700">${(parseInt(foodItem.qty || foodItem.Qty || foodItem.quantity || 1) * parseFloat(foodItem.price || foodItem.Price || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                        ));
                      })()}
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

    </div>
  );
};

export default CompleteOrdersPage;