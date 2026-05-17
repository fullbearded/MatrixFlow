import { randomUUID } from 'crypto';
import { Logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { TaskScheduler } from '../core/TaskScheduler';
import { PlatformRegistry } from '../platform/base/PlatformRegistry';
import { publishTaskRepo } from '../data/repositories/PublishTaskRepository';
import { taskItemRepo } from '../data/repositories/TaskItemRepository';
import { groupPublishRuleRepo } from '../data/repositories/GroupPublishRuleRepository';
import { accountRepo } from '../data/repositories/AccountRepository';
import type { PlatformAdapter } from '../platform/base/interfaces';
import type {
  UploadContext,
  PublishContext,
  ScheduleContext,
} from '../platform/base/types';
import type { PublishTask as DbPublishTask, TaskItem as DbTaskItem, Account as DbAccount } from '../data/types';
import type {
  IPublishService,
  PublishRequest,
  BatchPublishRequest,
  PublishTask,
  PublishResult,
  PublishTaskStatus,
  PublishTaskStatusDetail,
  PublishTaskItem,
  PublishMode,
  TaskCreatedPayload,
  TaskScheduledPayload,
  TaskStartedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  TaskCancelledPayload,
  ItemStartedPayload,
  ItemCompletedPayload,
  ItemFailedPayload,
  RulesAppliedPayload,
} from './types/publish';
import { PublishEvent } from './types/publish';

const logger = new Logger('PublishService');

const DEFAULT_MAX_RETRIES = 3;
const SCHEDULE_AHEAD_THRESHOLD_MS = 60_000;

function nowISO(): string {
  return new Date().toISOString();
}

export class PublishService implements IPublishService {
  private static instance: PublishService;
  private eventBus: EventBus;
  private taskScheduler: TaskScheduler;
  private initialized = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.taskScheduler = TaskScheduler.getInstance();
  }

  static getInstance(): PublishService {
    if (!PublishService.instance) {
      PublishService.instance = new PublishService();
    }
    return PublishService.instance;
  }

  initialize(): void {
    if (this.initialized) return;

    this.taskScheduler.onTaskExecute = async (task) => {
      if (task.type !== 'publish') return { success: false, error: '非发布任务' };
      const publishTaskId = task.payload as string;
      try {
        const dbTask = await publishTaskRepo.findById(publishTaskId);
        if (!dbTask) return { success: false, error: `发布任务不存在: ${publishTaskId}` };

        const result = dbTask.publish_mode === 'server'
          ? await this.publishToServer(publishTaskId)
          : await this.publishFromClient(publishTaskId);

        return { success: result.success, error: result.error };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    };

    this.initialized = true;
    logger.info('发布管理服务已初始化');
  }

  // ─── 任务创建 ─────────────────────────────────────────────

  async createPublishTask(request: PublishRequest): Promise<PublishTask> {
    const adapter = this.requireAdapter(request.platform);

    await this.validateCookieForAccount(request.accountId);

    const taskId = randomUUID();
    const now = nowISO();
    const status: PublishTaskStatus = request.scheduledAt ? 'scheduled' : 'pending';

    const dbRow = {
      id: taskId,
      content_id: request.contentId,
      group_id: null,
      platform: request.platform,
      account_id: request.accountId,
      proxy_id: null,
      fingerprint_id: null,
      scheduled_at: request.scheduledAt ? request.scheduledAt.toISOString() : null,
      publish_mode: request.publishMode,
      status,
      result: null,
      error_message: null,
      retry_count: 0,
      max_retries: DEFAULT_MAX_RETRIES,
      created_at: now,
      updated_at: now,
    };

    await publishTaskRepo.insert(dbRow);

    const task = this.dbRowToTask(dbRow as unknown as DbPublishTask);

    if (request.scheduledAt) {
      this.taskScheduler.scheduleAt(
        {
          id: taskId,
          type: 'publish',
          platform: request.platform,
          accountId: request.accountId,
          priority: 5,
          payload: taskId,
          status: 'pending',
          createdAt: now,
          scheduledAt: request.scheduledAt.toISOString(),
          retryCount: 0,
          maxRetries: DEFAULT_MAX_RETRIES,
        },
        request.scheduledAt,
      );
    }

    const payload: TaskCreatedPayload = {
      taskId,
      contentId: request.contentId,
      platform: request.platform,
      accountId: request.accountId,
      publishMode: request.publishMode,
    };
    this.eventBus.emit(PublishEvent.TASK_CREATED, payload);

    logger.info(
      `发布任务创建: taskId=${taskId} platform=${request.platform} mode=${request.publishMode}`
        + (request.scheduledAt ? ` scheduledAt=${request.scheduledAt.toISOString()}` : ' immediate'),
    );

    return task;
  }

  async createBatchPublishTask(request: BatchPublishRequest): Promise<PublishTask[]> {
    const tasks: PublishTask[] = [];

    for (const groupId of request.groupIds) {
      const accountsInGroup = await accountRepo.findWhere({ status: 'active' } as Partial<DbAccount>);

      const groupRules = await groupPublishRuleRepo.findEnabledByGroup(groupId);
      const platformAccounts = new Map<string, string[]>();

      for (const rule of groupRules) {
        const accountIds = accountsInGroup
          .filter((a) => a.platform === rule.platform)
          .map((a) => a.id);
        platformAccounts.set(rule.platform, accountIds);
      }

      for (const [platform, accountIds] of platformAccounts) {
        for (const accountId of accountIds) {
          const task = await this.createPublishTask({
            contentId: request.contentId,
            platform,
            accountId,
            scheduledAt: request.scheduledAt,
            publishMode: request.publishMode,
            metadata: {},
          });
          tasks.push(task);
        }
      }
    }

    logger.info(`批量发布任务创建完成: count=${tasks.length} groupIds=${request.groupIds.join(',')}`);
    return tasks;
  }

  // ─── 发布调度 ─────────────────────────────────────────────

  async schedulePublish(taskId: string, scheduledAt: Date): Promise<void> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);
    if (dbTask.status === 'running' || dbTask.status === 'completed') {
      throw new Error(`任务状态不允许调度: ${dbTask.status}`);
    }

    await publishTaskRepo.update(taskId, {
      scheduled_at: scheduledAt.toISOString(),
      status: 'scheduled',
    } as Partial<DbPublishTask>);

    this.taskScheduler.scheduleAt(
      {
        id: taskId,
        type: 'publish',
        platform: dbTask.platform,
        accountId: dbTask.account_id ?? '',
        priority: 5,
        payload: taskId,
        status: 'pending',
        createdAt: dbTask.created_at,
        scheduledAt: scheduledAt.toISOString(),
        retryCount: dbTask.retry_count,
        maxRetries: dbTask.max_retries,
      },
      scheduledAt,
    );

    const payload: TaskScheduledPayload = { taskId, scheduledAt };
    this.eventBus.emit(PublishEvent.TASK_SCHEDULED, payload);

    logger.info(`发布任务已调度: taskId=${taskId} scheduledAt=${scheduledAt.toISOString()}`);
  }

  async executeNow(taskId: string): Promise<PublishResult> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);
    if (dbTask.status === 'running') throw new Error(`任务正在执行: ${taskId}`);
    if (dbTask.status === 'completed') throw new Error(`任务已完成: ${taskId}`);

    await publishTaskRepo.update(taskId, {
      status: 'running',
      scheduled_at: nowISO(),
    } as Partial<DbPublishTask>);

    const startedPayload: TaskStartedPayload = {
      taskId,
      publishMode: dbTask.publish_mode as PublishMode,
    };
    this.eventBus.emit(PublishEvent.TASK_STARTED, startedPayload);

    logger.info(`立即执行发布任务: taskId=${taskId} mode=${dbTask.publish_mode}`);

    try {
      const result = dbTask.publish_mode === 'server'
        ? await this.publishToServer(taskId)
        : await this.publishFromClient(taskId);

      if (result.success) {
        await publishTaskRepo.markCompleted(taskId, JSON.stringify(result));
        this.eventBus.emit(PublishEvent.TASK_COMPLETED, { taskId, result } as TaskCompletedPayload);
      } else {
        await this.handleTaskFailure(taskId, result.error ?? '未知错误', dbTask.retry_count, dbTask.max_retries);
      }

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.handleTaskFailure(taskId, errMsg, dbTask.retry_count, dbTask.max_retries);
      return { success: false, error: errMsg };
    }
  }

  async updateTask(taskId: string, data: Partial<{ scheduledAt: Date; status: string }>): Promise<void> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);

    const updateData: Partial<DbPublishTask> = {};
    if (data.scheduledAt) {
      updateData.scheduled_at = data.scheduledAt.toISOString();
    }
    if (data.status) {
      updateData.status = data.status;
    }

    await publishTaskRepo.update(taskId, updateData);
    this.eventBus.emit(PublishEvent.TASK_UPDATED, { taskId, changes: data });
    logger.info(`发布任务已更新: taskId=${taskId}`);
  }

  async cancelPublish(taskId: string): Promise<void> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);
    if (dbTask.status === 'completed') throw new Error(`任务已完成，无法取消: ${taskId}`);
    if (dbTask.status === 'running') throw new Error(`任务正在执行，无法取消: ${taskId}`);

    this.taskScheduler.cancel(taskId);

    await publishTaskRepo.update(taskId, { status: 'cancelled' } as Partial<DbPublishTask>);

    const payload: TaskCancelledPayload = { taskId };
    this.eventBus.emit(PublishEvent.TASK_CANCELLED, payload);

    logger.info(`发布任务已取消: taskId=${taskId}`);
  }

  async deleteTask(taskId: string): Promise<void> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);
    if (dbTask.status === 'running') throw new Error(`任务正在执行，无法删除: ${taskId}`);

    this.taskScheduler.cancel(taskId);
    await publishTaskRepo.deleteById(taskId);
    logger.info(`发布任务已删除: taskId=${taskId}`);
  }

  // ─── 服务端发布 ───────────────────────────────────────────

  async publishToServer(taskId: string): Promise<PublishResult> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);

    const adapter = this.requireAdapter(dbTask.platform);
    const accountId = dbTask.account_id ?? '';
    const contentId = dbTask.content_id;

    logger.info(`服务端发布开始: taskId=${taskId} platform=${dbTask.platform} accountId=${accountId}`);

    await this.validateCookieForAccount(accountId);

    const items = await taskItemRepo.findByTaskId(taskId);
    if (items.length === 0) {
      const itemId = randomUUID();
      await taskItemRepo.insert({
        id: itemId,
        task_id: taskId,
        account_id: accountId,
        platform: dbTask.platform,
        status: 'pending',
        platform_video_id: null,
        publish_url: null,
        error_message: null,
        started_at: null,
        completed_at: null,
      } as Omit<DbTaskItem, 'created_at' | 'updated_at'>);
    }

    const allItems = await taskItemRepo.findByTaskId(taskId);
    const targetItem = allItems[0];

    await taskItemRepo.markStarted(targetItem.id);
    this.emitItemStarted(taskId, targetItem.id, accountId, dbTask.platform);

    try {
      const uploadCtx: UploadContext = {
        accountId,
        videoPath: contentId,
        title: `video_${contentId.slice(0, 8)}`,
      };

      const uploadResult = await adapter.uploadVideo(uploadCtx);
      if (!uploadResult.success) {
        await taskItemRepo.markFailed(targetItem.id, uploadResult.message);
        this.emitItemFailed(taskId, targetItem.id, uploadResult.message);
        return { success: false, error: `上传失败: ${uploadResult.message}` };
      }

      if (dbTask.scheduled_at && adapter.schedule) {
        const scheduleCtx: ScheduleContext = {
          accountId,
          videoId: uploadResult.videoId ?? '',
          title: uploadCtx.title,
          scheduledTime: new Date(dbTask.scheduled_at),
        };
        const scheduleResult = await adapter.schedule(scheduleCtx);
        if (!scheduleResult.success) {
          logger.warn(`平台定时发布失败，回退到本地调度: ${scheduleResult.message}`);
        } else {
          logger.info(`平台定时发布设置成功: taskId=${taskId} scheduledTime=${scheduleResult.scheduledTime?.toISOString()}`);
        }
      } else if (dbTask.scheduled_at) {
        logger.info(`平台不支持定时发布 API，使用本地 TaskScheduler 调度`);
      }

      const publishCtx: PublishContext = {
        accountId,
        videoId: uploadResult.videoId ?? '',
        title: uploadCtx.title,
      };
      const publishRes = await adapter.publish(publishCtx);

      if (publishRes.success) {
        await taskItemRepo.markCompleted(
          targetItem.id,
          uploadResult.videoId ?? '',
          publishRes.publishUrl ?? '',
        );
        this.emitItemCompleted(taskId, targetItem.id, uploadResult.videoId, publishRes.publishUrl);

        logger.info(`服务端发布成功: taskId=${taskId} videoId=${uploadResult.videoId}`);

        return {
          success: true,
          videoId: uploadResult.videoId,
          publishUrl: publishRes.publishUrl,
          publishedAt: new Date(),
        };
      }

      await taskItemRepo.markFailed(targetItem.id, publishRes.message);
      this.emitItemFailed(taskId, targetItem.id, publishRes.message);
      return { success: false, error: `发布失败: ${publishRes.message}` };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await taskItemRepo.markFailed(targetItem.id, errMsg);
      this.emitItemFailed(taskId, targetItem.id, errMsg);
      return { success: false, error: errMsg };
    }
  }

  // ─── 客户端发布 ───────────────────────────────────────────

  async publishFromClient(taskId: string): Promise<PublishResult> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);

    const adapter = this.requireAdapter(dbTask.platform);
    const accountId = dbTask.account_id ?? '';
    const contentId = dbTask.content_id;

    logger.info(`客户端发布开始: taskId=${taskId} platform=${dbTask.platform} accountId=${accountId}`);

    await this.validateCookieForAccount(accountId);

    const items = await taskItemRepo.findByTaskId(taskId);
    if (items.length === 0) {
      const itemId = randomUUID();
      await taskItemRepo.insert({
        id: itemId,
        task_id: taskId,
        account_id: accountId,
        platform: dbTask.platform,
        status: 'pending',
        platform_video_id: null,
        publish_url: null,
        error_message: null,
        started_at: null,
        completed_at: null,
      } as Omit<DbTaskItem, 'created_at' | 'updated_at'>);
    }

    const allItems = await taskItemRepo.findByTaskId(taskId);
    const targetItem = allItems[0];

    await taskItemRepo.markStarted(targetItem.id);
    this.emitItemStarted(taskId, targetItem.id, accountId, dbTask.platform);

    try {
      const uploadCtx: UploadContext = {
        accountId,
        videoPath: contentId,
        title: `video_${contentId.slice(0, 8)}`,
      };

      const uploadResult = await adapter.uploadVideo(uploadCtx);
      if (!uploadResult.success) {
        await taskItemRepo.markFailed(targetItem.id, uploadResult.message);
        this.emitItemFailed(taskId, targetItem.id, uploadResult.message);
        return { success: false, error: `上传失败: ${uploadResult.message}` };
      }

      const publishCtx: PublishContext = {
        accountId,
        videoId: uploadResult.videoId ?? '',
        title: uploadCtx.title,
      };
      const publishRes = await adapter.publish(publishCtx);

      if (publishRes.success) {
        await taskItemRepo.markCompleted(
          targetItem.id,
          uploadResult.videoId ?? '',
          publishRes.publishUrl ?? '',
        );
        this.emitItemCompleted(taskId, targetItem.id, uploadResult.videoId, publishRes.publishUrl);

        logger.info(`客户端发布成功: taskId=${taskId} videoId=${uploadResult.videoId}`);

        return {
          success: true,
          videoId: uploadResult.videoId,
          publishUrl: publishRes.publishUrl,
          publishedAt: new Date(),
        };
      }

      await taskItemRepo.markFailed(targetItem.id, publishRes.message);
      this.emitItemFailed(taskId, targetItem.id, publishRes.message);
      return { success: false, error: `发布失败: ${publishRes.message}` };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await taskItemRepo.markFailed(targetItem.id, errMsg);
      this.emitItemFailed(taskId, targetItem.id, errMsg);
      return { success: false, error: errMsg };
    }
  }

  // ─── 状态追踪 ─────────────────────────────────────────────

  async getTaskStatus(taskId: string): Promise<PublishTaskStatusDetail> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);

    const dbItems = await taskItemRepo.findByTaskId(taskId);
    const items: PublishTaskItem[] = dbItems.map((item) => ({
      itemId: item.id,
      accountId: item.account_id,
      platform: item.platform,
      status: item.status,
      videoId: item.platform_video_id ?? undefined,
      publishUrl: item.publish_url ?? undefined,
      error: item.error_message ?? undefined,
    }));

    let result: PublishResult | undefined;
    if (dbTask.result) {
      try {
        result = JSON.parse(dbTask.result);
      } catch { /* ignore */ }
    }

    return {
      taskId: dbTask.id,
      status: dbTask.status as PublishTaskStatus,
      publishMode: dbTask.publish_mode as PublishMode,
      scheduledAt: dbTask.scheduled_at ? new Date(dbTask.scheduled_at) : undefined,
      result,
      items,
      createdAt: new Date(dbTask.created_at),
      updatedAt: new Date(dbTask.updated_at),
    };
  }

  async getAccountTasks(accountId: string): Promise<PublishTask[]> {
    const dbTasks = await publishTaskRepo.findWhere({
      account_id: accountId,
    } as Partial<DbPublishTask>);

    return dbTasks.map((t) => this.dbRowToTask(t));
  }

  async getContentTasks(contentId: string): Promise<PublishTask[]> {
    const dbTasks = await publishTaskRepo.findByContentId(contentId);
    return dbTasks.map((t) => this.dbRowToTask(t));
  }

  // ─── 发布规则应用 ─────────────────────────────────────────

  async applyGroupRules(taskId: string, groupId: string): Promise<void> {
    const dbTask = await publishTaskRepo.findById(taskId);
    if (!dbTask) throw new Error(`发布任务不存在: ${taskId}`);

    const rules = await groupPublishRuleRepo.findEnabledByGroup(groupId);
    if (rules.length === 0) {
      logger.warn(`分组无启用规则: groupId=${groupId}`);
      return;
    }

    for (const rule of rules) {
      if (rule.publish_mode) {
        await publishTaskRepo.update(taskId, {
          publish_mode: rule.publish_mode,
        } as Partial<DbPublishTask>);
      }

      if (rule.publish_interval_min > 0) {
        const earliestSlot = new Date(Date.now() + rule.publish_interval_min * 60_000);
        const currentScheduled = dbTask.scheduled_at ? new Date(dbTask.scheduled_at) : null;

        if (!currentScheduled || currentScheduled < earliestSlot) {
          await publishTaskRepo.update(taskId, {
            scheduled_at: earliestSlot.toISOString(),
          } as Partial<DbPublishTask>);
        }
      }
    }

    await publishTaskRepo.update(taskId, {
      group_id: groupId,
    } as Partial<DbPublishTask>);

    const payload: RulesAppliedPayload = { taskId, groupId, rulesCount: rules.length };
    this.eventBus.emit(PublishEvent.RULES_APPLIED, payload);

    logger.info(`发布规则已应用: taskId=${taskId} groupId=${groupId} rulesCount=${rules.length}`);
  }

  // ─── 内部方法 ─────────────────────────────────────────────

  private async handleTaskFailure(
    taskId: string,
    error: string,
    currentRetryCount: number,
    maxRetries: number,
  ): Promise<void> {
    const updatedTask = await publishTaskRepo.markFailed(taskId, error);
    const newRetryCount = updatedTask.retry_count;

    const payload: TaskFailedPayload = {
      taskId,
      error,
      retryCount: newRetryCount,
      maxRetries,
    };
    this.eventBus.emit(PublishEvent.TASK_FAILED, payload);

    if (newRetryCount < maxRetries) {
      logger.info(`发布任务将重试: taskId=${taskId} retry=${newRetryCount}/${maxRetries}`);
    } else {
      logger.error(`发布任务最终失败: taskId=${taskId} retries=${maxRetries} error=${error}`);
    }
  }

  private async validateCookieForAccount(accountId: string): Promise<void> {
    const account = await accountRepo.findById(accountId);
    if (!account) throw new Error(`账号不存在: ${accountId}`);
    if (!account.cookie_valid) {
      logger.warn(`账号 Cookie 已失效: accountId=${accountId}，尝试检查`);
      const adapter = this.requireAdapter(account.platform);
      const valid = await adapter.checkCookie(accountId).catch(() => false);
      if (!valid) {
        throw new Error(`账号 Cookie 无效，请重新登录: accountId=${accountId}`);
      }
      await accountRepo.setCookieValid(accountId, true);
    }
  }

  private requireAdapter(platform: string): PlatformAdapter {
    const adapter = PlatformRegistry.getAdapter(platform);
    if (!adapter) {
      throw new Error(
        `不支持的平台: ${platform}，可用: ${PlatformRegistry.getSupportedPlatforms().join(', ')}`,
      );
    }
    return adapter;
  }

  private dbRowToTask(row: DbPublishTask): PublishTask {
    let result: PublishResult | undefined;
    if (row.result) {
      try { result = JSON.parse(row.result); } catch { /* ignore */ }
    }

    return {
      id: row.id,
      contentId: row.content_id,
      platform: row.platform,
      accountId: row.account_id ?? '',
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      publishMode: row.publish_mode as PublishMode,
      status: row.status as PublishTaskStatus,
      result,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      error: row.error_message ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private emitItemStarted(taskId: string, itemId: string, accountId: string, platform: string): void {
    const payload: ItemStartedPayload = { taskId, itemId, accountId, platform };
    this.eventBus.emit(PublishEvent.ITEM_STARTED, payload);
  }

  private emitItemCompleted(taskId: string, itemId: string, videoId?: string, publishUrl?: string): void {
    const payload: ItemCompletedPayload = { taskId, itemId, videoId, publishUrl };
    this.eventBus.emit(PublishEvent.ITEM_COMPLETED, payload);
  }

  private emitItemFailed(taskId: string, itemId: string, error: string): void {
    const payload: ItemFailedPayload = { taskId, itemId, error };
    this.eventBus.emit(PublishEvent.ITEM_FAILED, payload);
  }
}

export const publishService = PublishService.getInstance();
