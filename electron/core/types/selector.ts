// ============================================================
// Selector Update Types — MatrixFlow 选择器远程更新类型定义
// ============================================================

// --- 选择器分组 ---

export interface LoginSelectors {
  [key: string]: string;
}

export interface UploadSelectors {
  [key: string]: string;
}

export interface PublishSelectors {
  [key: string]: string;
}

// --- 平台选择器配置 ---

export interface PlatformSelectors {
  version: string;
  updatedAt: string;
  platform: string;
  login: LoginSelectors;
  upload: UploadSelectors;
  publish: PublishSelectors;
}

// --- 更新结果 ---

export interface SelectorUpdateResult {
  platform: string;
  oldVersion: string;
  newVersion: string;
  updated: boolean;
}

// --- 远程配置（YAML 解析后的结构） ---

export interface RemoteSelectorConfig {
  version: string;
  updatedAt: string;
  selectors: {
    login: LoginSelectors;
    upload: UploadSelectors;
    publish: PublishSelectors;
  };
}

// --- 服务接口 ---

export interface ISelectorUpdateService {
  initialize(): Promise<void>;
  checkForUpdates(): Promise<boolean>;
  forceUpdate(platform: string): Promise<void>;
  getSelectors(platform: string): Promise<PlatformSelectors>;
  getLocalVersion(platform: string): string;
}

// --- 事件常量 ---

export const SelectorEvents = {
  UPDATE_CHECK_STARTED: 'selector:update-check-started',
  UPDATE_AVAILABLE: 'selector:update-available',
  UPDATE_COMPLETED: 'selector:update-completed',
  UPDATE_FAILED: 'selector:update-failed',
  FORCE_UPDATE_STARTED: 'selector:force-update-started',
  CACHE_LOADED: 'selector:cache-loaded',
  CACHE_FALLBACK: 'selector:cache-fallback',
} as const;

export type SelectorEventName = typeof SelectorEvents[keyof typeof SelectorEvents];
