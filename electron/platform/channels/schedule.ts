import type { Page } from 'patchright';
import { Logger } from '../../core/Logger';
import { UPLOAD_SELECTORS } from './selectors';
import { fillVideoMetadata } from './publish';
import type { ScheduleContext, ScheduleResult } from '../base/types';

const logger = new Logger('ChannelsSchedule');

/**
 * 视频号服务端定时发布
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

  try {
    await fillVideoMetadata(page, title, description, tags);

    const scheduleToggle = page.locator(UPLOAD_SELECTORS.scheduleToggle).first();
    if (!(await scheduleToggle.isVisible().catch(() => false))) {
      return { success: false, message: '未找到定时发布选项' };
    }

    await scheduleToggle.click();
    await page.waitForTimeout(500);

    const datePicker = page.locator(UPLOAD_SELECTORS.scheduleDatePicker).first();
    if (await datePicker.isVisible().catch(() => false)) {
      const year = scheduledTime.getFullYear();
      const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
      const day = String(scheduledTime.getDate()).padStart(2, '0');
      const hours = String(scheduledTime.getHours()).padStart(2, '0');
      const minutes = String(scheduledTime.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day} ${hours}:${minutes}`;

      await datePicker.click();
      await datePicker.fill(dateStr);
      await page.keyboard.press('Enter');
      logger.info(`定时发布时间已设置: ${dateStr}`);
    }

    const publishBtn = page.locator(UPLOAD_SELECTORS.publishButton).first();
    await publishBtn.waitFor({ state: 'visible', timeout: 10000 });
    await publishBtn.click();

    await page.waitForTimeout(2000);

    const successToast = page.locator(UPLOAD_SELECTORS.publishSuccessToast);
    if (await successToast.isVisible().catch(() => false)) {
      logger.info('定时发布设置成功');
      return { success: true, message: '定时发布设置成功', scheduledTime };
    }

    const currentUrl = page.url();
    if (currentUrl.includes('/platform/post/manage')) {
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
