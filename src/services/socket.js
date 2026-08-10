import { io } from 'socket.io-client';

/**
 * Resolves the WebSocket / Socket.IO server URL dynamically.
 *
 * Priority:
 *  1. VITE_SOCKET_URL env var (for explicit configuration)
 *  2. In dev, use the same hostname the page was loaded from, port 8000
 *  3. In production, fall back to http://<current-hostname>:8000
 *
 * This ensures mobile devices on the LAN (accessing the app at
 * http://<PC_IP>:5173) automatically connect to the WebSocket server
 * at http://<PC_IP>:8000 instead of their own localhost.
 */
function resolveSocketUrl() {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl;

  const hostname = window.location.hostname;
  return `http://${hostname}:8000`;
}

const SOCKET_URL = resolveSocketUrl();

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export default socket;