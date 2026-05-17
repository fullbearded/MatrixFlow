import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { UPLOAD_SELECTORS, DOUYIN_URLS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';
import type { PublishContext, PublishResult } from '../base/types';

const logger = new Logger('DouyinPublish');

const CHROME_ARGS = [
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--no-sandbox',
];

export async function fillVideoMetadata(
  page: Page,
  title: string,
  description?: string,
  tags?: string[]
): Promise<void> {
  const titleInput = page.getByPlaceholder('填写作品标题，为作品获得更多流量');
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  await titleInput.click();
  await titleInput.fill(title);
  logger.info(`标题已填写: ${title}`);

  if (description) {
    const descInput = page.locator(UPLOAD_SELECTORS.descriptionEditor);
    const hasDesc = await descInput.count();
    if (hasDesc) {
      await descInput.click();
      await descInput.fill(description);
      logger.info('描述已填写');
    }
  }

  if (tags && tags.length > 0) {
    const tagInput = page.locator(UPLOAD_SELECTORS.addTagDropdown);
    const hasTagInput = await tagInput.count();
    if (hasTagInput) {
      for (const tag of tags) {
        await tagInput.click();
        await tagInput.fill(tag);
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        logger.info(`标签已添加: ${tag}`);
      }
    }
  }
}

async function handleCoverPrompt(page: Page): Promise<boolean> {
  const coverPrompt = page.getByText('请设置封面后再发布', { exact: false });
  const isVisible = await coverPrompt.isVisible().catch(() => false);

  if (!isVisible) {
    return false;
  }

  logger.info('检测到封面提示，自动选择推荐封面');

  const recommendCover = page.locator("[class^='recommendCover-']").first();
  if (await recommendCover.isVisible().catch(() => false)) {
    await recommendCover.click();
    await page.waitForTimeout(500);

    const confirmBtn = page.getByRole('button', { name: '确定' });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      logger.info('封面已设置');
      return true;
    }
  }

  return false;
}

async function executePublish(page: Page, maxRetries: number = 3): Promise<boolean> {
  for (let retry = 0; retry < maxRetries; retry++) {
    const publishBtn = page.getByRole('button', { name: '发布', exact: true });
    await publishBtn.waitFor({ state: 'visible', timeout: 10000 });
    await publishBtn.click();
    logger.info(`发布按钮已点击（第 ${retry + 1} 次）`);

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('content/manage')) {
      logger.info('发布成功：已跳转到管理页');
      return true;
    }

    const successText = page.locator('text=/发布成功|提交成功/');
    if (await successText.isVisible().catch(() => false)) {
      logger.info('发布成功：检测到成功文本');
      return true;
    }

    if (await handleCoverPrompt(page)) {
      continue;
    }

    const failedText = page.getByText('发布失败', { exact: false });
    if (await failedText.isVisible().catch(() => false)) {
      logger.warn('发布失败，正在重试...');
      await page.waitForTimeout(1000);
      continue;
    }
  }

  return false;
}

/**
 * 抖音发布操作
 * 支持：传入 page 直接操作，或不传 page 自动创建浏览器
 */
export async function publish(ctx: PublishContext): Promise<PublishResult> {
  const { page: existingPage, accountId, title, description, tags, scheduledTime } = ctx;

  if (existingPage) {
    return executePublishOnPage(existingPage, title, description, tags, scheduledTime);
  }

  if (!accountId) {
    return { success: false, message: '缺少 accountId，无法自动创建浏览器' };
  }

  const cookiePath = getCookiePath(accountId);
  if (!cookieExists(cookiePath)) {
    return { success: false, message: `Cookie 文件不存在: ${cookiePath}` };
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: CHROME_ARGS });
  const context = await browser.newContext({ storageState: cookiePath });

  try {
    const page = await context.newPage();
    await page.goto(DOUYIN_URLS.upload, { waitUntil: 'domcontentloaded' });
    return await executePublishOnPage(page, title, description, tags, scheduledTime);
  } catch (error) {
    return { success: false, message: `发布出错: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function executePublishOnPage(
  page: Page,
  title: string,
  description?: string,
  tags?: string[],
  scheduledTime?: Date
): Promise<PublishResult> {
  try {
    await fillVideoMetadata(page, title, description, tags);

    if (scheduledTime) {
      logger.warn('抖音定时发布请使用 schedule 方法');
    }

    const success = await executePublish(page);

    if (success) {
      const currentUrl = page.url();
      const videoId = extractVideoId(currentUrl);
      return { success: true, message: '视频发布成功', videoId };
    } else {
      return { success: false, message: '视频发布失败，请检查是否有未填写的必填项' };
    }
  } catch (error) {
    return { success: false, message: `发布出错: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function extractVideoId(url: string): string | undefined {
  const match = url.match(/\/content\/manage\?.*item_ids=([^&]+)/);
  return match ? match[1] : undefined;
}
