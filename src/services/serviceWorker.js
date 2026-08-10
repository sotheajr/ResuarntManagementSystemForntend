// PWA service worker registration + install prompt handling

/**
 * Checks if the current hostname is a loopback address
 * (localhost / 127.x.x.x).
 */
function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('127.');
}

/**
 * Checks if the current hostname is a private / LAN IP address.
 * Chrome & Edge treat private network IPs as secure contexts and
 * allow service workers over plain HTTP — required for mobile
 * devices accessing the app at http://192.168.x.x:3000.
 */
function isPrivateLanHost(hostname) {
  // IPv4 private ranges
  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return true;
  }

  // IPv6 link-local / unique-local
  if (hostname.startsWith('fe80:') || hostname.startsWith('fd') || hostname.startsWith('fc')) {
    return true;
  }

  return false;
}

/**
 * Registers the service worker for offline caching.
 * Service workers are permitted on:
 *  - HTTPS (secure context)
 *  - localhost / 127.x.x.x (loopback is always a secure context)
 *  - Private LAN IPs (Chrome/Edge treat these as secure contexts)
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service workers not supported in this browser.');
    return;
  }

  const hostname = window.location.hostname;
  const isLocalhost = isLoopbackHost(hostname);
  const isHttps = window.location.protocol === 'https:';
  const isLan = isPrivateLanHost(hostname);

  if (!isLocalhost && !isHttps && !isLan) {
    console.log('[PWA] Service worker requires HTTPS, localhost, or a private LAN IP. Skipping registration.');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(registration => {
        console.log('[PWA] Service worker registered:', registration.scope);

        // Check for updates on page load
        registration.update();

        // Listen for a new service worker taking control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[PWA] New service worker activated.');
        });
      })
      .catch(error => {
        console.error('[PWA] Service worker registration failed:', error);
      });
  });
}

/**
 * Sets up the "beforeinstallprompt" listener and returns a function
 * that can be used to show the install prompt. Exposes a subscription
 * mechanism so React components can react to prompt availability.
 */
export function setupInstallPrompt() {
  const handlers = new Set();

  // Store the deferred prompt globally so any component can trigger it
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', event => {
    // Prevent the default mini-infobar on mobile
    event.preventDefault();
    deferredPrompt = event;

    // Notify all subscribers that the install prompt is available
    handlers.forEach(handler => handler(event));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed.');
    deferredPrompt = null;

    // Notify subscribers that the app was installed (prompt no longer available)
    handlers.forEach(handler => handler(null));
  });

  /**
   * Subscribe to install prompt availability.
   * @param {(promptEvent: Event | null) => void} handler
   * @returns {() => void} unsubscribe function
   */
  function subscribe(handler) {
    handlers.add(handler);

    // Immediately deliver current state to new subscribers
    if (deferredPrompt) {
      handler(deferredPrompt);
    }

    return () => handlers.delete(handler);
  }

  /**
   * Shows the install prompt. Call only when `deferredPrompt` is set.
   * @returns {Promise<boolean>} true if the user accepted, false otherwise
   */
  async function promptInstall() {
    if (!deferredPrompt) return false;

    // Show the native install prompt
    deferredPrompt.prompt();

    const choiceResult = await deferredPrompt.userChoice;
    deferredPrompt = null;

    return choiceResult.outcome === 'accepted';
  }

  return { subscribe, promptInstall, isAvailable: () => !!deferredPrompt };
}

// Singleton instance used across the app
let installPromptInstance = null;
export function getInstallPrompt() {
  if (!installPromptInstance) {
    installPromptInstance = setupInstallPrompt();
  }
  return installPromptInstance;
}