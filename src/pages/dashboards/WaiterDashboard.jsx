import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Table, ClipboardList, Receipt, UserCheck, Plus,
  Minus, ShoppingCart, CheckCircle, AlertCircle,
  RefreshCw, Search, X, Clock, Users
} from 'lucide-react';
import { tablesAPI, categoriesAPI, menuAPI, ordersAPI, customersAPI, reservationsAPI } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const WaiterDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tables');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);

  const [reservations, setReservations] = useState([]);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatReservationId, setSeatReservationId] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, categoriesRes, menuRes, customersRes, ordersRes] = await Promise.allSettled([
        tablesAPI.getAll(),
        categoriesAPI.getAll(),
        menuAPI.getAll(),
        customersAPI.getAll(),
        ordersAPI.getMyOrders(),
      ]);

      if (tablesRes.status === 'fulfilled') setTables(tablesRes.value.data?.data || []);
      if (categoriesRes.status === 'fulfilled') {
        const cats = categoriesRes.value.data?.data || [];
        setCategories(cats);
        if (cats.length > 0) setSelectedCategory(cats[0].category_id || cats[0].id);
      }
      if (menuRes.status === 'fulfilled') setMenuItems(menuRes.value.data?.data || []);
      if (customersRes.status === 'fulfilled') setCustomers(customersRes.value.data?.data || []);
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatGuest = async (tableId) => {
    try {
      const tableReservations = reservations.filter(
        r => r.table_id === tableId && (r.status === 'Pending' || r.status === 'Confirmed')
      );
      if (tableReservations.length > 0) {
        await reservationsAPI.seat(tableReservations[0].reservation_id);
      } else {
        await tablesAPI.update(tableId, { status: 'Occupied' });
      }
      const tablesRes = await tablesAPI.getAll();
      setTables(tablesRes.data?.data || []);
    } catch (err) {
      console.error('Failed to seat guest:', err);
      setError('Failed to seat guest. Please try again.');
    }
  };

  const getTableStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'border-green-500 bg-green-50 text-green-700';
      case 'occupied': return 'border-red-500 bg-red-50 text-red-700';
      case 'reserved': return 'border-accent-400 bg-accent-50 text-accent-700';
      default: return 'border-gray-300 bg-gray-50 text-gray-600';
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_id === (item.menu_id || item.id));
      if (existing) {
        return prev.map(i =>
          i.menu_id === (item.menu_id || item.id) ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [{
        menu_id: item.menu_id || item.id,
        menu_name: item.menu_name || item.name,
        price: parseFloat(item.price || 0),
        quantity: 1,
      }];
    });
  };

  const removeFromCart = (menuId) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_id === menuId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.menu_id === menuId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.menu_id !== menuId);
    });
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCreateOrder = async () => {
    if (!selectedTable || cart.length === 0) {
      setError('Please select a table and add items to the order.');
      return;
    }
    setLoading(true);
    try {
      await ordersAPI.create({
        table_id: selectedTable.table_id || selectedTable.id,
        customer_id: selectedCustomer?.customer_id || selectedCustomer?.id || 1,
        items: cart.map(item => ({
          menu_id: item.menu_id,
          quantity: item.quantity,
          price: item.price,
        })),
      });
      setCart([]);
      setSelectedTable(null);
      setSelectedCustomer(null);
      const ordersRes = await ordersAPI.getMyOrders();
      setOrders(ordersRes.data?.data || []);
      setActiveTab('myorders');
    } catch (err) {
      console.error('Failed to create order:', err);
      setError('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await ordersAPI.update(orderId, { status });
      const ordersRes = await ordersAPI.getMyOrders();
      setOrders(ordersRes.data?.data || []);
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  const handleViewBill = async (orderId) => {
    try {
      const orderRes = await ordersAPI.getById(orderId);
      setSelectedBill(orderRes.data?.data || orderRes.data);
    } catch (err) {
      console.error('Failed to fetch bill:', err);
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    const isAvailable = item.status?.toLowerCase() === 'available' || item.is_available === true || item.status === 1;
    if (!isAvailable) return false;
    const matchesCategory = selectedCategory ? (item.category_id === selectedCategory) : true;
    const matchesSearch = searchTerm
      ? (item.menu_name || item.name)?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  const tabs = [
    { id: 'tables', label: 'Tables', icon: Table },
    { id: 'neworder', label: 'New Order', icon: Plus },
    { id: 'myorders', label: 'My Orders', icon: ClipboardList },
    { id: 'bill', label: 'View Bill', icon: Receipt },
  ];

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Loading waiter dashboard..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        <button onClick={fetchInitialData} className="p-2.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'tables' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Table Layout</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map(table => (
              <button key={table.table_id || table.id}
                onClick={() => { setSelectedTable(table); if (table.status?.toLowerCase() === 'available') handleSeatGuest(table.table_id || table.id); }}
                className={`p-4 rounded-xl border-2 text-center transition-all hover:shadow-md ${getTableStatusColor(table.status)} ${selectedTable?.table_id === (table.table_id || table.id) ? 'ring-2 ring-brand-600' : ''}`}>
                <Table className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold text-lg">T{table.table_number || table.table_number}</p>
                <p className="text-xs mt-1">Cap: {table.capacity || '-'}</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-sm font-semibold mt-2 bg-white/80">{table.status || 'Unknown'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'neworder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Select Table</h3>
              <div className="flex flex-wrap gap-2">
                {tables.filter(t => t.status?.toLowerCase() === 'available' || t.status?.toLowerCase() === 'occupied').map(table => (
                  <button key={table.table_id || table.id} onClick={() => setSelectedTable(table)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      selectedTable?.table_id === (table.table_id || table.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    T{table.table_number || table.table_number} ({table.status})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${!selectedCategory ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                All
              </button>
              {categories.map(cat => (
                <button key={cat.category_id || cat.id} onClick={() => setSelectedCategory(cat.category_id || cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedCategory === (cat.category_id || cat.id) ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {cat.category_name || cat.name}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search menu items..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="input-field pl-10" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMenuItems.map(item => (
                <button key={item.menu_id || item.id} onClick={() => addToCart(item)}
                  className="card text-left p-3 hover:shadow-md transition-shadow cursor-pointer">
                  <p className="font-medium text-sm text-gray-800 truncate">{item.menu_name || item.name}</p>
                  <p className="text-brand-600 font-bold mt-1">${parseFloat(item.price || 0).toFixed(2)}</p>
                  {item.discount_percent > 0 && <span className="badge-accent text-xs">-{item.discount_percent}% off</span>}
                </button>
              ))}
              {filteredMenuItems.length === 0 && <p className="col-span-full text-center text-gray-400 py-8">No menu items found.</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Cart ({cart.length})</h3>
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">Clear</button>}
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Customer (optional)</label>
                <select value={selectedCustomer?.customer_id || selectedCustomer?.id || ''}
                  onChange={(e) => { const val = e.target.value; const c = customers.find(c => (c.customer_id || c.id) === parseInt(val)); setSelectedCustomer(c || null); }}
                  className="input-field text-sm">
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.customer_name || c.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.menu_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.menu_name}</p>
                      <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button onClick={() => removeFromCart(item.menu_id)} className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"><Minus className="w-3 h-3" /></button>
                      <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Cart is empty</p>}
              </div>

              {cart.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-800">Total:</span>
                    <span className="font-bold text-lg text-green-600">${getCartTotal().toFixed(2)}</span>
                  </div>
                  <button onClick={handleCreateOrder} disabled={loading || !selectedTable}
                    className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><CheckCircle className="w-4 h-4" /> Place Order</>}
                  </button>
                  {!selectedTable && <p className="text-xs text-red-500 text-center mt-1">Please select a table first</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'myorders' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">My Orders</h3>
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.order_id || order.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">Order #{order.order_id || order.id}</p>
                    <p className="text-xs text-gray-500">Table: {order.table_number || order.table?.table_number || 'N/A'} | Customer: {order.customer_name || order.customer?.customer_name || 'Walk-in'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm font-semibold ${order.status === 'Completed' ? 'bg-green-100 text-green-700' : order.status === 'Pending' ? 'bg-accent-100 text-accent-700' : 'bg-blue-100 text-blue-700'}`}>
                    {order.status || 'Pending'}
                  </span>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="text-sm text-gray-600">{order.items.map((item, idx) => (
                    <span key={idx}>{item.menu_name || item.menu?.menu_name} x{item.quantity}{idx < order.items.length - 1 ? ', ' : ''}</span>
                  ))}</div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  <div>
                    <p className="font-bold text-green-600">${parseFloat(order.total_amount || order.total || 0).toFixed(2)}</p>
                    {parseFloat(order.discount_percent || 0) > 0 && <p className="text-xs text-red-500">-{order.discount_percent}% discount</p>}
                  </div>
                  <div className="flex gap-2">
                    {order.status !== 'Completed' && (
                      <button onClick={() => handleUpdateOrderStatus(order.order_id || order.id, 'Completed')} className="text-xs btn-success py-1 px-3">Mark Served</button>
                    )}
                    <button onClick={() => handleViewBill(order.order_id || order.id)} className="text-xs btn-primary py-1 px-3">View Bill</button>
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="text-center text-gray-400 py-8">No orders yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'bill' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">View Bill</h3>
          <div className="space-y-3">
            {orders.filter(o => o.status === 'Completed').map(order => (
              <button key={order.order_id || order.id} onClick={() => handleViewBill(order.order_id || order.id)}
                className="card w-full text-left hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">Order #{order.order_id || order.id}</p>
                    <p className="text-xs text-gray-500">Table: {order.table_number || order.table?.table_number || 'N/A'}</p>
                  </div>
                  <p className="font-bold text-green-600">${parseFloat(order.total_amount || order.total || 0).toFixed(2)}</p>
                </div>
              </button>
            ))}
            {orders.filter(o => o.status === 'Completed').length === 0 && <p className="text-center text-gray-400 py-8">No completed orders to bill.</p>}
          </div>

          {selectedBill && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Bill - Order #{selectedBill.order_id || selectedBill.id}</h3>
                  <button onClick={() => setSelectedBill(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-2 mb-4">
                  {selectedBill.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.menu_name || item.menu?.menu_name} x{item.quantity}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 space-y-1">
                  {parseFloat(selectedBill.discount_percent || 0) > 0 && (
                    <div className="flex justify-between text-sm text-brand-600">
                      <span>Discount ({selectedBill.discount_percent}%)</span>
                      <span>-${(() => { const dTotal = parseFloat(selectedBill.total_amount || selectedBill.total || 0); const dPct = parseFloat(selectedBill.discount_percent || 0); return ((dTotal / (1 - dPct / 100)) - dTotal).toFixed(2); })()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-green-600">${parseFloat(selectedBill.total_amount || selectedBill.total || 0).toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedBill(null)} className="btn-primary w-full mt-4">Close</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WaiterDashboard;