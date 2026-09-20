import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The storefront talks to the API through a relative `/api` path.  In
 * development Vite proxies those calls to the Express server; in the container
 * image nginx performs the same job, so the application code is identical in
 * both environments.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
