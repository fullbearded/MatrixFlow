import type { PlatformAdapter, PlatformConfig, PlatformCapabilities } from '../base/interfaces';
import type { Page } from 'patchright';
import { KUAISHOU_URLS } from './selectors';
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

const KUAISHOU_CONFIG: PlatformConfig = {
  platformId: 'kuaishou',
  platformName: '快手',
  domain: 'kuaishou.com',
  rateLimit: {
    hourly: 6,
    daily: 25,
    burst: 2,
  },
  urls: {
    creator: KUAISHOU_URLS.creatorHome,
    upload: KUAISHOU_URLS.upload,
    publish: KUAISHOU_URLS.upload,
    login: KUAISHOU_URLS.loginPage,
  },
  selectors: {
    login: {
      qrCode: '.qr-code img',
      scanTab: 'text=扫码登录',
    },
    upload: {
      fileInput: 'input[type="file"]',
      titleInput: 'input[placeholder*="标题"]',
      publishBtn: 'button:has-text("发布")',
    },
  },
};

const KUAISHOU_CAPABILITIES: PlatformCapabilities = {
  serverScheduledPublish: true,
  maxScheduleDays: 7,
  comment: true,
  image: true,
};

class KuaishouAdapter implements PlatformAdapter {
  readonly platformId = 'kuaishou';
  readonly config = KUAISHOU_CONFIG;
  readonly capabilities = KUAISHOU_CAPABILITIES;

  getPublishPageUrl(): string {
    return KUAISHOU_URLS.upload;
  }

  getCreatorCenterUrl(): string {
    return KUAISHOU_URLS.creatorHome;
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

export const kuaishouAdapter = new KuaishouAdapter();
