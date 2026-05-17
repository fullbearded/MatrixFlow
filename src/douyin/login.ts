// ============================================================
// 抖音扫码登录
// 移植自 social-auto-upload/uploader/douyin_uploader/main.py
// ============================================================

import path from 'path';
import fs from 'fs';
import type { BrowserContext, Page } from 'patchright';
import { chromium } from 'patchright';
import { DOUYIN_URLS } from './selectors';
import { getCookiePath, saveCookie, cookieExists } from './cookie';

/**
 * 登录结果
 */
export interface LoginResult {
  success: boolean;
  status: 'cookie_valid' | 'cookie_invalid' | 'qr_ready' | 'scanned' | 'success' | 'timeout' | 'failed';
  message: string;
  cookiePath: string;
}

// ============================================================
// Cookie 验证（cookie_auth）
// ============================================================

/**
 * 验证已有的 cookie 是否仍然有效
 * 来自 social-auto-upload cookie_auth() 函数
 * 
 * @param cookiePath cookie 文件路径
 * @returns cookie 是否有效
 */
export async function validateExistingCookie(cookiePath: string): Promise<boolean> {
  if (!fs.existsSync(cookiePath)) {
    return false;
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
    ],
  });
  try {
    const context = await browser.newContext({ storageState: cookiePath });
    const page = await context.newPage();

    // 导航到上传页
    await page.goto(DOUYIN_URLS.upload, { timeout: 10000 });

    // 等待 URL 加载
    try {
      await page.waitForURL(DOUYIN_URLS.upload, { timeout: 5000 });
    } catch {
      return false;
    }

    // 检查是否出现登录按钮
    const phoneLoginVisible = await page.getByText('手机号登录').isVisible().catch(() => false);
    const scanLoginVisible = await page.getByText('扫码登录').isVisible().catch(() => false);

    if (phoneLoginVisible || scanLoginVisible) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[login] Cookie 验证失败:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// ============================================================
// 提取二维码
// ============================================================

/**
 * 从登录页提取二维码图片 src
 * 来自 social-auto-upload _extract_douyin_qrcode_src()
 */
async function extractQrCodeSrc(page: Page): Promise<string> {
  // 找到"扫码登录"Tab
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

/**
 * 保存二维码到本地文件
 */
async function saveQrCodeImage(src: string, accountId: string): Promise<string> {
  const qrDir = path.join(process.cwd(), 'data', 'qrcodes');
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  const qrPath = path.join(qrDir, `${accountId}-${Date.now()}.png`);

  // 处理 data:image/png;base64,... 格式
  if (src.startsWith('data:image')) {
    const base64Data = src.split(',')[1];
    fs.writeFileSync(qrPath, Buffer.from(base64Data, 'base64'));
  } else {
    // 如果是 URL，这里暂不处理（实际场景需要下载）
    throw new Error('二维码 src 不是 base64 格式，暂不支持');
  }

  console.log(`[login] 二维码已保存: ${qrPath}`);
  return qrPath;
}

// ============================================================
// 等待登录完成
// ============================================================

/**
 * 检查是否已完成登录
 * 来自 social-auto-upload _is_douyin_login_completed()
 */
async function isLoginCompleted(page: Page): Promise<boolean> {
  // 检查 URL 是否跳转到登录后的主页
  if (!page.url().startsWith(DOUYIN_URLS.creatorHome)) {
    return false;
  }

  // 检查登录相关元素是否已不可见
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

/**
 * 等待用户扫码登录
 * 来自 social-auto-upload _wait_for_douyin_login()
 */
async function waitForLogin(
  page: Page,
  accountId: string,
  pollIntervalMs: number = 3000,
  maxChecks: number = 100
): Promise<boolean> {
  for (let i = 0; i < maxChecks; i++) {
    // 检查是否登录完成
    if (await isLoginCompleted(page)) {
      console.log(`[login] 扫码成功，已跳转到: ${page.url()}`);
      return true;
    }

    // 检查二维码是否过期
    const expiredBox = page.getByText('二维码失效', { exact: true }).locator('..').first();
    if ((await expiredBox.count()) && (await expiredBox.isVisible())) {
      console.log('[login] 二维码已过期，正在刷新...');
      await expiredBox.click();
      await page.waitForTimeout(1000);
      // 重新提取并保存二维码
      const src = await extractQrCodeSrc(page);
      await saveQrCodeImage(src, accountId);
    }

    // 等待下一次检查
    await page.waitForTimeout(pollIntervalMs);
  }

  return false;
}

// ============================================================
// 主登录流程
// ============================================================

/**
 * 抖音扫码登录
 * 来自 social-auto-upload douyin_cookie_gen()
 * 
 * @param accountId 账号标识
 * @param headless 是否无头模式（登录时建议 false）
 * @returns 登录结果
 */
export async function qrCodeLogin(
  accountId: string,
  headless: boolean = false
): Promise<LoginResult> {
  const cookiePath = getCookiePath(accountId);

  // 检查现有 cookie
  if (cookieExists(cookiePath)) {
    console.log('[login] 检查现有 cookie...');
    const valid = await validateExistingCookie(cookiePath);
    if (valid) {
      console.log('[login] Cookie 有效，无需重新登录');
      return {
        success: true,
        status: 'cookie_valid',
        message: 'Cookie 有效',
        cookiePath,
      };
    }
    console.log('[login] Cookie 已失效，准备扫码登录');
  }

  // 启动浏览器进行扫码登录
  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    args: [
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
    ],
  });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    // 导航到抖音创作者中心首页
    console.log('[login] 打开抖音创作者中心...');
    await page.goto(DOUYIN_URLS.loginPage);

    // 提取并保存二维码
    const qrSrc = await extractQrCodeSrc(page);
    const qrPath = await saveQrCodeImage(qrSrc, accountId);

    console.log('[login] 请使用抖音 APP 扫描二维码登录');
    console.log(`[login] 二维码文件: ${qrPath}`);

    // 等待扫码登录
    const loginSuccess = await waitForLogin(page, accountId);

    if (!loginSuccess) {
      return {
        success: false,
        status: 'timeout',
        message: '等待扫码超时',
        cookiePath,
      };
    }

    // 登录成功，等待页面稳定
    await page.waitForTimeout(2000);

    // 保存 cookie
    await saveCookie(context, cookiePath);
    console.log(`[login] Cookie 已保存: ${cookiePath}`);

    // 二次验证
    const verifySuccess = await validateExistingCookie(cookiePath);
    if (!verifySuccess) {
      return {
        success: false,
        status: 'failed',
        message: 'Cookie 保存后验证失败',
        cookiePath,
      };
    }

    return {
      success: true,
      status: 'success',
      message: '扫码登录成功',
      cookiePath,
    };
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      message: `登录过程出错: ${error}`,
      cookiePath,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
