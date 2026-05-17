// ============================================================
// 反检测验证
// 使用 Patchright 的 stealth 能力验证浏览器指纹
// ============================================================

import path from 'path';
import fs from 'fs';
import type { BrowserContext, Page } from 'patchright';
import { chromium } from 'patchright';

// 反检测测试 URL
const BOT_TEST_URLS = [
  'https://bot.sannysoft.com/',
  'https://abrahamjuliot.github.io/creepjs/',
];

// 截图保存目录
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

/**
 * 反检测结果
 */
export interface AntiDetectResult {
  passed: boolean;
  webdriverDetected: boolean;
  screenshotPath: string;
  details: string[];
  passedTests: number;
  totalTests: number;
  failedChecks: string[];
}

/**
 * 运行反检测测试
 * 1. 打开 bot.sannysoft.com
 * 2. 截图保存
 * 3. 检查 navigator.webdriver
 * 4. 检查自动化指标
 *
 * @param context Patchright BrowserContext
 * @returns 反检测结果
 */
export async function runAntiDetectTest(
  context?: BrowserContext
): Promise<AntiDetectResult> {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  let ownBrowser = false;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let ctx = context;

  if (!ctx) {
    browser = await chromium.launch({
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
    ctx = await browser.newContext();
    ownBrowser = true;
  }

  const page: Page = await ctx.newPage();
  const details: string[] = [];
  const failedChecks: string[] = [];

  try {
    console.log('[anti-detect] 正在打开 bot.sannysoft.com ...');
    await page.goto(BOT_TEST_URLS[0], {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      `anti-detect-${Date.now()}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    details.push(`截图已保存: ${screenshotPath}`);

    const webdriverDetected = await checkNavigatorWebdriver(page);
    if (webdriverDetected) {
      failedChecks.push('navigator.webdriver = true');
    }
    details.push(
      webdriverDetected
        ? '[FAIL] navigator.webdriver = true（被检测为自动化浏览器）'
        : '[PASS] navigator.webdriver = false 或 undefined（未被检测）'
    );

    const indicators = await checkAutomationIndicators(page);
    if (indicators.length > 0) {
      failedChecks.push(...indicators);
      details.push(`[FAIL] 发现自动化指标: ${indicators.join(', ')}`);
    } else {
      details.push('[PASS] 未发现其他自动化指标');
    }

    const passed = !webdriverDetected && indicators.length === 0;
    const totalTests = 2;
    const passedTests = passed ? totalTests : (webdriverDetected ? 0 : 1) + (indicators.length === 0 ? 1 : 0);

    return {
      passed,
      webdriverDetected,
      screenshotPath,
      details,
      passedTests,
      totalTests,
      failedChecks,
    };
  } catch (error) {
    details.push(`[ERROR] 测试执行失败: ${error}`);
    return {
      passed: false,
      webdriverDetected: true,
      screenshotPath: '',
      details,
      passedTests: 0,
      totalTests: 2,
      failedChecks: ['测试执行失败'],
    };
  } finally {
    await page.close();
    if (ownBrowser && browser) {
      await browser.close();
    }
  }
}

/**
 * 检查 navigator.webdriver 是否被设置
 * @param page 当前页面
 * @returns true = 被检测到自动化（不好），false = 未被检测（好）
 */
export async function checkNavigatorWebdriver(
  page: Page
): Promise<boolean> {
  try {
    const webdriver = await page.evaluate(() => {
      return navigator.webdriver;
    });
    return webdriver === true;
  } catch {
    // 无法获取则保守判断为已检测
    return true;
  }
}

/**
 * 检查浏览器中的自动化指标
 * 返回检测到的指标列表（空列表 = 好）
 *
 * @param page 当前页面
 * @returns 检测到的自动化指标列表
 */
export async function checkAutomationIndicators(
  page: Page
): Promise<string[]> {
  const indicators: string[] = [];

  try {
    const results = await page.evaluate(() => {
      const found: string[] = [];

      // 检查 window.chrome（正常 Chrome 应该有）
      if (!(window as any).chrome) {
        found.push('window.chrome 缺失');
      }

      // 检查 CDP 相关属性
      if ((window as any).__nightmare) {
        found.push('__nightmare 存在');
      }
      if ((window as any).callPhantom) {
        found.push('callPhantom 存在');
      }
      if ((window as any)._phantom) {
        found.push('_phantom 存在');
      }
      if ((window as any).phantom) {
        found.push('phantom 存在');
      }

      // 检查 Automation 相关全局变量
      if ((window as any).domAutomation) {
        found.push('domAutomation 存在');
      }
      if ((window as any).domAutomationController) {
        found.push('domAutomationController 存在');
      }

      // 检查 Selenium / WebDriver 剩余标记
      const doc = document as any;
      if (doc.$cdc_asdjflasutopfhvcZLmcfl_ !== undefined) {
        found.push('$cdc_ 变量存在（ChromeDriver 指标）');
      }
      if (doc.__webdriver_evaluate !== undefined) {
        found.push('__webdriver_evaluate 存在');
      }
      if (doc.__selenium_unwrapped !== undefined) {
        found.push('__selenium_unwrapped 存在');
      }

      // 检查 permissions API（headless 中 notification permission 可能异常）
      if (navigator.permissions) {
        // 注意：这是异步的，这里只做标记
        found.push('__PERMISSION_CHECK_PENDING__');
      }

      return found;
    });

    for (const item of results) {
      if (item === '__PERMISSION_CHECK_PENDING__') {
        // 异步检查 notification permission
        try {
          const permission = await page.evaluate(async () => {
            const result = await navigator.permissions.query({
              name: 'notifications',
            });
            return result.state;
          });
          if (permission === 'denied') {
            indicators.push(
              'Notification permission = denied（可能是 headless）'
            );
          }
        } catch {
          // permissions API 不可用，跳过
        }
      } else {
        indicators.push(item);
      }
    }
  } catch (error) {
    indicators.push(`检查自动化指标时出错: ${error}`);
  }

  return indicators;
}
