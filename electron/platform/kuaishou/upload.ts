import fs from 'fs';
import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { KUAISHOU_URLS, UPLOAD_SELECTORS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';
import type { UploadContext, UploadResult } from '../base/types';

const logger = new Logger('KuaishouUpload');

const CHROME_ARGS = [
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--no-sandbox',
];

async function waitForUploadComplete(page: Page, maxWaitMs: number = 180000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const processingVisible = await page
      .getByText('视频上传中')
      .isVisible()
      .catch(() => false);
    const successVisible = await page
      .getByText('上传成功')
      .isVisible()
      .catch(() => false);
    const failedVisible = await page
      .getByText('上传失败')
      .isVisible()
      .catch(() => false);

    if (successVisible) {
      logger.info('视频上传成功');
      return true;
    }

    if (failedVisible) {
      logger.error('视频上传失败');
      return false;
    }

    if (processingVisible) {
      logger.info('视频处理中...');
    }

    await page.waitForTimeout(2000);
  }

  return false;
}

async function fillVideoMetadata(
  page: Page,
  title: string,
  description?: string,
  tags?: string[]
): Promise<void> {
  const titleInput = page.locator(UPLOAD_SELECTORS.titleInput).first();
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });

  await titleInput.click();
  await titleInput.fill(title);
  logger.info(`标题已填写: ${title}`);

  if (description) {
    const descInput = page.locator(UPLOAD_SELECTORS.descEditor).first();
    const hasDesc = await descInput.count();

    if (hasDesc) {
      await descInput.click();
      await descInput.fill(description);
      logger.info('描述已填写');
    } else {
      const fallback = page.locator(UPLOAD_SELECTORS.descEditorFallback).first();
      if (await fallback.count()) {
        await fallback.click();
        await fallback.fill(description);
        logger.info('描述已填写（备用选择器）');
      }
    }
  }

  if (tags && tags.length > 0) {
    const topicInput = page.locator(UPLOAD_SELECTORS.topicInput).first();
    const hasTopicInput = await topicInput.count();

    if (hasTopicInput) {
      for (const tag of tags) {
        await topicInput.click();
        await topicInput.fill(tag);
        await page.waitForTimeout(500);

        const suggestion = page.locator(UPLOAD_SELECTORS.topicSuggestion).first();
        if (await suggestion.count()) {
          await suggestion.click();
        } else {
          await page.keyboard.press('Enter');
        }

        logger.info(`话题已添加: ${tag}`);
      }
    }
  }
}

async function clickPublish(page: Page): Promise<boolean> {
  const publishBtn = page.locator(UPLOAD_SELECTORS.publishButton).first();
  await publishBtn.waitFor({ state: 'visible', timeout: 10000 });

  await publishBtn.click();
  logger.info('已点击发布按钮');

  const successToast = page.getByText('发布成功', { exact: false });
  const failedToast = page.getByText('发布失败', { exact: false });

  try {
    await Promise.race([
      successToast.waitFor({ timeout: 30000 }),
      failedToast.waitFor({ timeout: 30000 }),
    ]);

    const isSuccessful = await successToast.isVisible();
    return isSuccessful;
  } catch {
    logger.warn('未检测到发布结果提示');
    return false;
  }
}

export async function uploadVideo(ctx: UploadContext): Promise<UploadResult> {
  const { videoPath, title, description, tags, accountId } = ctx;

  if (!fs.existsSync(videoPath)) {
    return {
      success: false,
      message: `视频文件不存在: ${videoPath}`,
    };
  }

  const cookiePath = getCookiePath(accountId);
  if (!cookieExists(cookiePath)) {
    return {
      success: false,
      message: `Cookie 文件不存在: ${cookiePath}`,
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

    logger.info('导航到快手上传页...');
    await page.goto(KUAISHOU_URLS.upload);

    const loginButtonVisible = await page
      .getByText('扫码登录')
      .isVisible()
      .catch(() => false);
    if (loginButtonVisible) {
      return {
        success: false,
        message: 'Cookie 已失效，需要重新登录',
      };
    }

    const fileInput = page.locator(UPLOAD_SELECTORS.videoFileInput).first();
    await fileInput.setInputFiles(videoPath);
    logger.info(`视频文件已选择: ${videoPath}`);

    const uploadSuccess = await waitForUploadComplete(page);
    if (!uploadSuccess) {
      return {
        success: false,
        message: '视频上传超时或失败',
      };
    }

    await fillVideoMetadata(page, title, description, tags);

    const publishSuccess = await clickPublish(page);

    if (publishSuccess) {
      await page.waitForTimeout(3000);
      const currentUrl = page.url();

      return {
        success: true,
        message: '视频发布成功',
        videoId: extractVideoId(currentUrl),
      };
    } else {
      return {
        success: false,
        message: '视频发布失败',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `上传过程出错: ${error}`,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function extractVideoId(url: string): string | undefined {
  const match = url.match(/photoId=([^&]+)/) || url.match(/\/video\/([^?/]+)/);
  return match ? match[1] : undefined;
}
