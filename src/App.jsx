import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FontSizeProvider } from './context/FontSizeContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import UsersManagement from './pages/Admin/UsersManagement';
import RolesManagement from './pages/Admin/RolesManagement';
import CategoriesPage from './pages/Admin/CategoriesPage';
import MenuItemsPage from './pages/Admin/MenuItemsPage';
import TablesPage from './pages/Admin/TablesPage';
import CustomersPage from './pages/Admin/CustomersPage';
import OrdersPage from './pages/Admin/OrdersPage';
import ActiveOrdersPage from './pages/Admin/ActiveOrdersPage';
import CompleteOrdersPage from './pages/Admin/CompleteOrdersPage';
import OrderHistoryPage from './pages/Admin/OrderHistoryPage';
import PaymentsPage from './pages/Admin/PaymentsPage';
import PaymentSuccessPage from './pages/Admin/PaymentSuccessPage';
import ReportsPage from './pages/Admin/ReportsPage';
import ReservationsPage from './pages/Admin/ReservationsPage';
import InventoryPage from './pages/Admin/InventoryPage';
import ProfilePage from './pages/ProfilePage';
import SuppliersPage from './pages/Admin/SuppliersPage';
import PurchasesPage from './pages/Admin/PurchasesPage';
import PartnersPage from './pages/Admin/PartnersPage';
import PayrollPage from './pages/Admin/PayrollPage';
import AttendancePage from './pages/Admin/AttendancePage';
import ClockInPage from './pages/Admin/ClockInPage';
import ClockOutPage from './pages/Admin/ClockOutPage';
import RecycleBin from './pages/Admin/RecycleBin';
import WaiterDashboard from './pages/dashboards/WaiterDashboard';
import CashierDashboard from './pages/dashboards/CashierDashboard';
import PaymentQRDisplay from './pages/Display/PaymentQRDisplay';
import StripeSuccess from './pages/Payment/StripeSuccess';
import StripeCancel from './pages/Payment/StripeCancel';

