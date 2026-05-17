import type { Page, Locator } from 'patchright';
import { Logger } from '../../core/Logger';

const logger = new Logger('SelectorUtils');

export async function trySelectors(
  page: Page,
  selectors: string[],
  options?: { timeout?: number }
): Promise<Locator | null> {
  const timeout = options?.timeout ?? 5000;
  
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout });
      logger.debug('选择器匹配成功', { selector });
      return locator;
    } catch {
      logger.debug('选择器匹配失败，尝试下一个', { selector });
    }
  }
  
  logger.warn('所有选择器均未匹配', { selectors });
  return null;
}

export async function clickWithFallback(
  page: Page,
  selectors: string[],
  options?: { timeout?: number }
): Promise<boolean> {
  const locator = await trySelectors(page, selectors, options);
  if (!locator) return false;
  
  await locator.click();
  return true;
}

export async function fillWithFallback(
  page: Page,
  selectors: string[],
  value: string,
  options?: { timeout?: number }
): Promise<boolean> {
  const locator = await trySelectors(page, selectors, options);
  if (!locator) return false;
  
  await locator.fill(value);
  return true;
}

export async function uploadWithFallback(
  page: Page,
  selectors: string[],
  filePath: string,
  options?: { timeout?: number }
): Promise<boolean> {
  const locator = await trySelectors(page, selectors, options);
  if (!locator) return false;
  
  await locator.setInputFiles(filePath);
  return true;
}
