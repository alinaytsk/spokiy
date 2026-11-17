import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // three.js alone is ~560 kB minified (140 kB gzipped). It is split into its own chunk
  // and loaded only by the home page, so the default 500 kB warning is noise here.
  build: { chunkSizeWarningLimit: 650 },
})
