import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '@electron/core/RateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    limiter.reset();
  });

  describe('acquire', () => {
    it('首次获取许可应返回 true', async () => {
      const result = await limiter.acquire('test-key');
      expect(result).toBe(true);
    });

    it('并发限制：超过 maxConcurrent 应返回 false', async () => {
      limiter.setRule('concurrent-test', { maxConcurrent: 2, windowMs: 60_000, maxRequestsPerWindow: 100 });

      expect(await limiter.acquire('concurrent-test')).toBe(true);
      expect(await limiter.acquire('concurrent-test')).toBe(true);
      expect(await limiter.acquire('concurrent-test')).toBe(false);
    });

    it('窗口限制：超过 maxRequestsPerWindow 应返回 false', async () => {
      limiter.setRule('window-test', { maxConcurrent: 100, windowMs: 60_000, maxRequestsPerWindow: 3 });

      for (let i = 0; i < 3; i++) {
        await limiter.acquire('window-test');
      }
      expect(await limiter.acquire('window-test')).toBe(false);
    });
  });

  describe('release', () => {
    it('释放后可再次获取许可', async () => {
      limiter.setRule('release-test', { maxConcurrent: 1, windowMs: 60_000, maxRequestsPerWindow: 100 });

      expect(await limiter.acquire('release-test')).toBe(true);
      expect(await limiter.acquire('release-test')).toBe(false);

      limiter.release('release-test');
      expect(await limiter.acquire('release-test')).toBe(true);
    });
  });

  describe('getActiveCount', () => {
    it('初始时应为 0', () => {
      expect(limiter.getActiveCount('unknown-key')).toBe(0);
    });

    it('acquire 后递增，release 后递减', async () => {
      limiter.setRule('count-test', { maxConcurrent: 10, windowMs: 60_000, maxRequestsPerWindow: 100 });

      await limiter.acquire('count-test');
      await limiter.acquire('count-test');
      expect(limiter.getActiveCount('count-test')).toBe(2);

      limiter.release('count-test');
      expect(limiter.getActiveCount('count-test')).toBe(1);
    });
  });

  describe('getWaitTime', () => {
    it('空闲时返回 0', () => {
      expect(limiter.getWaitTime('unknown-key')).toBe(0);
    });

    it('达到并发上限时返回 windowMs', async () => {
      limiter.setRule('wait-test', { maxConcurrent: 1, windowMs: 60_000, maxRequestsPerWindow: 100 });

      await limiter.acquire('wait-test');
      expect(limiter.getWaitTime('wait-test')).toBe(60_000);
    });
  });

  describe('setRule', () => {
    it('可覆盖默认规则', async () => {
      limiter.setRule('custom-rule', { maxConcurrent: 5 });
      expect(await limiter.acquire('custom-rule')).toBe(true);
      expect(limiter.getActiveCount('custom-rule')).toBe(1);
    });
  });

  describe('reset', () => {
    it('重置特定 key', async () => {
      limiter.setRule('reset-one', { maxConcurrent: 1, windowMs: 60_000, maxRequestsPerWindow: 100 });
      await limiter.acquire('reset-one');
      expect(limiter.getActiveCount('reset-one')).toBe(1);

      limiter.reset('reset-one');
      expect(limiter.getActiveCount('reset-one')).toBe(0);
    });

    it('重置所有 key', async () => {
      await limiter.acquire('key-a');
      await limiter.acquire('key-b');

      limiter.reset();
      expect(limiter.getActiveCount('key-a')).toBe(0);
      expect(limiter.getActiveCount('key-b')).toBe(0);
    });
  });
});
