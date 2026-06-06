import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  cacheDir: '/tmp/eastshop-vite-cache',
  plugins: [react()],
})
