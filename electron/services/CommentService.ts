import { Logger } from '../core/Logger';
import { getDatabase, isDatabaseAvailable } from '../data/Database';
import { PlatformRegistry } from '../platform/base/PlatformRegistry';
import { postCommentFull as douyinComment } from '../platform/douyin/comment';
import { postCommentFull as xiaohongshuComment } from '../platform/xiaohongshu/comment';
import { postCommentFull as channelsComment } from '../platform/channels/comment';
import { postCommentFull as kuaishouComment } from '../platform/kuaishou/comment';

const logger = new Logger('CommentService');

const PLATFORM_COMMENT_FN: Record<string, (accountId: string, videoId: string, content: string) => Promise<import('../platform/base/types').CommentResult>> = {
  douyin: douyinComment,
  xiaohongshu: xiaohongshuComment,
  channels: channelsComment,
  kuaishou: kuaishouComment,
};

export interface CommentTemplate {
  id: string;
  platform: string;
  name: string;
  content: string;
  triggerCondition: 'after_publish' | 'threshold';
  threshold?: {
    metric: 'views' | 'likes' | 'comments';
    value: number;
  };
  delay?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentTask {
  id: string;
  templateId: string;
  accountId: string;
  platform: string;
  videoId: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

class CommentService {
  private static instance: CommentService;

  private constructor() {}

  static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  createTemplate(data: Omit<CommentTemplate, 'id' | 'createdAt' | 'updatedAt'>): CommentTemplate {
    const id = `ctpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const template: CommentTemplate = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.saveTemplate(template);
    logger.info(`创建评论模板: ${template.name}`);
    return template;
  }

  updateTemplate(id: string, updates: Partial<CommentTemplate>): CommentTemplate | null {
    const template = this.getTemplate(id);
    if (!template) return null;

    const updated: CommentTemplate = {
      ...template,
      ...updates,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: new Date(),
    };

    this.saveTemplate(updated);
    return updated;
  }

  getTemplate(id: string): CommentTemplate | null {
    if (!isDatabaseAvailable()) return null;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT id, platform, name, content, trigger_condition, threshold, delay, created_at, updated_at
      FROM comment_templates
      WHERE id = ?
    `).get(id) as {
      id: string;
      platform: string;
      name: string;
      content: string;
      trigger_condition: string;
      threshold: string | null;
      delay: number | null;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      platform: row.platform,
      name: row.name,
      content: row.content,
      triggerCondition: row.trigger_condition as CommentTemplate['triggerCondition'],
      threshold: row.threshold ? JSON.parse(row.threshold) : undefined,
      delay: row.delay ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  listTemplates(platform?: string): CommentTemplate[] {
    if (!isDatabaseAvailable()) return [];
    const db = getDatabase();

    const sql = platform
      ? `SELECT id, platform, name, content, trigger_condition, threshold, delay, created_at, updated_at FROM comment_templates WHERE platform = ? ORDER BY created_at DESC`
      : `SELECT id, platform, name, content, trigger_condition, threshold, delay, created_at, updated_at FROM comment_templates ORDER BY created_at DESC`;

    const params = platform ? [platform] : [];
    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      platform: string;
      name: string;
      content: string;
      trigger_condition: string;
      threshold: string | null;
      delay: number | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      name: row.name,
      content: row.content,
      triggerCondition: row.trigger_condition as CommentTemplate['triggerCondition'],
      threshold: row.threshold ? JSON.parse(row.threshold) : undefined,
      delay: row.delay ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  deleteTemplate(id: string): boolean {
    if (!isDatabaseAvailable()) return false;
    const db = getDatabase();

    const result = db.prepare('DELETE FROM comment_templates WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async scheduleComment(
    templateId: string,
    accountId: string,
    platform: string,
    videoId: string
  ): Promise<CommentTask | null> {
    const template = this.getTemplate(templateId);
    if (!template) {
      logger.error(`评论模板不存在: ${templateId}`);
      return null;
    }

    const adapter = PlatformRegistry.getAdapter(platform);
    if (!adapter || !adapter.capabilities.comment) {
      logger.warn(`平台不支持自动评论: ${platform}`);
      return null;
    }

    const id = `ctask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task: CommentTask = {
      id,
      templateId,
      accountId,
      platform,
      videoId,
      status: 'pending',
      createdAt: new Date(),
    };

    this.saveTask(task);
    return task;
  }

  async executeComment(taskId: string): Promise<boolean> {
    const task = this.getTask(taskId);
    if (!task || task.status !== 'pending') return false;

    const template = this.getTemplate(task.templateId);
    if (!template) return false;

    try {
      const adapter = PlatformRegistry.getAdapter(task.platform);
      if (!adapter) {
        throw new Error('平台适配器不存在');
      }

      await this.doComment(task.accountId, task.platform, task.videoId, template.content);

      task.status = 'completed';
      task.completedAt = new Date();
      this.updateTask(task);

      logger.info(`评论成功: ${task.videoId}`);
      return true;
    } catch (error) {
      task.status = 'failed';
      task.error = String(error);
      this.updateTask(task);

      logger.error(`评论失败: ${task.videoId}`, error);
      return false;
    }
  }

  getTask(id: string): CommentTask | null {
    if (!isDatabaseAvailable()) return null;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT id, template_id, account_id, platform, video_id, status, error, created_at, completed_at
      FROM comment_tasks
      WHERE id = ?
    `).get(id) as {
      id: string;
      template_id: string;
      account_id: string;
      platform: string;
      video_id: string;
      status: string;
      error: string | null;
      created_at: string;
      completed_at: string | null;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      templateId: row.template_id,
      accountId: row.account_id,
      platform: row.platform,
      videoId: row.video_id,
      status: row.status as CommentTask['status'],
      error: row.error ?? undefined,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }

  private saveTemplate(template: CommentTemplate): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    db.prepare(`
      INSERT INTO comment_templates (id, platform, name, content, trigger_condition, threshold, delay, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        content = excluded.content,
        trigger_condition = excluded.trigger_condition,
        threshold = excluded.threshold,
        delay = excluded.delay,
        updated_at = excluded.updated_at
    `).run(
      template.id,
      template.platform,
      template.name,
      template.content,
      template.triggerCondition,
      template.threshold ? JSON.stringify(template.threshold) : null,
      template.delay ?? null,
      template.createdAt.toISOString(),
      template.updatedAt.toISOString()
    );
  }

  private saveTask(task: CommentTask): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    db.prepare(`
      INSERT INTO comment_tasks (id, template_id, account_id, platform, video_id, status, error, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.templateId,
      task.accountId,
      task.platform,
      task.videoId,
      task.status,
      task.error ?? null,
      task.createdAt.toISOString(),
      task.completedAt?.toISOString() ?? null
    );
  }

  private updateTask(task: CommentTask): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    db.prepare(`
      UPDATE comment_tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?
    `).run(
      task.status,
      task.error ?? null,
      task.completedAt?.toISOString() ?? null,
      task.id
    );
  }

  private async doComment(accountId: string, platform: string, videoId: string, content: string): Promise<void> {
    const commentFn = PLATFORM_COMMENT_FN[platform];
    if (!commentFn) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    const result = await commentFn(accountId, videoId, content);
    if (!result.success) {
      throw new Error(result.message);
    }

    logger.info(`评论完成: ${platform}/${videoId}`);
  }
}

export const commentService = CommentService.getInstance();
