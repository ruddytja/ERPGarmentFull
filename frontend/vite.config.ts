import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Permintaan /api/* diteruskan ke server backend (../backend). Bila backend tidak
// berjalan, LoginPage otomatis beralih ke mode demo (akun mock).
const API_URL = process.env.API_URL || 'http://localhost:4000';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': { target: API_URL, changeOrigin: true },
      },
    },
  };
});
