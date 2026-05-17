import fs from 'fs';
import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { XHS_URLS, UPLOAD_SELECTORS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';
import type { UploadContext, UploadResult } from '../base/types';

const logger = new Logger('XhsUpload');

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
    const successVisible = await page
      .getByText('上传成功', { exact: false })
      .isVisible()
      .catch(() => false);
    const failedVisible = await page
      .getByText('上传失败', { exact: false })
      .isVisible()
      .catch(() => false);
    const processingVisible = await page
      .getByText('处理中', { exact: false })
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

  logger.error('视频上传超时');
  return false;
}

async function fillTitle(page: Page, title: string): Promise<boolean> {
  const titleInput = page.locator(UPLOAD_SELECTORS.titleInput).first();
  let hasTitle = await titleInput.count();

  if (!hasTitle) {
    const fallback = page.locator(UPLOAD_SELECTORS.titleInputFallback).first();
    hasTitle = await fallback.count();
    if (hasTitle) {
      await fallback.click();
      await fallback.fill(title);
      logger.info(`标题已填写（fallback）: ${title}`);
      return true;
    }
    return false;
  }

  await titleInput.click();
  await titleInput.fill(title);
  logger.info(`标题已填写: ${title}`);
  return true;
}

async function fillDescription(page: Page, description?: string): Promise<void> {
  if (!description) return;

  const descEditor = page.locator(UPLOAD_SELECTORS.descEditor).first();
  let hasDesc = await descEditor.count();

  if (!hasDesc) {
    const fallback = page.locator(UPLOAD_SELECTORS.descEditorFallback).first();
    hasDesc = await fallback.count();
    if (!hasDesc) {
      logger.warn('未找到描述输入框');
      return;
    }
    await fallback.click();
    await fallback.fill(description);
    logger.info('描述已填写（fallback）');
    return;
  }

  await descEditor.click();
  await descEditor.fill(description);
  logger.info('描述已填写');
}

async function addTopics(page: Page, tags?: string[]): Promise<void> {
  if (!tags || tags.length === 0) return;

  const topicInput = page.locator(UPLOAD_SELECTORS.topicInput).first();
  const hasInput = await topicInput.count();

  if (!hasInput) {
    logger.warn('未找到话题输入框');
    return;
  }

  for (const tag of tags) {
    await topicInput.click();
    await topicInput.fill(`#${tag}`);
    await page.waitForTimeout(800);

    const suggestion = page.locator(UPLOAD_SELECTORS.topicSuggestion).first();
    if ((await suggestion.count()) && (await suggestion.isVisible().catch(() => false))) {
      await suggestion.click();
      logger.info(`话题已选择: ${tag}`);
    } else {
      await page.keyboard.press('Enter');
      logger.info(`话题已输入: ${tag}`);
    }

    await page.waitForTimeout(500);
  }
}

async function addMentions(page: Page, mentions?: string[]): Promise<void> {
  if (!mentions || mentions.length === 0) return;

  const mentionInput = page.locator(UPLOAD_SELECTORS.mentionInput).first();
  const hasInput = await mentionInput.count();

  if (!hasInput) {
    logger.warn('未找到@提及输入框');
    return;
  }

  for (const mention of mentions) {
    await mentionInput.click();
    await mentionInput.fill(`@${mention}`);
    await page.waitForTimeout(800);

    const suggestion = page.locator(UPLOAD_SELECTORS.mentionSuggestion).first();
    if ((await suggestion.count()) && (await suggestion.isVisible().catch(() => false))) {
      await suggestion.click();
      logger.info(`@提及已选择: ${mention}`);
    } else {
      await page.keyboard.press('Enter');
      logger.info(`@提及已输入: ${mention}`);
    }

    await page.waitForTimeout(500);
  }
}

async function setCover(page: Page, coverPath?: string): Promise<void> {
  if (!coverPath || !fs.existsSync(coverPath)) return;

  const coverBtn = page.locator(UPLOAD_SELECTORS.coverSelectBtn).first();
  if (!(await coverBtn.count())) {
    logger.warn('未找到封面设置按钮');
    return;
  }

  await coverBtn.click();
  logger.info('已打开封面设置');

  const coverModal = page.locator(UPLOAD_SELECTORS.coverModal).first();
  if ((await coverModal.count())) {
    await coverModal.waitFor({ state: 'visible', timeout: 5000 });
  }

  const coverInput = page.locator(UPLOAD_SELECTORS.coverUploadInput).first();
  if ((await coverInput.count())) {
    await coverInput.setInputFiles(coverPath);
    logger.info(`封面已上传: ${coverPath}`);

    const confirmBtn = page.locator(UPLOAD_SELECTORS.coverConfirmBtn).first();
    if ((await confirmBtn.count())) {
      await confirmBtn.click();
      logger.info('封面已确认');
    }
  }
}

async function clickPublish(page: Page): Promise<boolean> {
  const publishBtn = page.locator(UPLOAD_SELECTORS.publishButton).first();
  if (!(await publishBtn.count())) {
    const primary = page.locator(UPLOAD_SELECTORS.publishButtonPrimary).first();
    if (!(await primary.count())) {
      logger.error('未找到发布按钮');
      return false;
    }
    await primary.click();
  } else {
    await publishBtn.click();
  }

  logger.info('已点击发布按钮');

  try {
    const successToast = page.getByText('发布成功', { exact: false });
    const failedToast = page.getByText('发布失败', { exact: false });

    await Promise.race([
      successToast.waitFor({ timeout: 30000 }),
      failedToast.waitFor({ timeout: 30000 }),
    ]);

    return await successToast.isVisible().catch(() => false);
  } catch {
    logger.warn('未检测到发布结果提示');
    return false;
  }
}

export async function uploadVideo(ctx: UploadContext): Promise<UploadResult> {
  const { videoPath, title, description, tags, accountId, coverPath } = ctx;

  if (!fs.existsSync(videoPath)) {
    return { success: false, message: `视频文件不存在: ${videoPath}` };
  }

  const cookiePath = getCookiePath(accountId);
  if (!cookieExists(cookiePath)) {
    return { success: false, message: `Cookie 文件不存在，请先登录: ${cookiePath}` };
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: CHROME_ARGS,
  });
  const context = await browser.newContext({ storageState: cookiePath });

  try {
    const page = await context.newPage();

    logger.info('导航到小红书发布页...');
    await page.goto(XHS_URLS.publish);

    const loginVisible = await page
      .getByText('扫码登录', { exact: true })
      .isVisible()
      .catch(() => false);
    if (loginVisible) {
      return { success: false, message: 'Cookie 已失效，需要重新登录' };
    }

    const fileInput = page.locator(UPLOAD_SELECTORS.videoFileInput).first();
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    await fileInput.setInputFiles(videoPath);
    logger.info(`视频文件已选择: ${videoPath}`);

    const uploadSuccess = await waitForUploadComplete(page);
    if (!uploadSuccess) {
      return { success: false, message: '视频上传超时或失败' };
    }

    await fillTitle(page, title);
    await fillDescription(page, description);
    await addTopics(page, tags);
    await setCover(page, coverPath);

    const publishSuccess = await clickPublish(page);

    if (publishSuccess) {
      await page.waitForTimeout(3000);
      return { success: true, message: '视频发布成功' };
    } else {
      return { success: false, message: '视频发布失败' };
    }
  } catch (error) {
    return { success: false, message: `上传过程出错: ${error}` };
  } finally {
    await context.close();
    await browser.close();
  }
}
