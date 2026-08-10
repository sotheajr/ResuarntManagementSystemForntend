import { useState, useEffect, useCallback } from 'react';
import socket from '../../services/socket';

const PaymentQRDisplay = () => {
  const [activePayment, setActivePayment] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [connected, setConnected] = useState(socket.connected);

  // Connect socket on mount, disconnect on unmount
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onShowQR = (payload) => {
      setActivePayment(payload);
      setPaymentSuccess(false);
    };
    const onPaymentSuccess = () => {
      setPaymentSuccess(true);
      // After 3 seconds go back to standby
      setTimeout(() => {
        setPaymentSuccess(false);
        setActivePayment(null);
      }, 3000);
    };
    const onClearQR = () => {
      setActivePayment(null);
      setPaymentSuccess(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('SHOW_PAYMENT_QR', onShowQR);
    socket.on('PAYMENT_SUCCESS', onPaymentSuccess);
    socket.on('CLEAR_PAYMENT_QR', onClearQR);

    // If already connected, set state
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('SHOW_PAYMENT_QR', onShowQR);
      socket.off('PAYMENT_SUCCESS', onPaymentSuccess);
      socket.off('CLEAR_PAYMENT_QR', onClearQR);
    };
  }, []);

  // ==================== SUCCESS ANIMATION ====================
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-500 to-emerald-700 flex flex-col items-center justify-center z-50">
        <div className="animate-bounce-in">
          <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-20 h-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3 animate-fade-in">Payment Successful!</h1>
        <p className="text-xl text-white/80 animate-fade-in">Thank you for your payment</p>
      </div>
    );
  }

  // ==================== ACTIVE PAYMENT QR DISPLAY ====================
  if (activePayment) {
    const { amount, qrUrl, qrString, orderId, tableName } = activePayment;
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Scan to Pay</h1>
          <p className="text-2xl text-gray-500">
            Table <span className="font-bold text-gray-800">{tableName || 'N/A'}</span>
          </p>
        </div>

        {/* QR Code */}
        <div className="qr-code-container bg-white rounded-3xl shadow-2xl p-8 mb-6 border border-gray-100">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="KHQR Code"
              className="w-72 h-72 object-contain"
            />
          ) : qrString ? (
            <div className="w-72 h-72 flex items-center justify-center">
              <p className="text-lg font-mono text-center break-all text-gray-700">{qrString}</p>
            </div>
          ) : (
            <div className="w-72 h-72 flex items-center justify-center bg-gray-50 rounded-2xl">
              <p className="text-gray-400 text-lg">Loading QR...</p>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="text-center mb-4">
          <p className="text-lg text-gray-500 mb-1">Total Amount</p>
          <p className="text-6xl font-bold text-gray-900">
            ${parseFloat(amount || 0).toFixed(2)}
          </p>
          <p className="text-lg text-gray-400 mt-2">USD</p>
        </div>

        {/* Order reference */}
        <div className="text-center text-gray-400">
          <p className="text-sm">Order #{orderId}</p>
        </div>

        {/* Connection indicator */}
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-gray-800/80 text-white px-4 py-2 rounded-full text-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? 'Live' : 'Connecting...'}
        </div>
      </div>
    );
  }

  // ==================== STANDBY / IDLE STATE ====================
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-brand-600 to-brand-800 flex flex-col items-center justify-center text-white">
      {/* Logo / Branding */}
      <div className="mb-8">
        <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-16 h-16 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-center">Restaurant Name</h1>
        <p className="text-lg text-white/60 text-center mt-1">KHQR Payment · ABA / Bakong</p>
      </div>

      {/* Status */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl px-10 py-6 text-center border border-white/10">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-2xl font-medium">Ready for Next Payment</span>
        </div>
        <p className="text-white/50 text-base">
          Waiting for a payment request...
        </p>
      </div>

      {/* Table statuses (placeholder) */}
      <div className="mt-8 text-white/40">
        <p className="text-sm">Connected · All systems ready</p>
      </div>

      {/* Connection indicator */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-black/30 text-white/80 px-4 py-2 rounded-full text-sm">
        <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        {connected ? 'Connected' : 'Connecting...'}
      </div>
    </div>
  );
};

export default PaymentQRDisplay;