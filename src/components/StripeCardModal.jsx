import { useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { X, Loader2, CheckCircle, AlertTriangle, CreditCard } from 'lucide-react';

// Load Stripe with the public key from env or a safe test fallback for dev
const stripePk = import.meta.env.VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51RPn3NQvXDWFbEa4QC7cUeadd65HPn9AkRqJNphPUNwnbrGbZtQdXaPacbRkeNCvw0bXu3TljAbRwz3FqWGX0NKD00NtyvqqCs';
const stripePromise = loadStripe(stripePk);

/**
 * Inner checkout form that handles Stripe Element submission.
 */
const CheckoutForm = ({ clientSecret, amount, email, orderId, onSuccess, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          receipt_email: email,
          return_url: `${window.location.origin}/admin/payments/success?order_id=${orderId}`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed. Please try again.');
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        if (typeof onSuccess === 'function') {
          await onSuccess(paymentIntent);
        }
        return;
      }

      setError('Payment was not completed. Status: ' + (paymentIntent?.status || 'unknown'));
      setProcessing(false);
    } catch (submitException) {
      setError(submitException?.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount Display */}
      <div className="text-center py-3">
        <p className="text-sm text-gray-500">Amount to pay</p>
        <p className="text-3xl font-bold text-gray-900">${amount.toFixed(2)}</p>
      </div>

      {/* Card Element */}
      <div className="p-4 border border-gray-200 rounded-xl bg-white">
        <div className="my-4 min-h-[160px]">
          <PaymentElement
            onReady={() => {
              setIsReady(true);
              setLoading(false);
            }}
            onLoadError={() => {
              setLoading(false);
              setError('Stripe payment form failed to load. Please refresh and try again.');
            }}
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#374151',
                  '::placeholder': { color: '#9ca3af' },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={processing}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || isReady === false || loading || processing}
          className="flex-1 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 rounded-xl transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {processing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
          ) : (
            <><CreditCard className="w-4 h-4" /> Pay ${amount.toFixed(2)}</>
          )}
        </button>
      </div>
    </form>
  );
};

/**
 * StripeCardModal - In-app modal for embedded credit card payment using Stripe Elements.
 *
 * Props:
 *   clientSecret  - PaymentIntent client_secret from backend
 *   amount        - total amount in dollars (float)
 *   email         - customer email
 *   orderId       - order ID (for metadata)
 *   onSuccess     - callback(paymentIntent) after successful payment
 *   onClose       - callback to close modal
 */
const StripeCardModal = ({ clientSecret, amount, email, orderId, onSuccess, onClose }) => {
  console.log('Stripe clientSecret:', clientSecret);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-gray-900">Card Payment</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="mb-3 text-sm text-gray-500">
            Order #{orderId || 'N/A'} — Secure card payment via Stripe
          </div>

          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm
                clientSecret={clientSecret}
                amount={amount}
                email={email}
                orderId={orderId}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </Elements>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">Loading card payment...</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Powered by Stripe — secure & encrypted
          </p>
        </div>
      </div>
    </div>
  );
};

export default StripeCardModal;