import type { Page } from 'patchright';
import { Logger } from '../../core/Logger';
import { UPLOAD_SELECTORS } from './selectors';
import type { PublishContext, PublishResult } from '../base/types';

const logger = new Logger('XiaohongshuPublish');

/**
 * 填写小红书视频元数据
 * 竞品模式：标题 + 正文 + 话题标签
 */
export async function fillVideoMetadata(
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
    const descEditor = page.locator(UPLOAD_SELECTORS.descEditor).first();
    if (await descEditor.isVisible().catch(() => false)) {
      await descEditor.click();
      await descEditor.fill(description);
      logger.info('正文已填写');
    }
  }

  if (tags && tags.length > 0) {
    const topicInput = page.locator(UPLOAD_SELECTORS.topicInput).first();
    if (await topicInput.isVisible().catch(() => false)) {
      for (const tag of tags) {
        await topicInput.click();
        await topicInput.fill(`#${tag}`);
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        logger.info(`话题已添加: ${tag}`);
      }
    }
  }
}

/**
 * 处理小红书封面设置
 * 竞品模式：检测封面提示 → 选择推荐封面或上传封面 → 确认
 */
async function handleCoverPrompt(page: Page): Promise<boolean> {
  const coverBtn = page.locator(UPLOAD_SELECTORS.coverSelectBtn).first();
  if (!(await coverBtn.isVisible().catch(() => false))) {
    return false;
  }

  logger.info('检测到封面设置选项');
  await coverBtn.click();
  await page.waitForTimeout(1000);

  const autoCover = page.locator(UPLOAD_SELECTORS.coverAutoSelect).first();
  if (await autoCover.isVisible().catch(() => false)) {
    await autoCover.click();
    await page.waitForTimeout(500);

    const confirmBtn = page.locator(UPLOAD_SELECTORS.coverConfirmBtn).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      logger.info('封面已设置');
      return true;
    }
  }

  return false;
}

/**
 * 执行小红书发布操作
 * 竞品模式：点击发布 → 检测成功提示 → 处理可能的封面提示
 */
async function executePublish(page: Page, maxRetries: number = 3): Promise<boolean> {
  for (let retry = 0; retry < maxRetries; retry++) {
    const publishBtn = page.locator(UPLOAD_SELECTORS.publishButton).first();
    await publishBtn.waitFor({ state: 'visible', timeout: 10000 });
    await publishBtn.click();
    logger.info(`发布按钮已点击（第 ${retry + 1} 次）`);

    await page.waitForTimeout(2000);

    const successToast = page.locator(UPLOAD_SELECTORS.publishSuccessToast);
    if (await successToast.isVisible().catch(() => false)) {
      logger.info('发布成功：检测到成功提示');
      return true;
    }

    const currentUrl = page.url();
    if (currentUrl.includes('/content/manage')) {
      logger.info('发布成功：已跳转到管理页');
      return true;
    }

    if (await handleCoverPrompt(page)) {
      continue;
    }

    const failedToast = page.locator(UPLOAD_SELECTORS.publishFailedToast);
    if (await failedToast.isVisible().catch(() => false)) {
      logger.warn('发布失败，正在重试...');
      await page.waitForTimeout(1000);
      continue;
    }
  }

  return false;
}

/**
 * 小红书发布操作
 * 适用场景：视频已上传，需要填写元数据并发布
 */
export async function publish(ctx: PublishContext): Promise<PublishResult> {
  const { page: existingPage, title, description, tags } = ctx;

  if (!existingPage) {
    return { success: false, message: '发布需要 page 参数' };
  }

  try {
    const page = existingPage;
    await fillVideoMetadata(page, title, description, tags);

    const success = await executePublish(page);

    if (success) {
      const currentUrl = page.url();
      const videoId = extractVideoId(currentUrl);

      return {
        success: true,
        message: '视频发布成功',
        videoId,
      };
    } else {
      return {
        success: false,
        message: '视频发布失败，请检查是否有未填写的必填项',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`发布过程出错: ${errorMessage}`);
    return {
      success: false,
      message: `发布过程出错: ${errorMessage}`,
    };
  }
}

function extractVideoId(url: string): string | undefined {
  const match = url.match(/\/content\/manage\/detail\/([a-zA-Z0-9]+)/);
  return match ? match[1] : undefined;
}
