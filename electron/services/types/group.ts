/**
 * 分组管理服务类型定义
 *
 * 涵盖分组实体、发布规则、统计、事件及服务接口。
 * 数据库表：groups、group_publish_rules、accounts（group_id 列）
 */

import type { Account } from './account';

// ─── 分组实体 ───────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  description?: string;
  color: string;
  /** 关联的账号数量（查询时聚合） */
  accountCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── 数据库行映射 ────────────────────────────────────────────

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── 发布规则 ────────────────────────────────────────────────

export type PublishMode = 'server' | 'client';

export interface ScheduledTime {
  /** 开始时间 "HH:mm" 格式 */
  start: string;
  /** 结束时间 "HH:mm" 格式 */
  end: string;
}

export interface PlatformPublishSettings {
  title?: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'private' | 'followers';
}

export interface PublishRule {
  groupId: string;
  publishMode: PublishMode;
  scheduledTime?: ScheduledTime;
  /** 发布间隔（分钟） */
  interval: number;
  platforms: string[];
  settings: Record<string, PlatformPublishSettings>;
}

// ─── 发布规则行映射 ──────────────────────────────────────────

export interface PublishRuleRow {
  id: string;
  group_id: string;
  platform: string;
  publish_interval_min: number;
  daily_limit: number;
  time_slots: string;
  publish_mode: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

// ─── 分组统计 ────────────────────────────────────────────────

export interface GroupStats {
  totalAccounts: number;
  activeAccounts: number;
  publishedToday: number;
  publishedThisWeek: number;
}

// ─── 事件名 ──────────────────────────────────────────────────

export enum GroupEvent {
  /** 分组创建 */
  GROUP_CREATED = 'group:created',
  /** 分组更新 */
  GROUP_UPDATED = 'group:updated',
  /** 分组删除 */
  GROUP_DELETED = 'group:deleted',
  /** 账号加入分组 */
  ACCOUNTS_ADDED = 'group:accounts-added',
  /** 账号移出分组 */
  ACCOUNTS_REMOVED = 'group:accounts-removed',
  /** 发布规则设置 */
  PUBLISH_RULE_SET = 'group:publish-rule-set',
}

// ─── 事件载荷 ────────────────────────────────────────────────

export interface GroupCreatedPayload {
  groupId: string;
  name: string;
}

export interface GroupUpdatedPayload {
  groupId: string;
  changes: Partial<Group>;
}

export interface GroupDeletedPayload {
  groupId: string;
}

export interface AccountsAddedPayload {
  groupId: string;
  accountIds: string[];
}

export interface AccountsRemovedPayload {
  groupId: string;
  accountIds: string[];
}

export interface PublishRuleSetPayload {
  groupId: string;
  publishMode: PublishMode;
}

// ─── 服务接口 ────────────────────────────────────────────────

export interface IGroupService {
  // 分组 CRUD
  createGroup(name: string, description?: string, color?: string): Promise<Group>;
  updateGroup(groupId: string, data: Partial<Group>): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  getGroup(groupId: string): Promise<Group | null>;
  getAllGroups(): Promise<Group[]>;

  // 账号绑定
  addAccountsToGroup(groupId: string, accountIds: string[]): Promise<void>;
  removeAccountsFromGroup(groupId: string, accountIds: string[]): Promise<void>;
  getGroupAccounts(groupId: string): Promise<Account[]>;

  // 发布规则
  setPublishRule(groupId: string, rule: PublishRule): Promise<void>;
  getPublishRule(groupId: string): Promise<PublishRule | null>;

  // 统计
  getGroupStats(groupId: string): Promise<GroupStats>;
}
