import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ordersAPI, paymentsAPI, tablesAPI, customersAPI, usersAPI, stripePaymentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import StripeCardModal from '../../components/StripeCardModal';
import ReceiptModal from '../../components/ReceiptModal';
import {
  X, AlertTriangle, Loader2, CreditCard, CheckCircle, ClipboardList,
  DollarSign, Wallet, Smartphone, User as UserIcon,
  Table as TableIcon, QrCode, Receipt, ArrowLeft,
} from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Wallet },
  { value: 'KHQR', label: 'ABA KHQR', icon: Smartphone },
  { value: 'Visa', label: 'Visa Card', icon: CreditCard },
  { value: 'Mastercard', label: 'Mastercard', icon: CreditCard },
];

const ProcessPayment = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId');

  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(Boolean(orderIdParam));
  const [error, setError] = useState(null);

  // Reference data for ID lookups
  const [allTables, setAllTables] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allWaiters, setAllWaiters] = useState([]);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  // ABA KHQR payment state (TolaSaint rail)
  const [khqr, setKhqr] = useState(null); // { id, qr_link, qr_string, expiry, ... }
  const [khqrGenerating, setKhqrGenerating] = useState(false);
  const [khqrStatus, setKhqrStatus] = useState(null); // gateway status: pending/scanned/processing/paid/approved/failed/expired
  const [khqrError, setKhqrError] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeModalState, setStripeModalState] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ==================== Fetch Order ====================
  const fetchOrder = useCallback(async () => {
    if (!orderIdParam) return;
    setOrderLoading(true);
    setError(null);
    try {
      const response = await ordersAPI.getById(orderIdParam);
      const orderData = response.data?.data || response.data;
      setOrder(orderData);
      setPaymentSuccess(null);
      setKhqr(null);
      setKhqrStatus(null);
      setKhqrError(null);
      setStripeLoading(false);
      setStripeModalState(null);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to load order', language));
    } finally {
      setOrderLoading(false);
    }
  }, [orderIdParam, language]);

  // ==================== Fetch reference data ====================
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
    if (orderIdParam) fetchOrder();
    fetchReferenceData();
  }, [fetchOrder, fetchReferenceData, orderIdParam]);
