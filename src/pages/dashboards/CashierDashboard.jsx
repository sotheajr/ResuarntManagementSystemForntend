import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart, CreditCard, BarChart3, Table, UtensilsCrossed,
  ClipboardList, DollarSign, Printer, Search, X,
  CheckCircle, AlertCircle, RefreshCw, TrendingUp,
  Calendar, Filter, Download, Eye, Clock
} from 'lucide-react';
import { ordersAPI, paymentsAPI, reportsAPI, tablesAPI, menuAPI, customersAPI } from '../../services/api';
import AbaPaymentModal from '../../components/AbaPaymentModal';
import ReceiptModal from '../../components/ReceiptModal';
import LoadingSpinner from '../../components/LoadingSpinner';

const CashierDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // POS / Checkout state
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showAbaModal, setShowAbaModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null); // { paymentId, orderId }

  // Menu management state
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);

  // Table management state
  const [tables, setTables] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);

  // Sales reports state
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  // Orders management state
  const [allOrders, setAllOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    fetchPOSData();
  }, []);

  const fetchPOSData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, tablesRes] = await Promise.allSettled([
        ordersAPI.getAll(),
        tablesAPI.getAll(),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const orders = ordersRes.value.data?.data || [];
        setAllOrders(orders);
        setPendingOrders(orders.filter(o => 
          o.status === 'Pending' || o.status === 'pending'
        ));
      }
      if (tablesRes.status === 'fulfilled') setTables(tablesRes.value.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch POS data:', err);
      setError('Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (orderId) => {
    try {
      const res = await ordersAPI.getById(orderId);
      setSelectedOrder(res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to fetch order details:', err);
      setError('Failed to load order details.');
    }
  };

  const calculateOrderTotal = (order) => {
    if (!order) return 0;
    if (order.total_amount) return parseFloat(order.total_amount);
    if (order.total) return parseFloat(order.total);
    if (order.items) {
      const subtotal = order.items.reduce((sum, item) => {
        return sum + (parseFloat(item.price || 0) * (item.quantity || 1));
      }, 0);
      const discount = order.discount_percent ? subtotal * (order.discount_percent / 100) : 0;
      return subtotal - discount;
    }
    return 0;
  };

  const handleProcessPayment = async () => {
    if (!selectedOrder) return;

    if (paymentMethod === 'ABA Bank') {
      setShowAbaModal(true);
      return;
    }
    
    setProcessingPayment(true);
    setError(null);
    setSuccess(null);
    
    try {
      const paymentData = {
        order_id: selectedOrder.order_id || selectedOrder.id,
        payment_method: paymentMethod,
      };

      const res = await paymentsAPI.process(paymentData);
      
      setSuccess(`Payment of $${calculateOrderTotal(selectedOrder).toFixed(2)} processed successfully!`);
      setSelectedOrder(null);
      await fetchPOSData();
    } catch (err) {
      console.error('Payment failed:', err);
      setError(err.response?.data?.message || 'Payment processing failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleAbaSuccess = async (paidOrderId, paidPaymentId) => {
    try {
      if (selectedOrder) {
        await paymentsAPI.process({
          order_id: selectedOrder.order_id || selectedOrder.id,
          payment_method: 'ABA Bank',
        });
      }
      const orderId = paidOrderId || (selectedOrder ? selectedOrder.order_id || selectedOrder.id : null);
      setShowAbaModal(false);
      setSuccess(`KHQR payment of $${calculateOrderTotal(selectedOrder).toFixed(2)} completed!`);
      setSelectedOrder(null);
      await fetchPOSData();

      // Auto-open the Print Receipt modal for the paid order
      if (orderId) {
        setReceiptData({ paymentId: paidPaymentId || null, orderId });
      } else {
        // Navigate to the Payment Success page (cashier path) if no receipt
        navigate('/cashier/payment-success');
      }
    } catch (err) {
      console.error('Failed to record ABA payment:', err);
      setError('Payment was successful but failed to record. Please check the orders page.');
      setShowAbaModal(false);
      navigate('/cashier/payment-success');
    }
  };

  const handleReceiptClose = () => {
    setReceiptData(null);
    navigate('/cashier/payment-success');
  };

  const handleAbaClose = () => {
    setShowAbaModal(false);
  };

  const fetchMenuData = async () => {
    setMenuLoading(true);
    try {
      const res = await menuAPI.getAll();
      setMenuItems(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setMenuLoading(false);
    }
  };

  const fetchTableData = async () => {
    setTableLoading(true);
    try {
      const res = await tablesAPI.getAll();
      setTables(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchSalesReport = async () => {
    setReportLoading(true);
    setError(null);
    try {
      const [summaryRes, methodsRes, topItemsRes] = await Promise.allSettled([
        reportsAPI.salesSummary(dateRange),
        reportsAPI.paymentMethods(dateRange),
        reportsAPI.topItems(dateRange),
      ]);

      setReportData({
        summary: summaryRes.status === 'fulfilled' ? summaryRes.value.data?.data : null,
        paymentMethods: methodsRes.status === 'fulfilled' ? methodsRes.value.data?.data : null,
        topItems: topItemsRes.status === 'fulfilled' ? topItemsRes.value.data?.data : null,
      });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError('Failed to load sales reports.');
    } finally {
      setReportLoading(false);
    }
  };

  const fetchAllOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await ordersAPI.getAll();
      setAllOrders(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await ordersAPI.update(orderId, { status });
      await fetchAllOrders();
      await fetchPOSData();
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  const tabs = [
    { id: 'pos', label: 'POS / Checkout', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'tables', label: 'Tables', icon: Table },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'reports', label: 'Sales Reports', icon: BarChart3 },
  ];

  const paymentMethods = ['Cash', 'ABA Bank', 'ACLEDA Bank', 'Wing', 'Credit Card', 'Other'];

  return (
    <div className="space-y-4">
      {/* Success Banner */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'menu') fetchMenuData();
                if (tab.id === 'tables') fetchTableData();
                if (tab.id === 'orders') fetchAllOrders();
                if (tab.id === 'reports') fetchSalesReport();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        <button
          onClick={fetchPOSData}
          className="p-2.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ==================== POS / CHECKOUT TAB ==================== */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-600" />
              Pending Orders
            </h3>
            {pendingOrders.map(order => (
              <button
                key={order.order_id || order.id}
                onClick={() => handleSelectOrder(order.order_id || order.id)}
                className={`card w-full text-left hover:shadow-md transition-shadow ${
                  selectedOrder?.order_id === (order.order_id || order.id)
                    ? 'ring-2 ring-brand-600'
                    : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">Order #{order.order_id || order.id}</p>
                    <p className="text-xs text-gray-500">Table: {order.table_number || order.table?.table_number || 'N/A'}</p>
                    <p className="text-xs text-gray-400 mt-1">{order.items?.length || 0} item(s)</p>
                  </div>
                  <p className="font-bold text-lg text-brand-600">${calculateOrderTotal(order).toFixed(2)}</p>
                </div>
              </button>
            ))}
            {pendingOrders.length === 0 && !loading && (
              <p className="text-center text-gray-400 py-8">No pending orders.</p>
            )}
          </div>

          <div>
            {selectedOrder ? (
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Checkout - Order #{selectedOrder.order_id || selectedOrder.id}
                </h3>

                <div className="space-y-2 mb-4">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-gray-700">{item.menu_name || item.menu?.menu_name} x{item.quantity}</span>
                      <span className="font-medium">${(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {parseFloat(selectedOrder.discount_percent || 0) > 0 && (
                  <div className="flex justify-between text-sm text-brand-600 mb-2">
                    <span>Discount ({selectedOrder.discount_percent}%)</span>
                    <span>-${(() => {
                      const dTotal = calculateOrderTotal(selectedOrder);
                      const dPct = parseFloat(selectedOrder.discount_percent || 0);
                      const dSubtotal = dPct > 0 ? dTotal / (1 - dPct / 100) : dTotal;
                      return (dSubtotal - dTotal).toFixed(2);
                    })()}</span>
                  </div>
                )}

                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Total</span>
                    <span className="font-bold text-2xl text-green-600">${calculateOrderTotal(selectedOrder).toFixed(2)}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map(method => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          paymentMethod === method
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleProcessPayment}
                  disabled={processingPayment}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-lg"
                >
                  {processingPayment ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Processing...</>
                  ) : (
                    <><CreditCard className="w-5 h-5" />Process Payment - ${calculateOrderTotal(selectedOrder).toFixed(2)}</>
                  )}
                </button>

                <button onClick={() => setSelectedOrder(null)} className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-3">Cancel</button>
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">Select an order to checkout</p>
                <p className="text-sm mt-1">Choose a pending order from the list</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MENU MANAGEMENT TAB ==================== */}
      {activeTab === 'menu' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Menu Items</h3>
            <button onClick={fetchMenuData} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          {menuLoading ? (
            <LoadingSpinner message="Loading menu..." size="sm" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {menuItems.filter(item => {
                const isAvailable = item.status?.toLowerCase() === 'available' || item.is_available === true || item.status === 1;
                return isAvailable;
              }).map(item => (
                <div key={item.menu_id || item.id} className="card p-4">
                  <p className="font-medium text-gray-800 truncate">{item.menu_name || item.name}</p>
                  <p className="text-brand-600 font-bold mt-1">${parseFloat(item.price || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Status: <span className="text-green-600">Available</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TABLE MANAGEMENT TAB ==================== */}
      {activeTab === 'tables' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Tables</h3>
            <button onClick={fetchTableData} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          {tableLoading ? (
            <LoadingSpinner message="Loading tables..." size="sm" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tables.map(table => (
                <div key={table.table_id || table.id} className={`p-4 rounded-xl border-2 text-center ${
                  table.status === 'Available' ? 'border-green-500 bg-green-50' :
                  table.status === 'Occupied' ? 'border-red-500 bg-red-50' :
                  'border-accent-500 bg-accent-50'
                }`}>
                  <Table className="w-6 h-6 mx-auto mb-1" />
                  <p className="font-bold">T{table.table_number || table.table_number}</p>
                  <p className="text-xs mt-1">{table.status || 'Unknown'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== ORDERS MANAGEMENT TAB ==================== */}
      {activeTab === 'orders' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">All Orders</h3>
            <button onClick={fetchAllOrders} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          {ordersLoading ? (
            <LoadingSpinner message="Loading orders..." size="sm" />
          ) : (
            <div className="space-y-3">
              {allOrders.map(order => (
                <div key={order.order_id || order.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">Order #{order.order_id || order.id}</p>
                      <p className="text-xs text-gray-500">Table: {order.table_number || order.table?.table_number || 'N/A'} | Items: {order.items?.length || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-600">${calculateOrderTotal(order).toFixed(2)}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold mt-1 ${
                        order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'Pending' ? 'bg-accent-100 text-accent-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{order.status || 'Pending'}</span>
                    </div>
                  </div>
                  {order.status !== 'Completed' && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
                      <button onClick={() => handleUpdateOrderStatus(order.order_id || order.id, 'Completed')} className="text-xs btn-success py-1 px-3">Mark Completed</button>
                    </div>
                  )}
                </div>
              ))}
              {allOrders.length === 0 && <p className="text-center text-gray-400 py-8">No orders found.</p>}
            </div>
          )}
        </div>
      )}

      {/* ==================== SALES REPORTS TAB ==================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" />
              Sales Reports
            </h3>

            <div className="flex flex-wrap gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input type="date" value={dateRange.start_date}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input type="date" value={dateRange.end_date}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                  className="input-field text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={fetchSalesReport} disabled={reportLoading} className="btn-primary flex items-center gap-2">
                  {reportLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Filter className="w-4 h-4" />}
                  Generate Report
                </button>
              </div>
            </div>

            {reportLoading ? (
              <LoadingSpinner message="Generating report..." size="sm" />
            ) : reportData ? (
              <div className="space-y-6">
                {reportData.summary && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Sales Summary</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">${parseFloat(reportData.summary?.totals?.total_sales || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">Total Sales</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{reportData.summary?.totals?.total_transactions || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Transactions</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{reportData.summary?.summary?.length || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">Days</p>
                      </div>
                    </div>
                  </div>
                )}
                {reportData.paymentMethods && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Payment Methods</h4>
                    <div className="space-y-2">
                      {Array.isArray(reportData.paymentMethods) && reportData.paymentMethods.map((method, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                          <span className="font-medium text-gray-700">{method.payment_method || method.method}</span>
                          <div className="text-right">
                            <p className="font-bold text-gray-800">${parseFloat(method.total || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">{method.count || 0} transactions</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reportData.topItems && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Top Selling Items</h4>
                    <div className="space-y-2">
                      {Array.isArray(reportData.topItems) && reportData.topItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                            <span className="font-medium text-gray-700">{item.menu_name || item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-800">${parseFloat(item.total_revenue || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">{item.total_quantity || 0} sold</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3" />
                <p>Select a date range and generate a report</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== ABA PAYWAY MODAL ==================== */}
      {showAbaModal && selectedOrder && (
        <AbaPaymentModal
          totalAmount={calculateOrderTotal(selectedOrder)}
          orderId={selectedOrder.order_id || selectedOrder.id}
          tableName={selectedOrder.table_number || selectedOrder.table?.table_number || 'N/A'}
          onSuccess={handleAbaSuccess}
          onClose={handleAbaClose}
        />
      )}

      {/* ==================== PRINT RECEIPT MODAL ==================== */}
      {receiptData && (
        <ReceiptModal
          paymentId={receiptData.paymentId}
          orderId={receiptData.orderId}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  );
};

export default CashierDashboard;