import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['brand/jja-logo.jpg', 'pwa/*.png'],
      manifest: {
        name: 'J.J.A Motor Accessories and Motorcycle Repair Shop',
        short_name: 'J.J.A',
        description: 'Walk-in tickets, stock, payments, and tamper-evident e-receipts.',
        theme_color: '#E84E1B',
        background_color: '#F1F2EE',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,jpg,svg}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Supabase responses must never be cached: they contain orders,
            // prices, labor, GCash, and staff data.
            urlPattern: /^https:\/\/[^/]*\.supabase\.co\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
