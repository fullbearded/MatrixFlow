import type { Page } from 'patchright';

export interface PlatformCapabilities {
  serverScheduledPublish: boolean;
  maxScheduleDays: number;
  comment: boolean;
  image: boolean;
}

export interface PlatformConfig {
  platformId: string;
  platformName: string;
  domain: string;
  rateLimit: {
    hourly: number;
    daily: number;
    burst: number;
  };
  urls: {
    creator: string;
    upload: string;
    publish: string;
    login?: string;
  };
  selectors: Record<string, Record<string, string>>;
}

export interface CookieResult {
  success: boolean;
  cookiePath: string;
  message: string;
}

export interface UploadContext {
  accountId: string;
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  coverPath?: string;
}

export interface UploadResult {
  success: boolean;
  message: string;
  videoId?: string;
}

export interface PublishContext {
  page?: Page;
  accountId: string;
  videoId?: string;
  title: string;
  description?: string;
  tags?: string[];
  scheduledTime?: Date;
}

export interface PublishResult {
  success: boolean;
  message: string;
  videoId?: string;
  publishUrl?: string;
}

export interface ScheduleContext {
  page?: Page;
  accountId: string;
  videoId?: string;
  title: string;
  description?: string;
  tags?: string[];
  scheduledTime: Date;
}

export interface ScheduleResult {
  success: boolean;
  message: string;
  scheduledTime?: Date;
}

export interface StatsData {
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  fetchTime: Date;
  error?: string;
}

export interface VideoStatsData extends StatsData {
  videoId: string;
}

export type TimePeriod = '7d' | '30d' | 'all';

export interface CommentContext {
  accountId: string;
  videoId: string;
  comment: string;
}

export interface CommentResult {
  success: boolean;
  message: string;
  commentId?: string;
}

export interface PageChangeReport {
  hasChanges: boolean;
  changedSelectors: string[];
  timestamp: Date;
}
