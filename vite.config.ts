import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: '/tmp/eastshop-vite-cache',
  plugins: [react()],
})
