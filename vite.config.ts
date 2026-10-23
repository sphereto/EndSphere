import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH lets GitHub Pages serve from /<repo>/ (e.g. BASE_PATH=/endsphere/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
