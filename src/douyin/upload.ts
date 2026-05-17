// ============================================================
// 抖音视频上传
// 移植自 social-auto-upload/uploader/douyin_uploader/main.py
// ============================================================

import path from 'path';
import fs from 'fs';
import type { BrowserContext, Page } from 'patchright';
import { chromium } from 'patchright';
import { DOUYIN_URLS, UPLOAD_SELECTORS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';

export interface UploadOptions {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  accountId: string;
}

export interface UploadResult {
  success: boolean;
  status: 'cookie_invalid' | 'uploading' | 'processing' | 'success' | 'failed';
  message: string;
  publishUrl?: string;
}

async function waitForUploadComplete(page: Page, maxWaitMs: number = 120000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const processingVisible = await page.getByText('视频上传中').isVisible().catch(() => false);
    const successVisible = await page.getByText('上传成功').isVisible().catch(() => false);
    const failedVisible = await page.getByText('上传失败').isVisible().catch(() => false);
    
    if (successVisible) {
      console.log('[upload] 视频上传成功');
      return true;
    }
    
    if (failedVisible) {
      console.log('[upload] 视频上传失败');
      return false;
    }
    
    if (processingVisible) {
      console.log('[upload] 视频处理中...');
    }
    
    await page.waitForTimeout(2000);
  }
  
  return false;
}

async function fillVideoMetadata(page: Page, title: string, description?: string, tags?: string[]): Promise<void> {
  const titleInput = page.getByPlaceholder('填写作品标题，为作品获得更多流量');
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  
  await titleInput.click();
  await titleInput.fill(title);
  console.log(`[upload] 标题已填写: ${title}`);
  
  if (description) {
    const descInput = page.locator(UPLOAD_SELECTORS.descriptionEditor);
    const hasDesc = await descInput.count();
    
    if (hasDesc) {
      await descInput.click();
      await descInput.fill(description);
      console.log(`[upload] 描述已填写`);
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
        console.log(`[upload] 标签已添加: ${tag}`);
      }
    }
  }
}

async function clickPublish(page: Page): Promise<boolean> {
  const publishBtn = page.getByRole('button', { name: '发布', exact: true });
  await publishBtn.waitFor({ state: 'visible', timeout: 10000 });
  
  await publishBtn.click();
  console.log('[upload] 已点击发布按钮');
  
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
    console.log('[upload] 未检测到发布结果提示');
    return false;
  }
}

export async function uploadVideo(options: UploadOptions): Promise<UploadResult> {
  const { videoPath, title, description, tags, accountId } = options;
  
  if (!fs.existsSync(videoPath)) {
    return {
      success: false,
      status: 'failed',
      message: `视频文件不存在: ${videoPath}`,
    };
  }
  
  const cookiePath = getCookiePath(accountId);
  if (!cookieExists(cookiePath)) {
    return {
      success: false,
      status: 'cookie_invalid',
      message: `Cookie 文件不存在: ${cookiePath}`,
    };
  }
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
    ],
  });
  const context = await browser.newContext({ storageState: cookiePath });
  
  try {
    const page = await context.newPage();
    
    console.log('[upload] 导航到抖音上传页...');
    await page.goto(DOUYIN_URLS.upload);
    
    const loginButtonVisible = await page.getByText('扫码登录').isVisible().catch(() => false);
    if (loginButtonVisible) {
      return {
        success: false,
        status: 'cookie_invalid',
        message: 'Cookie 已失效，需要重新登录',
      };
    }
    
    const fileInput = page.locator(UPLOAD_SELECTORS.videoFileInput);
    await fileInput.setInputFiles(videoPath);
    console.log(`[upload] 视频文件已选择: ${videoPath}`);
    
    const uploadSuccess = await waitForUploadComplete(page);
    if (!uploadSuccess) {
      return {
        success: false,
        status: 'failed',
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
        status: 'success',
        message: '视频发布成功',
        publishUrl: currentUrl,
      };
    } else {
      return {
        success: false,
        status: 'failed',
        message: '视频发布失败',
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      message: `上传过程出错: ${error}`,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
