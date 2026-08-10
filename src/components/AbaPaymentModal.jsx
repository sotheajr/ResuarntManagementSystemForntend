import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import socket from '../services/socket';

const AbaPaymentModal = ({ totalAmount, orderId, tableName, onSuccess, onPaymentSuccess, onClose }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paid, setPaid] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [toast, setToast] = useState(null);
  const [transactionId, setTransactionId] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const generatingRef = useRef(false);

  // Keep latest callbacks in refs to prevent the polling effect from restarting
  // every time the parent component re-renders (which changes function references).
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  onPaymentSuccessRef.current = onPaymentSuccess;

  // Show toast notification
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Connect socket if not connected
  useEffect(() => {
    // IMPORTANT: Reset mountedRef on every (re)mount.
    // React StrictMode mounts → unmounts → remounts in dev; without this reset,
    // the second generateQR response would be discarded and polling would never start.
    mountedRef.current = true;

    if (!socket.connected) {
      socket.connect();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Generate QR on mount (ONLY ONCE)
  const generateQR = useCallback(async () => {
    // Prevent duplicate create-payment calls (double-fire from StrictMode / re-renders)
    if (generatingRef.current) return;
    if (!mountedRef.current) return;

    generatingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/create-payment', {
        order_id: orderId,
        total_price: totalAmount,
        currency: 'USD',
      });

      const data = response.data?.data || response.data;
      const qrUrl = data.qr_url || data.qrUrl;
      const qrString = data.qr_string || data.qrString;
      const txnId = data.transaction_id || data.transactionId;
      const payId = data.payment_id || data.paymentId || null;
      const amount = data.amount || totalAmount;
      const expiry = data.expiry || null;

      if (!mountedRef.current) return;

      // Reset first so a retry with a new ID always re-triggers polling
      setTransactionId(null);

      setQrData({ qrUrl, qrString, transactionId: txnId, paymentId: payId, amount, expiry });

      // Store IDs in state — the polling useEffect below watches these and starts polling immediately
      setTransactionId(txnId || null);
      setPaymentId(payId);

      // Emit to secondary display via socket
      if (socket.connected) {
        socket.emit('SHOW_PAYMENT_QR', {
          amount,
          qrUrl: qrUrl || null,
          qrString: qrString || null,
          orderId,
          tableName: tableName || 'N/A',
        });
      }

      setLoading(false);
    } catch (err) {
      console.error('KHQR generation failed:', err);
      if (mountedRef.current) {
        setError(err.response?.data?.message || 'Failed to generate QR code');
        setLoading(false);
      }
    } finally {
      generatingRef.current = false;
    }
  }, [totalAmount, orderId, tableName]);

  // ==================== POLLING ====================
  // Start polling IMMEDIATELY whenever a transactionId is available.
  // This effect is responsible for the interval lifecycle — no manual start needed.
  useEffect(() => {
    if (!transactionId || !mountedRef.current) return;

    console.log('Starting polling for Transaction:', transactionId, 'payment_id:', paymentId);
    setPollingActive(true);

    const checkStatus = async () => {
      if (!mountedRef.current) return;
      try {
        console.log('Polling status for ID:', transactionId, 'payment_id:', paymentId);
        const response = await api.get(`/check-status?id=${transactionId}&payment_id=${paymentId || ''}`);
        const res = response.data || {};
        const data = res.data || res;
        console.log('Polling status for ID:', transactionId, 'Response:', response.data);

        // Check is_paid at ALL levels: res.is_paid, res.data.is_paid, res.data.data.is_paid
        const isPaid = res.data?.is_paid || res.data?.data?.is_paid || res.is_paid || data.is_paid;
        const status = (res.data?.status || res.data?.data?.status || res.status || data.status || '').toLowerCase();

        // Approved/paid → success! Close modal immediately
        if (isPaid || status === 'approved' || status === 'paid') {
          clearInterval(intervalRef.current);
          intervalRef.current = null;

          if (mountedRef.current) {
            setPaid(true);
            setPollingActive(false);

            // Show success toast
            showToast('success', 'Payment Received!');

            // Emit success to secondary display
            if (socket.connected) {
              socket.emit('PAYMENT_SUCCESS', { orderId });
            }

            // Play success sound
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
              oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.15);
              gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
              oscillator.start(audioCtx.currentTime);
              oscillator.stop(audioCtx.currentTime + 0.5);
            } catch (e) {
              // Audio not supported, ignore
            }

            // Notify parent component to update UI state to Paid
            if (onPaymentSuccessRef.current) {
              onPaymentSuccessRef.current(data);
            }

            // Close the KHQR payment modal
            if (onClose) {
              onClose();
            }

            // Trigger onSuccess with the paid order_id (and payment_id when available)
            // so the parent can auto-open the Print Receipt dialog.
            onSuccessRef.current && onSuccessRef.current(orderId, paymentId);
          }
        } else if (data.is_terminal === true) {
          // Terminal state (failed/expired) — stop polling and show error
          clearInterval(intervalRef.current);
          intervalRef.current = null;

          if (mountedRef.current) {
            setPollingActive(false);
            const msg = data.status === 'expired'
              ? 'Payment QR code has expired. Please try again.'
              : 'Payment failed. Please try again.';
            showToast('error', msg);
            setError(msg);
          }
        }
      } catch (err) {
        // Silently retry on error
        console.warn('Payment status check failed, retrying...', err.message);
      }
    };

    // Check immediately (payment may already be done), then poll every 3 seconds
    checkStatus();
    intervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      // Cleanup interval when transactionId changes or component unmounts
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [transactionId, paymentId, orderId]);

  // Generate QR on mount
  useEffect(() => {
    generateQR();

    return () => {
      // Cleanup interval on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [generateQR]);

  // Handle close/cancel
  const handleClose = () => {
    // Emit clear event to secondary display
    if (socket.connected) {
      socket.emit('CLEAR_PAYMENT_QR', { orderId });
    }

    // Stop polling
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setPollingActive(false);
    onClose && onClose();
  };

  // ==================== PAID STATE ====================
  if (paid) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-lg text-gray-600 mb-4">
            ${parseFloat(totalAmount).toFixed(2)} paid via KHQR
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Processing your transaction...
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN MODAL ====================
  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">KHQR Payment</h2>
              <p className="text-sm text-white/80">ABA / Bakong</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Toast Notification */}
          {toast && (
            <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border transition-all duration-300 animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
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
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
              <p className="text-gray-500">Generating QR code...</p>
            </div>
          )}

          {/* QR Code Display */}
          {!loading && !error && qrData && (
            <>
              <div className="flex flex-col items-center">
                {/* QR Image */}
                <div className="qr-code-container bg-white rounded-xl p-4 mb-4 border-2 border-gray-100">
                  {qrData.qrUrl ? (
                    <img
                      src={qrData.qrUrl}
                      alt="KHQR Code"
                      className="w-56 h-56 object-contain"
                    />
                  ) : qrData.qrString ? (
                    <div className="w-56 h-56 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
                      <p className="text-xs font-mono break-all text-gray-500 text-center px-2">
                        {qrData.qrString}
                      </p>
                    </div>
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center bg-gray-50 rounded-lg">
                      <p className="text-gray-400">QR not available</p>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="text-center mb-2">
                  <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${parseFloat(qrData.amount || totalAmount).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-400">USD</p>
                </div>

                {/* Expiry */}
                {qrData.expiry && (
                  <div className="text-center text-xs text-gray-400 mb-1">
                    QR expires: {new Date(qrData.expiry).toLocaleTimeString()}
                  </div>
                )}
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 py-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pollingActive ? 'bg-blue-400' : 'bg-gray-400'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${pollingActive ? 'bg-blue-500' : 'bg-gray-500'}`} />
                </span>
                <span className="text-sm text-gray-500">
                  {pollingActive ? 'Waiting for payment...' : 'Initializing...'}
                </span>
              </div>

              {/* Order reference */}
              <div className="text-center text-xs text-gray-400">
                Order #{orderId}
              </div>
            </>
          )}

          {/* Retry on error */}
          {!loading && error && (
            <div className="flex justify-center">
                <button
                  onClick={generateQR}
                  className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
                >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Footer with Cancel */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default AbaPaymentModal;