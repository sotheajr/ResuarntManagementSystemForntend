import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Home, CreditCard } from 'lucide-react';

const StripeSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Brief delay for animation
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Success Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-scale-in">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center animate-bounce-in">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-green-100 text-sm">Your transaction has been completed</p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {sessionId && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Session ID</p>
                <p className="text-sm font-mono text-gray-800 break-all">{sessionId}</p>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Paid via Credit Card (Stripe)</p>
                <p className="text-xs text-green-600 mt-1">
                  Your payment has been processed securely through Stripe. A receipt has been sent to your email.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Link
                to="/"
                className="btn-primary w-full inline-flex items-center justify-center gap-2 py-3"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </Link>
              <button
                onClick={() => navigate('/admin/payments')}
                className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Back to Payments
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Stripe · Secure Payment Gateway
        </p>
      </div>
    </div>
  );
};

export default StripeSuccess;