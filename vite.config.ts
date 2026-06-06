import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
  },
  cacheDir: '/tmp/eastshop-vite-cache',
  plugins: [react()],
})
