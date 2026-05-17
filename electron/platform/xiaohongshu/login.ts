import path from 'path';
import fs from 'fs';
import type { Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { XHS_URLS, LOGIN_SELECTORS } from './selectors';
import { getCookiePath, saveCookie, cookieExists } from './cookie';
import type { CookieResult } from '../base/types';

const logger = new Logger('XhsLogin');

const CHROME_ARGS = [
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--no-sandbox',
];

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

    await page.goto(XHS_URLS.publish, { timeout: 15000 });

    try {
      await page.waitForURL(/creator\.xiaohongshu\.com/, { timeout: 8000 });
    } catch {
      return false;
    }

    const scanLoginVisible = await page
      .getByText('扫码登录', { exact: true })
      .isVisible()
      .catch(() => false);
    const phoneLoginVisible = await page
      .getByText('手机登录', { exact: true })
      .isVisible()
      .catch(() => false);

    if (scanLoginVisible || phoneLoginVisible) {
      logger.info('Cookie 已失效，页面显示了登录界面');
      return false;
    }

    logger.info('Cookie 验证通过');
    return true;
  } catch (error) {
    logger.error('Cookie 验证失败:', error);
    return false;
  } finally {
    await browser.close();
  }
}

async function extractQrCodeSrc(page: Page): Promise<string> {
  const scanTab = page.getByText('扫码登录', { exact: true }).first();
  await scanTab.waitFor({ timeout: 30000 });

  const qrcodeImg = page.locator(LOGIN_SELECTORS.qrCodeImage).first();
  await qrcodeImg.waitFor({ state: 'visible', timeout: 30000 });
  const src = await qrcodeImg.getAttribute('src');

  if (!src) {
    throw new Error('未获取到小红书登录二维码地址');
  }

  return src;
}

async function saveQrCodeImage(src: string, accountId: string): Promise<string> {
  const { app } = await import('electron');
  const userDataPath = app.getPath('userData');
  const qrDir = path.join(userDataPath, 'qrcodes', 'xiaohongshu');

  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  const qrPath = path.join(qrDir, `${accountId}-${Date.now()}.png`);

  if (src.startsWith('data:image')) {
    const base64Data = src.split(',')[1];
    fs.writeFileSync(qrPath, Buffer.from(base64Data, 'base64'));
  } else if (src.startsWith('http')) {
    const response = await fetch(src);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(qrPath, buffer);
  } else {
    throw new Error(`二维码 src 格式不支持: ${src.substring(0, 50)}`);
  }

  logger.info(`二维码已保存: ${qrPath}`);
  return qrPath;
}

async function isLoginCompleted(page: Page): Promise<boolean> {
  if (!page.url().includes('creator.xiaohongshu.com')) {
    return false;
  }

  if (page.url().includes('/publish/publish') || page.url().includes('/content/manage')) {
    return true;
  }

  const loginMarkers = [
    page.getByText('扫码登录', { exact: true }).first(),
    page.getByText('手机登录', { exact: true }).first(),
  ];

  for (const marker of loginMarkers) {
    if (!(await marker.count())) continue;
    try {
      if (await marker.isVisible()) return false;
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
      logger.info(`扫码成功，当前页面: ${page.url()}`);
      return true;
    }

    const expiredText = page.getByText('二维码已失效', { exact: true }).first();
    if ((await expiredText.count()) && (await expiredText.isVisible().catch(() => false))) {
      logger.info('二维码已过期，正在刷新...');
      const refreshBtn = page.locator(LOGIN_SELECTORS.qrRefreshBtn).first();
      if ((await refreshBtn.count())) {
        await refreshBtn.click();
      } else {
        await expiredText.click();
      }
      await page.waitForTimeout(1500);
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
      return { success: true, cookiePath, message: 'Cookie 有效' };
    }
    logger.info('Cookie 已失效，准备扫码登录');
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    args: CHROME_ARGS,
  });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    logger.info('打开小红书创作者中心...');
    await page.goto(XHS_URLS.loginPage);

    const qrSrc = await extractQrCodeSrc(page);
    const qrPath = await saveQrCodeImage(qrSrc, accountId);

    logger.info('请使用小红书 APP 扫描二维码登录');
    logger.info(`二维码文件: ${qrPath}`);
    onQRReady?.(qrPath);

    const loginSuccess = await waitForLogin(page, accountId, onQRRefresh);

    if (!loginSuccess) {
      return { success: false, cookiePath, message: '等待扫码超时' };
    }

    await page.waitForTimeout(2000);
    await saveCookie(context, cookiePath);
    logger.info(`Cookie 已保存: ${cookiePath}`);

    const verifySuccess = await validateExistingCookie(cookiePath);
    if (!verifySuccess) {
      return { success: false, cookiePath, message: 'Cookie 保存后验证失败' };
    }

    return { success: true, cookiePath, message: '扫码登录成功' };
  } catch (error) {
    return {
      success: false,
      cookiePath,
      message: `登录过程出错: ${error}`,
    };
  } finally {
    await context.close();
    await browser.close();
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

    await page.goto(XHS_URLS.loginPage);
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
