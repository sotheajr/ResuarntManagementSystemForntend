import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ordersAPI, paymentsAPI, tablesAPI, customersAPI, usersAPI, stripePaymentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import AbaPaymentModal from '../../components/AbaPaymentModal';
import StripeCardModal from '../../components/StripeCardModal';
import ReceiptModal from '../../components/ReceiptModal';
import {
  Search, X, AlertTriangle, Loader2, ClipboardList,
  Eye, CreditCard, CheckCircle, DollarSign, Wallet, Smartphone,
  ArrowLeft
} from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash (សាច់ប្រាក់)', icon: Wallet },
  { value: 'KHQR', label: 'KHQR / ABA Bank', icon: Smartphone },
  { value: 'Visa', label: 'Visa / Credit Card', icon: CreditCard },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';

const PaymentsPage = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reference data for ID lookups
  const [allTables, setAllTables] = useState([]);
  const [allWaiters, setAllWaiters] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);

  // Payment form state (when processing from query param)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  // ABA QR Modal state
  const [showAbaModal, setShowAbaModal] = useState(false);
  // Receipt Modal state (auto-opens after payment success)
  const [receiptData, setReceiptData] = useState(null); // { paymentId, orderId }
  // Stripe processing state
  const [stripeLoading, setStripeLoading] = useState(false);
  // Stripe card modal state (embedded PaymentElement)
  const [stripeModalState, setStripeModalState] = useState(null); // { clientSecret, amount, email, orderId }

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

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
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

  // ==================== Auto-select order from query param ====================
  useEffect(() => {
    if (!loading && orders.length > 0 && orderIdParam) {
      const found = orders.find(
        (o) => String(o.order_id || o.Order_ID) === String(orderIdParam)
      );
      if (found) {
        setSelectedOrder(found);
        setPaymentMethod('Cash');
        setAmountReceived('');
        setProcessingPayment(false);
        setPaymentSuccess(null);
      }
    }
  }, [loading, orders, orderIdParam]);

  // ==================== Filtering ====================
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    const orderId = String(o.order_id || o.Order_ID || '');
    const customerName = resolveCustomerName(o).toLowerCase();
    const waiterName = resolveWaiterName(o).toLowerCase();
    const tableNum = String(resolveTableNumber(o));
    return orderId.includes(term) || customerName.includes(term) || waiterName.includes(term) || tableNum.includes(term);
  });

  // ==================== Payment Form ====================
  const orderTotal = selectedOrder
    ? parseFloat(selectedOrder.total_amount ?? selectedOrder.Total_Amount ?? 0)
    : 0;
  const received = parseFloat(amountReceived) || 0;
  const changeDue = received - orderTotal;
  const isCash = paymentMethod === 'Cash';
  const isProcessing = processingPayment || stripeLoading;
  const canSubmit = !isCash || (isCash && received >= orderTotal && received > 0);

  const openPaymentForm = (order) => {
    setSelectedOrder(order);
    setPaymentMethod('Cash');
    setAmountReceived('');
    setProcessingPayment(false);
    setPaymentSuccess(null);
    setError(null);
    setShowAbaModal(false);
    setStripeLoading(false);
  };

  const closePaymentForm = () => {
    setSelectedOrder(null);
    setPaymentSuccess(null);
    setShowAbaModal(false);
    setStripeLoading(false);
  };

  const handleProcessPayment = async () => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.order_id || selectedOrder.Order_ID;

    // If KHQR is selected, open the ABA modal
    if (paymentMethod === 'KHQR') {
      setShowAbaModal(true);
      return;
    }

    // If Visa/Credit Card is selected, create PaymentIntent and open embedded card modal
    if (paymentMethod === 'Visa') {
      setStripeLoading(true);
      setError(null);
      try {
        const response = await stripePaymentAPI.createCheckoutSession({
          email: user?.email || 'customer@example.com',
          order_id: orderId,
          total_amount: orderTotal,
        });
        // Backend returns { success, message, data: { clientSecret, id, amount } }
        const responseData = response.data?.data || response.data;
        const clientSecret = responseData?.clientSecret;
        if (!clientSecret) {
          throw new Error('No client secret returned from server');
        }
        // Open the embedded Stripe card modal
        setStripeModalState({
          clientSecret,
          amount: orderTotal,
          email: user?.email || 'customer@example.com',
          orderId,
        });
      } catch (err) {
        const msg = err.response?.data?.message || err.message || t('Failed to initiate Stripe payment', language);
        setError(msg);
        showToast('error', msg);
      } finally {
        setStripeLoading(false);
      }
      return;
    }

    if (isCash && received < orderTotal) {
      showToast('error', t('Amount received must be at least the total bill amount.', language));
      return;
    }

    setProcessingPayment(true);
    setError(null);
    try {
      const currentUserId = user?.USER_ID || user?.user_id || user?.id;

      await paymentsAPI.process({
        order_id: orderId,
        payment_method: paymentMethod,
        cashier_id: currentUserId,
      });

      setPaymentSuccess({ orderId });
      showToast('success', `Payment of $${orderTotal.toFixed(2)} ${t('paid via', language)} ${paymentMethod}!`);
      await fetchOrders();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || t('Failed to process payment', language);

      if (msg.toLowerCase().includes('already paid')) {
        try {
          await ordersAPI.update(orderId, { status: 'Paid' });
        } catch (_) { }
        showToast('success', `Payment already recorded for #${orderId}. Status synced to Paid.`);
        setPaymentSuccess({ orderId });
        await fetchOrders();
        return;
      }

      setError(msg);
      showToast('error', msg);
    } finally {
      setProcessingPayment(false);
    }
  };

  // ==================== ABA Payment Handlers ====================
  // Update order status badge to "Paid" in the local UI state
  const handleAbaPaymentSuccess = (paymentData) => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.order_id || selectedOrder.Order_ID;

    setOrders((prevOrders) =>
      prevOrders.map((o) => {
        const oid = o.order_id || o.Order_ID;
        if (String(oid) === String(orderId)) {
          return { ...o, status: 'Paid', Status: 'Paid' };
        }
        return o;
      })
    );

    // Also update the selected order so the badge reflects immediately
    setSelectedOrder((prev) => (prev ? { ...prev, status: 'Paid', Status: 'Paid' } : prev));
  };

  const handleAbaSuccess = async (paidOrderId, paidPaymentId) => {
    if (!selectedOrder) return;
    const orderId = paidOrderId || selectedOrder.order_id || selectedOrder.Order_ID;
    const paymentId = paidPaymentId || null;

    // The payment record was already created as 'Pending' in Step 1 (generate QR)
    // and updated to 'Paid' in Step 2 (polling/check-status detected approval).
    // Close the modal and open the Print Receipt dialog.
    setShowAbaModal(false);
    setPaymentSuccess({ orderId });
    showToast('success', `KHQR payment of $${orderTotal.toFixed(2)} completed!`);
    await fetchOrders();

    // Auto-open the Print Receipt modal for the paid order
    setReceiptData({ paymentId, orderId });
  };

  const handleAbaClose = () => {
    setShowAbaModal(false);
  };

  const handleReceiptClose = () => {
    setReceiptData(null);

    // After receipt modal closes, navigate to the Payment Success page (role-aware path)
    const role = user?.role?.toLowerCase();
    const basePath = role === 'cashier' ? '/cashier' : '/admin';
    navigate(`${basePath}/payment-success`);
  };

  // ==================== Stripe Card Payment Handlers ====================
  const handleStripeSuccess = async (paymentIntent) => {
    setStripeModalState(null);
    if (!selectedOrder) return;
    const orderId = selectedOrder.order_id || selectedOrder.Order_ID;
    const currentUserId = user?.USER_ID || user?.user_id || user?.id;

    try {
      await paymentsAPI.process({
        order_id: orderId,
        payment_method: 'Visa',
        cashier_id: currentUserId,
      });
      setPaymentSuccess({ orderId });
      showToast('success', `Visa card payment of $${orderTotal.toFixed(2)} completed successfully!`);
      await fetchOrders();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to record payment';
      if (msg.toLowerCase().includes('already paid')) {
        setPaymentSuccess({ orderId });
        showToast('success', `Visa payment already recorded for #${orderId}.`);
        await fetchOrders();
        return;
      }
      showToast('error', 'Card payment succeeded but failed to record. Please check orders page.');
    }
  };

  const handleStripeClose = () => {
    setStripeModalState(null);
  };

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Payments', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Process payments for completed orders. Select an order to begin checkout.', language)}
          </p>
        </div>
      </div>

      {/* Toast */}
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ==================== Payment Form Panel ==================== */}
      {selectedOrder && !paymentSuccess && (
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button onClick={closePaymentForm} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('Checkout', language)} — {t('Order', language)} #{selectedOrder.order_id || selectedOrder.Order_ID}
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {/* Order Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm text-gray-500">{t('Total Bill', language)}</p>
                <p className="text-3xl font-bold text-gray-900">${orderTotal.toFixed(2)}</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-brand-600" />
              </div>
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-3 gap-4 text-sm p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="block text-gray-500 mb-0.5">{t('Customer', language)}</span>
                <span className="font-medium text-gray-900">{resolveCustomerName(selectedOrder)}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-0.5">{t('Table', language)}</span>
                <span className="font-medium text-gray-900">{resolveTableNumber(selectedOrder)}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-0.5">{t('Waiter', language)}</span>
                <span className="font-medium text-gray-900">{resolveWaiterName(selectedOrder)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">{t('Payment Method', language)} <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-3">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(method.value);
                        if (method.value !== 'Cash') setAmountReceived('');
                      }}
                      className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-sm font-medium border transition-all duration-200 ${
                        isSelected
                          ? 'border-brand-600 bg-rose-50 text-brand-700 ring-2 ring-brand-200'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-center leading-tight">{t(method.label, language)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash: Amount Received + Change Due */}
            {isCash && (
              <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Amount Received', language)} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                </div>
                {received > 0 && (
                  <div className="space-y-2 pt-2 border-t border-yellow-300">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('Total Bill', language)}</span>
                      <span className="font-medium text-gray-900">${orderTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('Amount Received', language)}</span>
                      <span className="font-medium text-gray-900">${received.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-1 border-t border-yellow-300">
                      <span className={changeDue >= 0 ? 'text-green-600' : 'text-red-600'}>{t('Change Due', language)} {changeDue >= 0 ? '(លុយអាប់)' : ''}</span>
                      <span className={changeDue >= 0 ? 'text-green-600' : 'text-red-600'}>{changeDue >= 0 ? `$${changeDue.toFixed(2)}` : `-$${Math.abs(changeDue).toFixed(2)}`}</span>
                    </div>
                  </div>
                )}
                {received > 0 && received < orderTotal && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('Amount received is less than total. Please collect the full amount.', language)}
                  </p>
                )}
              </div>
            )}

            {/* Non-cash summary */}
            {!isCash && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-brand-700">
                <p>{t('Processing payment of', language)} <strong>${orderTotal.toFixed(2)}</strong> {t('via', language)} <strong>{t(PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label, language)}</strong>.</p>
                {paymentMethod === 'KHQR' && (
                  <p className="mt-1 text-brand-600 font-medium">
                    {t('Click "Confirm Payment" to generate the ABA QR code for the customer to scan.', language)}
                  </p>
                )}
                {paymentMethod === 'Visa' && (
                  <p className="mt-1 text-brand-600 font-medium">
                    {t('Click "Confirm Payment" to proceed to Stripe secure checkout gateway.', language)}
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={closePaymentForm}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                {t('Cancel', language)}
              </button>
              <button onClick={handleProcessPayment} disabled={isProcessing || !canSubmit}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-50">
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {stripeLoading ? t('Redirecting to Stripe Gateway...', language) : processingPayment ? t('Processing...', language) : `${t('Confirm Payment', language)} — $${orderTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ABA PAYWAY QR MODAL ==================== */}
      {showAbaModal && selectedOrder && (
        <AbaPaymentModal
          totalAmount={orderTotal}
          orderId={selectedOrder.order_id || selectedOrder.Order_ID}
          tableName={resolveTableNumber(selectedOrder)}
          onSuccess={handleAbaSuccess}
          onPaymentSuccess={handleAbaPaymentSuccess}
          onClose={handleAbaClose}
        />
      )}

      {/* ==================== STRIPE CARD PAYMENT MODAL ==================== */}
      {stripeModalState && (
        <StripeCardModal
          clientSecret={stripeModalState.clientSecret}
          amount={stripeModalState.amount}
          email={stripeModalState.email}
          orderId={stripeModalState.orderId}
          onSuccess={handleStripeSuccess}
          onClose={handleStripeClose}
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

      {/* ==================== Success State ==================== */}
      {selectedOrder && paymentSuccess && (
        <div className="card">
          <div className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('Payment Successful!', language)}</h3>
            <p className="text-gray-500 mb-1">
              {t('Order', language)} #{paymentSuccess.orderId} — ${orderTotal.toFixed(2)} {t('paid via', language)} {paymentMethod === 'KHQR' ? 'KHQR' : paymentMethod}
            </p>
            {isCash && changeDue >= 0 && (
              <p className="text-lg font-medium text-green-600 mb-4">{t('Change Due:', language)} ${changeDue.toFixed(2)}</p>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => { setSelectedOrder(null); setPaymentSuccess(null); }}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                {t('Back to Orders', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Orders Table ==================== */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">{t('Completed Orders Awaiting Payment', language)}</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder={t('Search orders...', language)} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div>}

        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <ClipboardList className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-700 mb-1">{t('No orders awaiting payment', language)}</h3>
            <p className="text-sm text-gray-500">{t('Complete orders will appear here when ready for checkout.', language)}</p>
          </div>
        )}

        {!loading && filteredOrders.length > 0 && (
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
                  <th className="text-right py-3.5 px-4 text-sm font-semibold tracking-wider text-slate-700 dark:text-slate-300">{t('Action', language)}</th>
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
                        {String(status).toLowerCase() === 'paid' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border bg-green-100 text-green-700 border-green-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                            PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border bg-gray-100 text-gray-600 border-gray-200">{t(status, language)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openPaymentForm(order)} disabled={selectedOrder !== null}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          <CreditCard className="w-4 h-4" /> {t('Pay', language)}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsPage;