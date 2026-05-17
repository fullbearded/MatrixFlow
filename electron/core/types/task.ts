// ============================================================
// Task Scheduling Types — MatrixFlow 任务调度层类型定义
// ============================================================

/** 任务类型 */
export type TaskType = 'upload' | 'publish' | 'stats' | 'comment';

/** 任务状态 */
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retry';

/** 任务优先级（数值越大优先级越高） */
export const enum TaskPriority {
  Low = 0,
  Normal = 5,
  High = 10,
  Critical = 20,
}

/** 调度策略 */
export type ScheduleStrategy = 'immediate' | 'delayed' | 'periodic';

// ============================================================
// 核心接口
// ============================================================

export interface ITask {
  id: string;
  type: TaskType;
  platform: string;
  accountId: string;
  priority: number;
  payload: unknown;
  status: TaskStatus;
  createdAt: string;   // ISO 8601
  scheduledAt?: string; // ISO 8601 — 定时执行时间
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/** 创建任务时的输入（不含自动生成的字段） */
export interface TaskInput {
  type: TaskType;
  platform: string;
  accountId: string;
  priority?: number;
  payload: unknown;
  maxRetries?: number;
  scheduledAt?: string;
}

/** 周期性任务定义 */
export interface IPeriodicTask {
  id: string;
  taskInput: TaskInput;
  intervalMs: number;
  nextRunAt: string;
  enabled: boolean;
}

// ============================================================
// 调度器接口
// ============================================================

export interface ITaskScheduler {
  schedule(task: ITask): void;
  scheduleAt(task: ITask, time: Date): void;
  schedulePeriodic(taskInput: TaskInput, intervalMs: number): string;
  cancel(taskId: string): boolean;
  getPendingTasks(): ITask[];
  start(): void;
  stop(): void;
  onTaskExecute: ((task: ITask) => Promise<ITaskResult>) | null;
}

export interface ITaskResult {
  success: boolean;
  error?: string;
}

// ============================================================
// 队列管理器接口
// ============================================================

export interface IQueueManager {
  enqueue(task: ITask): void;
  dequeue(): ITask | undefined;
  peek(): ITask | undefined;
  updateStatus(taskId: string, status: TaskStatus, error?: string): void;
  getByStatus(status: TaskStatus): ITask[];
  getByPlatform(platform: string): ITask[];
  size(): number;
  persist(): Promise<void>;
  restore(): Promise<void>;
  clear(): void;
}

// ============================================================
// 速率限制器接口
// ============================================================

export interface RateLimitRule {
  maxConcurrent: number;
  windowMs: number;
  maxRequestsPerWindow: number;
}

export interface IRateLimiter {
  /** 获取执行许可，返回 true 表示获得许可 */
  acquire(key: string): Promise<boolean>;
  /** 释放执行许可 */
  release(key: string): void;
  /** 获取需要等待的毫秒数 */
  getWaitTime(key: string): number;
  /** 为指定 key 设置限速规则 */
  setRule(key: string, rule: Partial<RateLimitRule>): void;
  /** 获取当前并发数 */
  getActiveCount(key: string): number;
}

// ============================================================
// 事件常量
// ============================================================

export const TaskEvents = {
  TASK_CREATED: 'task:created',
  TASK_QUEUED: 'task:queued',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_RETRY: 'task:retry',
  TASK_CANCELLED: 'task:cancelled',
  SCHEDULER_STARTED: 'scheduler:started',
  SCHEDULER_STOPPED: 'scheduler:stopped',
  QUEUE_PERSISTED: 'queue:persisted',
  QUEUE_RESTORED: 'queue:restored',
  RATE_LIMITED: 'rate:limited',
} as const;

export type TaskEventName = typeof TaskEvents[keyof typeof TaskEvents];
