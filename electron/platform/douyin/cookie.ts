import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Logger } from '../../core/Logger';

const logger = new Logger('DouyinCookie');

export function getCookiePath(accountId: string): string {
  const userDataPath = app.getPath('userData');
  const cookieDir = path.join(userDataPath, 'cookies', 'douyin');
  
  if (!fs.existsSync(cookieDir)) {
    fs.mkdirSync(cookieDir, { recursive: true });
  }
  
  return path.join(cookieDir, `${accountId}.json`);
}

export function cookieExists(cookiePath: string): boolean {
  return fs.existsSync(cookiePath);
}

export async function saveCookie(
  context: import('patchright').BrowserContext,
  cookiePath: string
): Promise<void> {
  await context.storageState({ path: cookiePath });
  logger.info(`Cookie 已保存: ${cookiePath}`);
}

export function deleteCookie(accountId: string): boolean {
  const cookiePath = getCookiePath(accountId);
  if (fs.existsSync(cookiePath)) {
    fs.unlinkSync(cookiePath);
    logger.info(`Cookie 已删除: ${cookiePath}`);
    return true;
  }
  return false;
}
