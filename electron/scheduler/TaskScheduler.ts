import { randomUUID } from 'crypto';
import { Logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';

const logger = new Logger('PublishScheduler');

export type PublishMode = 'server' | 'client';

export type PublishTaskStatus = 'pending' | 'running' | 'uploaded' | 'done' | 'failed';

export interface PublishTask {
  id: string;
  accountId: string;
  platform: string;
  contentId: string;
  scheduleTime?: Date;
  publishMode: PublishMode;
  status: PublishTaskStatus;
  retryCount: number;
  errorMsg?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerStats {
  pending: number;
  running: number;
  done: number;
  failed: number;
  total: number;
  platformBreakdown: Record<string, { pending: number; running: number; done: number; failed: number }>;
}

export interface SchedulerEvents {
  'scheduler:task-submitted': { taskId: string; platform: string };
  'scheduler:task-started': { taskId: string; platform: string; accountId: string };
  'scheduler:task-completed': { taskId: string; platform: string };
  'scheduler:task-failed': { taskId: string; platform: string; error: string; retryCount: number };
  'scheduler:task-retrying': { taskId: string; platform: string; retryCount: number; delayMs: number };
  'scheduler:task-cancelled': { taskId: string };
  'scheduler:started': void;
  'scheduler:stopped': void;
}

const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;
const MAX_RETRIES = 3;
const TICK_INTERVAL_MS = 500;

type ExecutorFn = (task: PublishTask) => Promise<{ success: boolean; error?: string }>;

export class TaskScheduler {
  private static instance: TaskScheduler;

  private queue: Map<string, PublishTask[]> = new Map();
  private activeTasks: Map<string, PublishTask> = new Map();
  private taskIndex: Map<string, PublishTask> = new Map();
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private executor: ExecutorFn | null = null;
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  setExecutor(fn: ExecutorFn): void {
    this.executor = fn;
  }

  async submit(partial: Omit<PublishTask, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const task: PublishTask = {
      ...partial,
      id: randomUUID(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.enqueueTask(task);
    this.emitEvent('scheduler:task-submitted', { taskId: task.id, platform: task.platform });
    logger.info(`任务已提交: id=${task.id} platform=${task.platform} mode=${task.publishMode}`);

    return task.id;
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.taskIndex.get(taskId);
    if (!task) {
      logger.warn(`取消失败，任务不存在: ${taskId}`);
      return;
    }

    if (task.status === 'done') {
      logger.warn(`取消失败，任务已完成: ${taskId}`);
      return;
    }

    if (task.status === 'running') {
      logger.warn(`取消失败，任务正在执行: ${taskId}`);
      return;
    }

    const retryTimer = this.retryTimers.get(taskId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(taskId);
    }

    this.removeFromQueue(task);
    task.status = 'failed';
    task.errorMsg = '已取消';
    task.updatedAt = new Date();
    this.taskIndex.set(taskId, task);

    this.emitEvent('scheduler:task-cancelled', { taskId });
    logger.info(`任务已取消: ${taskId}`);
  }

  async retry(taskId: string): Promise<void> {
    const task = this.taskIndex.get(taskId);
    if (!task) {
      logger.warn(`重试失败，任务不存在: ${taskId}`);
      return;
    }

    if (task.status !== 'failed') {
      logger.warn(`重试失败，任务状态不是 failed: ${taskId} status=${task.status}`);
      return;
    }

    task.status = 'pending';
    task.retryCount = 0;
    task.errorMsg = undefined;
    task.updatedAt = new Date();

    this.enqueueTask(task);
    logger.info(`任务已手动重试: ${taskId}`);
  }

  start(): void {
    if (this.running) return;

    this.running = true;
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.emitEvent('scheduler:started', undefined as any);
    logger.info('发布调度器已启动');
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    this.emitEvent('scheduler:stopped', undefined as any);
    logger.info('发布调度器已停止');
  }

  getTask(taskId: string): PublishTask | undefined {
    return this.taskIndex.get(taskId);
  }

  getPendingTasks(): PublishTask[] {
    const pending: PublishTask[] = [];
    for (const tasks of this.queue.values()) {
      pending.push(...tasks);
    }
    return pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  getActiveTasks(): PublishTask[] {
    return Array.from(this.activeTasks.values());
  }

  getStats(): SchedulerStats {
    const stats: SchedulerStats = {
      pending: 0,
      running: 0,
      done: 0,
      failed: 0,
      total: this.taskIndex.size,
      platformBreakdown: {},
    };

    for (const task of this.taskIndex.values()) {
      if (!stats.platformBreakdown[task.platform]) {
        stats.platformBreakdown[task.platform] = { pending: 0, running: 0, done: 0, failed: 0 };
      }
      const pb = stats.platformBreakdown[task.platform];

      switch (task.status) {
        case 'pending':
          stats.pending++;
          pb.pending++;
          break;
        case 'running':
        case 'uploaded':
          stats.running++;
          pb.running++;
          break;
        case 'done':
          stats.done++;
          pb.done++;
          break;
        case 'failed':
          stats.failed++;
          pb.failed++;
          break;
      }
    }

    return stats;
  }

  private enqueueTask(task: PublishTask): void {
    if (!this.queue.has(task.platform)) {
      this.queue.set(task.platform, []);
    }
    this.queue.get(task.platform)!.push(task);
    this.taskIndex.set(task.id, task);
  }

  private removeFromQueue(task: PublishTask): void {
    const platformQueue = this.queue.get(task.platform);
    if (!platformQueue) return;

    const idx = platformQueue.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      platformQueue.splice(idx, 1);
    }

    if (platformQueue.length === 0) {
      this.queue.delete(task.platform);
    }
  }

  private tick(): void {
    if (!this.running || !this.executor) return;

    for (const [platform, tasks] of this.queue) {
      const platformActive = this.hasActivePlatformTask(platform);
      if (platformActive) continue;

      const nextTask = tasks[0];
      if (!nextTask) continue;

      if (nextTask.scheduleTime && nextTask.scheduleTime.getTime() > Date.now()) {
        continue;
      }

      tasks.shift();
      if (tasks.length === 0) {
        this.queue.delete(platform);
      }

      this.executeTask(nextTask);
    }
  }

  private hasActivePlatformTask(platform: string): boolean {
    for (const task of this.activeTasks.values()) {
      if (task.platform === platform) return true;
    }
    return false;
  }

  private async executeTask(task: PublishTask): Promise<void> {
    task.status = 'running';
    task.updatedAt = new Date();
    this.activeTasks.set(task.id, task);
    this.taskIndex.set(task.id, task);

    this.emitEvent('scheduler:task-started', {
      taskId: task.id,
      platform: task.platform,
      accountId: task.accountId,
    });

    logger.info(
      `任务开始执行: id=${task.id} platform=${task.platform} mode=${task.publishMode}`,
    );

    try {
      const result = await this.executor!(task);

      if (result.success) {
        task.status = 'done';
        task.updatedAt = new Date();
        this.taskIndex.set(task.id, task);

        this.emitEvent('scheduler:task-completed', {
          taskId: task.id,
          platform: task.platform,
        });

        logger.info(`任务完成: id=${task.id} platform=${task.platform}`);
      } else {
        await this.handleFailure(task, result.error ?? '未知错误');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.handleFailure(task, errMsg);
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  private async handleFailure(task: PublishTask, error: string): Promise<void> {
    task.errorMsg = error;
    task.updatedAt = new Date();

    if (task.retryCount < MAX_RETRIES) {
      task.retryCount++;
      task.status = 'pending';

      const delay = this.calculateBackoff(task.retryCount);

      this.emitEvent('scheduler:task-retrying', {
        taskId: task.id,
        platform: task.platform,
        retryCount: task.retryCount,
        delayMs: delay,
      });

      logger.info(
        `任务重试: id=${task.id} retry=${task.retryCount}/${MAX_RETRIES} delay=${delay}ms error=${error}`,
      );

      const timer = setTimeout(() => {
        this.retryTimers.delete(task.id);
        if (!this.running) return;

        this.enqueueTask(task);
      }, delay);

      this.retryTimers.set(task.id, timer);
      this.taskIndex.set(task.id, task);
    } else {
      task.status = 'failed';
      this.taskIndex.set(task.id, task);

      this.emitEvent('scheduler:task-failed', {
        taskId: task.id,
        platform: task.platform,
        error,
        retryCount: task.retryCount,
      });

      logger.error(
        `任务最终失败: id=${task.id} retries=${task.retryCount} error=${error}`,
      );
    }
  }

  private calculateBackoff(retryCount: number): number {
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * BASE_RETRY_DELAY_MS * 0.5;
    return Math.min(delay + jitter, MAX_RETRY_DELAY_MS);
  }

  private emitEvent<E extends keyof SchedulerEvents>(
    event: E,
    payload: SchedulerEvents[E],
  ): void {
    this.eventBus.emit(event as string, payload);
  }
}

export const publishScheduler = TaskScheduler.getInstance();
