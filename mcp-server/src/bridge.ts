/**
 * IPC Bridge — 连接 MCP Server 与 Electron 主进程
 *
 * 两种模式：
 * 1. Electron 内嵌模式：通过 ipcMain/ipcRenderer 转发到主进程服务
 * 2. 独立模式（fallback）：直接操作 SQLite 数据库，不依赖 Electron
 *
 * 默认使用独立模式。当检测到 Electron 环境时自动切换到 IPC 模式。
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

// ─── Bridge 接口 ──────────────────────────────────────────────

export interface BridgeResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export type IpcChannel = string;

/**
 * IPC Bridge 核心抽象
 */
export interface IBridge {
  invoke<T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<BridgeResult<T>>;
  isAvailable(): boolean;
}

// ─── 独立模式 Bridge（直接操作 SQLite） ─────────────────────────

function resolveDataDir(): string {
  // 优先使用项目 data 目录
  const projectData = path.resolve(process.cwd(), 'data');
  if (fs.existsSync(path.join(projectData, 'matrixflow.db'))) {
    return projectData;
  }

  // 回退到用户数据目录
  const userDataDir = path.join(os.homedir(), '.matrixflow', 'data');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return userDataDir;
}

function findDatabase(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'data', 'matrixflow.db'),
    path.join(os.homedir(), '.matrixflow', 'data', 'matrixflow.db'),
  ];

  // 从 MATRIXFLOW_DB 环境变量
  if (process.env.MATRIXFLOW_DB && fs.existsSync(process.env.MATRIXFLOW_DB)) {
    return process.env.MATRIXFLOW_DB;
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

class StandaloneBridge implements IBridge {
  private db: Database.Database | null = null;

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    const dbPath = findDatabase();

    if (dbPath) {
      try {
        this.db = new Database(dbPath, { readonly: false });
        this.db.pragma('journal_mode = WAL');
        this.ensureSchema();
        console.error(`[Bridge] 数据库已连接: ${dbPath}`);
      } catch (err) {
        console.error(`[Bridge] 数据库连接失败: ${err}`);
        this.db = null;
      }
    } else {
      // 创建新的数据库
      const dataDir = resolveDataDir();
      const newPath = path.join(dataDir, 'matrixflow.db');
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        this.db = new Database(newPath);
        this.db.pragma('journal_mode = WAL');
        this.ensureSchema();
        console.error(`[Bridge] 新数据库已创建: ${newPath}`);
      } catch (err) {
        console.error(`[Bridge] 创建数据库失败: ${err}`);
      }
    }
  }

  private ensureSchema(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar TEXT,
        cookie_encrypted TEXT NOT NULL DEFAULT '',
        cookie_valid INTEGER NOT NULL DEFAULT 0,
        last_cookie_check TEXT,
        group_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'video',
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        duration REAL,
        size INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        file_hash TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS publish_tasks (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        group_id TEXT,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        proxy_id TEXT,
        fingerprint_id TEXT,
        scheduled_at TEXT,
        publish_mode TEXT NOT NULL DEFAULT 'client',
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_items (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        platform_video_id TEXT,
        publish_url TEXT,
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS video_stats (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_video_id TEXT NOT NULL,
        play_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        collect_count INTEGER DEFAULT 0,
        fetch_time TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS platform_configs (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
      CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
      CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_id);
      CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status);
      CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id);
      CREATE INDEX IF NOT EXISTS idx_video_stats_platform ON video_stats(platform);
    `);
  }

  isAvailable(): boolean {
    return this.db !== null;
  }

  async invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<BridgeResult<T>> {
    if (!this.db) {
      return { success: false, message: '数据库不可用' };
    }

    try {
      const data = await this.route<T>(channel, args);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }

  // ─── 路由：将 IPC 频道映射到数据库操作 ──────────────────────

  private async route<T>(channel: string, args: unknown[]): Promise<T> {
    switch (channel) {
      // ─── 账号管理 ────────────────────────────────────────
      case 'account:list':
        return this.accountList() as T;

      case 'account:add':
        return this.accountAdd(args[0] as { platform: string; groupId?: string }) as T;

      case 'account:remove':
        return this.accountRemove(args[0] as string) as unknown as T;

      case 'account:validate':
        return this.accountValidate(args[0] as string) as T;

      case 'account:status':
        return this.accountStatus(args[0] as string) as T;

      // ─── 内容管理 ────────────────────────────────────────
      case 'content:list':
        return this.contentList() as T;

      case 'content:create':
        return this.contentCreate(args[0] as { filePath: string }) as T;

      case 'content:delete':
        return this.contentDelete(args[0] as string) as unknown as T;

      case 'content:update':
        return this.contentUpdate(args[0] as string, args[1] as Record<string, unknown>) as T;

      case 'content:search':
        return this.contentSearch(args[0] as string) as T;

      case 'content:tags':
        return this.contentTags(args[0] as string, args[1] as string[]) as T;

      // ─── 发布管理 ────────────────────────────────────────
      case 'publish:createTask':
        return this.publishCreateTask(args[0] as Record<string, unknown>) as T;

      case 'publish:listTasks':
        return this.publishListTasks(args[0] as { contentId?: string } | undefined) as T;

      case 'publish:cancelTask':
        return this.publishCancelTask(args[0] as string) as unknown as T;

      case 'publish:status':
        return this.publishStatus(args[0] as string) as T;

      case 'publish:schedule':
        return this.publishSchedule(args[0] as string, args[1] as string) as unknown as T;

      case 'publish:batch':
        return this.publishBatch(args[0] as Record<string, unknown>) as T;

      // ─── 数据统计 ────────────────────────────────────────
      case 'stats:overview':
        return this.statsOverview() as T;

      case 'stats:platform':
        return this.statsPlatform(args[0] as string) as T;

      case 'stats:trend':
        return this.statsTrend(args[0] as string | undefined) as T;

      default:
        throw new Error(`未知的 IPC 频道: ${channel}`);
    }
  }

  // ─── 账号操作 ──────────────────────────────────────────────

  private accountList() {
    const rows = this.db!.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
    return rows.map((r: any) => ({
      id: r.id,
      platform: r.platform,
      name: r.name,
      avatar: r.avatar ?? undefined,
      cookieValid: r.cookie_valid === 1,
      lastCookieCheck: r.last_cookie_check ?? undefined,
      groupId: r.group_id ?? undefined,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  private accountAdd(params: { platform: string; groupId?: string }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db!.prepare(
      `INSERT INTO accounts (id, platform, name, status, cookie_encrypted, cookie_valid, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', '', 0, ?, ?)`
    ).run(id, params.platform, `账号-${id.slice(0, 8)}`, now, now);

    if (params.groupId) {
      this.db!.prepare('UPDATE accounts SET group_id = ? WHERE id = ?').run(params.groupId, id);
    }

    return this.db!.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  }

  private accountRemove(accountId: string): boolean {
    const result = this.db!.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    return result.changes > 0;
  }

  private accountValidate(accountId: string): { valid: boolean; lastCheck: string } {
    const now = new Date().toISOString();
    // 在独立模式下，仅检查数据库中记录的 cookie_valid 状态
    const row = this.db!.prepare('SELECT cookie_valid FROM accounts WHERE id = ?').get(accountId) as any;

    if (!row) throw new Error(`账号不存在: ${accountId}`);

    this.db!.prepare('UPDATE accounts SET last_cookie_check = ?, updated_at = ? WHERE id = ?')
      .run(now, now, accountId);

    return { valid: row.cookie_valid === 1, lastCheck: now };
  }

  private accountStatus(accountId: string) {
    const row = this.db!.prepare('SELECT status, cookie_valid, last_cookie_check FROM accounts WHERE id = ?').get(accountId) as any;
    if (!row) throw new Error(`账号不存在: ${accountId}`);
    return {
      status: row.status,
      cookieValid: row.cookie_valid === 1,
      lastCookieCheck: row.last_cookie_check,
    };
  }

  // ─── 内容操作 ──────────────────────────────────────────────

  private contentList() {
    const rows = this.db!.prepare('SELECT * FROM contents ORDER BY created_at DESC').all();
    return rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description ?? undefined,
      tags: JSON.parse(r.tags || '[]'),
      filePath: r.file_path,
      thumbnailPath: r.thumbnail_path ?? undefined,
      duration: r.duration ?? undefined,
      size: r.size ?? 0,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  private contentCreate(params: { filePath: string }) {
    const filePath = params.filePath;
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath, ext);

    const id = `cnt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    const type = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'].includes(ext) ? 'video' : 'image';

    this.db!.prepare(
      `INSERT INTO contents (id, type, title, file_path, size, tags, metadata, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', '{}', 'ready', ?, ?)`
    ).run(id, type, basename, filePath, stat.size, now, now);

    return this.db!.prepare('SELECT * FROM contents WHERE id = ?').get(id);
  }

  private contentDelete(contentId: string): boolean {
    const result = this.db!.prepare('DELETE FROM contents WHERE id = ?').run(contentId);
    return result.changes > 0;
  }

  private contentUpdate(contentId: string, data: Record<string, unknown>) {
    const existing = this.db!.prepare('SELECT * FROM contents WHERE id = ?').get(contentId) as any;
    if (!existing) throw new Error(`内容不存在: ${contentId}`);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }

    if (updates.length === 0) return existing;

    updates.push("updated_at = datetime('now')");
    values.push(contentId);

    this.db!.prepare(`UPDATE contents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.db!.prepare('SELECT * FROM contents WHERE id = ?').get(contentId);
  }

  private contentSearch(query: string) {
    const like = `%${query}%`;
    const rows = this.db!.prepare(
      "SELECT * FROM contents WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY created_at DESC"
    ).all(like, like, like);

    return rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description ?? undefined,
      tags: JSON.parse(r.tags || '[]'),
      filePath: r.file_path,
      size: r.size ?? 0,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  private contentTags(contentId: string, tags: string[]) {
    const existing = this.db!.prepare('SELECT * FROM contents WHERE id = ?').get(contentId) as any;
    if (!existing) throw new Error(`内容不存在: ${contentId}`);

    const now = new Date().toISOString();
    this.db!.prepare("UPDATE contents SET tags = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(tags), contentId);

    return { id: contentId, tags };
  }

  // ─── 发布操作 ──────────────────────────────────────────────

  private publishCreateTask(params: Record<string, unknown>) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const status = params.scheduledAt ? 'scheduled' : 'pending';

    this.db!.prepare(
      `INSERT INTO publish_tasks (id, content_id, platform, account_id, publish_mode, status, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      params.contentId as string ?? '',
      params.platform as string ?? 'douyin',
      params.accountId as string ?? '',
      (params.publishMode as string) ?? 'client',
      status,
      (params.scheduledAt as string) ?? null,
      now,
      now
    );

    return this.db!.prepare('SELECT * FROM publish_tasks WHERE id = ?').get(id);
  }

  private publishListTasks(filter?: { contentId?: string }) {
    if (filter?.contentId) {
      return this.db!.prepare('SELECT * FROM publish_tasks WHERE content_id = ? ORDER BY created_at DESC').all(filter.contentId);
    }
    return this.db!.prepare('SELECT * FROM publish_tasks ORDER BY created_at DESC').all();
  }

  private publishCancelTask(taskId: string): boolean {
    const row = this.db!.prepare('SELECT status FROM publish_tasks WHERE id = ?').get(taskId) as any;
    if (!row) throw new Error(`任务不存在: ${taskId}`);
    if (row.status === 'running' || row.status === 'completed') {
      throw new Error(`任务状态不允许取消: ${row.status}`);
    }

    this.db!.prepare("UPDATE publish_tasks SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(taskId);
    return true;
  }

  private publishStatus(taskId: string) {
    const task = this.db!.prepare('SELECT * FROM publish_tasks WHERE id = ?').get(taskId) as any;
    if (!task) throw new Error(`任务不存在: ${taskId}`);

    const items = this.db!.prepare('SELECT * FROM task_items WHERE task_id = ?').all(taskId);

    return {
      taskId: task.id,
      status: task.status,
      publishMode: task.publish_mode,
      scheduledAt: task.scheduled_at ?? undefined,
      result: task.result ? JSON.parse(task.result) : undefined,
      error: task.error_message ?? undefined,
      items: items.map((i: any) => ({
        itemId: i.id,
        accountId: i.account_id,
        platform: i.platform,
        status: i.status,
        videoId: i.platform_video_id ?? undefined,
        publishUrl: i.publish_url ?? undefined,
        error: i.error_message ?? undefined,
      })),
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };
  }

  private publishSchedule(taskId: string, scheduledAt: string): boolean {
    const row = this.db!.prepare('SELECT status FROM publish_tasks WHERE id = ?').get(taskId) as any;
    if (!row) throw new Error(`任务不存在: ${taskId}`);
    if (row.status === 'running' || row.status === 'completed') {
      throw new Error(`任务状态不允许调度: ${row.status}`);
    }

    this.db!.prepare("UPDATE publish_tasks SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(scheduledAt, taskId);
    return true;
  }

  private publishBatch(params: Record<string, unknown>) {
    const contentId = params.contentId as string;
    const accountIds = params.accountIds as string[] ?? [];
    const platform = params.platform as string ?? 'douyin';
    const publishMode = params.publishMode as string ?? 'client';

    const tasks: unknown[] = [];
    const now = new Date().toISOString();

    const insertStmt = this.db!.prepare(
      `INSERT INTO publish_tasks (id, content_id, platform, account_id, publish_mode, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
    );

    const transaction = this.db!.transaction(() => {
      for (const accountId of accountIds) {
        const id = crypto.randomUUID();
        insertStmt.run(id, contentId, platform, accountId, publishMode, now, now);
        tasks.push({ id, contentId, platform, accountId, publishMode, status: 'pending' });
      }
    });

    transaction();
    return tasks;
  }

  // ─── 统计操作 ──────────────────────────────────────────────

  private statsOverview() {
    const accounts = (this.db!.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as any).cnt;
    const videos = (this.db!.prepare('SELECT COUNT(*) as cnt FROM contents').get() as any).cnt;
    const publishes = (this.db!.prepare("SELECT COUNT(*) as cnt FROM task_items WHERE status = 'completed'").get() as any).cnt;
    const plays = (this.db!.prepare('SELECT COALESCE(SUM(play_count), 0) as total FROM video_stats').get() as any).total;
    const likes = (this.db!.prepare('SELECT COALESCE(SUM(like_count), 0) as total FROM video_stats').get() as any).total;

    // 按平台汇总
    const platformRows = this.db!.prepare(
      `SELECT a.platform,
         COUNT(DISTINCT a.id) as account_count,
         COUNT(DISTINCT ti.id) as publish_count,
         COALESCE(SUM(vs.play_count), 0) as total_plays,
         COALESCE(SUM(vs.like_count), 0) as total_likes
       FROM accounts a
       LEFT JOIN task_items ti ON ti.account_id = a.id AND ti.status = 'completed'
       LEFT JOIN video_stats vs ON vs.platform = a.platform
       GROUP BY a.platform`
    ).all();

    const platformStats: Record<string, unknown> = {};
    for (const row of platformRows as any[]) {
      platformStats[row.platform] = {
        platform: row.platform,
        accountCount: row.account_count,
        totalPublishes: row.publish_count,
        totalPlays: row.total_plays,
        totalLikes: row.total_likes,
      };
    }

    return {
      totalAccounts: accounts,
      totalVideos: videos,
      totalPublishes: publishes,
      totalPlays: plays,
      totalLikes: likes,
      platformStats,
    };
  }

  private statsPlatform(platform: string) {
    const accountCount = (this.db!.prepare('SELECT COUNT(*) as cnt FROM accounts WHERE platform = ?').get(platform) as any).cnt;
    const activeAccounts = (this.db!.prepare("SELECT COUNT(*) as cnt FROM accounts WHERE platform = ? AND status = 'active'").get(platform) as any).cnt;

    const statRow = this.db!.prepare(
      `SELECT
         COUNT(DISTINCT vs.platform_video_id) as video_count,
         COALESCE(SUM(vs.play_count), 0) as total_plays,
         COALESCE(SUM(vs.like_count), 0) as total_likes
       FROM video_stats vs
       WHERE vs.platform = ?`
    ).get(platform) as any;

    return {
      platform,
      accountCount,
      activeAccounts,
      totalVideos: statRow?.video_count ?? 0,
      totalPlays: statRow?.total_plays ?? 0,
      totalLikes: statRow?.total_likes ?? 0,
    };
  }

  private statsTrend(metric?: string) {
    const allowedMetrics = new Set(['play_count', 'like_count', 'comment_count', 'share_count', 'collect_count']);
    const safeMetric = allowedMetrics.has(metric ?? '') ? metric : 'play_count';

    const rows = this.db!.prepare(
      `SELECT DATE(fetch_time) as date, SUM(${safeMetric}) as value
       FROM video_stats
       GROUP BY DATE(fetch_time)
       ORDER BY date ASC`
    ).all();

    return rows.map((r: any) => ({
      date: r.date,
      value: r.value ?? 0,
      metric: safeMetric,
    }));
  }
}

// ─── Bridge 工厂 ──────────────────────────────────────────────

let bridgeInstance: IBridge | null = null;

export function getBridge(): IBridge {
  if (!bridgeInstance) {
    // 检查是否在 Electron 环境中
    const isElectron = typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.electron != null;

    if (isElectron) {
      // Electron 环境使用 IPC 模式（需要 preload 注入）
      // 暂时也用 standalone，后续可扩展
      bridgeInstance = new StandaloneBridge();
    } else {
      bridgeInstance = new StandaloneBridge();
    }
  }

  return bridgeInstance;
}

export { StandaloneBridge };
