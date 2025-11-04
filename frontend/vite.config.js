import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: mode === 'development' ? {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://cantontrack.ddev.site',
        changeOrigin: true,
        secure: false,
      },
    },
  } : undefined,
}));
