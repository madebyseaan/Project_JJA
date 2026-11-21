import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    // The database tests share one Supabase instance. Running files in
    // parallel lets one test's cleanup and counters leak into another's totals.
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
