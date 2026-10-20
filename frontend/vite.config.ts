import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy all /api/* requests to the Express backend (avoids CORS in dev)
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy /zipkin/* requests to the local Zipkin container.
      // The frontend tracing module exports spans to /zipkin/api/v2/spans
      // which Vite rewrites to http://localhost:9411/api/v2/spans — same
      // approach as the /api proxy: browser talks to its own origin, no CORS.
      '/zipkin': {
        target: 'http://localhost:9411',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zipkin/, ''),
      },
    },
  },
});
