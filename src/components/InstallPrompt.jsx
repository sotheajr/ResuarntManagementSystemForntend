import { useState, useEffect, useCallback } from 'react';
import { Download, X, Smartphone, Zap, Share2, Menu as MenuIcon, MoreVertical } from 'lucide-react';
import { getInstallPrompt } from '../services/serviceWorker';

const DISMISSED_KEY = 'rms-install-dismissed';

/**
 * Detects if the app is already running in standalone (installed) mode.
 */
function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

/**
 * Detects if this is an iOS device (where native beforeinstallprompt is
 * not supported, but users can add to home screen via Share > Add to Home Screen).
 */
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Detects if this is an Android device.
 */
function isAndroid() {
  return /android/i.test(window.navigator.userAgent);
}

const InstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone app
    if (isRunningStandalone()) return;

    // Don't show if user previously dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const installPrompt = getInstallPrompt();

    // Subscribe to prompt availability (fires when beforeinstallprompt occurs)
    const unsubscribe = installPrompt.subscribe(event => {
      setPromptEvent(event);
      if (event) {
        setVisible(true);
      }
    });

    // If a native prompt is available, show immediately
    if (installPrompt.isAvailable()) {
      setVisible(true);
      return () => unsubscribe();
    }

    // Otherwise wait a moment before showing the install hint
    const showTimer = setTimeout(() => setVisible(true), 4000);

    return () => {
      clearTimeout(showTimer);
      unsubscribe();
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }, []);

  const handleInstall = useCallback(async () => {
    const installPrompt = getInstallPrompt();

    if (installPrompt.isAvailable()) {
      setInstalling(true);
      try {
        const accepted = await installPrompt.promptInstall();
        if (accepted) {
          setVisible(false);
          localStorage.setItem(DISMISSED_KEY, 'true');
        }
      } finally {
        setInstalling(false);
      }
    } else if (isIOS()) {
      // iOS has no native install prompt — show instructions instead
      setPromptEvent({ ios: true });
      setShowInstructions(true);
    } else {
      // Fallback: show instructions for manual browser install
      setPromptEvent({ manual: true });
      setShowInstructions(true);
    }
  }, []);

  /**
   * Returns the browser-specific install instructions.
   */
  const renderInstructions = () => {
    if (promptEvent?.ios) {
      return (
        <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Tap the <Share2 className="inline w-3.5 h-3.5 text-blue-500 -mt-0.5" /> <strong>Share</strong> button in the Safari toolbar.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Tap <strong>Add</strong> in the top-right corner. The app will appear on your home screen.</span>
          </li>
        </ol>
      );
    }

    if (promptEvent?.manual && isAndroid()) {
      return (
        <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Tap the <MoreVertical className="inline w-3.5 h-3.5 text-gray-500 -mt-0.5" /> <strong>menu</strong> (three dots) in Chrome.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Tap <strong>Add</strong> to confirm. The app will appear on your home screen.</span>
          </li>
        </ol>
      );
    }

    if (promptEvent?.manual) {
      return (
        <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Click the <MenuIcon className="inline w-3.5 h-3.5 text-gray-500 -mt-0.5" /> <strong>menu</strong> (⋮ icon) in your browser toolbar.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Select <strong>"Install"</strong>, <strong>"Install app"</strong>, or <strong>"Add to Home Screen"</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Confirm the installation. The app will launch in full-screen mode.</span>
          </li>
        </ol>
      );
    }

    return null;
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-[9999] px-4 sm:px-6 flex justify-center pointer-events-none">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 pointer-events-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-white shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {showInstructions ? 'Install Restaurant Management System' : 'Add to Home Screen'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              {showInstructions
                ? 'Follow these simple steps to install the app:'
                : 'Install the app for offline access, faster loading, and a full-screen experience.'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature bullets */}
        {!showInstructions && (
          <div className="flex items-center gap-4 px-4 pt-1 pb-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-accent-500" /> Instant loading
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-teal-600" /> Works offline
            </span>
          </div>
        )}

        {/* Instructions */}
        {showInstructions && (
          <div className="px-4 pt-1 pb-3">{renderInstructions()}</div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          {!showInstructions && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {installing ? 'Installing…' : 'Install App'}
            </button>
          )}
          {showInstructions && (
            <button
              onClick={() => {
                setVisible(false);
                localStorage.setItem(DISMISSED_KEY, 'true');
              }}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors duration-200"
            >
              Got it
            </button>
          )}
          {!showInstructions && (
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;