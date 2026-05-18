import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('worker_threads', () => ({
  __esModule: true,
  default: {},
  Worker: vi.fn(),
}));

vi.mock('@electron/core/Logger', () => ({
  Logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@electron/core/EventBus', () => ({
  EventBus: { getInstance: vi.fn(() => ({ emit: vi.fn() })) },
}));

import { BrowserAutomationWorker } from '@electron/core/BrowserAutomationWorker';

describe('BrowserAutomationWorker', () => {
  let worker: BrowserAutomationWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new BrowserAutomationWorker();
  });

  describe('isReady', () => {
    it('returns false before init', () => {
      expect(worker.isReady()).toBe(false);
    });
  });

  describe('executeTask rejection', () => {
    it('rejects when worker not ready', async () => {
      await expect(worker.executeLogin('acc', 'douyin')).rejects.toThrow('Worker not ready');
    });

    it('rejects publish when not ready', async () => {
      await expect(worker.executePublish('douyin', {} as any)).rejects.toThrow('Worker not ready');
    });

    it('rejects schedule when not ready', async () => {
      await expect(worker.executeSchedule('douyin', {} as any)).rejects.toThrow('Worker not ready');
    });

    it('rejects comment when not ready', async () => {
      await expect(worker.executeComment('douyin', {} as any)).rejects.toThrow('Worker not ready');
    });

    it('rejects fetchStats when not ready', async () => {
      await expect(worker.executeFetchStats('douyin', 'acc1', '7d')).rejects.toThrow('Worker not ready');
    });

    it('rejects checkCookie when not ready', async () => {
      await expect(worker.executeCheckCookie('douyin', 'acc1')).rejects.toThrow('Worker not ready');
    });
  });

  describe('shutdown', () => {
    it('does nothing if worker not initialized', async () => {
      await worker.shutdown();
      expect(worker.isReady()).toBe(false);
    });
  });

  describe('constructor', () => {
    it('accepts custom config', () => {
      const customWorker = new BrowserAutomationWorker({ maxRestartAttempts: 5 });
      expect(customWorker.isReady()).toBe(false);
    });

    it('uses default config when none provided', () => {
      const defaultWorker = new BrowserAutomationWorker();
      expect(defaultWorker.isReady()).toBe(false);
    });
  });
});
