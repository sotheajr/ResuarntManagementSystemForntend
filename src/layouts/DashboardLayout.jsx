import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../translations/sidebar';
import ThemeToggle from '../components/ThemeToggle';
import FontSizeToggle from '../components/FontSizeToggle';
import LanguageToggle from '../components/LanguageToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  LayoutDashboard, Users, Shield, FolderTree, UtensilsCrossed,
  Table, UsersRound, CalendarCheck, ClipboardList, CreditCard,
  BarChart3, Package, Truck, Menu, X,
  ShoppingCart, ShoppingBag, Receipt, ChefHat, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Clock,
  User, LogOut, Handshake, DollarSign, Trash2,
} from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000";

const DashboardLayout = () => {
  const { user, logout, isAdmin, isWaiter, isCashier, loading } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!sidebarOpen) setExpandedMenu(null);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!loading && !user && !redirecting) {
      setRedirecting(true);
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate, redirecting]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.image]);

  if (loading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-400 via-rose-400 to-pink-500 dark:from-amber-400 dark:via-rose-400 dark:to-pink-500">
        <LoadingSpinner message={redirecting ? t('Redirecting...', language) : t('Loading...', language)} size="lg" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const toggleMenu = (label) => {
    setExpandedMenu(expandedMenu === label ? null : label);
  };

  const headerImgUrl = user?.image
    ? user.image.startsWith('http')
      ? user.image
      : (() => {
          let cleanPath = user.image;
          if (cleanPath.startsWith('/storage/')) cleanPath = cleanPath.replace('/storage/', '');
          else if (cleanPath.startsWith('storage/')) cleanPath = cleanPath.replace('storage/', '');
          return `${API_BASE_URL}/storage/${cleanPath}`;
        })()
    : null;
  const showHeaderImg = !!headerImgUrl && !avatarError;

  const adminMenuItems = [
    { label: t('Dashboard', language), icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: t('Users', language), icon: Users, children: [
      { label: t('List Users', language), path: '/admin/users' },
      { label: t('Create User', language), path: '/admin/users/create' },
    ]},
    { label: t('Roles', language), icon: Shield, path: '/admin/roles' },
    { label: t('Categories', language), icon: FolderTree, path: '/admin/categories' },
    { label: t('Menu Items', language), icon: UtensilsCrossed, children: [
      { label: t('Product List', language), path: '/admin/menu' },
      { label: t('Create Item', language), path: '/admin/menu/create' },
    ]},
    { label: t('Tables', language), icon: Table, path: '/admin/tables' },
    { label: t('Customers', language), icon: UsersRound, path: '/admin/customers' },
    { label: t('Reservations', language), icon: CalendarCheck, path: '/admin/reservations' },
    { label: t('Orders', language), icon: ClipboardList, children: [
      { label: t('Active Orders', language), path: '/admin/orders/active' },
      { label: t('Complete Orders', language), path: '/admin/orders/complete' },
      { label: t('Order History', language), path: '/admin/orders/history' },
    ]},
    { label: t('Payments', language), icon: CreditCard, children: [
      { label: t('Process Payment', language), path: '/admin/payments' },
      { label: t('Payment Success', language), path: '/admin/payment-success' },
    ]},
    { label: t('Reports', language), icon: BarChart3, children: [
      { label: t('Daily Sales', language), path: '/admin/reports?type=Daily' },
      { label: t('Weekly Sales', language), path: '/admin/reports?type=Weekly' },
      { label: t('Monthly Reports', language), path: '/admin/reports?type=Monthly' },
      { label: t('Yearly Sales', language), path: '/admin/reports?type=Yearly' },
    ]},
    { label: t('Inventory', language), icon: Package, path: '/admin/inventory' },
    { label: t('Suppliers', language), icon: Truck, path: '/admin/suppliers' },
    { label: t('Partners', language), icon: Handshake, path: '/admin/partners' },
    { label: t('Attendance', language), icon: Clock, children: [
      { label: t('Clock In', language), path: '/admin/attendance/clock-in' },
      { label: t('Clock Out', language), path: '/admin/attendance/clock-out' },
      { label: t('Attendance History', language), path: '/admin/attendance' },
    ]},
    { label: t('Payroll', language), icon: DollarSign, path: '/admin/payroll' },
    { label: t('Purchases', language), icon: ShoppingBag, path: '/admin/purchases' },
    { label: t('Recycle Bin', language), icon: Trash2, path: '/admin/recycle-bin' },
  ];

  const cashierMenuItems = [
    { label: t('Dashboard', language), icon: LayoutDashboard, path: '/cashier/dashboard' },
    { label: t('Menu', language), icon: UtensilsCrossed, path: '/cashier/menu' },
    { label: t('Categories', language), icon: FolderTree, path: '/cashier/categories' },
    { label: t('Tables', language), icon: Table, path: '/cashier/tables' },
    { label: t('Customers', language), icon: UsersRound, path: '/cashier/customers' },
    { label: t('Reservations', language), icon: CalendarCheck, path: '/cashier/reservations' },
    { label: t('Orders', language), icon: ClipboardList, children: [
      { label: t('Active Orders', language), path: '/cashier/orders/active' },
      { label: t('Complete Orders', language), path: '/cashier/orders/complete' },
      { label: t('Order History', language), path: '/cashier/orders/history' },
    ]},
    { label: t('Payments', language), icon: CreditCard, children: [
      { label: t('Process Payment', language), path: '/cashier/payments' },
      { label: t('Payment Success', language), path: '/cashier/payment-success' },
    ]},
    { label: t('Attendance', language), icon: Clock, children: [
      { label: t('Clock In', language), path: '/cashier/attendance/clock-in' },
      { label: t('Clock Out', language), path: '/cashier/attendance/clock-out' },
      { label: t('Attendance History', language), path: '/cashier/attendance' },
    ]},
    { label: t('Reports', language), icon: BarChart3, children: [
      { label: t('Daily Sales', language), path: '/cashier/reports?type=Daily' },
      { label: t('Weekly Sales', language), path: '/cashier/reports?type=Weekly' },
      { label: t('Monthly Reports', language), path: '/cashier/reports?type=Monthly' },
      { label: t('Yearly Sales', language), path: '/cashier/reports?type=Yearly' },
    ]},
  ];

  const waiterMenuItems = [
    { label: t('Dashboard', language), icon: LayoutDashboard, path: '/waiter/dashboard' },
    { label: t('Menu', language), icon: UtensilsCrossed, path: '/waiter/menu' },
    { label: t('Categories', language), icon: FolderTree, path: '/waiter/categories' },
    { label: t('Tables', language), icon: Table, path: '/waiter/tables' },
    { label: t('Customers', language), icon: UsersRound, path: '/waiter/customers' },
    { label: t('Orders', language), icon: ClipboardList, children: [
      { label: t('Active Orders', language), path: '/waiter/orders/active' },
      { label: t('Complete Orders', language), path: '/waiter/orders/complete' },
      { label: t('Order History', language), path: '/waiter/orders/history' },
    ]},
    { label: t('Attendance', language), icon: Clock, children: [
      { label: t('Clock In', language), path: '/waiter/attendance/clock-in' },
      { label: t('Clock Out', language), path: '/waiter/attendance/clock-out' },
      { label: t('Attendance History', language), path: '/waiter/attendance' },
    ]},
    { label: t('Bills', language), icon: Receipt, path: '/waiter/bill' },
  ];

  let menuItems = [];
  if (isAdmin) menuItems = adminMenuItems;
  else if (isWaiter) menuItems = waiterMenuItems;
  else if (isCashier) menuItems = cashierMenuItems;

  const getRoleBadgeColor = () => {
    if (isAdmin) return 'bg-brand-600';
    if (isWaiter) return 'bg-green-600';
    if (isCashier) return 'bg-accent-500';
    return 'bg-gray-600';
  };

  const getRoleBadgeLabel = () => {
    if (isAdmin) return t('Admin', language);
    if (isWaiter) return t('Waiter', language);
    if (isCashier) return t('Cashier', language);
    return t('User', language);
  };

  const isDropdownActive = (children) => {
    return children?.some(child => isActive(child.path));
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-screen overflow-y-auto z-40
        bg-gradient-to-b from-amber-400 via-rose-400 to-pink-500 text-slate-900
        border-r border-pink-300 shadow-md
        dark:bg-slate-900 dark:bg-none dark:text-slate-200 dark:border-slate-800
        transition-all duration-300 ease-in-out flex flex-col
        ${sidebarOpen ? 'w-64' : 'w-0 -translate-x-full lg:w-16 lg:translate-x-0'}
        ${mobileSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
        lg:translate-x-0
      `}>
        <div className={`p-4 border-b border-white/20 flex-shrink-0 ${!sidebarOpen ? 'lg:px-0 lg:py-3' : ''}`}>
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm overflow-hidden">
              <img src="/images/Logo.jpg" alt="CHBSYRT" className="w-full h-full object-cover" />
            </div>
            <div className={`transition-all duration-300 overflow-hidden ${sidebarOpen ? 'ml-3 w-auto opacity-100' : 'w-0 opacity-0 ml-0'}`}>
              <h2 className="font-bold text-base whitespace-nowrap text-slate-900">{t('CHBSYRT', language)}</h2>
              <p className="text-xs text-slate-800/80 whitespace-nowrap font-medium">{t('Restaurant & Lounge', language)}</p>
            </div>
            <button onClick={() => setMobileSidebarOpen(false)} className={`lg:hidden text-slate-800 hover:text-slate-900 flex-shrink-0 ml-auto ${!sidebarOpen ? 'hidden' : ''}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = item.path ? isActive(item.path) : false;
            const hasActiveChild = item.children ? isDropdownActive(item.children) : false;
            const isItemActive = active || hasActiveChild;

            if (item.children) {
              const isOpen = expandedMenu === item.label;
              return (
                <div key={item.label}>
                  <button onClick={() => sidebarOpen ? toggleMenu(item.label) : null}
                    className={`sidebar-link w-full text-left ${hasActiveChild ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarOpen ? '' : 'lg:justify-center lg:px-0'}`}
                    title={!sidebarOpen ? item.label : undefined}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <><span className="truncate flex-1">{item.label}</span>
                      {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}</>
                    )}
                  </button>
                  {sidebarOpen && (
                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-2 pl-4 border-l border-white/30 space-y-1 mt-1">
                        {item.children.map((child) => {
                          const childActive = isActive(child.path);
                          return (
                            <button key={child.path}
                              onClick={() => { navigate(child.path); setMobileSidebarOpen(false); }}
                              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${childActive ? 'bg-white/90 text-pink-700 font-bold shadow-xs' : 'text-slate-800 hover:bg-white/20 font-medium'}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button key={item.path}
                onClick={() => { navigate(item.path); setMobileSidebarOpen(false); }}
                className={`sidebar-link w-full text-left ${isItemActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${sidebarOpen ? '' : 'lg:justify-center lg:px-0'}`}
                title={!sidebarOpen ? item.label : undefined}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'}`}>
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2.5 sm:py-3 flex items-center justify-between gap-2 shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center justify-center w-8 h-8 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              title={sidebarOpen ? t('Collapse sidebar', language) : t('Expand sidebar', language)}>
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex-shrink-0">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0">
                <img src="/images/Logo.jpg" alt="CHBSYRT" className="w-full h-full object-cover" />
              </div>
              <h1 className="hidden md:block text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
                {t('CHBSYRT', language)} — {t('Restaurant & Lounge', language)}
              </h1>
              <h1 className="md:hidden text-base font-bold text-gray-800 dark:text-gray-100 truncate">
                {t('CHBSYRT', language)}
              </h1>
            </div>
          </div>

          <div className="relative flex-shrink-0 flex items-center gap-0.5 sm:gap-1" ref={dropdownRef}>
            <LanguageToggle />
            <ThemeToggle />
            <FontSizeToggle />
            <button onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2.5 px-1.5 sm:px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="w-7 h-7 sm:w-8 sm:h-8 aspect-square rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden">
                {showHeaderImg ? (
                  <img key={user.image} src={headerImgUrl} alt={user?.full_name || t('User', language)}
                    className="w-full h-full object-cover object-top"
                    onError={() => setAvatarError(true)} onLoad={() => setAvatarError(false)} />
                ) : (
                  <span className="text-white text-sm font-bold">{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">{user?.full_name || t('User', language)}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{getRoleBadgeLabel()}</p>
              </div>
              <ChevronDown className={`hidden sm:block w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in origin-top-right">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.full_name || t('User', language)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Role: {getRoleBadgeLabel()}</p>
                </div>
                <button onClick={() => {
                  setProfileDropdownOpen(false);
                  if (isAdmin) navigate('/admin/profile');
                  else if (isWaiter) navigate('/waiter/profile');
                  else if (isCashier) navigate('/cashier/profile');
                  else navigate('/profile');
                }}
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  <User className="w-4 h-4" />
                  {t('My Profile', language)}
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                <button onClick={handleLogout}
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-brand-600 dark:text-brand-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                  <LogOut className="w-4 h-4" />
                  {t('Logout', language)}
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;