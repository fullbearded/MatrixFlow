import type { PlatformAdapter, PlatformConfig, PlatformCapabilities } from '../base/interfaces';
import type { Page } from 'patchright';
import { XHS_URLS } from './selectors';
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

const XHS_CONFIG: PlatformConfig = {
  platformId: 'xiaohongshu',
  platformName: '小红书',
  domain: 'xiaohongshu.com',
  rateLimit: {
    hourly: 5,
    daily: 20,
    burst: 2,
  },
  urls: {
    creator: XHS_URLS.creatorHome,
    upload: XHS_URLS.publish,
    publish: XHS_URLS.publish,
    login: XHS_URLS.loginPage,
  },
  selectors: {
    login: {
      qrCode: '.qrcode-img img',
      scanTab: 'text=扫码登录',
    },
    upload: {
      fileInput: 'input[type="file"]',
      titleInput: 'input[placeholder*="标题"]',
      publishBtn: 'button:has-text("发布")',
    },
  },
};

const XHS_CAPABILITIES: PlatformCapabilities = {
  serverScheduledPublish: false,
  maxScheduleDays: 0,
  comment: true,
  image: true,
};

class XiaohongshuAdapter implements PlatformAdapter {
  readonly platformId = 'xiaohongshu';
  readonly config = XHS_CONFIG;
  readonly capabilities = XHS_CAPABILITIES;

  getPublishPageUrl(): string {
    return XHS_URLS.publish;
  }

  getCreatorCenterUrl(): string {
    return XHS_URLS.creatorHome;
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

export const xiaohongshuAdapter = new XiaohongshuAdapter();
