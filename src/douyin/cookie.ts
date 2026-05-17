// ============================================================
// 抖音 Cookie 管理
// 参考 social-auto-upload 的 cookie 持久化逻辑
// ============================================================

import path from 'path';
import fs from 'fs';
import type { BrowserContext, Page } from 'patchright';
import { DOUYIN_URLS } from './selectors';

// Cookie 文件存放根目录
const COOKIE_BASE_DIR = path.join(process.cwd(), 'data', 'cookies');

// 用户数据目录根目录（用于 persistent context）
const USER_DATA_BASE_DIR = path.join(process.cwd(), 'data', 'userdata');

/**
 * 获取指定账号的 cookie 文件路径
 * @param accountId 账号标识（如手机号或自定义 ID）
 * @returns cookie JSON 文件的绝对路径
 */
export function getCookiePath(accountId: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(COOKIE_BASE_DIR, `${safeId}.json`);
}

/**
 * 检查 cookie 文件是否存在
 * @param cookiePath cookie 文件路径（由 getCookiePath 返回）
 * @returns 文件是否存在
 */
export function cookieExists(cookiePath: string): boolean {
  return fs.existsSync(cookiePath);
}

/**
 * 创建用户数据目录路径（用于 BrowserContext 持久化）
 * @param accountId 账号标识
 * @returns 用户数据目录的绝对路径
 */
export function createUserDataDir(accountId: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(USER_DATA_BASE_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 验证当前 cookie 是否仍然有效
 * 策略（来自 social-auto-upload）：导航到上传页，检查是否出现登录提示
 * 如果页面出现「手机号登录」或「扫码登录」文字，说明 cookie 已失效
 *
 * @param page 已打开的页面
 * @returns cookie 是否有效
 */
export async function validateCookie(
  _context: BrowserContext,
  page: Page
): Promise<boolean> {
  try {
    // 导航到抖音上传页面
    await page.goto(DOUYIN_URLS.upload, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待页面加载
    await page.waitForTimeout(3000);

    // 检查是否出现登录相关文字（说明未登录/cookie 失效）
    const loginDetected = await page
      .getByText('手机号登录')
      .isVisible()
      .catch(() => false);

    const scanLoginDetected = await page
      .getByText('扫码登录')
      .isVisible()
      .catch(() => false);

    // 如果看到登录按钮，说明 cookie 无效
    if (loginDetected || scanLoginDetected) {
      return false;
    }

    // 检查是否成功到达上传页面（存在文件上传区域）
    const uploadAreaVisible = await page
      .locator("div[class^='container'] input")
      .isVisible()
      .catch(() => false);

    return uploadAreaVisible;
  } catch (error) {
    console.error('[cookie] 验证失败:', error);
    return false;
  }
}

/**
 * 保存当前 context 的 cookie/localStorage 到文件
 * @param context BrowserContext 实例
 * @param filePath 保存路径
 */
export async function saveCookie(
  context: BrowserContext,
  filePath: string
): Promise<void> {
  // 确保目录存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 导出 storageState（包含 cookies + localStorage）
  const state = await context.storageState();
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  console.log(`[cookie] 已保存到 ${filePath}`);
}

/**
 * 加载 cookie 文件内容
 * @param filePath cookie 文件路径
 * @returns storageState JSON 对象，文件不存在时返回 null
 */
export function loadCookie(
  filePath: string
): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[cookie] 加载失败 ${filePath}:`, error);
    return null;
  }
}
