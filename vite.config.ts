import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project sites are served from /<repo>/. Override with BASE_PATH (use '/' for a <user>.github.io repo).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/EndSphere/',
  plugins: [react()],
})
