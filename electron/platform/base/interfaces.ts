import type { Page } from 'patchright';
import type {
  PlatformConfig,
  PlatformCapabilities,
  CookieResult,
  UploadContext,
  UploadResult,
  PublishContext,
  PublishResult,
  ScheduleContext,
  ScheduleResult,
  StatsData,
  VideoStatsData,
  TimePeriod,
  CommentContext,
  CommentResult,
  PageChangeReport,
} from './types';

export type {
  PlatformConfig,
  PlatformCapabilities,
  CookieResult,
  UploadContext,
  UploadResult,
  PublishContext,
  PublishResult,
  ScheduleContext,
  ScheduleResult,
  StatsData,
  VideoStatsData,
  TimePeriod,
  CommentContext,
  CommentResult,
  PageChangeReport,
};

export interface IPlatformInfo {
  readonly platformId: string;
  readonly config: PlatformConfig;
  readonly capabilities: PlatformCapabilities;
  getPublishPageUrl(): string;
  getCreatorCenterUrl(): string;
  detectPageChanges(page: Page): Promise<PageChangeReport>;
}

export interface ILoginAdapter {
  login(accountId: string, headless?: boolean): Promise<CookieResult>;
  checkCookie(accountId: string): Promise<boolean>;
  getQRCode(accountId: string): Promise<string>;
}

export interface IUploadAdapter {
  uploadVideo(ctx: UploadContext): Promise<UploadResult>;
}

export interface IPublishAdapter {
  publish(ctx: PublishContext): Promise<PublishResult>;
  schedule?(ctx: ScheduleContext): Promise<ScheduleResult>;
}

export interface IStatsAdapter {
  fetchStats(accountId: string, period: TimePeriod): Promise<StatsData>;
  fetchVideoStats(videoId: string): Promise<VideoStatsData>;
}

export interface ICommentAdapter {
  postComment(ctx: CommentContext): Promise<CommentResult>;
}

export type PlatformAdapter = IPlatformInfo &
  ILoginAdapter &
  IUploadAdapter &
  IPublishAdapter &
  IStatsAdapter;
