import fs from 'fs';
import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { CHANNELS_URLS, UPLOAD_SELECTORS, LOGIN_SELECTORS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';
import type { UploadContext, UploadResult } from '../base/types';

const logger = new Logger('ChannelsUpload');

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
    const successVisible = await page.getByText('上传成功').isVisible().catch(() => false);
    const failedVisible = await page.getByText('上传失败').isVisible().catch(() => false);
    const progressVisible = await page.locator(UPLOAD_SELECTORS.uploadProgress).first().isVisible().catch(() => false);

    if (successVisible) {
      logger.info('视频上传成功');
      return true;
    }

    if (failedVisible) {
      logger.error('视频上传失败');

      // 尝试点击重新上传
      const reUploadBtn = page.locator(UPLOAD_SELECTORS.reUploadBtn).first();
      if ((await reUploadBtn.count()) && (await reUploadBtn.isVisible().catch(() => false))) {
        logger.info('尝试重新上传...');
        await reUploadBtn.click();
        continue;
      }

      return false;
    }

    if (progressVisible) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      logger.info(`视频处理中... 已等待 ${elapsed} 秒`);
    }

    await page.waitForTimeout(3000);
  }

  logger.error(`上传等待超时（${maxWaitMs / 1000} 秒）`);
  return false;
}

/**
 * 填写视频描述和标签
 * 视频号与抖音不同：没有独立标题字段，只有描述
 */
async function fillVideoMetadata(
  page: Page,
  description?: string,
  tags?: string[]
): Promise<void> {
  if (description) {
    const descInput = page.locator(UPLOAD_SELECTORS.descInput).first();
    const hasDesc = await descInput.count();

    if (hasDesc) {
      await descInput.click();
      await descInput.fill(description);
      logger.info(`描述已填写: ${description.substring(0, 50)}...`);
    } else {
      // 尝试备用选择器
      const fallbackInput = page.locator(UPLOAD_SELECTORS.descInputFallback).first();
      if ((await fallbackInput.count())) {
        await fallbackInput.click();
        await fallbackInput.fill(description);
        logger.info('描述已填写（使用备用选择器）');
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

        // 选择下拉建议或按回车
        const suggestion = page.locator(UPLOAD_SELECTORS.topicSuggestion).first();
        if ((await suggestion.count()) && (await suggestion.isVisible().catch(() => false))) {
          await suggestion.click();
        } else {
          await page.keyboard.press('Enter');
        }

        logger.info(`标签已添加: ${tag}`);
        await page.waitForTimeout(300);
      }
    }
  }
}

async function clickPublish(page: Page): Promise<boolean> {
  const publishBtn = page.locator(UPLOAD_SELECTORS.publishButton).first();
  if (!(await publishBtn.count())) {
    const primaryBtn = page.locator(UPLOAD_SELECTORS.publishButtonPrimary).first();
    if (!(await primaryBtn.count())) {
      logger.error('未找到发布按钮');
      return false;
    }
    await primaryBtn.click();
  } else {
    await publishBtn.click();
  }

  logger.info('已点击发表按钮');

  const successToast = page.getByText('发布成功').or(page.getByText('发表成功')).first();
  const failedToast = page.getByText('发布失败').or(page.getByText('发表失败')).first();

  try {
    await Promise.race([
      successToast.waitFor({ timeout: 30000 }),
      failedToast.waitFor({ timeout: 30000 }),
    ]);

    const isSuccessful = await successToast.isVisible().catch(() => false);
    return isSuccessful;
  } catch {
    logger.warn('未检测到发布结果提示');
    return false;
  }
}

export async function uploadVideo(ctx: UploadContext): Promise<UploadResult> {
  const { videoPath, title, description, tags, coverPath, accountId } = ctx;

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
      message: `Cookie 文件不存在，请先登录: ${cookiePath}`,
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

    logger.info('导航到视频号发布页...');
    await page.goto(CHANNELS_URLS.upload, { timeout: 30000 });

    // 检查是否被重定向到登录页
    const qrCodeVisible = await page.locator(LOGIN_SELECTORS?.qrCodeImage || '.qrcode img').isVisible().catch(() => false);
    if (qrCodeVisible) {
      return {
        success: false,
        message: 'Cookie 已失效，需要重新登录',
      };
    }

    // 选择视频文件
    const fileInput = page.locator(UPLOAD_SELECTORS.videoFileInput).first();
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    await fileInput.setInputFiles(videoPath);
    logger.info(`视频文件已选择: ${videoPath}`);

    // 等待上传完成
    const uploadSuccess = await waitForUploadComplete(page);
    if (!uploadSuccess) {
      return {
        success: false,
        message: '视频上传超时或失败',
      };
    }

    // 设置封面（如果提供了封面图）
    if (coverPath && fs.existsSync(coverPath)) {
      const coverBtn = page.locator(UPLOAD_SELECTORS.coverSelectBtn).first();
      if ((await coverBtn.count()) && (await coverBtn.isVisible().catch(() => false))) {
        await coverBtn.click();
        await page.waitForTimeout(1000);

        const coverInput = page.locator(UPLOAD_SELECTORS.coverUploadInput).first();
        if ((await coverInput.count())) {
          await coverInput.setInputFiles(coverPath);
          logger.info('封面图已上传');

          const confirmBtn = page.locator(UPLOAD_SELECTORS.coverConfirmBtn).first();
          if ((await confirmBtn.count())) {
            await confirmBtn.click();
          }
        }
      }
    }

    // 填写描述（视频号用 title 作为描述的一部分）
    const fullDescription = description || title;
    await fillVideoMetadata(page, fullDescription, tags);

    // 点击发表
    const publishSuccess = await clickPublish(page);

    if (publishSuccess) {
      await page.waitForTimeout(3000);
      const currentUrl = page.url();

      return {
        success: true,
        message: '视频号视频发布成功',
        videoId: extractVideoId(currentUrl),
      };
    } else {
      return {
        success: false,
        message: '视频号视频发布失败',
      };
    }
  } catch (error) {
    logger.error('上传过程出错:', error);
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
  const match = url.match(/\/platform\/post\/manage.*[?&]id=([^&]+)/)
    || url.match(/finderId=([^&]+)/);
  return match ? match[1] : undefined;
}
