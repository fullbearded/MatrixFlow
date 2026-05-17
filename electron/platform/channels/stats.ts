import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { CHANNELS_URLS, STATS_SELECTORS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';
import type { StatsData, VideoStatsData, TimePeriod } from '../base/types';

const logger = new Logger('ChannelsStats');

const CHROME_ARGS = [
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--no-sandbox',
];

/**
 * 视频号数据抓取
 * 竞品模式：导航到数据中心 → 提取概览数据
 */
export async function fetchStats(accountId: string, period: TimePeriod): Promise<StatsData> {
  const cookiePath = getCookiePath(accountId);
  if (!cookieExists(cookiePath)) {
    return {
      playCount: 0,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      collectCount: 0,
      fetchTime: new Date(),
      error: 'Cookie 文件不存在',
    };
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: CHROME_ARGS,
  });
  const context = await browser.newContext({ storageState: cookiePath });

  try {
    const page = await context.newPage();
    logger.info('导航到视频号数据中心...');

    await page.goto(CHANNELS_URLS.statsOverview, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const loginPrompt = page.locator('.login-container, [class*="login-box"]');
    if (await loginPrompt.isVisible().catch(() => false)) {
      return {
        playCount: 0,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        collectCount: 0,
        fetchTime: new Date(),
        error: 'Cookie 已失效，需要重新登录',
      };
    }

    const stats = await extractOverviewStats(page, period);

    return {
      ...stats,
      fetchTime: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`数据抓取出错: ${errorMessage}`);
    return {
      playCount: 0,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      collectCount: 0,
      fetchTime: new Date(),
      error: errorMessage,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * 视频号单条视频数据抓取
 * 竞品模式：导航到视频详情页 → 解析数据
 */
export async function fetchVideoStats(videoId: string): Promise<VideoStatsData> {
  return {
    videoId,
    playCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    collectCount: 0,
    fetchTime: new Date(),
    error: '视频数据抓取功能暂未完整实现',
  };
}

/**
 * 提取账号概览数据
 * 竞品模式：从数据中心概览页提取数据
 */
async function extractOverviewStats(page: Page, period: TimePeriod): Promise<Omit<StatsData, 'fetchTime'>> {
  const statCards = await page.locator(STATS_SELECTORS.statCard).all();
  let playCount = 0;
  let likeCount = 0;
  let commentCount = 0;
  let shareCount = 0;
  let collectCount = 0;

  for (const card of statCards) {
    const text = await card.textContent() || '';
    const value = extractNumber(text);

    if (text.includes('播放') || text.includes('浏览')) {
      playCount = value;
    } else if (text.includes('点赞')) {
      likeCount = value;
    } else if (text.includes('评论')) {
      commentCount = value;
    } else if (text.includes('分享')) {
      shareCount = value;
    } else if (text.includes('收藏')) {
      collectCount = value;
    }
  }

  return {
    playCount,
    likeCount,
    commentCount,
    shareCount,
    collectCount,
  };
}

function extractNumber(text: string): number {
  const match = text.match(/[\d.]+[万kw]?/i);
  if (!match) return 0;

  const numStr = match[0].toLowerCase();
  let num = parseFloat(numStr);

  if (numStr.includes('万') || numStr.includes('w')) {
    num *= 10000;
  } else if (numStr.includes('k')) {
    num *= 1000;
  }

  return Math.floor(num);
}
