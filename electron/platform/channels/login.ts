import path from 'path';
import fs from 'fs';
import type { BrowserContext, Page } from 'patchright';
import { chromium } from 'patchright';
import { Logger } from '../../core/Logger';
import { CHANNELS_URLS, LOGIN_SELECTORS } from './selectors';
import { getCookiePath, saveCookie, cookieExists } from './cookie';
import type { CookieResult } from '../base/types';

const logger = new Logger('ChannelsLogin');

const CHROME_ARGS = [
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--no-sandbox',
];

/** 扫码登录超时时间（5 分钟） */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
/** 二维码轮询间隔 */
const QR_POLL_INTERVAL_MS = 3000;
/** 二维码最大轮询次数 */
const QR_MAX_POLLS = Math.floor(LOGIN_TIMEOUT_MS / QR_POLL_INTERVAL_MS);

/**
 * 视频号的登录验证逻辑：
 * 与抖音不同，视频号登录成功后会跳转离开登录页，
 * 并且页面上不再出现二维码相关元素。
 */
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

    await page.goto(CHANNELS_URLS.creatorHome, { timeout: 15000 });

    // 视频号已登录时，页面不会出现二维码
    const qrCodeVisible = await page.locator(LOGIN_SELECTORS.qrCodeImage).isVisible().catch(() => false);
    const loginContainerVisible = await page.locator(LOGIN_SELECTORS.loginContainer).isVisible().catch(() => false);

    if (qrCodeVisible || loginContainerVisible) {
      logger.info('检测到登录页面元素，Cookie 已失效');
      return false;
    }

    // 额外验证：尝试访问管理页面
    await page.goto(CHANNELS_URLS.contentManage, { timeout: 10000 });
    const redirectedToLogin = page.url().includes('login') || page.url() === CHANNELS_URLS.creatorHome;

    if (redirectedToLogin) {
      logger.info('访问管理页被重定向，Cookie 已失效');
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

/**
 * 从视频号登录页提取微信二维码
 * 视频号登录页直接显示微信二维码（无需切换 tab），
 * 与抖音需要先点击"扫码登录" tab 不同。
 */
async function extractQrCodeSrc(page: Page): Promise<string> {
  // 等待二维码图片加载
  const qrCodeImg = page.locator(LOGIN_SELECTORS.qrCodeImage).first();
  await qrCodeImg.waitFor({ state: 'visible', timeout: 30000 });

  const src = await qrCodeImg.getAttribute('src');
  if (!src) {
    throw new Error('未获取到视频号登录二维码地址');
  }

  logger.info('已获取微信二维码');
  return src;
}

async function saveQrCodeImage(src: string, accountId: string): Promise<string> {
  const { app } = await import('electron');
  const userDataPath = app.getPath('userData');
  const qrDir = path.join(userDataPath, 'qrcodes', 'channels');

  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  const qrPath = path.join(qrDir, `${accountId}-${Date.now()}.png`);

  if (src.startsWith('data:image')) {
    const base64Data = src.split(',')[1];
    fs.writeFileSync(qrPath, Buffer.from(base64Data, 'base64'));
  } else if (src.startsWith('http')) {
    // 微信二维码可能是网络图片 URL
    const response = await fetch(src);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(qrPath, buffer);
  } else {
    throw new Error(`不支持的二维码 src 格式: ${src.substring(0, 50)}`);
  }

  logger.info(`微信二维码已保存: ${qrPath}`);
  return qrPath;
}

/**
 * 检测视频号是否登录成功
 * 视频号扫码后页面会自动跳转到创作者中心，
 * 二维码相关元素会消失。
 */
async function isLoginCompleted(page: Page): Promise<boolean> {
  const currentUrl = page.url();

  // 如果已经跳转到管理/上传页面，说明登录成功
  if (currentUrl.includes('/platform/')) {
    return true;
  }

  // 如果还在首页，检查是否还有登录元素
  if (currentUrl === CHANNELS_URLS.creatorHome || currentUrl === CHANNELS_URLS.creatorHome.slice(0, -1)) {
    const loginMarkers = [
      page.locator(LOGIN_SELECTORS.qrCodeImage).first(),
      page.locator(LOGIN_SELECTORS.loginContainer).first(),
      page.locator(LOGIN_SELECTORS.qrCodeContainer).first(),
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

    // 所有登录标记都不可见，检查是否有用户信息
    const avatar = page.locator(LOGIN_SELECTORS.avatarIndicator).first();
    if ((await avatar.count()) && (await avatar.isVisible().catch(() => false))) {
      return true;
    }
  }

  return false;
}

/**
 * 处理二维码过期并自动刷新
 * 微信二维码有效期约 5 分钟，过期后需要刷新。
 */
async function handleExpiredQrCode(page: Page, accountId: string, onQRRefresh?: (path: string) => void): Promise<void> {
  const expiredText = page.getByText('二维码已失效', { exact: false });
  const refreshBtn = page.locator(LOGIN_SELECTORS.qrRefreshBtn).first();

  const isExpired = (await expiredText.count()) && (await expiredText.isVisible().catch(() => false));
  const hasRefreshBtn = (await refreshBtn.count()) && (await refreshBtn.isVisible().catch(() => false));

  if (isExpired || hasRefreshBtn) {
    logger.info('微信二维码已过期，正在刷新...');

    if (hasRefreshBtn) {
      await refreshBtn.click();
    } else {
      // 尝试点击过期提示区域触发刷新
      await expiredText.click().catch(() => {});
    }

    await page.waitForTimeout(1500);

    try {
      const src = await extractQrCodeSrc(page);
      const qrPath = await saveQrCodeImage(src, accountId);
      onQRRefresh?.(qrPath);
      logger.info('二维码已刷新');
    } catch (error) {
      logger.warn('刷新二维码失败:', error);
    }
  }
}

/**
 * 轮询等待用户完成微信扫码
 * 微信扫码流程：打开二维码 → 用户微信扫码 → 手机确认 → 页面跳转
 */
async function waitForLogin(
  page: Page,
  accountId: string,
  onQRRefresh?: (path: string) => void
): Promise<boolean> {
  for (let i = 0; i < QR_MAX_POLLS; i++) {
    if (await isLoginCompleted(page)) {
      logger.info(`微信扫码成功，已跳转到: ${page.url()}`);
      return true;
    }

    // 检查二维码是否过期
    await handleExpiredQrCode(page, accountId, onQRRefresh);

    if (i > 0 && i % 10 === 0) {
      const elapsed = Math.floor((i * QR_POLL_INTERVAL_MS) / 1000);
      logger.info(`等待微信扫码中... 已等待 ${elapsed} 秒`);
    }

    await page.waitForTimeout(QR_POLL_INTERVAL_MS);
  }

  logger.error(`扫码等待超时（${LOGIN_TIMEOUT_MS / 1000} 秒）`);
  return false;
}

/**
 * 视频号微信扫码登录主入口
 *
 * 流程与抖音不同：
 * 1. 打开 channels.weixin.qq.com → 直接显示微信二维码
 * 2. 用户用微信扫描二维码
 * 3. 在手机微信上确认登录
 * 4. 页面自动跳转到创作者中心
 */
export async function qrCodeLogin(
  accountId: string,
  headless: boolean = false,
  onQRReady?: (path: string) => void,
  onQRRefresh?: (path: string) => void
): Promise<CookieResult> {
  const cookiePath = getCookiePath(accountId);

  // 先检查现有 Cookie
  if (cookieExists(cookiePath)) {
    logger.info('检查现有 Cookie...');
    const valid = await validateExistingCookie(cookiePath);
    if (valid) {
      logger.info('Cookie 有效，无需重新登录');
      return {
        success: true,
        cookiePath,
        message: 'Cookie 有效',
      };
    }
    logger.info('Cookie 已失效，准备微信扫码登录');
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    args: CHROME_ARGS,
  });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    logger.info('打开微信视频号创作者中心...');
    await page.goto(CHANNELS_URLS.loginPage, { timeout: 30000 });

    // 视频号直接显示微信二维码，不需要切换 tab
    const qrSrc = await extractQrCodeSrc(page);
    const qrPath = await saveQrCodeImage(qrSrc, accountId);

    logger.info('请使用微信扫描二维码登录');
    logger.info(`二维码文件: ${qrPath}`);
    onQRReady?.(qrPath);

    const loginSuccess = await waitForLogin(page, accountId, onQRRefresh);

    if (!loginSuccess) {
      return {
        success: false,
        cookiePath,
        message: `等待微信扫码超时（${LOGIN_TIMEOUT_MS / 1000} 秒）`,
      };
    }

    // 登录成功后等待页面完全加载
    await page.waitForTimeout(3000);

    // 记录登录后的用户名
    const usernameEl = page.locator(LOGIN_SELECTORS.usernameText).first();
    if ((await usernameEl.count()) && (await usernameEl.isVisible().catch(() => false))) {
      const username = await usernameEl.textContent().catch(() => '');
      if (username) {
        logger.info(`登录账号: ${username}`);
      }
    }

    await saveCookie(context, cookiePath);
    logger.info(`Cookie 已保存: ${cookiePath}`);

    // 二次验证
    const verifySuccess = await validateExistingCookie(cookiePath);
    if (!verifySuccess) {
      return {
        success: false,
        cookiePath,
        message: 'Cookie 保存后验证失败',
      };
    }

    return {
      success: true,
      cookiePath,
      message: '微信扫码登录成功',
    };
  } catch (error) {
    logger.error('登录过程出错:', error);
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

/** 获取二维码图片路径（不等待扫码完成） */
export async function getQRCode(accountId: string): Promise<string> {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: CHROME_ARGS,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(CHANNELS_URLS.loginPage, { timeout: 30000 });
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

/** 检查指定账号的 Cookie 是否有效 */
export async function checkCookie(accountId: string): Promise<boolean> {
  const cookiePath = getCookiePath(accountId);
  return validateExistingCookie(cookiePath);
}
