import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/app',
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
