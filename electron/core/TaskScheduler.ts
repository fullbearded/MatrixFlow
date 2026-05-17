import { Logger } from './Logger';
import { EventBus } from './EventBus';
import { QueueManager, generateId } from './QueueManager';
import { RateLimiter } from './RateLimiter';
import { TaskEvents } from './types/task';
import type {
  ITaskScheduler,
  ITask,
  ITaskResult,
  TaskInput,
  IPeriodicTask,
} from './types/task';

const logger = new Logger('TaskScheduler');

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_BACKOFF_MS = 300_000;

export class TaskScheduler implements ITaskScheduler {
  private static instance: TaskScheduler;

  private queue: QueueManager;
  private rateLimiter: RateLimiter;
  private eventBus: EventBus;

  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private periodicTasks = new Map<string, IPeriodicTask>();
  private periodicTimers = new Map<string, ReturnType<typeof setInterval>>();

  private inFlight = new Set<string>();

  onTaskExecute: ((task: ITask) => Promise<ITaskResult>) | null = null;

  private pollIntervalMs: number;

  private constructor(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
    this.queue = QueueManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.eventBus = EventBus.getInstance();
    this.pollIntervalMs = pollIntervalMs;
  }

  static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  schedule(task: ITask): void {
    const now = new Date();
    const enriched: ITask = {
      ...task,
      id: task.id || generateId(),
      status: 'queued',
      createdAt: task.createdAt || now.toISOString(),
      scheduledAt: now.toISOString(),
      retryCount: task.retryCount ?? 0,
      maxRetries: task.maxRetries ?? 3,
    };

    this.queue.enqueue(enriched);
    this.eventBus.emit(TaskEvents.TASK_CREATED, enriched);
    logger.info(`任务已调度（立即）: ${enriched.id} type=${enriched.type}`);
  }

  scheduleAt(task: ITask, time: Date): void {
    const enriched: ITask = {
      ...task,
      id: task.id || generateId(),
      status: 'pending',
      createdAt: task.createdAt || new Date().toISOString(),
      scheduledAt: time.toISOString(),
      retryCount: task.retryCount ?? 0,
      maxRetries: task.maxRetries ?? 3,
    };

    const delay = time.getTime() - Date.now();
    if (delay <= 0) {
      this.schedule(enriched);
      return;
    }

    this.queue.enqueue(enriched);
    this.eventBus.emit(TaskEvents.TASK_CREATED, enriched);

    const timer = setTimeout(() => {
      this.scheduledTimers.delete(enriched.id);
      this.queue.updateStatus(enriched.id, 'queued');
      logger.info(`定时任务到期: ${enriched.id}`);
    }, delay);
    this.scheduledTimers.set(enriched.id, timer);
    logger.info(`任务已调度（定时）: ${enriched.id} 执行时间=${time.toISOString()}`);
  }

