import type { Page } from 'patchright';
import { Logger } from '../../core/Logger';
import { fillVideoMetadata } from './publish';
import type { ScheduleContext, ScheduleResult } from '../base/types';

const logger = new Logger('XiaohongshuSchedule');

/**
 * 小红书不支持服务端定时发布
 * 必须提供 page 参数，但会返回不支持的消息
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

    logger.info(`小红书客户端定时：等待 ${Math.round((scheduledTime.getTime() - now.getTime()) / 60000)} 分钟后发布`);

    return {
      success: false,
      message: '小红书不支持服务端定时发布，请使用客户端定时模式（需保持应用运行）',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`定时发布设置出错: ${errorMessage}`);
    return { success: false, message: `定时发布设置出错: ${errorMessage}` };
  }
}
