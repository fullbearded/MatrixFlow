import { Logger } from '../core/Logger';
import { getDatabase, isDatabaseAvailable } from '../data/Database';

const logger = new Logger('DraftService');

export interface Draft {
  id: string;
  type: 'video' | 'image';
  title: string;
  description?: string;
  coverPath?: string;
  filePath?: string;
  platformConfigs: Record<string, {
    title?: string;
    description?: string;
    tags?: string[];
    topics?: string[];
    location?: string;
    allowComment?: boolean;
    allowDownload?: boolean;
  }>;
  status: 'draft' | 'ready';
  createdAt: Date;
  updatedAt: Date;
}

class DraftService {
  private static instance: DraftService;

  private constructor() {}

  static getInstance(): DraftService {
    if (!DraftService.instance) {
      DraftService.instance = new DraftService();
    }
    return DraftService.instance;
  }

  createDraft(data: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Draft {
    const id = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const draft: Draft = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.saveDraft(draft);
    logger.info(`创建草稿: ${draft.title}`);
    return draft;
  }

  updateDraft(id: string, updates: Partial<Draft>): Draft | null {
    const draft = this.getDraft(id);
    if (!draft) return null;

    const updated: Draft = {
      ...draft,
      ...updates,
      id: draft.id,
      createdAt: draft.createdAt,
      updatedAt: new Date(),
    };

    this.saveDraft(updated);
    return updated;
  }

  getDraft(id: string): Draft | null {
    if (!isDatabaseAvailable()) return null;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT id, type, title, description, cover_path, file_path, platform_configs, status, created_at, updated_at
      FROM drafts
      WHERE id = ?
    `).get(id) as {
      id: string;
      type: string;
      title: string;
      description: string | null;
      cover_path: string | null;
      file_path: string | null;
      platform_configs: string;
      status: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type as Draft['type'],
      title: row.title,
      description: row.description ?? undefined,
      coverPath: row.cover_path ?? undefined,
      filePath: row.file_path ?? undefined,
      platformConfigs: JSON.parse(row.platform_configs),
      status: row.status as Draft['status'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  listDrafts(status?: 'draft' | 'ready'): Draft[] {
    if (!isDatabaseAvailable()) return [];
    const db = getDatabase();

    const sql = status
      ? `SELECT id, type, title, description, cover_path, file_path, platform_configs, status, created_at, updated_at FROM drafts WHERE status = ? ORDER BY updated_at DESC`
      : `SELECT id, type, title, description, cover_path, file_path, platform_configs, status, created_at, updated_at FROM drafts ORDER BY updated_at DESC`;

    const params = status ? [status] : [];

    const rows = db.prepare(sql).all(...params) as Array<{
      id: string;
      type: string;
      title: string;
      description: string | null;
      cover_path: string | null;
      file_path: string | null;
      platform_configs: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      type: row.type as Draft['type'],
      title: row.title,
      description: row.description ?? undefined,
      coverPath: row.cover_path ?? undefined,
      filePath: row.file_path ?? undefined,
      platformConfigs: JSON.parse(row.platform_configs),
      status: row.status as Draft['status'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  deleteDraft(id: string): boolean {
    if (!isDatabaseAvailable()) return false;
    const db = getDatabase();

    const result = db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
    if (result.changes > 0) {
      logger.info(`删除草稿: ${id}`);
      return true;
    }
    return false;
  }

  duplicateDraft(id: string): Draft | null {
    const original = this.getDraft(id);
    if (!original) return null;

    const { id: _, createdAt, updatedAt, ...data } = original;
    return this.createDraft({
      ...data,
      title: `${original.title} (副本)`,
    });
  }

  private saveDraft(draft: Draft): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    db.prepare(`
      INSERT INTO drafts (id, type, title, description, cover_path, file_path, platform_configs, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        description = excluded.description,
        cover_path = excluded.cover_path,
        file_path = excluded.file_path,
        platform_configs = excluded.platform_configs,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      draft.id,
      draft.type,
      draft.title,
      draft.description ?? null,
      draft.coverPath ?? null,
      draft.filePath ?? null,
      JSON.stringify(draft.platformConfigs),
      draft.status,
      draft.createdAt.toISOString(),
      draft.updatedAt.toISOString()
    );
  }
}

export const draftService = DraftService.getInstance();
