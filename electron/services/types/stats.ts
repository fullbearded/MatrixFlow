/**
 * 数据统计服务类型定义
 *
 * 涵盖视频统计、账号统计、平台统计、趋势数据、事件及服务接口。
 */

// ─── 时间周期 ───────────────────────────────────────────────

export interface TimePeriod {
  start: Date;
  end: Date;
}

// ─── 视频统计 ───────────────────────────────────────────────

export interface VideoStats {
  videoId: string;
  platform: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  fetchedAt: Date;
}

// ─── 账号统计 ───────────────────────────────────────────────

export interface AccountStats {
  accountId: string;
  platform: string;
  totalVideos: number;
  totalPlays: number;
  totalLikes: number;
  totalComments: number;
  avgPlayCount: number;
  period: TimePeriod;
}

// ─── 平台统计 ───────────────────────────────────────────────

export interface PlatformStats {
  platform: string;
  accountCount: number;
  totalVideos: number;
  totalPlays: number;
  totalLikes: number;
  activeAccounts: number;
}

// ─── 总览统计 ───────────────────────────────────────────────

export interface OverviewStats {
  totalAccounts: number;
  totalVideos: number;
  totalPublishes: number;
  totalPlays: number;
  totalLikes: number;
  platformStats: Map<string, PlatformStats>;
}

// ─── 趋势数据 ───────────────────────────────────────────────

export interface TrendData {
  date: Date;
  value: number;
}

// ─── 缓存条目 ───────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  expiresAt: number; // ms timestamp
}

// ─── 定时刷新配置 ───────────────────────────────────────────

export interface StatsRefreshConfig {
  /** 刷新间隔（毫秒），默认 5 分钟 */
  intervalMs: number;
  /** 是否启用，默认 true */
  enabled: boolean;
}

// ─── 事件名 ─────────────────────────────────────────────────

export enum StatsEvent {
  /** 视频统计已更新 */
  VIDEO_STATS_UPDATED = 'stats:video-updated',
  /** 账号统计已更新 */
  ACCOUNT_STATS_UPDATED = 'stats:account-updated',
  /** 平台统计已更新 */
  PLATFORM_STATS_UPDATED = 'stats:platform-updated',
  /** 总览统计已刷新 */
  OVERVIEW_REFRESHED = 'stats:overview-refreshed',
  /** 批量统计开始 */
  BATCH_FETCH_STARTED = 'stats:batch-started',
  /** 批量统计完成 */
  BATCH_FETCH_COMPLETED = 'stats:batch-completed',
  /** 统计获取失败 */
  FETCH_FAILED = 'stats:fetch-failed',
  /** 定时刷新已触发 */
  SCHEDULED_REFRESH = 'stats:scheduled-refresh',
}

// ─── 事件载荷 ───────────────────────────────────────────────

export interface VideoStatsUpdatedPayload {
  videoId: string;
  platform: string;
  stats: VideoStats;
}

export interface AccountStatsUpdatedPayload {
  accountId: string;
  platform: string;
  stats: AccountStats;
}

export interface BatchFetchProgress {
  total: number;
  completed: number;
  failed: number;
}

export interface FetchFailedPayload {
  target: string;
  error: string;
}

// ─── 服务接口 ───────────────────────────────────────────────

export interface IStatsService {
  // 视频统计
  fetchVideoStats(videoId: string, platform: string): Promise<VideoStats>;
  fetchBatchVideoStats(
    videoIds: string[],
    platform: string,
  ): Promise<Map<string, VideoStats>>;

  // 账号统计
  fetchAccountStats(
    accountId: string,
    period: TimePeriod,
  ): Promise<AccountStats>;

  // 平台统计
  fetchPlatformStats(
    platform: string,
    period: TimePeriod,
  ): Promise<PlatformStats>;

  // 聚合统计
  getOverviewStats(): Promise<OverviewStats>;
  getTrendData(metric: string, period: TimePeriod): Promise<TrendData[]>;

  // 生命周期
  initialize(): void;
  dispose(): void;
}
