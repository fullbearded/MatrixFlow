import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { app } from 'electron';
import { Logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { getDatabase, isDatabaseAvailable, initDatabase } from '../data/Database';
import {
  ContentEvent,
} from './types/content';
import type {
  IContentService,
  Content,
  ContentRow,
  ContentMetadata,
  ContentStatus,
  ContentType,
  PublishedRecord,
  ImportProgress,
  BatchImportProgress,
} from './types/content';

const logger = new Logger('ContentService');

const VALID_VIDEO_EXTS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v',
]);
const VALID_IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
]);
const HASH_ALGORITHM = 'sha256';
const HASH_CHUNK_SIZE = 64 * 1024;
const THUMBNAIL_TIME = '00:00:01';
const THUMBNAIL_WIDTH = 320;

function generateId(): string {
  return `cnt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export class ContentService implements IContentService {
  private static instance: ContentService;
  private eventBus: EventBus;
  private thumbnailsDir: string;
  private initialized = false;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    const userDataPath = app.getPath('userData');
    this.thumbnailsDir = path.join(userDataPath, 'data', 'thumbnails');
  }

  static getInstance(): ContentService {
    if (!ContentService.instance) {
      ContentService.instance = new ContentService();
    }
    return ContentService.instance;
  }

  initialize(): void {
    if (this.initialized) return;
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
    this.initialized = true;
    logger.info('ContentService 已初始化');
  }

  // ─── 导入 ──────────────────────────────────────────────────

  async importContent(filePath: string): Promise<Content> {
    this.ensureInitialized();
    this.validateFile(filePath);

    const contentId = generateId();
    const basename = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath).toLowerCase();
    const type: ContentType = VALID_VIDEO_EXTS.has(ext) ? 'video' : 'image';
    const stat = fs.statSync(filePath);

    this.emitProgress({ contentId, filePath, phase: 'hashing', percent: 0 });

    const fileHash = await this.computeFileHash(filePath);

    const existing = this.findByHash(fileHash);
    if (existing) {
      logger.warn(`文件重复，跳过导入: ${filePath} (hash=${fileHash})`);
      throw new Error(`文件已存在: ${existing.title} (${existing.filePath})`);
    }

    const contentRow: Record<string, unknown> = {
      id: contentId,
      type,
      title: basename,
      description: '',
      file_path: filePath,
      thumbnail_path: null,
      duration: null,
      size: stat.size,
      tags: '[]',
      metadata: '{}',
      file_hash: fileHash,
      status: 'importing',
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    this.insertRow(contentRow);
    this.emitProgress({ contentId, filePath, phase: 'hashing', percent: 30 });
    this.eventBus.emit(ContentEvent.IMPORT_STARTED, { contentId, filePath });

    try {
      if (type === 'video') {
        this.emitProgress({ contentId, filePath, phase: 'metadata', percent: 40 });
        const meta = await this.extractVideoMetadata(filePath);
        contentRow.duration = meta.duration;
        const mergedMeta = { width: meta.width, height: meta.height };
        contentRow.metadata = JSON.stringify(mergedMeta);

        this.emitProgress({ contentId, filePath, phase: 'thumbnail', percent: 60 });
        try {
          const thumbPath = await this.generateThumbnail(filePath, contentId);
          contentRow.thumbnail_path = thumbPath;
          this.eventBus.emit(ContentEvent.THUMBNAIL_GENERATED, { contentId, thumbnailPath: thumbPath });
        } catch (thumbErr) {
          logger.warn(`缩略图生成失败: ${filePath}`, thumbErr);
        }
      }

      contentRow.status = 'ready';
      this.updateRow(contentId, contentRow);

      this.emitProgress({ contentId, filePath, phase: 'done', percent: 100 });
      this.eventBus.emit(ContentEvent.IMPORT_COMPLETED, { contentId, filePath });
    } catch (err) {
      contentRow.status = 'error';
      this.updateRow(contentId, contentRow);
      this.emitProgress({ contentId, filePath, phase: 'error', percent: 0, error: String(err) });
      this.eventBus.emit(ContentEvent.IMPORT_FAILED, { contentId, filePath, error: String(err) });
      throw err;
    }

    return this.rowToContent(contentRow as unknown as ContentRow);
  }

  async importBatch(filePaths: string[]): Promise<Content[]> {
    this.ensureInitialized();
    const results: Content[] = [];
    const batch: BatchImportProgress = {
      total: filePaths.length,
      completed: 0,
      failed: 0,
      currentFile: '',
      currentPhase: 'hashing',
    };

    for (const fp of filePaths) {
      batch.currentFile = fp;
      this.eventBus.emit(ContentEvent.BATCH_PROGRESS, { ...batch });

      try {
        const content = await this.importContent(fp);
        results.push(content);
        batch.completed++;
      } catch {
        batch.failed++;
      }
      this.eventBus.emit(ContentEvent.BATCH_PROGRESS, { ...batch });
    }

    return results;
  }

  // ─── 元数据 ────────────────────────────────────────────────

  async updateMetadata(contentId: string, metadata: ContentMetadata): Promise<void> {
    const existing = this.getContentRow(contentId);
    if (!existing) throw new Error(`内容不存在: ${contentId}`);

    if (metadata.title !== undefined) existing.title = metadata.title;
    if (metadata.description !== undefined) existing.description = metadata.description ?? '';
    if (metadata.tags !== undefined) existing.tags = JSON.stringify(metadata.tags);

    existing.updated_at = nowISO();
    this.updateRow(contentId, existing as unknown as Record<string, unknown>);
    this.eventBus.emit(ContentEvent.METADATA_UPDATED, { contentId });
  }

  async setTitle(contentId: string, title: string): Promise<void> {
    await this.updateMetadata(contentId, { title });
  }

  async setDescription(contentId: string, description: string): Promise<void> {
    await this.updateMetadata(contentId, { description });
  }

  async setTags(contentId: string, tags: string[]): Promise<void> {
    await this.updateMetadata(contentId, { tags });
  }

  // ─── 状态 ──────────────────────────────────────────────────

  async markAsReady(contentId: string): Promise<void> {
    this.transitionStatus(contentId, 'ready');
  }

  async markAsPublished(contentId: string, platform: string, videoId: string): Promise<void> {
    this.transitionStatus(contentId, 'published');
    logger.info(`内容已标记发布: ${contentId} → ${platform}/${videoId}`);
  }

  // ─── 查询 ──────────────────────────────────────────────────

  async getContent(contentId: string): Promise<Content | null> {
    const row = this.getContentRow(contentId);
    if (!row) return null;
    const published = this.fetchPublishedRecords(contentId);
    return this.rowToContent(row, published);
  }

  async getAllContents(): Promise<Content[]> {
    const db = this.getDb();
    if (!db) return [];
    const rows = db.prepare('SELECT * FROM contents ORDER BY created_at DESC').all() as ContentRow[];
    return rows.map((r) => this.rowToContent(r, this.fetchPublishedRecords(r.id)));
  }

  async getReadyContents(): Promise<Content[]> {
    const db = this.getDb();
    if (!db) return [];
    const rows = db.prepare("SELECT * FROM contents WHERE status = 'ready' ORDER BY created_at DESC").all() as ContentRow[];
    return rows.map((r) => this.rowToContent(r, this.fetchPublishedRecords(r.id)));
  }

  async searchContents(query: string): Promise<Content[]> {
    const db = this.getDb();
    if (!db) return [];
    const like = `%${query}%`;
    const rows = db.prepare(
      "SELECT * FROM contents WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY created_at DESC",
    ).all(like, like, like) as ContentRow[];
    return rows.map((r) => this.rowToContent(r, this.fetchPublishedRecords(r.id)));
  }

  // ─── 更新 ──────────────────────────────────────────────────

  async updateContent(contentId: string, data: Partial<ContentRow>): Promise<ContentRow | null> {
    const db = this.getDb();
    if (!db) throw new Error('数据库不可用');

    const existing = this.getContentRow(contentId);
    if (!existing) throw new Error(`内容不存在: ${contentId}`);

    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(data.tags));
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = datetime("now")');
    values.push(contentId);

    db.prepare(`UPDATE contents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    this.eventBus.emit(ContentEvent.CONTENT_UPDATED, { contentId, changes: data });
    logger.info(`内容已更新: ${contentId}`);

    return this.getContentRow(contentId);
  }

  // ─── 删除 ──────────────────────────────────────────────────

  async deleteContent(contentId: string): Promise<void> {
    const db = this.getDb();
    if (!db) throw new Error('数据库不可用');

    const row = this.getContentRow(contentId);
    if (!row) throw new Error(`内容不存在: ${contentId}`);

    if (row.thumbnail_path && fs.existsSync(row.thumbnail_path)) {
      try { fs.unlinkSync(row.thumbnail_path); } catch { /* ignore */ }
    }

    db.prepare('DELETE FROM contents WHERE id = ?').run(contentId);
    this.eventBus.emit(ContentEvent.CONTENT_DELETED, { contentId });
    logger.info(`内容已删除: ${contentId}`);
  }

  // ─── 视频元数据提取（ffprobe） ──────────────────────────────

  private extractVideoMetadata(filePath: string): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`ffprobe 退出码 ${code}: ${stderr}`));
        }
        try {
          const info = JSON.parse(stdout);
          const format = info.format || {};
          const videoStream = (info.streams || []).find(
            (s: Record<string, unknown>) => s.codec_type === 'video',
          );
          resolve({
            duration: parseFloat(format.duration) || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
          });
        } catch (parseErr) {
          reject(new Error(`ffprobe 输出解析失败: ${parseErr}`));
        }
      });

      proc.on('error', (err) => reject(new Error(`ffprobe 启动失败: ${err.message}`)));
    });
  }

  // ─── 缩略图生成（ffmpeg） ──────────────────────────────────

  private generateThumbnail(filePath: string, contentId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.thumbnailsDir, `${contentId}.jpg`);

      const proc = spawn('ffmpeg', [
        '-y',
        '-ss', THUMBNAIL_TIME,
        '-i', filePath,
        '-vframes', '1',
        '-vf', `scale=${THUMBNAIL_WIDTH}:-1`,
        '-q:v', '2',
        outputPath,
      ]);

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`ffmpeg 退出码 ${code}: ${stderr}`));
        }
        if (fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error('缩略图文件未生成'));
        }
      });

      proc.on('error', (err) => reject(new Error(`ffmpeg 启动失败: ${err.message}`)));
    });
  }

  // ─── 文件哈希（流式 SHA-256，不加载全文件到内存） ──────────

  private computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(HASH_ALGORITHM);
      const stream = fs.createReadStream(filePath, { highWaterMark: HASH_CHUNK_SIZE });

      stream.on('data', (chunk) => hash.update(chunk as Buffer));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // ─── 数据库操作 ────────────────────────────────────────────

  private getDb(): any | null {
    if (isDatabaseAvailable()) {
      try { return getDatabase(); } catch { /* fallthrough */ }
    }
    try { return initDatabase(); } catch { return null; }
  }

  private insertRow(row: Record<string, unknown>): void {
    const db = this.getDb();
    if (!db) throw new Error('数据库不可用');

    db.prepare(`
      INSERT INTO contents (id, type, title, description, file_path, thumbnail_path,
        duration, size, tags, metadata, file_hash, status, created_at, updated_at)
      VALUES (@id, @type, @title, @description, @file_path, @thumbnail_path,
        @duration, @size, @tags, @metadata, @file_hash, @status, @created_at, @updated_at)
    `).run(row);
  }

  private updateRow(contentId: string, row: Record<string, unknown>): void {
    const db = this.getDb();
    if (!db) throw new Error('数据库不可用');

    db.prepare(`
      UPDATE contents SET
        type = @type, title = @title, description = @description,
        file_path = @file_path, thumbnail_path = @thumbnail_path,
        duration = @duration, size = @size, tags = @tags,
        metadata = @metadata, file_hash = @file_hash, status = @status,
        updated_at = @updated_at
      WHERE id = @id
    `).run({ ...row, id: contentId });
  }

  private getContentRow(contentId: string): ContentRow | null {
    const db = this.getDb();
    if (!db) return null;
    return db.prepare('SELECT * FROM contents WHERE id = ?').get(contentId) as ContentRow | null;
  }

  private findByHash(fileHash: string): Content | null {
    const db = this.getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM contents WHERE file_hash = ?').get(fileHash) as ContentRow | undefined;
    if (!row) return null;
    return this.rowToContent(row);
  }

  private fetchPublishedRecords(contentId: string): PublishedRecord[] {
    const db = this.getDb();
    if (!db) return [];
    try {
      const rows = db.prepare(`
        SELECT ti.platform, ti.platform_video_id, ti.completed_at
        FROM task_items ti
        JOIN publish_tasks pt ON ti.task_id = pt.id
        WHERE pt.content_id = ? AND ti.status = 'completed' AND ti.platform_video_id IS NOT NULL
      `).all(contentId) as Array<{ platform: string; platform_video_id: string; completed_at: string }>;

      return rows.map((r) => ({
        platform: r.platform,
        videoId: r.platform_video_id,
        publishedAt: new Date(r.completed_at),
      }));
    } catch {
      return [];
    }
  }

  private transitionStatus(contentId: string, newStatus: ContentStatus): void {
    const row = this.getContentRow(contentId);
    if (!row) throw new Error(`内容不存在: ${contentId}`);

    const oldStatus = row.status as ContentStatus;
    row.status = newStatus;
    row.updated_at = nowISO();
    this.updateRow(contentId, row as unknown as Record<string, unknown>);
    this.eventBus.emit(ContentEvent.STATUS_CHANGED, { contentId, oldStatus, newStatus });
  }

  // ─── 转换 ──────────────────────────────────────────────────

  private rowToContent(row: ContentRow, publishedTo?: PublishedRecord[]): Content {
    let extraMeta: Record<string, unknown> = {};
    try { extraMeta = JSON.parse(row.metadata || '{}'); } catch { /* ignore */ }

    return {
      id: row.id,
      type: row.type as ContentType,
      title: row.title,
      description: row.description || undefined,
      tags: JSON.parse(row.tags || '[]'),
      filePath: row.file_path,
      thumbnailPath: row.thumbnail_path || undefined,
      duration: row.duration ?? undefined,
      size: row.size ?? 0,
      width: (extraMeta.width as number) || undefined,
      height: (extraMeta.height as number) || undefined,
      fileHash: row.file_hash || undefined,
      status: row.status as ContentStatus,
      publishedTo: publishedTo ?? [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ─── 工具 ──────────────────────────────────────────────────

  private ensureInitialized(): void {
    if (!this.initialized) this.initialize();
  }

  private validateFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new Error(`不是文件: ${filePath}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!VALID_VIDEO_EXTS.has(ext) && !VALID_IMAGE_EXTS.has(ext)) {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
  }

  private emitProgress(p: ImportProgress): void {
    this.eventBus.emit(ContentEvent.IMPORT_PROGRESS, p);
  }
}

export const contentService = ContentService.getInstance();
