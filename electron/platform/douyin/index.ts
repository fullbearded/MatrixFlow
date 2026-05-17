import type { PlatformAdapter, PlatformConfig, PlatformCapabilities } from '../base/interfaces';
import type { Page } from 'patchright';
import { DOUYIN_URLS } from './selectors';
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

const DOUYIN_CONFIG: PlatformConfig = {
  platformId: 'douyin',
  platformName: '抖音',
  domain: 'douyin.com',
  rateLimit: {
    hourly: 10,
    daily: 50,
    burst: 3,
  },
  urls: {
    creator: DOUYIN_URLS.creatorHome,
    upload: DOUYIN_URLS.upload,
    publish: DOUYIN_URLS.publishV2,
    login: DOUYIN_URLS.loginPage,
  },
  selectors: {
    login: {
      qrCode: 'img[aria-label="二维码"]',
      scanTab: 'text=扫码登录',
    },
    upload: {
      fileInput: "div[class^='container'] input",
      titleInput: 'input[type="text"]',
      publishBtn: 'button:has-text("发布")',
    },
  },
};

const DOUYIN_CAPABILITIES: PlatformCapabilities = {
  serverScheduledPublish: true,
  maxScheduleDays: 30,
  comment: true,
  image: true,
};

class DouyinAdapter implements PlatformAdapter {
  readonly platformId = 'douyin';
  readonly config = DOUYIN_CONFIG;
  readonly capabilities = DOUYIN_CAPABILITIES;

  getPublishPageUrl(): string {
    return DOUYIN_URLS.publishV2;
  }

  getCreatorCenterUrl(): string {
    return DOUYIN_URLS.creatorHome;
  }

  async detectPageChanges(page: Page): Promise<PageChangeReport> {
    const changedSelectors: string[] = [];

    const fileInput = await page.$("div[class^='container'] input");
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

export const douyinAdapter = new DouyinAdapter();
