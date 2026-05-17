import type { Page } from 'patchright';
import { Logger } from '../../core/Logger';

const logger = new Logger('BaseAdapter');

export abstract class BaseAdapter {
  protected async waitForElement(
    page: Page,
    selector: string,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs, state: 'visible' });
      return true;
    } catch {
      logger.warn(`等待元素超时: ${selector}`);
      return false;
    }
  }

  protected async safeClick(page: Page, selector: string): Promise<boolean> {
    try {
      await page.click(selector, { timeout: 5000 });
      return true;
    } catch (error) {
      logger.warn(`点击失败: ${selector}`, error);
      return false;
    }
  }

  protected async safeFill(
    page: Page,
    selector: string,
    value: string
  ): Promise<boolean> {
    try {
      await page.fill(selector, value, { timeout: 5000 });
      return true;
    } catch (error) {
      logger.warn(`填充失败: ${selector}`, error);
      return false;
    }
  }

  protected async waitForNavigation(
    page: Page,
    urlPattern: string | RegExp,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    try {
      await page.waitForURL(urlPattern, { timeout: timeoutMs });
      return true;
    } catch {
      logger.warn(`等待导航超时: ${urlPattern}`);
      return false;
    }
  }

  protected async takeScreenshot(page: Page, name: string): Promise<string> {
    const timestamp = Date.now();
    const screenshotPath = `data/screenshots/${name}-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    logger.info(`截图已保存: ${screenshotPath}`);
    return screenshotPath;
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const delay = baseDelayMs * Math.pow(2, i);
        logger.warn(`第 ${i + 1} 次重试失败，等待 ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
