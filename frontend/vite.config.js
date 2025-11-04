import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // permite acceder desde la LAN si lo necesitas
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://cantontrack.ddev.site',
        changeOrigin: true,
        secure: false,   // certificado dev de DDEV es self-signed
      },
    },
  },
})