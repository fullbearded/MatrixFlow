import * as crypto from 'crypto';
import { Logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { getDatabase, isDatabaseAvailable } from '../data/Database';
import type { Account, AccountRow } from './types/account';
import type {
  Group,
  GroupRow,
  GroupStats,
  IGroupService,
  PlatformPublishSettings,
  PublishMode,
  PublishRule,
  PublishRuleRow,
  GroupCreatedPayload,
  GroupUpdatedPayload,
  GroupDeletedPayload,
  AccountsAddedPayload,
  AccountsRemovedPayload,
  PublishRuleSetPayload,
} from './types/group';
import { GroupEvent } from './types/group';

const logger = new Logger('GroupService');

const DEFAULT_COLOR = '#409EFF';

function generateId(): string {
  return `grp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export class GroupService implements IGroupService {
  private static instance: GroupService;
  private initialized = false;

  private constructor() {}

  static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  initialize(): void {
    if (this.initialized) return;
    this.ensureSchema();
    this.initialized = true;
    logger.info('分组管理服务初始化完成');
  }

  dispose(): void {
    this.initialized = false;
    logger.info('分组管理服务已释放');
  }

  // ─── 分组 CRUD ──────────────────────────────────────────

  async createGroup(name: string, description?: string, color?: string): Promise<Group> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const id = generateId();
    const now = nowISO();

    db.prepare(
      `INSERT INTO groups (id, name, description, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(id, name, description ?? '', color ?? DEFAULT_COLOR, now, now);

    const group = await this.getGroup(id);

    const payload: GroupCreatedPayload = { groupId: id, name };
    EventBus.getInstance().emit(GroupEvent.GROUP_CREATED, payload);

    logger.info(`分组已创建: id=${id}, name=${name}`);
    return group!;
  }

  async updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const existing = await this.getGroup(groupId);
    if (!existing) {
      throw new Error(`分组不存在: ${groupId}`);
    }

    const sets: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      sets.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      sets.push('description = ?');
      values.push(data.description);
    }
    if (data.color !== undefined) {
      sets.push('color = ?');
      values.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      sets.push('sort_order = ?');
      values.push(data.sortOrder);
    }

    if (sets.length === 0) {
      logger.warn(`更新分组无变更: groupId=${groupId}`);
      return;
    }

    sets.push('updated_at = ?');
    values.push(nowISO());
    values.push(groupId);

    db.prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    const payload: GroupUpdatedPayload = { groupId, changes: data };
    EventBus.getInstance().emit(GroupEvent.GROUP_UPDATED, payload);

    logger.info(`分组已更新: groupId=${groupId}, fields=${sets.filter(s => !s.startsWith('updated_at')).map(s => s.split(' = ')[0]).join(',')}`);
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const existing = await this.getGroup(groupId);
    if (!existing) {
      throw new Error(`分组不存在: ${groupId}`);
    }

    if (existing.accountCount > 0) {
      throw new Error(
        `分组 "${existing.name}" 下还有 ${existing.accountCount} 个账号，请先解绑所有账号后再删除`
      );
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM group_publish_rules WHERE group_id = ?').run(groupId);
      db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
    });

    transaction();

    const payload: GroupDeletedPayload = { groupId };
    EventBus.getInstance().emit(GroupEvent.GROUP_DELETED, payload);

    logger.info(`分组已删除: groupId=${groupId}, name=${existing.name}`);
  }

  async getGroup(groupId: string): Promise<Group | null> {
    const db = this.requireDatabase();

    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as
      | GroupRow
      | undefined;

    if (!row) return null;

    const accountCount = this.countAccountsInGroup(groupId);
    return this.rowToGroup(row, accountCount);
  }

  async getAllGroups(): Promise<Group[]> {
    const db = this.requireDatabase();

    const rows = db.prepare('SELECT * FROM groups ORDER BY sort_order ASC, created_at ASC').all() as GroupRow[];

    return rows.map((row) => {
      const accountCount = this.countAccountsInGroup(row.id);
      return this.rowToGroup(row, accountCount);
    });
  }

  // ─── 账号绑定 ──────────────────────────────────────────

  async addAccountsToGroup(groupId: string, accountIds: string[]): Promise<void> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const existing = await this.getGroup(groupId);
    if (!existing) {
      throw new Error(`分组不存在: ${groupId}`);
    }

    if (accountIds.length === 0) {
      logger.warn(`添加账号到分组：accountIds 为空, groupId=${groupId}`);
      return;
    }

    const now = nowISO();
    const stmt = db.prepare('UPDATE accounts SET group_id = ?, updated_at = ? WHERE id = ?');

    const transaction = db.transaction(() => {
      for (const accountId of accountIds) {
        stmt.run(groupId, now, accountId);
      }
    });

    transaction();

    const payload: AccountsAddedPayload = { groupId, accountIds };
    EventBus.getInstance().emit(GroupEvent.ACCOUNTS_ADDED, payload);

    for (const accountId of accountIds) {
      EventBus.getInstance().emit('account:group-changed', {
        accountId,
        newGroupId: groupId,
      });
    }

    logger.info(`账号已加入分组: groupId=${groupId}, count=${accountIds.length}`);
  }

  async removeAccountsFromGroup(groupId: string, accountIds: string[]): Promise<void> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const existing = await this.getGroup(groupId);
    if (!existing) {
      throw new Error(`分组不存在: ${groupId}`);
    }

    if (accountIds.length === 0) {
      logger.warn(`从分组移除账号：accountIds 为空, groupId=${groupId}`);
      return;
    }

    const now = nowISO();
    const stmt = db.prepare('UPDATE accounts SET group_id = NULL, updated_at = ? WHERE id = ? AND group_id = ?');

    const transaction = db.transaction(() => {
      for (const accountId of accountIds) {
        stmt.run(now, accountId, groupId);
      }
    });

    transaction();

    const payload: AccountsRemovedPayload = { groupId, accountIds };
    EventBus.getInstance().emit(GroupEvent.ACCOUNTS_REMOVED, payload);

    for (const accountId of accountIds) {
      EventBus.getInstance().emit('account:group-changed', {
        accountId,
        oldGroupId: groupId,
        newGroupId: undefined,
      });
    }

    logger.info(`账号已移出分组: groupId=${groupId}, count=${accountIds.length}`);
  }

  async getGroupAccounts(groupId: string): Promise<Account[]> {
    const db = this.requireDatabase();

    const rows = db.prepare(
      'SELECT * FROM accounts WHERE group_id = ? ORDER BY created_at DESC'
    ).all(groupId) as AccountRow[];

    return rows.map((row) => this.rowToAccount(row));
  }

  // ─── 发布规则 ──────────────────────────────────────────

  async setPublishRule(groupId: string, rule: PublishRule): Promise<void> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const existing = await this.getGroup(groupId);
    if (!existing) {
      throw new Error(`分组不存在: ${groupId}`);
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM group_publish_rules WHERE group_id = ?').run(groupId);

      const insertStmt = db.prepare(
        `INSERT INTO group_publish_rules (id, group_id, platform, publish_interval_min, daily_limit, time_slots, publish_mode, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      );

      const now = nowISO();

      for (const platform of rule.platforms) {
        const ruleId = `rule_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const platformSettings = rule.settings[platform];
        const timeSlots = rule.scheduledTime ? [rule.scheduledTime] : [];

        insertStmt.run(
          ruleId,
          groupId,
          platform,
          rule.interval,
          0,
          JSON.stringify(timeSlots),
          rule.publishMode,
          now,
          now
        );
      }
    });

    transaction();

    const payload: PublishRuleSetPayload = { groupId, publishMode: rule.publishMode };
    EventBus.getInstance().emit(GroupEvent.PUBLISH_RULE_SET, payload);

    logger.info(
      `发布规则已设置: groupId=${groupId}, platforms=${rule.platforms.join(',')}, mode=${rule.publishMode}`
    );
  }

  async getPublishRule(groupId: string): Promise<PublishRule | null> {
    const db = this.requireDatabase();

    const rows = db.prepare(
      'SELECT * FROM group_publish_rules WHERE group_id = ? AND enabled = 1'
    ).all(groupId) as PublishRuleRow[];

    if (rows.length === 0) return null;

    const platforms: string[] = [];
    const settings: Record<string, PlatformPublishSettings> = {};
    let publishMode: PublishMode = 'client';
    let interval = 30;
    let scheduledTime: { start: string; end: string } | undefined;

    for (const row of rows) {
      platforms.push(row.platform);
      publishMode = row.publish_mode as PublishMode;
      interval = row.publish_interval_min;

      const timeSlots = JSON.parse(row.time_slots || '[]') as Array<{ start: string; end: string }>;
      if (timeSlots.length > 0 && !scheduledTime) {
        scheduledTime = timeSlots[0];
      }

      settings[row.platform] = {};
    }

    return {
      groupId,
      publishMode,
      scheduledTime,
      interval,
      platforms,
      settings,
    };
  }

  // ─── 统计 ──────────────────────────────────────────────

  async getGroupStats(groupId: string): Promise<GroupStats> {
    this.ensureInitialized();
    const db = this.requireDatabase();

    const existing = await this.getGroup(groupId);
    if (!existing) {
      throw new Error(`分组不存在: ${groupId}`);
    }

    const totalAccounts = this.countAccountsInGroup(groupId);

    const activeRow = db.prepare(
      "SELECT COUNT(*) as cnt FROM accounts WHERE group_id = ? AND status = 'active'"
    ).get(groupId) as { cnt: number };

    const today = new Date().toISOString().slice(0, 10);
    const todayRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM task_items ti
       JOIN publish_tasks pt ON ti.task_id = pt.id
       WHERE pt.group_id = ? AND ti.status = 'completed' AND DATE(ti.completed_at) = ?`
    ).get(groupId, today) as { cnt: number };

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM task_items ti
       JOIN publish_tasks pt ON ti.task_id = pt.id
       WHERE pt.group_id = ? AND ti.status = 'completed' AND ti.completed_at >= ?`
    ).get(groupId, weekAgo) as { cnt: number };

    return {
      totalAccounts,
      activeAccounts: activeRow.cnt,
      publishedToday: todayRow.cnt,
      publishedThisWeek: weekRow.cnt,
    };
  }

  // ─── 内部方法 ──────────────────────────────────────────

  private ensureSchema(): void {
    if (!isDatabaseAvailable()) {
      logger.warn('数据库不可用，跳过 schema 初始化');
      return;
    }

    const db = getDatabase();

    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT '${DEFAULT_COLOR}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS group_publish_rules (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        publish_interval_min INTEGER NOT NULL DEFAULT 30,
        daily_limit INTEGER NOT NULL DEFAULT 10,
        time_slots TEXT DEFAULT '[]',
        publish_mode TEXT NOT NULL DEFAULT 'client',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_groups_sort_order ON groups(sort_order);
      CREATE INDEX IF NOT EXISTS idx_gpr_group_id ON group_publish_rules(group_id);
      CREATE INDEX IF NOT EXISTS idx_gpr_platform ON group_publish_rules(platform);
    `);

    logger.info('分组表 schema 已就绪');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  private requireDatabase(): any {
    if (!isDatabaseAvailable()) {
      throw new Error('数据库不可用');
    }
    return getDatabase();
  }

  private countAccountsInGroup(groupId: string): number {
    const db = this.requireDatabase();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM accounts WHERE group_id = ?').get(groupId) as
      | { cnt: number }
      | undefined;
    return row?.cnt ?? 0;
  }

  private rowToGroup(row: GroupRow, accountCount: number): Group {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      color: row.color || DEFAULT_COLOR,
      accountCount,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToAccount(row: AccountRow): Account {
    return {
      id: row.id,
      platform: row.platform,
      name: row.name,
      avatar: row.avatar ?? undefined,
      cookieEncrypted: row.cookie_encrypted,
      cookieValid: row.cookie_valid === 1,
      lastCookieCheck: row.last_cookie_check ? new Date(row.last_cookie_check) : undefined,
      groupId: row.group_id ?? undefined,
      status: row.status as Account['status'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const groupService = GroupService.getInstance();
