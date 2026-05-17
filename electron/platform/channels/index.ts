import type { PlatformAdapter, PlatformConfig, PlatformCapabilities } from '../base/interfaces';
import type { Page } from 'patchright';
import { CHANNELS_URLS } from './selectors';
import { qrCodeLogin, checkCookie, getQRCode } from './login';
import { uploadVideo } from './upload';
import { publish } from './publish';
import { schedule } from './schedule';
import { fetchStats, fetchVideoStats } from './stats';
import type {
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
  PageChangeReport,
} from '../base/types';

const CHANNELS_CONFIG: PlatformConfig = {
  platformId: 'channels',
  platformName: '视频号',
  domain: 'channels.weixin.qq.com',
  rateLimit: {
    hourly: 8,
    daily: 30,
    burst: 2,
  },
  urls: {
    creator: CHANNELS_URLS.creatorHome,
    upload: CHANNELS_URLS.upload,
    publish: CHANNELS_URLS.upload,
    login: CHANNELS_URLS.loginPage,
  },
  selectors: {
    login: {
      qrCode: '.login-qr img',
      scanTab: '',
    },
    upload: {
      fileInput: 'input[type="file"]',
      titleInput: 'textarea[placeholder*="描述"]',
      publishBtn: 'button:has-text("发表")',
    },
  },
};

const CHANNELS_CAPABILITIES: PlatformCapabilities = {
  serverScheduledPublish: true,
  maxScheduleDays: 7,
  comment: true,
  image: true,
};

class ChannelsAdapter implements PlatformAdapter {
  readonly platformId = 'channels';
  readonly config = CHANNELS_CONFIG;
  readonly capabilities = CHANNELS_CAPABILITIES;

  getPublishPageUrl(): string {
    return CHANNELS_URLS.upload;
  }

  getCreatorCenterUrl(): string {
    return CHANNELS_URLS.creatorHome;
  }

  async detectPageChanges(page: Page): Promise<PageChangeReport> {
    const changedSelectors: string[] = [];

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      changedSelectors.push('upload.fileInput');
    }

    return {
      hasChanges: changedSelectors.length > 0,
      changedSelectors,
      timestamp: new Date(),
    };
  }

  async login(accountId: string, headless: boolean = false): Promise<CookieResult> {
    return qrCodeLogin(accountId, headless);
  }

  async checkCookie(accountId: string): Promise<boolean> {
    return checkCookie(accountId);
  }

  async getQRCode(accountId: string): Promise<string> {
    return getQRCode(accountId);
  }

  async uploadVideo(ctx: UploadContext): Promise<UploadResult> {
    return uploadVideo(ctx);
  }

  async publish(ctx: PublishContext): Promise<PublishResult> {
    return publish(ctx);
  }

  async schedule?(ctx: ScheduleContext): Promise<ScheduleResult> {
    return schedule(ctx);
  }

  async fetchStats(accountId: string, period: TimePeriod): Promise<StatsData> {
    return fetchStats(accountId, period);
  }

  async fetchVideoStats(videoId: string): Promise<VideoStatsData> {
    return fetchVideoStats(videoId);
  }
}

export const channelsAdapter = new ChannelsAdapter();