// ==================== SEO: Dynamic per-route meta tags ====================
const SEOMeta = () => {
  const location = useLocation();

  useEffect(() => {
    // Map path -> { title, description } for SEO-friendly page titles
    const pageMeta = [
      { path: '/', title: 'Restaurant Management System | POS, Orders, Payroll & Reports', desc: 'Complete restaurant management system for Cambodia.' },
      { path: '/login', title: 'Login | Restaurant Management System', desc: 'Sign in to manage your restaurant — POS, orders, inventory, payroll, and reports.' },
      { path: '/register', title: 'Register | Restaurant Management System', desc: 'Create an account for your restaurant management system.' },
      { path: '/qr-display', title: 'KHQR Payment Display | Restaurant Management System', desc: 'Customer payment QR display for KHQR / ABA payments.' },
      { path: '/admin/dashboard', title: 'Admin Dashboard | Restaurant Management System', desc: 'Admin overview of restaurant operations — sales, orders, and management.' },
      { path: '/admin/menu', title: 'Menu Items | Restaurant Management System', desc: 'Manage menu items, prices, categories, and availability.' },
      { path: '/admin/categories', title: 'Categories | Restaurant Management System', desc: 'Manage menu categories and subcategories.' },
      { path: '/admin/orders', title: 'Orders | Restaurant Management System', desc: 'View and manage all restaurant orders.' },
      { path: '/admin/payments', title: 'Payments | Restaurant Management System', desc: 'Process payments — cash, KHQR/ABA, and credit card.' },
      { path: '/admin/reports', title: 'Sales Reports | Restaurant Management System', desc: 'Sales analytics, daily/weekly/monthly reports, top selling items.' },
      { path: '/admin/inventory', title: 'Inventory | Restaurant Management System', desc: 'Manage restaurant inventory and stock levels.' },
      { path: '/admin/payroll', title: 'Payroll | Restaurant Management System', desc: 'Manage staff payroll and salary records.' },
      { path: '/admin/attendance', title: 'Attendance | Restaurant Management System', desc: 'Track staff clock-in/clock-out attendance and timesheets.' },
      { path: '/admin/reservations', title: 'Reservations | Restaurant Management System', desc: 'Manage table reservations and bookings.' },
      { path: '/admin/tables', title: 'Tables | Restaurant Management System', desc: 'Manage restaurant tables and capacity.' },
      { path: '/admin/customers', title: 'Customers | Restaurant Management System', desc: 'Manage customer records and walk-in history.' },
      { path: '/admin/users', title: 'Users Management | Restaurant Management System', desc: 'Manage system users, roles, and permissions.' },
      { path: '/admin/suppliers', title: 'Suppliers | Restaurant Management System', desc: 'Manage restaurant suppliers.' },
      { path: '/admin/purchases', title: 'Purchases | Restaurant Management System', desc: 'Manage purchase orders and supplier transactions.' },
      { path: '/admin/partners', title: 'Partners | Restaurant Management System', desc: 'Manage restaurant partners.' },
      { path: '/waiter/dashboard', title: 'Waiter Dashboard | Restaurant Management System', desc: 'Waiter view of tables, orders, and bills.' },
      { path: '/cashier/dashboard', title: 'Cashier Dashboard | Restaurant Management System', desc: 'POS checkout, pending orders, and payment processing.' },
      { path: '/stripe/success', title: 'Payment Successful | Restaurant Management System', desc: 'Your payment was processed successfully.' },
      { path: '/stripe/cancel', title: 'Payment Cancelled | Restaurant Management System', desc: 'Your payment was cancelled.' },
    ];

    // Find the best matching metadata (exact first, then prefix)
    const path = location.pathname;
    const exact = pageMeta.find(m => m.path === path);
    const prefix = pageMeta
      .filter(m => m.path !== '/' && path.startsWith(m.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
    const meta = exact || prefix || pageMeta[0];

    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.desc);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', meta.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', meta.desc);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', meta.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', meta.desc);

    // Update canonical link
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', `https://restaurant.example.com${path === '/' ? '' : path}`);
    }
  }, [location.pathname]);

  return null;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
        <FontSizeProvider>
        <SEOMeta />
        <InstallPrompt />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* ==================== PUBLIC QR DISPLAY ROUTE ==================== */}
          <Route path="/qr-display" element={<PaymentQRDisplay />} />

          {/* ==================== STRIPE PAYMENT ROUTES ==================== */}
          <Route path="/stripe/success" element={<StripeSuccess />} />
          <Route path="/stripe/cancel" element={<StripeCancel />} />

          {/* ==================== ADMIN ROUTES ==================== */}
          {/*
            The API returns role as a STRING ("Admin", "Waiter", "Cashier").
            We match by role NAME, not role_id.
          */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="users/create" element={<UsersManagement />} />
            <Route path="roles" element={<RolesManagement />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="menu" element={<MenuItemsPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/active" element={<ActiveOrdersPage />} />
            <Route path="orders/complete" element={<CompleteOrdersPage />} />
            <Route path="orders/history" element={<OrderHistoryPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="payment-success" element={<PaymentSuccessPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/daily" element={<ReportsPage />} />
            <Route path="reports/weekly" element={<ReportsPage />} />
            <Route path="reports/monthly" element={<ReportsPage />} />
            <Route path="reports/yearly" element={<ReportsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="attendance/clock-in" element={<ClockInPage />} />
            <Route path="attendance/clock-out" element={<ClockOutPage />} />
            <Route path="recycle-bin" element={<RecycleBin />} />
          </Route>


          {/* ==================== WAITER ROUTES ==================== */}
          <Route
            path="/waiter"
            element={
              <ProtectedRoute allowedRoles={["Waiter"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/waiter/dashboard" replace />} />
            <Route path="dashboard" element={<WaiterDashboard />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="menu" element={<MenuItemsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/active" element={<ActiveOrdersPage />} />
            <Route path="orders/complete" element={<CompleteOrdersPage />} />
            <Route path="orders/history" element={<OrderHistoryPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="attendance/clock-in" element={<ClockInPage />} />
            <Route path="attendance/clock-out" element={<ClockOutPage />} />
            <Route path="bill" element={<WaiterDashboard />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* ==================== CASHIER ROUTES ==================== */}
          <Route
            path="/cashier"
            element={
              <ProtectedRoute allowedRoles={["Cashier"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/cashier/dashboard" replace />} />
            <Route path="dashboard" element={<CashierDashboard />} />
            <Route path="menu" element={<MenuItemsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/active" element={<ActiveOrdersPage />} />
            <Route path="orders/complete" element={<CompleteOrdersPage />} />
            <Route path="orders/history" element={<OrderHistoryPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="pos" element={<CashierDashboard />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="payment-success" element={<PaymentSuccessPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="attendance/clock-in" element={<ClockInPage />} />
            <Route path="attendance/clock-out" element={<ClockOutPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Catch-all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </FontSizeProvider>
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

const AUTH_TOKEN_KEYS = ['token', 'access_token', 'auth_token'];
const getStoredAuthToken = () => AUTH_TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

const extractUserRole = (user) => {
  if (!user) return '';
  if (typeof user.role === 'string') return user.role.toLowerCase();
  if (typeof user.role === 'object') return (user.role.role_name || user.role.role || '').toLowerCase();
  return (user.role_name || '').toLowerCase();
};

// Root redirect based on auth status
const RootRedirect = () => {
  const token = getStoredAuthToken();
  const userStr = localStorage.getItem('user');

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      const role = extractUserRole(user);
      if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
      if (role === 'waiter') return <Navigate to="/waiter/dashboard" replace />;
      if (role === 'cashier') return <Navigate to="/cashier/dashboard" replace />;
    } catch (e) {
      // Invalid user data
    }
  }
  return <Navigate to="/login" replace />;
};

// Placeholder component for admin management pages
const AdminPlaceholder = ({ title }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-blue-600">
            {title.charAt(0)}
          </span>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm">
          This management page is under development. Full CRUD functionality with role-based access control will be implemented here.
        </p>
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left text-xs text-gray-500">
          <p className="font-medium text-gray-700 mb-1">Available Actions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>View all records with search & pagination</li>
            <li>Create new records</li>
            <li>Edit existing records</li>
            <li>Delete records (Admin only)</li>
            <li>Role-based button visibility</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App;