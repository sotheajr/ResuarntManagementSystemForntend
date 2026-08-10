import { useNavigate, Link } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCw, Home } from 'lucide-react';

const StripeCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Cancel Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-scale-in">
          {/* Cancel Header */}
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center animate-fade-in">
              <XCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Payment Cancelled</h1>
            <p className="text-amber-100 text-sm">Your transaction was not completed</p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                You have cancelled the payment process. No charges have been made to your account.
              </p>
            </div>

            <p className="text-sm text-gray-500 text-center">
              You can try again or choose a different payment method.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => navigate(-1)}
                className="btn-warning w-full inline-flex items-center justify-center gap-2 py-3"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
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
                Choose Another Payment Method
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

export default StripeCancel;