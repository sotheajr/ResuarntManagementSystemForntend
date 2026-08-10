import { useState, useEffect } from 'react';
import { X, Loader2, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import { paymentsAPI } from '../services/api';

const ReceiptModal = ({ paymentId, orderId, onClose }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [printTriggered, setPrintTriggered] = useState(false);

  // Fetch receipt data on mount
  useEffect(() => {
    let mounted = true;
    const fetchReceipt = async () => {
      if (!paymentId) {
        // No payment ID — fall back to fetching by order via payment lookup isn't available,
        // so we show a simple receipt with just the order info.
        setLoading(false);
        return;
      }
      try {
        const res = await paymentsAPI.getReceipt(paymentId);
        if (mounted) {
          setReceipt(res.data?.data || res.data);
        }
      } catch (err) {
        console.error('Failed to fetch receipt:', err);
        if (mounted) setError(err.response?.data?.message || 'Failed to load receipt');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReceipt();
    return () => { mounted = false; };
  }, [paymentId]);

  // Auto-trigger browser print when receipt is ready (once)
  useEffect(() => {
    if (receipt && !loading && !printTriggered) {
      setPrintTriggered(true);
      // Small delay so the modal renders before the print dialog opens
      const timer = setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto-print failed:', e);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [receipt, loading, printTriggered]);

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Print failed:', e);
    }
  };

  const displayItems = receipt?.items && Array.isArray(receipt.items)
    ? receipt.items
    : [];

  const totalAmount = receipt?.total
    ? parseFloat(receipt.total).toFixed(2)
    : 'N/A';

  const discountAmount = receipt?.discount_amount
    ? parseFloat(receipt.discount_amount).toFixed(2)
    : null;

  const receiptDate = receipt?.date
    ? new Date(receipt.date).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 print:bg-white print:p-0 print:static print:inset-auto print:z-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in print:shadow-none print:rounded-none print:max-w-none print:overflow-visible">
        {/* Header (hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Print Receipt</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading receipt...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm text-red-700 mb-2">{error}</p>
              <p className="text-xs text-gray-500">Order #{orderId || 'N/A'} payment was successful.</p>
            </div>
          )}

          {/* Receipt Content */}
          {!loading && (
            <div className="font-mono text-sm text-gray-800">
              {/* === RECEIPT HEADER === */}
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <h1 className="text-xl font-bold tracking-wide">RESTAURANT</h1>
                <p className="text-xs text-gray-500 mt-1">KHQR / ABA Payment Receipt</p>
                <p className="text-xs text-gray-500">Receipt #: {receipt?.receipt_no || `RCP-${orderId || ''}`}</p>
                <p className="text-xs text-gray-500">Date: {receiptDate}</p>
              </div>

              {/* === CUSTOMER INFO === */}
              <div className="space-y-1 mb-4">
                {receipt?.customer && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer:</span>
                    <span className="font-medium">{receipt.customer}</span>
                  </div>
                )}
                {receipt?.cashier && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cashier:</span>
                    <span className="font-medium">{receipt.cashier}</span>
                  </div>
                )}
                {receipt?.table && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Table:</span>
                    <span className="font-medium">{receipt.table}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Order #:</span>
                  <span className="font-medium">{orderId || receipt?.receipt_no || 'N/A'}</span>
                </div>
                {receipt?.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment:</span>
                    <span className="font-medium">{receipt.payment_method}</span>
                  </div>
                )}
              </div>

              {/* === ITEMS === */}
              <div className="border-y-2 border-dashed border-gray-300 py-3 mb-4">
                {displayItems.length > 0 ? (
                  <>
                    <div className="flex justify-between font-bold mb-2">
                      <span>ITEM</span>
                      <span>AMOUNT</span>
                    </div>
                    {displayItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1">
                        <span>
                          {item.item || item.name || 'Item'}
                          {parseInt(item.qty || 1) > 1 && (
                            <span className="text-gray-400"> x{item.qty}</span>
                          )}
                        </span>
                        <span>${parseFloat(item.subtotal ?? item.price ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center text-xs text-gray-400 py-3">
                    No itemized line items available
                  </div>
                )}
              </div>

              {/* === TOTALS === */}
              <div className="space-y-1 mb-6">
                {receipt?.subtotal !== undefined && receipt?.subtotal !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span>${parseFloat(receipt.subtotal).toFixed(2)}</span>
                  </div>
                )}
                {discountAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Discount{receipt?.discount_percent ? ` (${receipt.discount_percent}%)` : ''}:
                    </span>
                    <span>-${discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t-2 border-dashed border-gray-300 pt-2">
                  <span>TOTAL</span>
                  <span>${totalAmount}</span>
                </div>
              </div>

              {/* === FOOTER === */}
              <div className="text-center text-xs text-gray-500 border-t-2 border-dashed border-gray-300 pt-4">
                <p className="flex items-center justify-center gap-1 mb-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-green-700 font-medium">PAID</span>
                </p>
                <p>Thank you for your business!</p>
                <p className="mt-1">Powered by TolaSaint KHQR</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer (hidden on print) */}
        <div className="print:hidden px-6 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {error && (
            <p className="text-xs text-gray-500 text-center">
              Receipt data could not be fetched, but payment was successful.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;