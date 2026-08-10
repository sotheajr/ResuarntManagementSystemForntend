import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker, getInstallPrompt } from './services/serviceWorker';
import './index.css';

// Register the PWA service worker for offline caching
registerServiceWorker();

// Initialize the install prompt listener (captures beforeinstallprompt)
getInstallPrompt();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);