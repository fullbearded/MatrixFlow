import { Logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { RateLimiter } from '../core/RateLimiter';
import { PlatformRegistry } from '../platform/base/PlatformRegistry';
import { getDatabase, isDatabaseAvailable } from '../data/Database';
import {
  StatsEvent,
} from './types/stats';
import type {
  IStatsService,
  VideoStats,
  AccountStats,
  PlatformStats,
  OverviewStats,
  TrendData,
  TimePeriod,
  StatsRefreshConfig,
  CacheEntry,
  BatchFetchProgress,
  VideoStatsUpdatedPayload,
  AccountStatsUpdatedPayload,
  FetchFailedPayload,
} from './types/stats';

const logger = new Logger('StatsService');

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_KEY_PREFIX = 'stats:';
const BATCH_CONCURRENCY = 3;

function generateId(): string {
  return `stat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class StatsService implements IStatsService {
  private static instance: StatsService;

  private eventBus: EventBus;
  private rateLimiter: RateLimiter;

  private videoStatsCache = new Map<string, CacheEntry<VideoStats>>();
  private accountStatsCache = new Map<string, CacheEntry<AccountStats>>();
  private platformStatsCache = new Map<string, CacheEntry<PlatformStats>>();
  private overviewCache: CacheEntry<OverviewStats> | null = null;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshConfig: StatsRefreshConfig = {
    intervalMs: DEFAULT_REFRESH_INTERVAL_MS,
    enabled: true,
  };
  private initialized = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
  }

  static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  initialize(): void {
    if (this.initialized) return;

    this.startPeriodicRefresh();
    this.initialized = true;
    logger.info('StatsService 已初始化');
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.videoStatsCache.clear();
    this.accountStatsCache.clear();
    this.platformStatsCache.clear();
    this.overviewCache = null;
    this.initialized = false;
    logger.info('StatsService 已释放');
  }

  // ─── 视频统计 ──────────────────────────────────────────

  async fetchVideoStats(videoId: string, platform: string): Promise<VideoStats> {
    const cacheKey = `${platform}:${videoId}`;
    const cached = this.getFromCache(this.videoStatsCache, cacheKey);
    if (cached) return cached;

    const adapter = this.requireAdapter(platform);
    await this.acquireRateLimit(platform);

    try {
      const data = await adapter.fetchVideoStats(videoId);

      const stats: VideoStats = {
        videoId,
        platform,
        playCount: data.playCount,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        shareCount: data.shareCount,
        collectCount: data.collectCount,
        fetchedAt: data.fetchTime,
      };

      this.setCache(this.videoStatsCache, cacheKey, stats);
      this.persistVideoStat(stats);

      const payload: VideoStatsUpdatedPayload = { videoId, platform, stats };
      this.eventBus.emit(StatsEvent.VIDEO_STATS_UPDATED, payload);

      return stats;
    } catch (err) {
      const payload: FetchFailedPayload = { target: `video:${videoId}`, error: String(err) };
      this.eventBus.emit(StatsEvent.FETCH_FAILED, payload);
      throw err;
    } finally {
      this.rateLimiter.release(RATE_LIMIT_KEY_PREFIX + platform);
    }
  }

  async fetchBatchVideoStats(
    videoIds: string[],
    platform: string,
  ): Promise<Map<string, VideoStats>> {
    const results = new Map<string, VideoStats>();
    const progress: BatchFetchProgress = { total: videoIds.length, completed: 0, failed: 0 };

    this.eventBus.emit(StatsEvent.BATCH_FETCH_STARTED, progress);

    const uncachedIds: string[] = [];

    for (const id of videoIds) {
      const cacheKey = `${platform}:${id}`;
      const cached = this.getFromCache(this.videoStatsCache, cacheKey);
      if (cached) {
        results.set(id, cached);
        progress.completed++;
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length > 0) {
      const chunks = this.chunkArray(uncachedIds, BATCH_CONCURRENCY);

      for (const chunk of chunks) {
        const settled = await Promise.allSettled(
          chunk.map(async (id) => {
            const stats = await this.fetchVideoStats(id, platform);
            return { id, stats };
          }),
        );

        for (const result of settled) {
          if (result.status === 'fulfilled') {
            results.set(result.value.id, result.value.stats);
            progress.completed++;
          } else {
            progress.failed++;
          }
        }
      }
    }

    this.eventBus.emit(StatsEvent.BATCH_FETCH_COMPLETED, progress);
    return results;
  }

  // ─── 账号统计 ──────────────────────────────────────────

  async fetchAccountStats(accountId: string, period: TimePeriod): Promise<AccountStats> {
    const cacheKey = `${accountId}:${period.start.toISOString()}-${period.end.toISOString()}`;
    const cached = this.getFromCache(this.accountStatsCache, cacheKey);
    if (cached) return cached;

    const platform = this.resolveAccountPlatform(accountId);
    const adapter = this.requireAdapter(platform);
    await this.acquireRateLimit(platform);

    try {
      const platformPeriod = this.convertToPlatformPeriod(period);
      const data = await adapter.fetchStats(accountId, platformPeriod);

      const db = this.requireDatabase();
      const taskItems = db.prepare(
        `SELECT COUNT(*) as cnt FROM task_items WHERE account_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at <= ?`,
      ).get(accountId, period.start.toISOString(), period.end.toISOString()) as { cnt: number } | undefined;

      const totalVideos = taskItems?.cnt ?? 0;
      const avgPlayCount = totalVideos > 0 ? Math.round(data.playCount / totalVideos) : 0;

      const stats: AccountStats = {
        accountId,
        platform,
        totalVideos,
        totalPlays: data.playCount,
        totalLikes: data.likeCount,
        totalComments: data.commentCount,
        avgPlayCount,
        period,
      };

      this.setCache(this.accountStatsCache, cacheKey, stats);

      const payload: AccountStatsUpdatedPayload = { accountId, platform, stats };
      this.eventBus.emit(StatsEvent.ACCOUNT_STATS_UPDATED, payload);

      return stats;
    } catch (err) {
      const payload: FetchFailedPayload = { target: `account:${accountId}`, error: String(err) };
      this.eventBus.emit(StatsEvent.FETCH_FAILED, payload);
      throw err;
    } finally {
      this.rateLimiter.release(RATE_LIMIT_KEY_PREFIX + platform);
    }
  }

  // ─── 平台统计 ──────────────────────────────────────────

  async fetchPlatformStats(platform: string, period: TimePeriod): Promise<PlatformStats> {
    const cacheKey = `${platform}:${period.start.toISOString()}-${period.end.toISOString()}`;
    const cached = this.getFromCache(this.platformStatsCache, cacheKey);
    if (cached) return cached;

    const db = this.requireDatabase();

    const accountRow = db.prepare(
      'SELECT COUNT(*) as cnt FROM accounts WHERE platform = ?',
    ).get(platform) as { cnt: number } | undefined;

    const activeRow = db.prepare(
      "SELECT COUNT(*) as cnt FROM accounts WHERE platform = ? AND status = 'active'",
    ).get(platform) as { cnt: number } | undefined;

    const statRow = db.prepare(
      `SELECT
        COUNT(DISTINCT vs.platform_video_id) as video_count,
        COALESCE(SUM(vs.play_count), 0) as total_plays,
        COALESCE(SUM(vs.like_count), 0) as total_likes
       FROM video_stats vs
       WHERE vs.platform = ? AND vs.fetch_time >= ? AND vs.fetch_time <= ?`,
    ).get(platform, period.start.toISOString(), period.end.toISOString()) as {
      video_count: number;
      total_plays: number;
      total_likes: number;
    } | undefined;

    const stats: PlatformStats = {
      platform,
      accountCount: accountRow?.cnt ?? 0,
      totalVideos: statRow?.video_count ?? 0,
      totalPlays: statRow?.total_plays ?? 0,
      totalLikes: statRow?.total_likes ?? 0,
      activeAccounts: activeRow?.cnt ?? 0,
    };

    this.setCache(this.platformStatsCache, cacheKey, stats);
    this.eventBus.emit(StatsEvent.PLATFORM_STATS_UPDATED, { platform, stats });

    return stats;
  }

  // ─── 聚合统计 ──────────────────────────────────────────

  async getOverviewStats(period?: TimePeriod): Promise<OverviewStats> {
    if (this.overviewCache && Date.now() < this.overviewCache.expiresAt) {
      return this.overviewCache.data;
    }

    const db = this.requireDatabase();

    const accountsRow = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number };
    const videosRow = db.prepare('SELECT COUNT(*) as cnt FROM contents').get() as { cnt: number };
    const publishesRow = db.prepare(
      "SELECT COUNT(*) as cnt FROM task_items WHERE status = 'completed'",
    ).get() as { cnt: number };

    const playsRow = db.prepare(
      'SELECT COALESCE(SUM(play_count), 0) as total FROM video_stats',
    ).get() as { total: number };

    const likesRow = db.prepare(
      'SELECT COALESCE(SUM(like_count), 0) as total FROM video_stats',
    ).get() as { total: number };

    const platforms = PlatformRegistry.getSupportedPlatforms();
    const platformStats = new Map<string, PlatformStats>();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const defaultPeriod: TimePeriod = period ?? { start: thirtyDaysAgo, end: now };

    await Promise.allSettled(
      platforms.map(async (p) => {
        try {
          const ps = await this.fetchPlatformStats(p, defaultPeriod);
          platformStats.set(p, ps);
        } catch {
          platformStats.set(p, {
            platform: p,
            accountCount: 0,
            totalVideos: 0,
            totalPlays: 0,
            totalLikes: 0,
            activeAccounts: 0,
          });
        }
      }),
    );

    const overview: OverviewStats = {
      totalAccounts: accountsRow.cnt,
      totalVideos: videosRow.cnt,
      totalPublishes: publishesRow.cnt,
      totalPlays: playsRow.total,
      totalLikes: likesRow.total,
      platformStats,
    };

    this.overviewCache = {
      data: overview,
      expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    };

    this.eventBus.emit(StatsEvent.OVERVIEW_REFRESHED, overview);
    return overview;
  }

  async getTrendData(metric: string, period: TimePeriod): Promise<TrendData[]> {
    const db = this.requireDatabase();

    const rows = db.prepare(
      `SELECT
        DATE(fetch_time) as date,
        SUM(${this.sanitizeMetricColumn(metric)}) as value
       FROM video_stats
       WHERE fetch_time >= ? AND fetch_time <= ?
       GROUP BY DATE(fetch_time)
       ORDER BY date ASC`,
    ).all(period.start.toISOString(), period.end.toISOString()) as Array<{
      date: string;
      value: number;
    }>;

    return rows.map((r) => ({
      date: new Date(r.date),
      value: r.value ?? 0,
    }));
  }

  // ─── 配置 ──────────────────────────────────────────────

  setRefreshConfig(config: Partial<StatsRefreshConfig>): void {
    Object.assign(this.refreshConfig, config);

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.refreshConfig.enabled) {
      this.startPeriodicRefresh();
    }
  }

  clearCache(target?: 'video' | 'account' | 'platform' | 'overview'): void {
    switch (target) {
      case 'video':
        this.videoStatsCache.clear();
        break;
      case 'account':
        this.accountStatsCache.clear();
        break;
      case 'platform':
        this.platformStatsCache.clear();
        break;
      case 'overview':
        this.overviewCache = null;
        break;
      default:
        this.videoStatsCache.clear();
        this.accountStatsCache.clear();
        this.platformStatsCache.clear();
        this.overviewCache = null;
    }
  }

  // ─── 内部方法 ──────────────────────────────────────────

  private startPeriodicRefresh(): void {
    if (this.refreshTimer) return;

    this.refreshTimer = setInterval(async () => {
      if (!this.refreshConfig.enabled) return;

      try {
        this.eventBus.emit(StatsEvent.SCHEDULED_REFRESH, { timestamp: Date.now() });
        this.clearCache();
        await this.getOverviewStats();
        logger.info('定时统计刷新完成');
      } catch (err) {
        logger.error('定时统计刷新失败', err);
      }
    }, this.refreshConfig.intervalMs);
  }

  private getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
  }

  private async acquireRateLimit(platform: string): Promise<void> {
    const key = RATE_LIMIT_KEY_PREFIX + platform;
    const acquired = await this.rateLimiter.acquire(key);
    if (!acquired) {
      const waitMs = this.rateLimiter.getWaitTime(key);
      if (waitMs > 0) {
        logger.info(`等待限速: platform=${platform}, waitMs=${waitMs}`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  private requireAdapter(platform: string) {
    const adapter = PlatformRegistry.getAdapter(platform);
    if (!adapter) {
      throw new Error(
        `不支持的平台: ${platform}，可用平台: ${PlatformRegistry.getSupportedPlatforms().join(', ')}`,
      );
    }
    return adapter;
  }

  private requireDatabase(): any {
    if (!isDatabaseAvailable()) {
      throw new Error('数据库不可用');
    }
    return getDatabase();
  }

  private resolveAccountPlatform(accountId: string): string {
    const db = this.requireDatabase();
    const row = db.prepare('SELECT platform FROM accounts WHERE id = ?').get(accountId) as
      | { platform: string }
      | undefined;
    if (!row) throw new Error(`账号不存在: ${accountId}`);
    return row.platform;
  }

  private persistVideoStat(stats: VideoStats): void {
    try {
      const db = this.requireDatabase();
      const id = generateId();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO video_stats (id, platform, platform_video_id, play_count, like_count, comment_count, share_count, collect_count, fetch_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        stats.platform,
        stats.videoId,
        stats.playCount,
        stats.likeCount,
        stats.commentCount,
        stats.shareCount,
        stats.collectCount,
        stats.fetchedAt.toISOString(),
        now,
      );
    } catch (err) {
      logger.warn(`统计持久化失败: videoId=${stats.videoId}`, err);
    }
  }

  private sanitizeMetricColumn(metric: string): string {
    const allowed = new Set(['play_count', 'like_count', 'comment_count', 'share_count', 'collect_count']);
    if (allowed.has(metric)) return metric;
    return 'play_count';
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private convertToPlatformPeriod(period: TimePeriod): import('../platform/base/types').TimePeriod {
    const diffDays = Math.floor(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 7) return '7d';
    if (diffDays <= 30) return '30d';
    return 'all';
  }
}

export const statsService = StatsService.getInstance();
