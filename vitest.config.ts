import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
    testTimeout: 10_000,
    hookTimeout: 10_000,
    teardownTimeout: 5_000,
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['electron/**/*.ts', 'src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/types/**',
        '**/migrations/**',
        'electron/main.ts',
        'electron/preload.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@electron': path.resolve(__dirname, 'electron'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
