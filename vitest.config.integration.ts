import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 10_000,
    teardownTimeout: 5_000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@electron': path.resolve(__dirname, 'electron'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
