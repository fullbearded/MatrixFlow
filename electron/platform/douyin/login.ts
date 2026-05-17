import path from 'path';
import fs from 'fs';
import type { BrowserContext, Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { DOUYIN_URLS } from './selectors';
import { getCookiePath, cookieExists } from './cookie';
import type { CookieResult } from '../base/types';

const logger = new Logger('DouyinLogin');

const CHROME_ARGS = [
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--no-sandbox',
];

function getUserDataDir(accountId: string): string {
  const baseDir = path.join(process.cwd(), 'data', 'user_data', 'douyin');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, accountId);
}

export async function validateExistingCookie(cookiePath: string): Promise<boolean> {
  if (!fs.existsSync(cookiePath)) {
    return false;
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: CHROME_ARGS,
  });

  try {
    const context = await browser.newContext({ storageState: cookiePath });
    const page = await context.newPage();

    await page.goto(DOUYIN_URLS.upload, { timeout: 10000 });

    try {
      await page.waitForURL(DOUYIN_URLS.upload, { timeout: 5000 });
    } catch {
      return false;
    }

    const phoneLoginVisible = await page.getByText('手机号登录').isVisible().catch(() => false);
    const scanLoginVisible = await page.getByText('扫码登录').isVisible().catch(() => false);

    if (phoneLoginVisible || scanLoginVisible) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Cookie 验证失败:', error);
    return false;
  } finally {
    await browser.close();
  }
}

async function extractQrCodeSrc(page: Page): Promise<string> {
  const scanLoginTab = page.getByText('扫码登录', { exact: true }).first();
  await scanLoginTab.waitFor({ timeout: 30000 });

  let qrcodeImg = scanLoginTab
    .locator('..')
    .locator('xpath=following-sibling::div[1]')
    .locator('img[aria-label="二维码"]')
    .first();

  if (!(await qrcodeImg.count())) {
    qrcodeImg = page.getByRole('img', { name: '二维码' }).first();
  }

  await qrcodeImg.waitFor({ state: 'visible', timeout: 30000 });
  const src = await qrcodeImg.getAttribute('src');

  if (!src) {
    throw new Error('未获取到抖音登录二维码地址');
  }

  return src;
}

async function saveQrCodeImage(src: string, accountId: string): Promise<string> {
  const { app } = await import('electron');
  const userDataPath = app.getPath('userData');
  const qrDir = path.join(userDataPath, 'qrcodes', 'douyin');

  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  const qrPath = path.join(qrDir, `${accountId}-${Date.now()}.png`);

  if (src.startsWith('data:image')) {
    const base64Data = src.split(',')[1];
    fs.writeFileSync(qrPath, Buffer.from(base64Data, 'base64'));
  } else {
    throw new Error('二维码 src 不是 base64 格式，暂不支持');
  }

  logger.info(`二维码已保存: ${qrPath}`);
  return qrPath;
}

async function isLoginCompleted(page: Page): Promise<boolean> {
  if (!page.url().startsWith(DOUYIN_URLS.creatorHome)) {
    return false;
  }

  const loginMarkers = [
    page.getByText('扫码登录', { exact: true }).first(),
    page.getByText('手机号登录', { exact: true }).first(),
    page.getByText('二维码失效', { exact: true }).first(),
    page.getByRole('img', { name: '二维码' }).first(),
  ];

  for (const marker of loginMarkers) {
    if (!(await marker.count())) {
      continue;
    }
    try {
      if (await marker.isVisible()) {
        return false;
      }
    } catch {
      continue;
    }
  }

  return true;
}

async function waitForLogin(
  page: Page,
  accountId: string,
  onQRRefresh?: (path: string) => void,
  pollIntervalMs: number = 3000,
  maxChecks: number = 100
): Promise<boolean> {
  for (let i = 0; i < maxChecks; i++) {
    if (await isLoginCompleted(page)) {
      logger.info(`扫码成功，已跳转到: ${page.url()}`);
      return true;
    }

    const expiredBox = page.getByText('二维码失效', { exact: true }).locator('..').first();
    if ((await expiredBox.count()) && (await expiredBox.isVisible())) {
      logger.info('二维码已过期，正在刷新...');
      await expiredBox.click();
      await page.waitForTimeout(1000);
      const src = await extractQrCodeSrc(page);
      const qrPath = await saveQrCodeImage(src, accountId);
      onQRRefresh?.(qrPath);
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  return false;
}

export async function qrCodeLogin(
  accountId: string,
  headless: boolean = false,
  onQRReady?: (path: string) => void,
  onQRRefresh?: (path: string) => void
): Promise<CookieResult> {
  const cookiePath = getCookiePath(accountId);

  if (cookieExists(cookiePath)) {
    logger.info('检查现有 cookie...');
    const valid = await validateExistingCookie(cookiePath);
    if (valid) {
      logger.info('Cookie 有效，无需重新登录');
      return {
        success: true,
        cookiePath,
        message: 'Cookie 有效',
      };
    }
    logger.info('Cookie 已失效，准备扫码登录');
  }

  const context = await chromium.launchPersistentContext(getUserDataDir(accountId), {
    channel: 'chrome',
    headless,
    args: CHROME_ARGS,
    viewport: null,
  });

  try {
    const page = await context.newPage();

    logger.info('打开抖音创作者中心...');
    await page.goto(DOUYIN_URLS.loginPage);

    const qrSrc = await extractQrCodeSrc(page);
    const qrPath = await saveQrCodeImage(qrSrc, accountId);

    logger.info('请使用抖音 APP 扫描二维码登录');
    logger.info(`二维码文件: ${qrPath}`);
    onQRReady?.(qrPath);

    const loginSuccess = await waitForLogin(page, accountId, onQRRefresh);

    if (!loginSuccess) {
      return {
        success: false,
        cookiePath,
        message: '等待扫码超时',
      };
    }

    await page.waitForTimeout(2000);
    logger.info(`登录成功，Cookie 已自动保存到: ${getUserDataDir(accountId)}`);

    return {
      success: true,
      cookiePath: getCookiePath(accountId),
      message: '扫码登录成功',
    };
  } catch (error) {
    return {
      success: false,
      cookiePath: getCookiePath(accountId),
      message: `登录过程出错: ${error}`,
    };
  } finally {
    await context.close();
  }
}

export async function getQRCode(accountId: string): Promise<string> {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: CHROME_ARGS,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(DOUYIN_URLS.loginPage);
    const src = await extractQrCodeSrc(page);
    const qrPath = await saveQrCodeImage(src, accountId);

    await context.close();
    await browser.close();

    return qrPath;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function checkCookie(accountId: string): Promise<boolean> {
  const cookiePath = getCookiePath(accountId);
  return validateExistingCookie(cookiePath);
}
