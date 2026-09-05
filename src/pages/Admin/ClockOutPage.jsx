import { useState, useEffect } from 'react';
import { Clock, Loader2, CheckCircle, AlertTriangle, LogOut, RotateCcw } from 'lucide-react';
import { attendanceAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';

const ClockOutPage = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStatus, setTodayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [resetting, setResetting] = useState(false);

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

  const handleClockOut = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await attendanceAPI.clockOut();
      setResult({
        type: 'success',
        message: res.data?.message || t('Clocked out successfully!', language),
        data: res.data?.data || res.data,
      });
      // Refresh status
      setTimeout(() => fetchTodayStatus(), 500);
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to clock out', language));
    } finally {
      setSubmitting(false);
    }
  };

  // TESTING UTILITY (Admin): clear today's record so the flow can be re-tested
  const handleReset = async () => {
    setResetting(true);
    setError(null);
    setResult(null);
    try {
      await attendanceAPI.resetToday();
      await fetchTodayStatus();
    } catch (err) {
      setError(err.response?.data?.message || t('Failed to reset attendance', language) || 'Failed to reset attendance');
    } finally {
      setResetting(false);
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

  const canClockOut = todayStatus?.can_clock_out === true;
  const isNotClockedIn = todayStatus?.status === 'not_clocked_in';
  const isCompleted = todayStatus?.status === 'completed';
  const clockInTime = todayStatus?.record?.Clock_In || todayStatus?.record?.clock_in;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Clock Out', language)}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('End your shift for today', language)}</p>
      </div>

      {/* Real-Time Clock Card */}
      <div className="card p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <LogOut className="w-10 h-10 text-white" />
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
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{result.message}</p>
          </div>
          {result.data && (
            <div className="ml-8 text-xs text-green-600 space-y-1">
              <p>{t('Work Hours:', language)} <strong>{result.data.Work_Hours || result.data.work_hours || '0.00'} {t('hrs', language)}</strong></p>
              <p>{t('OT Hours:', language)} <strong>+{result.data.OT_Hours || result.data.ot_hours || '0.00'} {t('hrs', language)}</strong></p>
              <p>{t('Status:', language)} <strong>{result.data.Status || result.data.status || t('Present', language)}</strong></p>
            </div>
          )}
        </div>
      )}

      {/* Conditional Status Card */}
      {isNotClockedIn && (
        <div className="card p-6 text-center border-l-4 border-l-red-400">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('Not Clocked In Yet', language)}</h3>
          <p className="text-sm text-gray-500">{t('Please clock in first before attempting to clock out.', language)}</p>
          <p className="text-sm text-gray-400 mt-2">{t('Use the Clock In menu option to start your shift.', language)}</p>
        </div>
      )}

      {isCompleted && (
        <div className="card p-6 text-center border-l-4 border-l-green-400">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('Shift completed for today', language)}</h3>
          <p className="text-sm text-gray-500">{t('You have already clocked out. Great work today!', language)}</p>
        </div>
      )}

      {/* Clock In Time Display */}
      {canClockOut && clockInTime && (
        <div className="card p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <span className="font-medium">{t('Clocked in at:', language)}</span>{' '}
            {new Date('1970-01-01T' + clockInTime + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          <p className="text-xs text-blue-500 mt-1">{t('Work hours and overtime will be calculated automatically upon clock out.', language)}</p>
        </div>
      )}

      {/* Clock Out Button */}
      <button
        onClick={handleClockOut}
        disabled={!canClockOut || submitting}
        className={`w-full py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
          canClockOut
            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-lg hover:shadow-xl active:scale-[0.98]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('Clocking Out...', language)}
          </>
        ) : (
          <>
            <LogOut className="w-5 h-5" />
            {canClockOut ? t('Clock Out Now', language) : isCompleted ? t('Already Clocked Out', language) : t('Please Clock In First', language)}
          </>
        )}
      </button>

      {!canClockOut && (
        <p className="text-center text-xs text-gray-400">
          {isCompleted
            ? t('✅ You have already clocked out. See you tomorrow!', language)
            : t('⏰ You need to clock in before you can clock out.', language)}
        </p>
      )}

      {/* Reset for Testing (Admin only) */}
      {isAdmin && (canClockOut || isCompleted) && (
        <button
          onClick={handleReset}
          disabled={resetting}
          className="w-full py-2 px-4 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {resetting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          {t('Reset for Testing', language) || 'Reset for Testing'}
        </button>
      )}
    </div>
  );
};

export default ClockOutPage;