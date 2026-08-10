import { useState, useEffect } from 'react';
import { Clock, Loader2, CheckCircle, AlertTriangle, LogIn, ArrowLeft } from 'lucide-react';
import { attendanceAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';

const ClockInPage = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStatus, setTodayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Real-time clock update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance status
  useEffect(() => {
    fetchTodayStatus();
  }, []);

  const fetchTodayStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceAPI.todayStatus();
      setTodayStatus(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to check attendance status', language));
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await attendanceAPI.clockIn();
      const data = res.data?.data || res.data;
      setResult({
        type: 'success',
        message: res.data?.message || t('Clocked in successfully!', language),
        time: data?.Clock_In || currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
      // Refresh status
      setTimeout(() => fetchTodayStatus(), 500);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to clock in', language));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const canClockIn = todayStatus?.can_clock_in === true;
  const isClockedIn = todayStatus?.status === 'clocked_in';
  const isCompleted = todayStatus?.status === 'completed';
  const clockInTime = todayStatus?.record?.Clock_In || todayStatus?.record?.clock_in;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Clock In', language)}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('Record your attendance for today', language)}</p>
      </div>

      {/* Real-Time Clock Card */}
      <div className="card p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <LogIn className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-5xl font-bold text-gray-900 mb-2 font-mono tracking-wider">
          {formatTime(currentTime)}
        </h2>
        <p className="text-lg text-gray-500 mb-2">{formatDate(currentTime)}</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{t('Date & Time are auto-captured — not editable', language)}</span>
        </div>
      </div>

      {/* User Info */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold">
          {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{user?.full_name || 'User'}</p>
          <p className="text-xs text-gray-500">{t('Employee ID:', language)} {user?.User_ID || user?.user_id || 'N/A'}</p>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{result.message}</p>
            {result.time && <p className="text-xs text-green-500 mt-0.5">{t('Clocked in at:', language)} {result.time}</p>}
          </div>
        </div>
      )}

      {/* Conditional Status Card */}
      {isClockedIn && (
        <div className="card p-6 text-center border-l-4 border-l-yellow-400">
          <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-yellow-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('You are currently clocked in', language)}</h3>
          <p className="text-sm text-gray-500">
            {t('Clock in time:', language)} {clockInTime ? new Date('1970-01-01T' + clockInTime + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
          </p>
          <p className="text-sm text-gray-400 mt-2">{t('Please use the Clock Out menu option to end your shift.', language)}</p>
        </div>
      )}

      {isCompleted && (
        <div className="card p-6 text-center border-l-4 border-l-green-400">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('Shift completed for today', language)}</h3>
          <p className="text-sm text-gray-500">{t('You have already completed your full shift. Come back tomorrow!', language)}</p>
        </div>
      )}

      {/* Clock In Button */}
      <button
        onClick={handleClockIn}
        disabled={!canClockIn || submitting}
        className={`w-full py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
          canClockIn
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl active:scale-[0.98]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('Clocking In...', language)}
          </>
        ) : (
          <>
            <LogIn className="w-5 h-5" />
            {canClockIn ? t('Clock In Now', language) : isCompleted ? t('Shift Completed', language) : t('Already Clocked In', language)}
          </>
        )}
      </button>

      {!canClockIn && (
        <p className="text-center text-xs text-gray-400">
          {isCompleted
            ? t('✅ You have completed your shift. Clock-in is unavailable until tomorrow.', language)
            : t('⏰ You are already clocked in. Clock-out first before clocking in again.', language)}
        </p>
      )}
    </div>
  );
};

export default ClockInPage;