  schedulePeriodic(taskInput: TaskInput, intervalMs: number): string {
    const id = `periodic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const periodic: IPeriodicTask = {
      id,
      taskInput,
      intervalMs,
      nextRunAt: new Date().toISOString(),
      enabled: true,
    };

    this.periodicTasks.set(id, periodic);

    const timer = setInterval(() => {
      if (!periodic.enabled || !this.running) return;

      const task = this.buildTaskFromInput(taskInput);
      this.schedule(task);
      periodic.nextRunAt = new Date(Date.now() + intervalMs).toISOString();

      logger.info(`周期任务触发: ${id} next=${periodic.nextRunAt}`);
    }, intervalMs);

    this.periodicTimers.set(id, timer);

    logger.info(`周期任务已注册: ${id} interval=${intervalMs}ms`);
    return id;
  }

  cancel(taskId: string): boolean {
    const task = this.getTaskFromMap(taskId);
    if (!task) {
      logger.warn(`取消失败，任务不存在: ${taskId}`);
      return false;
    }

    if (task.status === 'running' || this.inFlight.has(taskId)) {
      logger.warn(`取消失败，任务正在执行: ${taskId}`);
      return false;
    }

    const timer = this.scheduledTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.scheduledTimers.delete(taskId);
    }

    this.queue.updateStatus(taskId, 'cancelled');
    logger.info(`任务已取消: ${taskId}`);
    return true;
  }

  cancelPeriodic(periodicId: string): void {
    const timer = this.periodicTimers.get(periodicId);
    if (timer) {
      clearInterval(timer);
      this.periodicTimers.delete(periodicId);
    }

    const periodic = this.periodicTasks.get(periodicId);
    if (periodic) {
      periodic.enabled = false;
    }

    this.periodicTasks.delete(periodicId);
    logger.info(`周期任务已取消: ${periodicId}`);
  }

  getPendingTasks(): ITask[] {
    return this.queue.getByStatus('queued')
      .concat(this.queue.getByStatus('pending'))
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return (a.scheduledAt || a.createdAt).localeCompare(b.scheduledAt || b.createdAt);
      });
  }

  getTask(taskId: string): ITask | undefined {
    return this.getTaskFromMap(taskId);
  }

  start(): void {
    if (this.running) return;

    this.running = true;

    this.queue.restore()
      .then(() => {
        this.queue.startAutoPersist();
        this.startPolling();
        this.eventBus.emit(TaskEvents.SCHEDULER_STARTED);
        logger.info('任务调度器已启动');
      })
      .catch((err) => {
        logger.error('调度器启动失败（恢复阶段）:', err);
        this.queue.startAutoPersist();
        this.startPolling();
      });
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;

    this.stopPolling();

    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();

    for (const timer of this.periodicTimers.values()) {
      clearInterval(timer);
    }
    this.periodicTimers.clear();

    this.queue.stopAutoPersist();
    this.queue.persist().catch((err) => logger.error('停止时持久化失败:', err));

    this.eventBus.emit(TaskEvents.SCHEDULER_STOPPED);
    logger.info('任务调度器已停止');
  }

  getStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    periodicCount: number;
  } {
    return {
      pending: this.queue.getByStatus('queued').length + this.queue.getByStatus('pending').length,
      running: this.inFlight.size,
      completed: this.queue.getByStatus('completed').length,
      failed: this.queue.getByStatus('failed').length,
      periodicCount: this.periodicTasks.size,
    };
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(() => {
      this.tick().catch((err) => logger.error('轮询执行错误:', err));
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.running || !this.onTaskExecute) return;

    const task = this.queue.peek();
    if (!task) return;

    if (task.scheduledAt) {
      const scheduledTime = new Date(task.scheduledAt).getTime();
      if (Date.now() < scheduledTime) return;
    }

    const rateLimitKey = `${task.platform}:${task.accountId}`;
    const acquired = await this.rateLimiter.acquire(rateLimitKey);
    if (!acquired) {
      const wait = this.rateLimiter.getWaitTime(rateLimitKey);
      logger.debug(`速率限制，等待 ${wait}ms: ${rateLimitKey}`);
      return;
    }

    const dequeuedTask = this.queue.dequeue();
    if (!dequeuedTask) {
      this.rateLimiter.release(rateLimitKey);
      return;
    }

    this.inFlight.add(dequeuedTask.id);

    try {
      const result = await this.onTaskExecute(dequeuedTask);

      if (result.success) {
        this.queue.updateStatus(dequeuedTask.id, 'completed');
        logger.info(`任务完成: ${dequeuedTask.id}`);
      } else {
        await this.handleFailure(dequeuedTask, result.error || '未知错误');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.handleFailure(dequeuedTask, errMsg);
    } finally {
      this.inFlight.delete(dequeuedTask.id);
      this.rateLimiter.release(rateLimitKey);
    }
  }

  private async handleFailure(task: ITask, error: string): Promise<void> {
    const updated = this.getTaskFromMap(task.id);
    const currentRetry = updated?.retryCount ?? task.retryCount;

    if (currentRetry < task.maxRetries) {
      const nextRetry = currentRetry + 1;
      const backoff = Math.min(DEFAULT_RETRY_DELAY_MS * Math.pow(2, currentRetry), MAX_RETRY_BACKOFF_MS);

      this.queue.updateStatus(task.id, 'retry', `重试 ${nextRetry}/${task.maxRetries}: ${error}`);

      const retryTask = this.getTaskFromMap(task.id);
      if (retryTask) {
        retryTask.retryCount = nextRetry;
        retryTask.status = 'queued';
        retryTask.error = undefined;
      }

      logger.info(`任务重试: ${task.id} 第${nextRetry}次 延迟=${backoff}ms 原因=${error}`);
    } else {
      this.queue.updateStatus(task.id, 'failed', `已达最大重试次数(${task.maxRetries}): ${error}`);
      logger.error(`任务最终失败: ${task.id} 重试${currentRetry}次 原因=${error}`);
    }
  }

  private getTaskFromMap(taskId: string): ITask | undefined {
    const allQueued = this.queue.getByStatus('queued');
    const allPending = this.queue.getByStatus('pending');
    const allRunning = this.queue.getByStatus('running');
    const allRetry = this.queue.getByStatus('retry');
    const allCompleted = this.queue.getByStatus('completed');
    const allFailed = this.queue.getByStatus('failed');

    return [...allQueued, ...allPending, ...allRunning, ...allRetry, ...allCompleted, ...allFailed]
      .find((t) => t.id === taskId);
  }

  private buildTaskFromInput(input: TaskInput): ITask {
    return {
      id: generateId(),
      type: input.type,
      platform: input.platform,
      accountId: input.accountId,
      priority: input.priority ?? 5,
      payload: input.payload,
      status: 'queued',
      createdAt: new Date().toISOString(),
      scheduledAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: input.maxRetries ?? 3,
    };
  }
}

export const taskScheduler = TaskScheduler.getInstance();
