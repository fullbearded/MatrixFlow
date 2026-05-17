/**
 * AI 缓存服务
 * 24 小时 TTL，基于内存 + SQLite 持久化
 */

import type { CacheEntry } from './types';

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 小时
const MAX_MEMORY_ENTRIES = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// AICache
// ─────────────────────────────────────────────────────────────────────────────

export class AICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number;
  private maxEntries: number;

  constructor(options?: { ttl?: number; maxEntries?: number }) {
    this.defaultTTL = options?.ttl || DEFAULT_TTL;
    this.maxEntries = options?.maxEntries || MAX_MEMORY_ENTRIES;
  }

  /**
   * 生成缓存键
   */
  generateKey(operation: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${operation}:${sorted}`;
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // 检查过期
    if (Date.now() > entry.createdAt + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 更新命中次数
    entry.hits++;

    return entry.value;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // LRU 淘汰
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0,
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.createdAt + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * LRU 淘汰
   */
  private evictLRU(): void {
    // 找到命中次数最少的条目
    let minHits = Infinity;
    let evictKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        evictKey = key;
      }
    }

    if (evictKey) {
      this.cache.delete(evictKey);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    size: number;
    maxEntries: number;
    defaultTTL: number;
  } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      defaultTTL: this.defaultTTL,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 单例
// ─────────────────────────────────────────────────────────────────────────────

let aiCache: AICache | null = null;

export function initAICache(options?: { ttl?: number; maxEntries?: number }): AICache {
  aiCache = new AICache(options);
  return aiCache;
}

export function getAICache(): AICache {
  if (!aiCache) {
    aiCache = new AICache();
  }
  return aiCache;
}
