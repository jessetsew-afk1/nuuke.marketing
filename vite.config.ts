import { defineConfig } from 'vite';

// SPA: every route falls back to index.html (Vite does this by default in dev/preview).
export default defineConfig({
  server: { port: 5173, open: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
