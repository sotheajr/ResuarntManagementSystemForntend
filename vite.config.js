import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Expose the dev server on the LAN so mobile devices / tablets
    // on the same network can access the app at http://<PC_IP>:3000
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://restaurant-backend-api-xsjc.onrender.com',
        changeOrigin: true,
      },
    },
  },
})