import { Logger } from './Logger';
import { EventBus } from './EventBus';
import { TaskEvents } from './types/task';
import type { IRateLimiter, RateLimitRule } from './types/task';

const logger = new Logger('RateLimiter');

interface BucketState {
  activeCount: number;
  timestamps: number[];
}

const DEFAULT_RULE: RateLimitRule = {
  maxConcurrent: 3,
  windowMs: 60_000,
  maxRequestsPerWindow: 30,
};

export class RateLimiter implements IRateLimiter {
  private static instance: RateLimiter;

  private buckets = new Map<string, BucketState>();
  private rules = new Map<string, RateLimitRule>();
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  setRule(key: string, rule: Partial<RateLimitRule>): void {
    const existing = this.rules.get(key) ?? { ...DEFAULT_RULE };
    this.rules.set(key, { ...existing, ...rule });
    logger.info(`限速规则已更新: ${key}`, this.rules.get(key));
  }

  private getRule(key: string): RateLimitRule {
    return this.rules.get(key) ?? { ...DEFAULT_RULE };
  }

  private getOrCreateBucket(key: string): BucketState {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { activeCount: 0, timestamps: [] };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  async acquire(key: string): Promise<boolean> {
    const rule = this.getRule(key);
    const bucket = this.getOrCreateBucket(key);
    const now = Date.now();

    this.pruneTimestamps(bucket, now, rule.windowMs);

    if (bucket.activeCount >= rule.maxConcurrent) {
      logger.warn(`并发限制触发: ${key} (${bucket.activeCount}/${rule.maxConcurrent})`);
      this.eventBus.emit(TaskEvents.RATE_LIMITED, { key, reason: 'concurrent', activeCount: bucket.activeCount });
      return false;
    }

    if (bucket.timestamps.length >= rule.maxRequestsPerWindow) {
      logger.warn(`窗口限制触发: ${key} (${bucket.timestamps.length}/${rule.maxRequestsPerWindow} per ${rule.windowMs}ms)`);
      this.eventBus.emit(TaskEvents.RATE_LIMITED, { key, reason: 'window', requestCount: bucket.timestamps.length });
      return false;
    }

    bucket.activeCount++;
    bucket.timestamps.push(now);
    logger.debug(`许可已获取: ${key} (active=${bucket.activeCount}, window=${bucket.timestamps.length})`);
    return true;
  }

  release(key: string): void {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      logger.warn(`释放未知的 key: ${key}`);
      return;
    }

    if (bucket.activeCount <= 0) {
      logger.warn(`释放计数异常: ${key} (activeCount=0)`);
      return;
    }

    bucket.activeCount--;
    logger.debug(`许可已释放: ${key} (active=${bucket.activeCount})`);
  }

  getWaitTime(key: string): number {
    const rule = this.getRule(key);
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;

    const now = Date.now();

    if (bucket.activeCount >= rule.maxConcurrent) {
      return rule.windowMs;
    }

    if (bucket.timestamps.length >= rule.maxRequestsPerWindow && bucket.timestamps.length > 0) {
      const oldestInWindow = bucket.timestamps[0];
      const wait = Math.max(0, oldestInWindow + rule.windowMs - now);
      return wait;
    }

    return 0;
  }

  getActiveCount(key: string): number {
    return this.buckets.get(key)?.activeCount ?? 0;
  }

  private pruneTimestamps(bucket: BucketState, now: number, windowMs: number): void {
    const cutoff = now - windowMs;
    let i = 0;
    while (i < bucket.timestamps.length && bucket.timestamps[i] < cutoff) {
      i++;
    }
    if (i > 0) {
      bucket.timestamps = bucket.timestamps.slice(i);
    }
  }

  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
      logger.info(`限速桶已重置: ${key}`);
    } else {
      this.buckets.clear();
      logger.info('所有限速桶已重置');
    }
  }
}