// ==================== Helper resolvers ====================
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

  const resolveWaiterName = (ord) => {
    const w = ord?.user;
    if (w) {
      const fromRelation = w.username ?? w.Username ?? w.full_name ?? w.Full_Name ?? w.name ?? w.Name;
      if (fromRelation) return fromRelation;
    }
    const flatName = ord?.waiter_name ?? ord?.Waiter_Name;
    if (flatName) return flatName;
    const waiterId = ord?.user_id ?? ord?.Waiter_ID;
    if (waiterId) {
      const numId = Number(waiterId);
      const matched = allWaiters.find(
        (wr) => Number(wr.user_id) === numId || Number(wr.User_ID) === numId || Number(wr.id) === numId
      );
      if (matched) {
        return matched?.username ?? matched?.Username ?? matched?.full_name ?? matched?.Full_Name ?? `Staff #${waiterId}`;
      }
      return `Staff #${waiterId}`;
    }
    return '—';
  };

  // ==================== Payment form calculations ====================
  const orderTotal = order ? parseFloat(order.total_amount ?? order.Total_Amount ?? 0) : 0;
  const received = parseFloat(amountReceived) || 0;
  const changeDue = received - orderTotal;
  const isCash = paymentMethod === 'Cash';
  const isCard = paymentMethod === 'Visa' || paymentMethod === 'Mastercard';
  const isKhqr = paymentMethod === 'KHQR';
  const isProcessing = processingPayment || stripeLoading;
  const canSubmit = isKhqr ? true : (isCash ? (received >= orderTotal && received > 0) : isCard);

  // ==================== Process payment ====================
  const handleProcessPayment = async () => {
    if (!order) return;
    const orderId = order.id;

    // KHQR -> (re)generate the ABA KHQR code
    if (isKhqr) {
      handleKhqrGenerate();
      return;
    }

    // Visa/Mastercard -> create Stripe PaymentIntent and open modal
    if (isCard) {
      setStripeLoading(true);
      setError(null);
      try {
        const response = await stripePaymentAPI.createCheckoutSession({
          email: user?.email || 'customer@example.com',
          order_id: orderId,
          total_amount: orderTotal,
        });
        const responseData = response.data?.data || response.data;
        const clientSecret = responseData?.clientSecret;
        if (!clientSecret) throw new Error('No client secret returned from server');
        setStripeModalState({
          clientSecret,
          amount: orderTotal,
          email: user?.email || 'customer@example.com',
          orderId,
        });
      } catch (err) {
        const msg = err.response?.data?.message || err.message || t('Failed to initiate card payment', language);
        setError(msg);
        showToast('error', msg);
      } finally {
        setStripeLoading(false);
      }
      return;
    }

    // Cash
    if (received < orderTotal) {
      setError(t('Amount received must be at least the total bill amount.', language));
      return;
    }

    setProcessingPayment(true);
    setError(null);
    try {
      const currentUserId = user?.USER_ID || user?.user_id || user?.id;
      try {
        await paymentsAPI.process({
          order_id: orderId,
          payment_method: paymentMethod === 'Mastercard' ? 'Card' : paymentMethod,
          cashier_id: currentUserId,
        });
      } catch (payErr) {
        // Record payment request failed — don't block; fall through to update order.
        const payMsg = payErr.response?.data?.message || payErr.response?.data?.error || payErr.message || '';
        if (!payMsg.toLowerCase().includes('already paid')) {
          console.warn('Payment record API failed:', payMsg);
        }
      }
      // Update order status to 'completed' — backend auto-sets payment_status = 'paid'.
      // Best-effort; ignore failures so navigation to the success page still happens.
      try {
        await ordersAPI.updateStatus(orderId, 'completed');
      } catch (statusErr) {
        console.warn('Order status sync failed:', statusErr.response?.data?.message || statusErr.message);
      }
      showToast('success', `Payment of $${orderTotal.toFixed(2)} ${t('paid via', language)} ${paymentMethod}!`);
      navigate(`/admin/payments/success?orderId=${orderId}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || t('Failed to process payment', language);
      if (msg.toLowerCase().includes('already paid')) {
        navigate(`/admin/payments/success?orderId=${orderId}`);
        return;
      }
      setError(msg);
      showToast('error', msg);
    } finally {
      setProcessingPayment(false);
    }
  };

  // ==================== ABA KHQR (TolaSaint rail) ====================
  const handleKhqrGenerate = async () => {
    if (!order || khqrGenerating) return;
    setKhqrGenerating(true);
    setKhqrError(null);
    setKhqrStatus(null);
    setKhqr(null);
    try {
      const response = await paymentsAPI.khqrGenerate({ order_id: order.id });
      const data = response.data?.data || response.data;
      setKhqr({
        id: data?.id,
        qr_link: data?.qr_link || data?.qr_url,
        qr_string: data?.qr_string,
        expiry: data?.expiry,
        amount: data?.amount,
      });
      setKhqrStatus(String(data?.status || 'pending').toLowerCase());
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t('Failed to generate KHQR code', language);
      setKhqrError(msg);
    } finally {
      setKhqrGenerating(false);
    }
  };

  const handleSelectMethod = (value) => {
    setPaymentMethod(value);
    setError(null);
    // Leaving the KHQR rail cancels any active QR + polling.
    if (value !== 'KHQR') {
      setKhqr(null);
      setKhqrStatus(null);
      setKhqrError(null);
    }
  };

  // ==================== KHQR status polling (every 3 seconds) ====================
  useEffect(() => {
    const id = khqr?.id;
    if (!id || khqrStatus === 'paid' || khqrStatus === 'approved') return undefined;

    let cancelled = false;
    const check = async () => {
      try {
        const response = await paymentsAPI.khqrStatus(id);
        const data = response.data?.data || response.data || {};
        const status = String(data.status || '').toLowerCase();
        if (cancelled) return;
        setKhqrStatus(status);

        // paid / approved → money arrived; stop polling and redirect cleanly.
        if (data.is_paid || status === 'paid' || status === 'approved') {
          setKhqrStatus('paid');
          navigate(`/admin/payments/success?orderId=${order?.id}`, { replace: true });
        } else if (data.is_final) {
          // failed / expired are final — stop polling and let the cashier retry.
          setKhqrError(
            status === 'expired'
              ? t('KHQR code has expired. Please generate a new one.', language)
              : t('KHQR payment failed. Please try again.', language)
          );
        }
      } catch (_) {
        // Transient network/gateway errors — keep polling.
      }
    };

    const timer = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [khqr?.id, khqrStatus, order?.id, language, navigate]);

  const handleStripeSuccess = (paymentIntent) => {
    setStripeModalState(null);
    if (order) {
      try {
        ordersAPI.updateStatus(order.id, 'completed');
      } catch (_) { /* non-blocking */ }
      navigate(`/admin/payments/success?orderId=${order.id}`);
    }
  };

  const handleReceiptClose = () => setReceiptData(null);
// ==================== Render: Loading ====================
  if (orderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t('Loading order details...', language)}</span>
      </div>
    );
  }


  // ==================== Render: Order not found / error ====================
  if (error && !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button onClick={() => navigate('/admin/orders/complete')} className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
          {t('Back to Complete Orders', language)}
        </button>
      </div>
    );
  }
// ==================== Render: Main payment form ====================
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 p-4 rounded-lg text-white ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button onClick={() => setToast(null)} className="text-white opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
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

      {/* Back Button */}
      <button
        onClick={() => navigate('/admin/orders/complete')}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('Back to Orders', language)}
      </button>

      {!order && !orderIdParam && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">{t('No order selected', language)}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('Please select an order from the completed orders list to process its payment.', language)}</p>
          <button onClick={() => navigate('/admin/orders/complete')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            {t('Go to Complete Orders', language)}
          </button>
        </div>
      )}

      {/* ==================== Payment Form Card ==================== */}
      {order && (
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-6 h-6 text-blue-600" />
                {t('Process Payment', language)} — {t('Order', language)} #{order.id}
              </h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${
                (order.payment_status || 'unpaid') === 'paid'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
              }`}>
                {(order.payment_status || 'unpaid') === 'paid' ? t('Paid', language) : t('Saved', language)}
              </span>
            </div>
          </div>

          <div className="p-6">
            {/* Order summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <TableIcon className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('Table', language)}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">#{resolveTableNumber(order)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <UserIcon className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('Customer', language)}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{resolveCustomerName(order)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('Total Amount', language)}</p>
                  <p className="font-bold text-2xl text-gray-900 dark:text-white">${orderTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
{/* Ordered Items */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('Ordered Items', language)}</h3>
              <div className="space-y-3">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.name || item.menu_item?.name || item.MenuItem?.Name || t('Menu Item', language)}
                      </p>
                      {item.special_instructions && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.special_instructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-sm text-gray-600 dark:text-gray-400">${parseFloat(item.price || 0).toFixed(2)}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">x{item.quantity || 1}</span>
                      <span className="w-16 text-right font-semibold text-gray-900 dark:text-white">
                        ${(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('Payment Method', language)}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PAYMENT_METHODS.map((method) => {
                  const IconComponent = method.icon;
                  const isSelected = paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => handleSelectMethod(method.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <IconComponent className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>
                        {t(method.label, language)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
{/* Amount Input (Cash) */}
            {isCash && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('Amount Received', language)}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={orderTotal.toFixed(2)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
                {received > 0 && (
                  <div className={`mt-2 p-3 rounded-lg ${changeDue >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className={`text-sm font-medium ${changeDue >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {changeDue >= 0
                        ? `${t('Change Due:', language)} $${changeDue.toFixed(2)}`
                        : `${t('Insufficient amount', language)} — $${Math.abs(changeDue).toFixed(2)} ${t('more needed', language)}`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Card Details Placeholder */}
            {isCard && (
              <div className="mb-6 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center">
                <div className="flex justify-center mb-3">
                  <CreditCard className="w-10 h-10 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {t('Card payment will be processed securely via Stripe', language)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {paymentMethod === 'Visa' ? t('Visa', language) : t('Mastercard', language)} ···· ···· ···· ····
                </p>
              </div>
            )}

            {/* ABA KHQR Payment (live QR from TolaSaint) */}
            {isKhqr && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('ABA KHQR Payment', language)}</h3>
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-44 h-44 bg-white dark:bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                    {khqrGenerating ? (
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    ) : khqr?.qr_link ? (
                      <img src={khqr.qr_link} alt="ABA KHQR" className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="w-20 h-20 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ABA Bank KHQR', language)}</p>
                    <p className="font-bold text-2xl text-gray-900 dark:text-white mb-2">${orderTotal.toFixed(2)}</p>

                    {khqrError ? (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-red-600 flex items-center gap-1.5 justify-center sm:justify-start">
                          <AlertTriangle className="w-4 h-4" /> {khqrError}
                        </p>
                        <button
                          type="button"
                          onClick={handleKhqrGenerate}
                          className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          <QrCode className="w-4 h-4" /> {t('Generate New QR', language)}
                        </button>
                      </div>
                    ) : khqrStatus === 'paid' || khqrStatus === 'approved' ? (
                      <p className="text-sm font-semibold text-green-600 flex items-center gap-1.5 justify-center sm:justify-start">
                        <CheckCircle className="w-4 h-4" /> {t('Payment received — redirecting...', language)}
                      </p>
                    ) : khqrStatus === 'scanned' || khqrStatus === 'processing' ? (
                      <p className="text-sm font-semibold text-blue-600 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Loader2 className="w-4 h-4 animate-spin" /> {t('Payment detected — confirming...', language)}
                      </p>
                    ) : khqr?.id ? (
                      <p className="text-sm text-amber-600 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Loader2 className="w-4 h-4 animate-spin" /> {t('Waiting for customer to scan...', language)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('Scan the QR with any banking app to pay', language)}
                      </p>
                    )}

                    {khqr?.expiry && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        {t('Expires', language)}: {new Date(khqr.expiry).toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">ABA KHQR · {t('Powered by TolaSaint', language)}</p>
                  </div>
                </div>
              </div>
            )}
{/* Confirm Payment Button */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 flex-wrap gap-3">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('Cashier', language)}: {user?.username ?? user?.Username ?? user?.name ?? '—'}
              </div>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isProcessing || !canSubmit}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('Processing...', language)}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    {t('Confirm Payment', language)} — ${orderTotal.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      {stripeModalState && (
        <StripeCardModal
          clientSecret={stripeModalState.clientSecret}
          amount={stripeModalState.amount}
          email={stripeModalState.email}
          orderId={stripeModalState.orderId}
          onSuccess={handleStripeSuccess}
          onClose={() => setStripeModalState(null)}
        />
      )}

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

export default ProcessPayment;
