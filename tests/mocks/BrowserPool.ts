import { vi } from 'vitest';
import type { PoolStats } from '@electron/core/types/browser';

export function createBrowserPoolMock() {
  return {
    initialize: vi.fn(() => Promise.resolve()),
    acquireContext: vi.fn(() =>
      Promise.resolve({
        navigate: vi.fn(() => Promise.resolve()),
        close: vi.fn(() => Promise.resolve()),
      })
    ),
    releaseContext: vi.fn(),
    getStats: vi.fn<() => PoolStats>(
      (): PoolStats => ({
        totalBrowsers: 0,
        activeContexts: 0,
        idleContexts: 0,
        memoryUsageMb: 100,
        memoryOverWatermark: false,
        accountBindings: 0,
      })
    ),
    shutdown: vi.fn(() => Promise.resolve()),
  };
}

export type BrowserPoolMock = ReturnType<typeof createBrowserPoolMock>;
