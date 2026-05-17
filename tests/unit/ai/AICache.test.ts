import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AICache } from '@electron/ai/AICache';

describe('AICache', () => {
  let cache: AICache;

  beforeEach(() => {
    cache = new AICache({ ttl: 1000, maxEntries: 5 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateKey', () => {
    it('参数顺序不同生成相同 key', () => {
      const key1 = cache.generateKey('op', { a: 1, b: 2 });
      const key2 = cache.generateKey('op', { b: 2, a: 1 });
      expect(key1).toBe(key2);
    });

    it('不同操作生成不同 key', () => {
      const key1 = cache.generateKey('op1', { x: 1 });
      const key2 = cache.generateKey('op2', { x: 1 });
      expect(key1).not.toBe(key2);
    });
  });

  describe('get / set', () => {
    it('设置后可获取', () => {
      cache.set('key1', { name: 'test' });
      const result = cache.get<{ name: string }>('key1');
      expect(result).toEqual({ name: 'test' });
    });

    it('未设置返回 null', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('过期后返回 null', () => {
      cache.set('expiring-key', 'value', 500);
      vi.advanceTimersByTime(501);
      expect(cache.get('expiring-key')).toBeNull();
    });

    it('使用默认 TTL', () => {
      cache.set('default-ttl-key', 'value');
      vi.advanceTimersByTime(999);
      expect(cache.get('default-ttl-key')).toBe('value');
      vi.advanceTimersByTime(2);
      expect(cache.get('default-ttl-key')).toBeNull();
    });
  });

  describe('delete', () => {
    it('删除后 get 返回 null', () => {
      cache.set('del-key', 'value');
      expect(cache.delete('del-key')).toBe(true);
      expect(cache.get('del-key')).toBeNull();
    });

    it('删除不存在的 key 返回 false', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('清空所有缓存', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('清理过期条目', () => {
      cache.set('keep', 'value1', 2000);
      cache.set('expire', 'value2', 500);

      vi.advanceTimersByTime(501);
      const cleaned = cache.cleanup();

      expect(cleaned).toBe(1);
      expect(cache.get('keep')).toBe('value1');
      expect(cache.get('expire')).toBeNull();
    });
  });

  describe('LRU 淘汰', () => {
    it('超过 maxEntries 时淘汰命中最少的条目', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }

      // key-0 和 key-1 多次命中
      cache.get('key-0');
      cache.get('key-0');
      cache.get('key-1');

      // key-2 从未被 get（hits=0），应被淘汰
      cache.set('key-5', 'value-5');

      expect(cache.get('key-2')).toBeNull();
      expect(cache.get('key-5')).toBe('value-5');
    });
  });

  describe('getStats', () => {
    it('返回正确的统计信息', () => {
      cache.set('a', 1);
      cache.set('b', 2);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxEntries).toBe(5);
      expect(stats.defaultTTL).toBe(1000);
    });
  });
});
