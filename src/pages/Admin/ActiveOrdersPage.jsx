import { useState, useEffect, useCallback } from 'react';
import { ordersAPI, customersAPI, tablesAPI, menuAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Plus, Trash2, Search, X, AlertTriangle,
  Loader2, ClipboardList, Eye, CheckCircle,
  ChefHat, Send, Ban, Minus, Plus as PlusIcon, ShoppingCart, Clock
} from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  preparing: 'bg-blue-100 text-blue-700 border-blue-200',
  ready: 'bg-purple-100 text-purple-700 border-purple-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_TRANSITIONS = {
  pending: { next: 'preparing', label: 'Start Cook', icon: ChefHat, color: 'bg-blue-600 hover:bg-blue-700' },
  preparing: { next: 'ready', label: 'Mark Ready', icon: CheckCircle, color: 'bg-purple-600 hover:bg-purple-700' },
  ready: { next: 'completed', label: 'Complete & Pay', icon: Send, color: 'bg-green-600 hover:bg-green-700' },
};

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready'];

// Helper: calculate elapsed time since order creation
const getElapsedTime = (createdAt) => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m ago`;
};

const ActiveOrdersPage = () => {
  const { user, isAdmin, isWaiter } = useAuth();
  const { language } = useLanguage();
  const role = user?.role || '';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reference data for ID lookups (fetched on mount)
  const [allTables, setAllTables] = useState([]);       // For Table_ID → Table_Number lookup
  const [allWaiters, setAllWaiters] = useState([]);     // For Waiter_ID → username lookup
  const [allCustomers, setAllCustomers] = useState([]); // For Customer_ID → name lookup

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Order modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [createForm, setCreateForm] = useState({
    customer_id: '',
    table_id: '',
    waiter_id: '',  // Added waiter_id for Waiter selection
    notes: '',
    discount_percent: '0',
    items: [],
  });
  const [newItem, setNewItem] = useState({ menu_item_id: '', quantity: 1, price: '' });

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ==================== Helper resolvers (same pattern as OrderHistory) ====================
  const resolveTableNumber = (order) => {
    const fromRelation = order.table?.table_number ?? order.table?.Table_Number ?? order.table_number ?? order.Table_Number;
    if (fromRelation) return fromRelation;
    const tableId = order.table_id ?? order.Table_ID;
    if (tableId) {
      const matched = allTables.find((t) => t.table_id === tableId || t.Table_ID === tableId);
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

  const resolveCreatorName = (order) => {
    const creatorId = order.created_by ?? order.CREATED_BY;
    if (!creatorId) return '—';
    const numId = Number(creatorId);
    const matched = allWaiters.find(
      (u) => Number(u.user_id) === numId || Number(u.User_ID) === numId || Number(u.id) === numId
    );
    if (matched) {
      return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? matched?.name ?? matched?.Name ?? `Staff #${creatorId}`;
    }
    return `Staff #${creatorId}`;
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

  // ==================== Fetch Active Orders ====================
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ordersAPI.getByType('active');
      setOrders(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load active orders', language));
    } finally {
      setLoading(false);
    }
  }, [language]);

  // ==================== Fetch reference data for lookups (mount + create modal) ====================
  const fetchReferenceData = useCallback(async () => {
    try {
      const [custRes, tabRes, menuRes, usersRes] = await Promise.all([
        customersAPI.getAll(),
        tablesAPI.getAll(),
        menuAPI.getAll(),
        usersAPI.getAll(),
      ]);
      const fetchedCustomers = custRes.data?.data || [];
      const fetchedTables = tabRes.data?.data || [];
      const fetchedMenu = menuRes.data?.data || [];
      const fetchedUsers = usersRes.data?.data || [];

      setCustomers(fetchedCustomers);
      setTables(fetchedTables);
      setMenuItems(fetchedMenu);

      // Also populate the lookup states for the table rows
      setAllCustomers(fetchedCustomers);
      setAllTables(fetchedTables);
      setAllWaiters(fetchedUsers);
    } catch (err) {
      // Silent
    }
  }, []);

  // Fetch lookups on mount
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

  // ==================== Status Update ====================
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const handleStatusUpdate = async (order, newStatus) => {
    const orderId = order.id;
    setUpdatingStatus(orderId);
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to update status', language));
    } finally {
      setUpdatingStatus(null);
    }
  };

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
      setError(err.response?.data?.message || t('Failed to delete order', language));
      setShowDeleteConfirm(false);
    } finally { setSubmitting(false); }
  };

  // ==================== Create Order ====================
  const openCreateModal = () => {
    fetchReferenceData();
    setCreateForm({ customer_id: '', table_id: '', user_id: '', notes: '', items: [] });
    setNewItem({ menu_item_id: '', quantity: 1, price: '' });
    setFormErrors({});
    setShowCreateModal(true);
  };
  const closeCreateModal = () => setShowCreateModal(false);
  const handleCreateFormChange = (e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));
  };
  // Calculate discounted price for a menu item
  const getFinalPrice = (item) => {
    const basePrice = parseFloat(item.price ?? item.Price ?? 0);
    const discount = parseFloat(item.discount_percent ?? item.Discount_Percent ?? item.discount ?? item.Discount ?? 0);
    return discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem((prev) => ({ ...prev, [name]: value }));
    if (name === 'menu_item_id' && value) {
      const selected = menuItems.find((m) => String(m.id) === value);
      if (selected) {
        const finalPrice = getFinalPrice(selected);
        setNewItem((prev) => ({ ...prev, price: String(finalPrice), quantity: '1' }));
      }
    }
  };
  const addItemToOrder = () => {
    const menuItemId = newItem.menu_item_id;
    const qty = newItem.quantity;
    const price = newItem.price;

    if (!menuItemId || !qty || price === '' || price == null) return;
    const parsedQty = parseInt(qty, 10);
    const parsedPrice = parseFloat(price);
    if (parsedQty < 1 || isNaN(parsedPrice) || parsedPrice < 0) return;

    const selected = menuItems.find((m) => String(m.id) === String(menuItemId));
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, {
        menu_item_id: parseInt(menuItemId, 10),
        quantity: parsedQty,
        price: parsedPrice,
        item_name: selected?.menu_name || 'Item',
        _tempId: Date.now(),
      }],
    }));
    setNewItem({ menu_item_id: '', quantity: 1, price: '' });
  };
  const removeItemFromOrder = (tempId) => setCreateForm((prev) => ({ ...prev, items: prev.items.filter((i) => i._tempId !== tempId) }));

  const subtotal = createForm.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discountPercent = parseFloat(createForm.discount_percent) || 0;
  const discountAmount = (discountPercent / 100) * subtotal;
  const total = subtotal - discountAmount;

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!createForm.table_id) { setFormErrors({ table_id: t('Table is required', language) }); return; }
    if (createForm.items.length === 0) { setFormErrors({ items: t('At least one menu item is required', language) }); return; }
    setSubmitting(true);
    try {
      const itemsPayload = createForm.items.map((item) => ({
        menu_item_id: Number(item.menu_item_id),
        quantity: Number(item.quantity),
        price: Number(item.price),
      }));

      await ordersAPI.create({
        table_id: parseInt(createForm.table_id),
        customer_id: createForm.customer_id ? parseInt(createForm.customer_id) : null,
        user_id: createForm.user_id ? parseInt(createForm.user_id) : null,
        notes: createForm.notes || null,
        items: itemsPayload,
      });

      closeCreateModal();
      await fetchOrders();
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      const validationErrors = err.response?.data?.errors;

      if (validationErrors) {
        const fieldErrors = {};
        Object.entries(validationErrors).forEach(([key, msgs]) => {
          fieldErrors[key] = Array.isArray(msgs) ? msgs[0] : msgs;
        });
        setFormErrors(fieldErrors);
      } else {
        setFormErrors({ general: serverMsg || t('Failed to create order', language) });
      }
    } finally { setSubmitting(false); }
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Active Orders', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Live orders in progress — Pending, Preparing, Ready, and Served', language)}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus className="w-4 h-4" /> {t('Create Order', language)}
        </button>
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold text-sm">{t('Pending', language)}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">{t('Preparing', language)}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm">{t('Ready', language)}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm">{t('Served', language)}</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder={t('Search active orders...', language)} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
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
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No active orders', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('All orders have been served. Create a new order to get started.', language)}</p>
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
            <Plus className="w-4 h-4" /> {t('Create Order', language)}
          </button>
        </div>
      )}

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
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Created By', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Total', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Discount', language)}</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Status', language)}</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const orderId = order.id;
                  const status = order.status || 'pending';
                  const customerName = resolveCustomerName(order);
                  const waiterName = resolveWaiterName(order);
                  const tableNumber = resolveTableNumber(order);
                  const totalAmount = parseFloat(order.total_amount ?? 0);
                  const transition = STATUS_TRANSITIONS[status];

                  return (
                    <tr key={orderId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">#{orderId}</span></td>
                      <td className="px-4 py-3"><span className="font-medium text-gray-700">{tableNumber}</span></td>
                      <td className="px-4 py-3 text-gray-600">{customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{waiterName}</td>
                      <td className="px-4 py-3 text-right"><span className="font-semibold text-gray-900">${totalAmount.toFixed(2)}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{STATUS_LABELS[status] || status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openDetail(order)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title={t('View details', language)}><Eye className="w-5 h-5" /></button>
                          {transition && (
                            <button onClick={() => handleStatusUpdate(order, transition.next)} disabled={updatingStatus === orderId}
                              className={`p-2 rounded-lg transition-colors text-white ${transition.color} disabled:opacity-50 disabled:cursor-wait`} title={transition.label}>
                              {updatingStatus === orderId ? <Loader2 className="w-4 h-4 animate-spin" /> : <transition.icon className="w-4 h-4" />}
                            </button>
                          )}
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
              <h2 className="text-lg font-semibold text-gray-900">{t('Order', language)} #{detailOrder?.order_id || detailOrder?.Order_ID || ''}</h2>
              <button onClick={closeDetail} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
            ) : detailOrder ? (
              <div className="px-6 py-4 space-y-5">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_COLORS[detailOrder.status || detailOrder.Status || 'Pending'] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {t(detailOrder.status || detailOrder.Status || 'Pending', language)}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">${parseFloat(detailOrder.total_amount ?? detailOrder.Total_Amount ?? 0).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="block text-gray-500 mb-0.5">{t('Customer', language)}</span><span className="font-medium text-gray-900">{resolveCustomerName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Table', language)}</span><span className="font-medium text-gray-900">{resolveTableNumber(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Waiter', language)}</span><span className="font-medium text-gray-900">{resolveWaiterName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Created By', language)}</span><span className="font-medium text-gray-900">{resolveCreatorName(detailOrder)}</span></div>
                  <div><span className="block text-gray-500 mb-0.5">{t('Order Date', language)}</span><span className="font-medium text-gray-900">{detailOrder.created_at ? new Date(detailOrder.created_at).toLocaleString() : '—'}</span></div>
                  {detailOrder.notes && (
                    <div className="col-span-2"><span className="block text-gray-500 mb-0.5">{t('Notes', language)}</span><span className="font-medium text-gray-900">{detailOrder.notes}</span></div>
                  )}
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

      {/* ==================== Create Order Modal ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('Create New Order', language)}</h2>
              <button onClick={closeCreateModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-4 space-y-4">
              {formErrors.general && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formErrors.general}</div>}
              {formErrors.items && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formErrors.items}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Waiter (បុគ្គលិកលើកម្ហូប)', language)} <span className="text-red-500">*</span></label>
                  <select name="waiter_id" value={createForm.waiter_id} onChange={handleCreateFormChange} className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.waiter_id ? 'border-red-400' : 'border-gray-300'}`}>
                    <option value="">{t('Select waiter', language)}</option>
                    {allWaiters
                      .filter((u) => {
                        const roleName = u.role?.role_name || u.role?.Role_Name || '';
                        return roleName.toLowerCase() === 'waiter';
                      })
                      .map((u) => (
                        <option key={u.User_ID || u.user_id} value={u.User_ID || u.user_id}>
                          {u.Username || u.username || u.Full_Name || u.full_name || u.Name || u.name || `User #${u.User_ID || u.user_id}`}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Customer', language)}</label>
                  <select name="customer_id" value={createForm.customer_id} onChange={handleCreateFormChange} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{t('Walk-in Customer', language)}</option>
                    {customers.map((c) => (<option key={c.id} value={c.id}>{c.customer_name}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Table', language)} <span className="text-red-500">*</span></label>
                  <select name="table_id" value={createForm.table_id} onChange={handleCreateFormChange} className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.table_id ? 'border-red-400' : 'border-gray-300'}`}>
                    <option value="">{t('Select a table', language)}</option>
                    {tables.map((tbl) => (<option key={tbl.id} value={tbl.id}>{t('Table', language)} {tbl.table_number} ({tbl.status || t('Available', language)})</option>))}
                  </select>
                  {formErrors.table_id && <p className="mt-1 text-xs text-red-500">{formErrors.table_id}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Notes', language)}</label>
                <textarea name="notes" value={createForm.notes} onChange={handleCreateFormChange} placeholder={t('Optional notes for the order', language)} rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Order Items', language)} <span className="text-red-500">*</span></label>
                <div className="flex items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{t('Menu Item', language)}</label>
                      <select name="menu_item_id" value={newItem.menu_item_id} onChange={handleNewItemChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">{t('Select item', language)}</option>
                        {menuItems
                          .filter((m) => {
                            const itemStatus = m.status?.toLowerCase?.() || String(m.status || '').toLowerCase();
                            return itemStatus === 'available' || itemStatus === '1' || itemStatus === 'true' || m.is_available === true;
                          })
                          .map((m) => {
                            const basePrice = parseFloat(m.price ?? 0);
                            const discount = parseFloat(m.discount_percent ?? 0);
                            const finalPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
                            return (
                              <option key={m.id} value={m.id}>
                                {m.menu_name} — ${finalPrice.toFixed(2)}{discount > 0 ? ` (Original: $${basePrice.toFixed(2)})` : ''}
                              </option>
                            );
                          })}
                      </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-500 mb-1">{t('Qty', language)}</label>
                    <input type="number" name="quantity" min="1" step="1" value={newItem.quantity} onChange={handleNewItemChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">{t('Price', language)}</label>
                    <input type="number" name="price" step="0.01" min="0" value={newItem.price} onChange={handleNewItemChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                   <button type="button" onClick={addItemToOrder} disabled={!newItem.menu_id || !newItem.quantity || newItem.price === '' || newItem.price == null} className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title={t('Add item', language)}><PlusIcon className="w-5 h-5" /></button>
                </div>
                {createForm.items.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {createForm.items.map((item) => (
                      <div key={item._tempId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-2"><span className="font-medium text-gray-900">{item.item_name}</span><span className="text-gray-500">x{item.quantity} @ ${item.price.toFixed(2)}</span></div>
                        <div className="flex items-center gap-3"><span className="font-medium text-gray-700">${(item.quantity * item.price).toFixed(2)}</span>
                          <button type="button" onClick={() => removeItemFromOrder(item._tempId)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Minus className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400 mb-3 italic">{t('No items added yet. Select a menu item above and click + to add.', language)}</p>}
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-32">
                    <label className="block text-xs text-gray-500 mb-1">{t('Discount % (optional)', language)}</label>
                    <input type="number" name="discount_percent" min="0" max="100" value={createForm.discount_percent} onChange={handleCreateFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {createForm.items.length > 0 && (
                    <div className="flex-1 text-right text-sm space-y-0.5 pt-4">
                      <div className="text-gray-500">{t('Subtotal:', language)} <span className="font-medium text-gray-700">${subtotal.toFixed(2)}</span></div>
                      {discountPercent > 0 && <div className="text-red-500">{t('Discount', language)} ({discountPercent}%): -${discountAmount.toFixed(2)}</div>}
                      <div className="text-base font-bold text-gray-900">{t('Total:', language)} ${total.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeCreateModal} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">{t('Cancel', language)}</button>
                <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}<ShoppingCart className="w-4 h-4" /> {t('Create Order', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Delete Confirmation ==================== */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('Delete Order', language)}</h3>
              <p className="text-sm text-gray-500 mb-2">{t('Are you sure you want to delete', language)} <span className="font-medium text-gray-700">{t('Order', language)} #{deleteTarget.order_id || deleteTarget.Order_ID}</span>?</p>
              <p className="text-xs text-red-500">{t('This will also free the table and remove all order details permanently.', language)}</p>
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

export default ActiveOrdersPage;