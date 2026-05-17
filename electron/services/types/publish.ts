/**
 * 发布管理服务类型定义
 *
 * 涵盖双路径发布（服务端/客户端）、发布任务、状态追踪、规则应用及事件。
 */

import type { PublishResult as PlatformPublishResult } from '../../platform/base/types';
import type { PublishTask as DbPublishTask, TaskItem } from '../../data/types';

// ─── 发布模式 ────────────────────────────────────────────────

export type PublishMode = 'server' | 'client';

// ─── 发布任务状态 ──────────────────────────────────────────────

export type PublishTaskStatus =
  | 'pending'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ─── 发布可见性 ──────────────────────────────────────────────

export type PublishVisibility = 'public' | 'private' | 'followers';

// ─── 发布请求 ────────────────────────────────────────────────

export interface PublishRequest {
  contentId: string;
  platform: string;
  accountId: string;
  scheduledAt?: Date;
  publishMode: PublishMode;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    visibility?: PublishVisibility;
  };
}

export interface BatchPublishRequest {
  contentId: string;
  groupIds: string[];
  scheduledAt?: Date;
  publishMode: PublishMode;
}

// ─── 发布任务 ────────────────────────────────────────────────

export interface PublishTask {
  id: string;
  contentId: string;
  platform: string;
  accountId: string;
  scheduledAt?: Date;
  publishMode: PublishMode;
  status: PublishTaskStatus;
  result?: PublishResult;
  retryCount: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── 发布结果 ────────────────────────────────────────────────

export interface PublishResult {
  success: boolean;
  videoId?: string;
  publishUrl?: string;
  error?: string;
  publishedAt?: Date;
}

// ─── 发布任务状态（含子项进度） ────────────────────────────────

export interface PublishTaskStatusDetail {
  taskId: string;
  status: PublishTaskStatus;
  publishMode: PublishMode;
  scheduledAt?: Date;
  result?: PublishResult;
  items: PublishTaskItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishTaskItem {
  itemId: string;
  accountId: string;
  platform: string;
  status: string;
  videoId?: string;
  publishUrl?: string;
  error?: string;
}

// ─── 事件名 ──────────────────────────────────────────────────

export enum PublishEvent {
  TASK_CREATED = 'publish:task-created',
  TASK_SCHEDULED = 'publish:task-scheduled',
  TASK_STARTED = 'publish:task-started',
  TASK_UPDATED = 'publish:task-updated',
  TASK_COMPLETED = 'publish:task-completed',
  TASK_FAILED = 'publish:task-failed',
  TASK_CANCELLED = 'publish:task-cancelled',
  /** 子项开始 */
  ITEM_STARTED = 'publish:item-started',
  /** 子项完成 */
  ITEM_COMPLETED = 'publish:item-completed',
  /** 子项失败 */
  ITEM_FAILED = 'publish:item-failed',
  /** 规则已应用 */
  RULES_APPLIED = 'publish:rules-applied',
}

// ─── 事件载荷 ────────────────────────────────────────────────

export interface TaskCreatedPayload {
  taskId: string;
  contentId: string;
  platform: string;
  accountId: string;
  publishMode: PublishMode;
}

export interface TaskScheduledPayload {
  taskId: string;
  scheduledAt: Date;
}

export interface TaskStartedPayload {
  taskId: string;
  publishMode: PublishMode;
}

export interface TaskCompletedPayload {
  taskId: string;
  result: PublishResult;
}

export interface TaskFailedPayload {
  taskId: string;
  error: string;
  retryCount: number;
  maxRetries: number;
}

export interface TaskCancelledPayload {
  taskId: string;
}

export interface ItemStartedPayload {
  taskId: string;
  itemId: string;
  accountId: string;
  platform: string;
}

export interface ItemCompletedPayload {
  taskId: string;
  itemId: string;
  videoId?: string;
  publishUrl?: string;
}

export interface ItemFailedPayload {
  taskId: string;
  itemId: string;
  error: string;
}

export interface RulesAppliedPayload {
  taskId: string;
  groupId: string;
  rulesCount: number;
}

// ─── 服务接口 ────────────────────────────────────────────────

export interface IPublishService {
  // 发布任务创建
  createPublishTask(request: PublishRequest): Promise<PublishTask>;
  createBatchPublishTask(request: BatchPublishRequest): Promise<PublishTask[]>;

  // 发布调度
  schedulePublish(taskId: string, scheduledAt: Date): Promise<void>;
  executeNow(taskId: string): Promise<PublishResult>;
  cancelPublish(taskId: string): Promise<void>;

  // 双路径发布
  publishToServer(taskId: string): Promise<PublishResult>;
  publishFromClient(taskId: string): Promise<PublishResult>;

  // 状态追踪
  getTaskStatus(taskId: string): Promise<PublishTaskStatusDetail>;
  getAccountTasks(accountId: string): Promise<PublishTask[]>;
  getContentTasks(contentId: string): Promise<PublishTask[]>;

  // 发布规则应用
  applyGroupRules(taskId: string, groupId: string): Promise<void>;
}
