import type { Page } from 'patchright';
import { Logger } from '../../core/Logger';
import { UPLOAD_SELECTORS, DOUYIN_URLS } from './selectors';
import { fillVideoMetadata } from './publish';
import type { ScheduleContext, ScheduleResult } from '../base/types';

const logger = new Logger('DouyinSchedule');

/**
 * 设置抖音定时发布
 */
async function setScheduledTime(page: Page, scheduledTime: Date): Promise<boolean> {
  const scheduleTab = page.getByText('定时发布', { exact: true });
  const hasScheduleTab = await scheduleTab.isVisible().catch(() => false);

  if (!hasScheduleTab) {
    logger.error('未找到"定时发布"选项');
    return false;
  }

  await scheduleTab.click();
  await page.waitForTimeout(500);

  const dateInput = page.locator(UPLOAD_SELECTORS.scheduleDatePicker || 'input[placeholder*="日期"]');
  if (await dateInput.isVisible().catch(() => false)) {
    const year = scheduledTime.getFullYear();
    const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledTime.getDate()).padStart(2, '0');
    const hours = String(scheduledTime.getHours()).padStart(2, '0');
    const minutes = String(scheduledTime.getMinutes()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day} ${hours}:${minutes}`;

    await dateInput.click();
    await dateInput.fill(dateStr);
    await page.keyboard.press('Enter');
    logger.info(`定时发布时间已设置: ${dateStr}`);
    return true;
  }

  return false;
}

/**
 * 抖音服务端定时发布
 * 必须提供 page 参数
 */
export async function schedule(ctx: ScheduleContext): Promise<ScheduleResult> {
  const { page, title, description, tags, scheduledTime } = ctx;

  if (!page) {
    return { success: false, message: '定时发布需要 page 参数' };
  }

  if (!scheduledTime) {
    return { success: false, message: '定时发布需要指定发布时间' };
  }

  const now = new Date();
  if (scheduledTime <= now) {
    return { success: false, message: '定时发布时间必须晚于当前时间' };
  }

  const maxScheduleDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (scheduledTime > maxScheduleDate) {
    return { success: false, message: '抖音定时发布最多支持30天' };
  }

  try {
    await fillVideoMetadata(page, title, description, tags);

    const scheduleSet = await setScheduledTime(page, scheduledTime);
    if (!scheduleSet) {
      return { success: false, message: '设置定时发布时间失败' };
    }

    const confirmBtn = page.getByRole('button', { name: '确认定时', exact: false });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    } else {
      const publishBtn = page.getByRole('button', { name: '发布', exact: true });
      await publishBtn.click();
    }

    await page.waitForTimeout(2000);

    const successText = page.locator('text=/定时发布设置成功|已设置定时发布/');
    if (await successText.isVisible().catch(() => false)) {
      logger.info('定时发布设置成功');
      return { success: true, message: '定时发布设置成功', scheduledTime };
    }

    const currentUrl = page.url();
    if (currentUrl.includes('content/manage')) {
      logger.info('定时发布设置成功（已跳转管理页）');
      return { success: true, message: '定时发布设置成功', scheduledTime };
    }

    return { success: false, message: '定时发布设置可能失败，未检测到成功标志' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`定时发布设置出错: ${errorMessage}`);
    return { success: false, message: `定时发布设置出错: ${errorMessage}` };
  }
}
