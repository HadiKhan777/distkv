import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/metrics': 'http://localhost:7380',
      '/command': 'http://localhost:7380',
      '/health':  'http://localhost:7380',
    },
  },
})
