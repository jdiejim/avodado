import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * One source tree, two builds.
 *
 *   `dist/app` — the default: documents come from `avo studio`'s file bridge.
 *   `dist/web` — the hosted studio: documents live in the tab, no server.
 *
 * The `build:web` script sets both variables — `VITE_STUDIO_BACKEND` picks the
 * backend at runtime (see `src/api/client.ts`) and this one keeps the two
 * outputs apart, so the CLI serves one and a static host serves the other.
 */
const web = process.env['VITE_STUDIO_BACKEND'] === 'vault';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: web ? { 'import.meta.env.VITE_STUDIO_BACKEND': '"vault"' } : {},
  build: {
    outDir: web ? 'dist/web' : 'dist/app',
    target: 'es2022',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': 'http://127.0.0.1:4174',
      '/__events': { target: 'http://127.0.0.1:4174' },
      '/site': 'http://127.0.0.1:4174',
    },
  },
});
