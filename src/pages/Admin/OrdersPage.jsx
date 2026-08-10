import { useState, useEffect, useCallback } from 'react';
import { ordersAPI, customersAPI, tablesAPI, menuAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Plus, Trash2, Search, X, AlertTriangle,
  Loader2, ClipboardList, Eye, Filter, CheckCircle,
  ChefHat, Send, Ban, Minus, Plus as PlusIcon, ShoppingCart
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Preparing: 'bg-blue-100 text-blue-700 border-blue-200',
  Ready: 'bg-purple-100 text-purple-700 border-purple-200',
  Served: 'bg-green-100 text-green-700 border-green-200',
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_TRANSITIONS = {
  Pending: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['Served', 'Cancelled'],
  Served: ['Completed'],
  Completed: [],
  Cancelled: [],
};

const OrdersPage = () => {
  const { user, isAdmin, isWaiter } = useAuth();
  const role = user?.role || '';
  const currentUserId = user?.user_id || user?.User_ID;

  // Tab state
  const [activeTab, setActiveTab] = useState('all');

  // Data state
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Order modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form data for create
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [createForm, setCreateForm] = useState({
    customer_id: '',
    table_id: '',
    notes: '',
    discount_percent: '0',
    items: [],
  });

  // New item row
  const [newItem, setNewItem] = useState({ menu_id: '', quantity: 1, price: '' });

  // Delete confirmation (Admin only)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ==================== Field helper ====================
  const getField = (obj, ...keys) => {
    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined && val !== null) return val;
    }
    return '';
  };

  // ==================== Fetch Orders ====================
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      switch (activeTab) {
        case 'pending':
          response = await ordersAPI.getPending();
          break;
        case 'my-orders':
          response = await ordersAPI.getMyOrders();
          break;
        default:
          response = await ordersAPI.getAll();
      }
      setOrders(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ==================== Fetch reference data for create form ====================
  const fetchReferenceData = useCallback(async () => {
    try {
      const [custRes, tabRes, menuRes] = await Promise.all([
        customersAPI.getAll(),
        tablesAPI.getAll(),
        menuAPI.getAll(),
      ]);
      setCustomers(custRes.data?.data || []);
      setTables(tabRes.data?.data || []);
      setMenuItems(menuRes.data?.data || []);
    } catch (err) {
      // Silent — supplemental data
    }
  }, []);

  // ==================== Filtering ====================
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    const orderId = String(o.order_id || o.Order_ID || '');
    const customerName = (
      o.customer?.customer_name ||
      o.customer?.Customer_Name ||
      o.customer_name ||
      o.Customer_Name ||
      ''
    ).toLowerCase();
    const waiterName = (
      o.waiter?.username ||
      o.waiter?.Username ||
      o.waiter_name ||
      o.Waiter_Name ||
      ''
    ).toLowerCase();
    const tableNum = String(o.table?.table_number || o.table?.Table_Number || o.table_number || o.Table_Number || '');

    return (
      orderId.includes(term) ||
      customerName.includes(term) ||
      waiterName.includes(term) ||
      tableNum.includes(term)
    );
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

  const closeDetail = () => {
    setShowDetail(false);
    setDetailOrder(null);
  };

  // ==================== Status Update ====================
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const handleStatusUpdate = async (order, newStatus) => {
    const orderId = order.order_id || order.Order_ID;
    setUpdatingStatus(orderId);
    try {
      await ordersAPI.update(orderId, { status: newStatus });
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleMarkServed = async (order) => {
    const orderId = order.order_id || order.Order_ID;
    setUpdatingStatus(orderId);
    try {
      await ordersAPI.complete(orderId);
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark order as served');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ==================== Delete (Admin only) ====================
  const confirmDelete = (order) => {
    setDeleteTarget(order);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const orderId = deleteTarget.order_id || deleteTarget.Order_ID;
      await ordersAPI.delete(orderId);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete order');
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== Create Order ====================
  const openCreateModal = () => {
    fetchReferenceData();
    setCreateForm({
      customer_id: '',
      table_id: '',
      notes: '',
      discount_percent: '0',
      items: [],
    });
    setNewItem({ menu_id: '', quantity: 1, price: '' });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

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

    // Auto-fill discounted price when menu item selected
    if (name === 'menu_id' && value) {
      const selected = menuItems.find(
        (m) => String(m.menu_id || m.Menu_ID) === value
      );
      if (selected) {
        const finalPrice = getFinalPrice(selected);
        setNewItem((prev) => ({ ...prev, price: String(finalPrice) }));
      }
    }
  };

  const addItemToOrder = () => {
    if (!newItem.menu_id || !newItem.quantity || !newItem.price) {
      return;
    }
    const selected = menuItems.find(
      (m) => String(m.menu_id || m.Menu_ID) === newItem.menu_id
    );
    const itemName = selected?.menu_name || selected?.Menu_Name || 'Item';
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          menu_id: parseInt(newItem.menu_id),
          quantity: parseInt(newItem.quantity),
          price: parseFloat(newItem.price),
          item_name: itemName,
          _tempId: Date.now(),
        },
      ],
    }));
    setNewItem({ menu_id: '', quantity: 1, price: '' });
  };

  const removeItemFromOrder = (tempId) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i._tempId !== tempId),
    }));
  };

  // Calculate totals
  const subtotal = createForm.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  const discountPercent = parseFloat(createForm.discount_percent) || 0;
  const discountAmount = (discountPercent / 100) * subtotal;
  const total = subtotal - discountAmount;

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    if (!createForm.table_id) {
      setFormErrors({ table_id: 'Table is required' });
      return;
    }
    if (createForm.items.length === 0) {
      setFormErrors({ items: 'At least one menu item is required' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        table_id: parseInt(createForm.table_id),
        customer_id: createForm.customer_id ? parseInt(createForm.customer_id) : undefined,
        notes: createForm.notes || undefined,
        discount_percent: discountPercent > 0 ? discountPercent : undefined,
        items: createForm.items.map((item) => ({
          menu_id: item.menu_id,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      await ordersAPI.create(payload);
      closeCreateModal();
      await fetchOrders();
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      if (err.response?.data?.errors) {
        const fieldErrors = {};
        Object.entries(err.response.data.errors).forEach(([key, msgs]) => {
          fieldErrors[key] = Array.isArray(msgs) ? msgs[0] : msgs;
        });
        setFormErrors(fieldErrors);
      } else {
        setFormErrors({ general: serverMsg || 'Failed to create order' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER ====================
  const tabs = [
    { key: 'all', label: 'All Orders' },
    { key: 'pending', label: 'Pending Orders' },
  ];
  if (isWaiter) {
    tabs.push({ key: 'my-orders', label: 'My Orders' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'Admin'
              ? 'Manage all restaurant orders — create, update status, and track order flow'
              : role === 'Waiter'
              ? 'Manage your assigned orders and track their progress'
              : 'View and manage all orders from the system'}
          </p>
        </div>
        {/* Create Order — Admin, Waiter, Cashier */}
        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
        >
          <Plus className="w-4 h-4" />
          Create Order
        </button>
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

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">
            {searchTerm ? 'No orders found' : 'No orders yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm
              ? 'Try adjusting your search term'
              : 'Create your first order to get started'}
          </p>
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
            <Plus className="w-4 h-4" />
            Create Order
          </button>
        </div>
      )}

      {/* ==================== Orders Table ==================== */}
      {!loading && filteredOrders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Order ID</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Table</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Customer</th>
                  <th className="text-left py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Waiter</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Total</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Discount</th>
                  <th className="text-center py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Status</th>
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const orderId = order.order_id || order.Order_ID;
                  const status = order.status || order.Status || 'Pending';
                  const totalAmount = parseFloat(order.total_amount ?? order.Total_Amount ?? 0);
                  const customerName =
                    order.customer?.customer_name ||
                    order.customer?.Customer_Name ||
                    order.customer_name ||
                    order.Customer_Name ||
                    'Walk-in';
                  const waiterName =
                    order.waiter?.username ||
                    order.waiter?.Username ||
                    order.waiter_name ||
                    order.Waiter_Name ||
                    '—';
                  const tableNumber =
                    order.table?.table_number ||
                    order.table?.Table_Number ||
                    order.table_number ||
                    order.Table_Number ||
                    '—';
                  const discountPercent = parseFloat(order.discount_percent ?? order.Discount_Percent ?? 0);
                  const availableTransitions = STATUS_TRANSITIONS[status] || [];

                  return (
                    <tr key={orderId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">#{orderId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700">{tableNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{waiterName}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          ${totalAmount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {discountPercent > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border bg-red-50 text-red-600 border-red-200">
                            -{discountPercent}%
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${
                            STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details — ALL roles */}
                          <button
                            onClick={() => openDetail(order)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          {/* Status Actions — Admin, Waiter, Cashier */}
                          {availableTransitions.length > 0 && (
                            <div className="flex items-center gap-1">
                              {availableTransitions.map((nextStatus) => {
                                const iconMap = {
                                  Preparing: <ChefHat className="w-4 h-4" />,
                                  Ready: <CheckCircle className="w-4 h-4" />,
                                  Served: <Send className="w-4 h-4" />,
                                  Cancelled: <Ban className="w-4 h-4" />,
                                };
                                const colorMap = {
                                  Preparing: 'text-blue-600 hover:bg-blue-50',
                                  Ready: 'text-purple-600 hover:bg-purple-50',
                                  Served: 'text-green-600 hover:bg-green-50',
                                  Cancelled: 'text-red-600 hover:bg-red-50',
                                };
                                return (
                                  <button
                                    key={nextStatus}
                                    onClick={() => handleStatusUpdate(order, nextStatus)}
                                    disabled={updatingStatus === orderId}
                                    className={`p-2 rounded-lg transition-colors ${
                                      colorMap[nextStatus] || 'text-gray-600 hover:bg-gray-100'
                                    } disabled:opacity-50 disabled:cursor-wait`}
                                    title={`Mark as ${nextStatus}`}
                                  >
                                    {updatingStatus === orderId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      iconMap[nextStatus] || null
                                    )}
                                  </button>
                                );
                              })}
                              {/* Mark as Served shortcut */}
                              {status === 'Ready' && (
                                <button
                                  onClick={() => handleMarkServed(order)}
                                  disabled={updatingStatus === orderId}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
                                  title="Mark as Served"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Delete — Admin ONLY */}
                          {isAdmin && (
                            <button
                              onClick={() => confirmDelete(order)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete order"
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
        </div>
      )}

      {/* ==================== Order Detail Modal (All roles) ==================== */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Order #{detailOrder?.order_id || detailOrder?.Order_ID || ''}
              </h2>
              <button
                onClick={closeDetail}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : detailOrder ? (
              <div className="px-6 py-4 space-y-5">
                {/* Status badge + Summary */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${
                      STATUS_COLORS[detailOrder.status || detailOrder.Status || 'Pending'] ||
                      'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    {detailOrder.status || detailOrder.Status || 'Pending'}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${parseFloat(detailOrder.total_amount ?? detailOrder.Total_Amount ?? 0).toFixed(2)}
                  </span>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-gray-500 mb-0.5">Customer</span>
                    <span className="font-medium text-gray-900">
                      {detailOrder.customer?.customer_name ||
                        detailOrder.customer?.Customer_Name ||
                        detailOrder.customer_name ||
                        'Walk-in'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-0.5">Table</span>
                    <span className="font-medium text-gray-900">
                      {detailOrder.table?.table_number ||
                        detailOrder.table?.Table_Number ||
                        detailOrder.table_number ||
                        '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-0.5">Waiter</span>
                    <span className="font-medium text-gray-900">
                      {detailOrder.waiter?.username ||
                        detailOrder.waiter?.Username ||
                        detailOrder.waiter_name ||
                        '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-0.5">Order Date</span>
                    <span className="font-medium text-gray-900">
                      {detailOrder.order_date || detailOrder.Order_Date
                        ? new Date(detailOrder.order_date || detailOrder.Order_Date).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                  {parseFloat(detailOrder.discount_percent ?? detailOrder.Discount_Percent ?? 0) > 0 && (
                    <div>
                      <span className="block text-gray-500 mb-0.5">Discount</span>
                      <span className="font-medium text-red-600">
                        -{detailOrder.discount_percent || detailOrder.Discount_Percent}%
                      </span>
                    </div>
                  )}
                  {detailOrder.notes || detailOrder.Notes ? (
                    <div className="col-span-2">
                      <span className="block text-gray-500 mb-0.5">Notes</span>
                      <p className="font-medium text-gray-900 bg-gray-50 rounded-lg p-3">
                        {detailOrder.notes || detailOrder.Notes}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Order Line Items */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-2">
                    Order Items
                  </h3>
                  {(detailOrder.order_details || detailOrder.orderDetails || []).length > 0 ? (
                    <div className="space-y-2">
                      {(detailOrder.order_details || detailOrder.orderDetails || []).map((item, idx) => {
                        const itemKey = item.order_detail_id || item.Order_Detail_ID || idx;
                        const itemName =
                          item.menu_item?.menu_name ||
                          item.menu_item?.Menu_Name ||
                          item.menu_name ||
                          item.Menu_Name ||
                          'Item';
                        const qty = item.quantity || item.Quantity || 0;
                        const price = parseFloat(item.price || item.Price || 0);
                        const lineSubtotal = parseFloat(item.subtotal || item.Subtotal || qty * price);

                        return (
                          <div
                            key={itemKey}
                            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400 font-mono text-xs">{idx + 1}.</span>
                              <div>
                                <span className="font-medium text-gray-900">{itemName}</span>
                                <span className="text-gray-500 ml-2">
                                  x{qty} @ ${price.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <span className="font-medium text-gray-900">
                              ${lineSubtotal.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No items loaded</p>
                  )}

                  {/* Totals */}
                  {(() => {
                    const dTotal = parseFloat(detailOrder.total_amount ?? detailOrder.Total_Amount ?? 0);
                    const dDiscountPct = parseFloat(detailOrder.discount_percent ?? detailOrder.Discount_Percent ?? 0);
                    const dSubtotal = dDiscountPct > 0 ? dTotal / (1 - dDiscountPct / 100) : dTotal;
                    const dDiscountAmt = dSubtotal - dTotal;
                    return (
                      <div className="mt-4 pt-3 border-t border-gray-200 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotal</span>
                          <span>${dSubtotal.toFixed(2)}</span>
                        </div>
                        {dDiscountPct > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Discount ({dDiscountPct}%)</span>
                            <span>-${dDiscountAmt.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-gray-900 text-base pt-1 border-t border-gray-200">
                          <span>Total</span>
                          <span>${dTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-500">
                Failed to load order details
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeDetail}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Create Order Modal (Admin, Waiter, Cashier) ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create New Order</h2>
              <button
                onClick={closeCreateModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-4 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formErrors.general}
                </div>
              )}
              {formErrors.items && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formErrors.items}
                </div>
              )}

              {/* Customer + Table row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Customer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    name="customer_id"
                    value={createForm.customer_id}
                    onChange={handleCreateFormChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option
                        key={c.customer_id || c.Customer_ID}
                        value={c.customer_id || c.Customer_ID}
                      >
                        {c.customer_name || c.Customer_Name || c.name || 'Customer'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Table */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Table <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="table_id"
                    value={createForm.table_id}
                    onChange={handleCreateFormChange}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.table_id ? 'border-red-400' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a table</option>
                    {tables.map((t) => {
                      const tableId = t.table_id || t.Table_ID;
                      const tableNum = t.table_number || t.Table_Number;
                      const tableStatus = t.status || t.Status || 'Available';
                      return (
                        <option key={tableId} value={tableId}>
                          Table {tableNum} ({tableStatus})
                        </option>
                      );
                    })}
                  </select>
                  {formErrors.table_id && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.table_id}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={createForm.notes}
                  onChange={handleCreateFormChange}
                  placeholder="Optional notes for the order"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* ===== Menu Items Section ===== */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Items <span className="text-red-500">*</span>
                </label>

                {/* Add item row */}
                <div className="flex items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Menu Item</label>
                    <select
                      name="menu_id"
                      value={newItem.menu_id}
                      onChange={handleNewItemChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select item</option>
                      {(() => {
                        // Strict filtering for available items only
                        const availableMenuItems = (menuItems || []).filter(item => {
                          const statusVal = String(item.status || item.STATUS || '').toLowerCase().trim();
                          const isAvailable = item.is_available ?? item.IS_AVAILABLE;

                          // If boolean is used:
                          if (typeof isAvailable === 'boolean') return isAvailable;
                          if (typeof isAvailable === 'number') return isAvailable === 1;

                          // If string status is used (e.g. "Available" vs "Unavailable"):
                          return statusVal === 'available' || statusVal === '1' || statusVal === 'true';
                        });

                        return availableMenuItems.map((m) => {
                          const menuId = m.menu_id || m.Menu_ID;
                          const menuName = m.menu_name || m.Menu_Name;
                          const basePrice = parseFloat(m.price ?? m.Price ?? 0);
                          const discount = parseFloat(m.discount_percent ?? m.Discount_Percent ?? m.discount ?? m.Discount ?? 0);
                          const finalPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
                          return (
                            <option key={menuId} value={menuId}>
                              {menuName} — ${finalPrice.toFixed(2)}{discount > 0 ? ` (Original: $${basePrice.toFixed(2)})` : ''}
                            </option>
                          );
                        });
                      })()}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-500 mb-1">Qty</label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      value={newItem.quantity}
                      onChange={handleNewItemChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">Price</label>
                    <input
                      type="number"
                      name="price"
                      step="0.01"
                      min="0"
                      value={newItem.price}
                      onChange={handleNewItemChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addItemToOrder}
                    disabled={!newItem.menu_id || !newItem.quantity || !newItem.price}
                    className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Add item"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Added items list */}
                {createForm.items.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {createForm.items.map((item) => (
                      <div
                        key={item._tempId}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.item_name}</span>
                          <span className="text-gray-500">
                            x{item.quantity} @ ${item.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-700">
                            ${(item.quantity * item.price).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItemFromOrder(item._tempId)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3 italic">
                    No items added yet. Select a menu item above and click + to add.
                  </p>
                )}

                {/* Discount */}
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-32">
                    <label className="block text-xs text-gray-500 mb-1">Discount % (optional)</label>
                    <input
                      type="number"
                      name="discount_percent"
                      min="0"
                      max="100"
                      value={createForm.discount_percent}
                      onChange={handleCreateFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {createForm.items.length > 0 && (
                    <div className="flex-1 text-right text-sm space-y-0.5 pt-4">
                      <div className="text-gray-500">
                        Subtotal: <span className="font-medium text-gray-700">${subtotal.toFixed(2)}</span>
                      </div>
                      {discountPercent > 0 && (
                        <div className="text-red-500">
                          Discount ({discountPercent}%): -${discountAmount.toFixed(2)}
                        </div>
                      )}
                      <div className="text-base font-bold text-gray-900">
                        Total: ${total.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <ShoppingCart className="w-4 h-4" />
                  Create Order
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Order</h3>
              <p className="text-sm text-gray-500 mb-2">
                Are you sure you want to delete{' '}
                <span className="font-medium text-gray-700">
                  Order #{deleteTarget.order_id || deleteTarget.Order_ID}
                </span>
                ?
              </p>
              <p className="text-xs text-red-500">
                This will also free the table and remove all order details permanently.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;