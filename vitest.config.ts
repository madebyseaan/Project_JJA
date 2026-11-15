import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
