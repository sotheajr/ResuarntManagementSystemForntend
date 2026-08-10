import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Shield, FolderTree, UtensilsCrossed, Table,
  UsersRound, CalendarCheck, ClipboardList, CreditCard,
  BarChart3, Package, Truck, DollarSign,
  ShoppingBag, AlertTriangle, RefreshCw, AlertCircle
} from 'lucide-react';
import api, { ordersAPI, paymentsAPI, inventoryAPI, usersAPI, tablesAPI } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    activeTables: 0,
    lowStockItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try the dedicated dashboard-summary endpoint first
      let summaryData = null;
      try {
        const summaryRes = await api.get('/admin/dashboard-summary');
        summaryData = summaryRes.data?.data || summaryRes.data;
      } catch (summaryErr) {
        // Fallback: fetch individual endpoints
        console.log('Dashboard summary endpoint not available, fetching individual endpoints...');
      }

      if (summaryData) {
        setStats({
          totalUsers: summaryData.total_users || summaryData.totalUsers || 0,
          totalOrders: summaryData.total_orders || summaryData.totalOrders || 0,
          todayRevenue: parseFloat(summaryData.today_revenue || summaryData.todayRevenue || 0),
          pendingOrders: summaryData.pending_orders || summaryData.pendingOrders || 0,
          activeTables: summaryData.active_tables || summaryData.activeTables || 0,
          lowStockItems: summaryData.low_stock_items || summaryData.lowStockItems || 0,
        });
      } else {
        // Fallback: fetch from individual endpoints
        const [ordersRes, paymentsRes, inventoryRes, usersRes, tablesRes] = await Promise.allSettled([
          ordersAPI.getAll(),
          paymentsAPI.getToday(),
          inventoryAPI.getLowStock(),
          usersAPI.getAll(),
          tablesAPI.getAll(),
        ]);

        const orders = ordersRes.status === 'fulfilled' ? ordersRes.value.data?.data || [] : [];
        const payments = paymentsRes.status === 'fulfilled' ? paymentsRes.value.data?.data || [] : [];
        const lowStock = inventoryRes.status === 'fulfilled' ? inventoryRes.value.data?.data || [] : [];
        const users = usersRes.status === 'fulfilled' ? usersRes.value.data?.data || [] : [];
        const tables = tablesRes.status === 'fulfilled' ? tablesRes.value.data?.data || [] : [];

        const todayRevenue = Array.isArray(payments)
          ? payments.reduce((sum, p) => sum + parseFloat(p.amount || p.total_amount || 0), 0)
          : 0;

        setStats({
          totalUsers: users.length,
          totalOrders: orders.length,
          todayRevenue,
          pendingOrders: orders.filter(o => (o.status === 'Pending' || o.status === 'pending')).length,
          activeTables: tables.filter(t => (t.status === 'Occupied' || t.status === 'occupied')).length,
          lowStockItems: lowStock.length,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'bg-blue-500' },
    { label: 'Menu Items', icon: UtensilsCrossed, path: '/admin/menu', color: 'bg-green-500' },
    { label: 'Tables', icon: Table, path: '/admin/tables', color: 'bg-purple-500' },
    { label: 'Orders', icon: ClipboardList, path: '/admin/orders', color: 'bg-orange-500' },
    { label: 'Reports', icon: BarChart3, path: '/admin/reports', color: 'bg-red-500' },
    { label: 'Inventory', icon: Package, path: '/admin/inventory', color: 'bg-teal-500' },
  ];

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: "Today's Revenue", value: `$${stats.todayRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Active Tables', value: stats.activeTables, icon: Table, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Low Stock Items', value: stats.lowStockItems, icon: Package, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Loading dashboard data..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Connection Error</h3>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={fetchDashboardData} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.full_name || 'Admin'}!
          </h2>
          <p className="text-gray-500 mt-1">Here's what's happening at your restaurant today.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-3 p-4">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{stat.label}</p>
                <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="card hover:shadow-md transition-shadow cursor-pointer text-center p-4 flex flex-col items-center gap-2"
              >
                <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Full Management Sections */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Full System Management</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Users & Roles', desc: 'Manage staff accounts and permissions', icon: Users, path: '/admin/users' },
            { label: 'Categories', desc: 'Organize menu categories and sub-categories', icon: FolderTree, path: '/admin/categories' },
            { label: 'Menu Items', desc: 'Add and update food & beverage items', icon: UtensilsCrossed, path: '/admin/menu' },
            { label: 'Tables', desc: 'Manage restaurant table layout', icon: Table, path: '/admin/tables' },
            { label: 'Customers', desc: 'View and manage customer information', icon: UsersRound, path: '/admin/customers' },
            { label: 'Reservations', desc: 'Handle table reservations', icon: CalendarCheck, path: '/admin/reservations' },
            { label: 'Orders', desc: 'View and manage all orders', icon: ClipboardList, path: '/admin/orders' },
            { label: 'Payments', desc: 'Process payments and view receipts', icon: CreditCard, path: '/admin/payments' },
            { label: 'Reports', desc: 'Sales reports and analytics', icon: BarChart3, path: '/admin/reports' },
            { label: 'Inventory', desc: 'Track ingredient stock levels', icon: Package, path: '/admin/inventory' },
            { label: 'Suppliers', desc: 'Manage supplier information', icon: Truck, path: '/admin/suppliers' },
            { label: 'Roles & Permissions', desc: 'Configure role-based access', icon: Shield, path: '/admin/roles' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="card hover:shadow-md transition-shadow cursor-pointer text-left flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;