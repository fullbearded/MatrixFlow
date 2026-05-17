import type { AccountRow } from './account';

export type ContentType = 'video' | 'image';
export type ContentStatus = 'importing' | 'ready' | 'published' | 'error';

export interface PublishedRecord {
  platform: string;
  videoId: string;
  publishedAt: Date;
}

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  description?: string;
  tags: string[];
  filePath: string;
  thumbnailPath?: string;
  duration?: number;
  size: number;
  width?: number;
  height?: number;
  fileHash?: string;
  status: ContentStatus;
  publishedTo: PublishedRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentMetadata {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface ContentRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
  duration: number | null;
  size: number | null;
  tags: string;
  metadata: string;
  file_hash: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ImportProgress {
  contentId: string;
  filePath: string;
  phase: 'hashing' | 'metadata' | 'thumbnail' | 'done' | 'error';
  percent: number;
  error?: string;
}

export interface BatchImportProgress {
  total: number;
  completed: number;
  failed: number;
  currentFile: string;
  currentPhase: ImportProgress['phase'];
}

export enum ContentEvent {
  IMPORT_STARTED = 'content:import-started',
  IMPORT_PROGRESS = 'content:import-progress',
  IMPORT_COMPLETED = 'content:import-completed',
  IMPORT_FAILED = 'content:import-failed',
  BATCH_PROGRESS = 'content:batch-progress',
  METADATA_UPDATED = 'content:metadata-updated',
  STATUS_CHANGED = 'content:status-changed',
  CONTENT_UPDATED = 'content:updated',
  CONTENT_DELETED = 'content:deleted',
  THUMBNAIL_GENERATED = 'content:thumbnail-generated',
}

export interface ContentStatusPayload {
  contentId: string;
  oldStatus: ContentStatus;
  newStatus: ContentStatus;
}

export interface IContentService {
  importContent(filePath: string): Promise<Content>;
  importBatch(filePaths: string[]): Promise<Content[]>;

  updateMetadata(contentId: string, metadata: ContentMetadata): Promise<void>;
  setTitle(contentId: string, title: string): Promise<void>;
  setDescription(contentId: string, description: string): Promise<void>;
  setTags(contentId: string, tags: string[]): Promise<void>;

  markAsReady(contentId: string): Promise<void>;
  markAsPublished(contentId: string, platform: string, videoId: string): Promise<void>;

  getContent(contentId: string): Promise<Content | null>;
  getAllContents(): Promise<Content[]>;
  getReadyContents(): Promise<Content[]>;
  searchContents(query: string): Promise<Content[]>;

  deleteContent(contentId: string): Promise<void>;
}
