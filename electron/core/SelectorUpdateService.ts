import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as yaml from 'yaml';
import { app, net } from 'electron';
import { Logger } from './Logger';
import { EventBus } from './EventBus';
import {
  SelectorEvents,
} from './types/selector';
import type {
  ISelectorUpdateService,
  PlatformSelectors,
  RemoteSelectorConfig,
  SelectorUpdateResult,
} from './types/selector';

const logger = new Logger('SelectorUpdateService');

const DEFAULT_REMOTE_BASE_URL =
  'https://raw.githubusercontent.com/matrixflow/selectors/main';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

type PlatformId = string;

export class SelectorUpdateService implements ISelectorUpdateService {
  private static instance: SelectorUpdateService;

  private selectorsDir: string;
  private cache: Map<PlatformId, PlatformSelectors> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private remoteBaseUrl: string;

  private constructor(remoteBaseUrl?: string) {
    this.remoteBaseUrl = remoteBaseUrl ?? DEFAULT_REMOTE_BASE_URL;
    this.selectorsDir = path.join(app.getPath('userData'), 'selectors');
  }

  static getInstance(remoteBaseUrl?: string): SelectorUpdateService {
    if (!SelectorUpdateService.instance) {
      SelectorUpdateService.instance = new SelectorUpdateService(remoteBaseUrl);
    }
    return SelectorUpdateService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.ensureSelectorsDir();
    this.loadAllLocalCache();

    this.initialized = true;
    logger.info('SelectorUpdateService 已初始化');

    this.checkForUpdates().catch((err) => {
      logger.warn('启动时检查更新失败，将使用本地缓存:', (err as Error).message);
    });

    this.timer = setInterval(() => {
      this.checkForUpdates().catch((err) => {
        logger.warn('定期检查更新失败:', (err as Error).message);
      });
    }, CHECK_INTERVAL_MS);
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.initialized = false;
  }

  async checkForUpdates(): Promise<boolean> {
    const platforms = this.discoverPlatforms();
    if (platforms.length === 0) {
      logger.info('无已注册平台，跳过更新检查');
      return false;
    }

    EventBus.getInstance().emit(SelectorEvents.UPDATE_CHECK_STARTED, { platforms });
    logger.info(`开始检查 ${platforms.length} 个平台的选择器更新`);

    let anyUpdated = false;
    const results: SelectorUpdateResult[] = [];

    for (const platform of platforms) {
      try {
        const result = await this.checkAndUpdatePlatform(platform);
        results.push(result);
        if (result.updated) anyUpdated = true;
      } catch (err) {
        logger.error(`平台 ${platform} 更新失败:`, (err as Error).message);
        this.emitFallback(platform, err as Error);
      }
    }

    if (anyUpdated) {
      EventBus.getInstance().emit(SelectorEvents.UPDATE_AVAILABLE, { results });
    }

    return anyUpdated;
  }

  async forceUpdate(platform: string): Promise<void> {
    EventBus.getInstance().emit(SelectorEvents.FORCE_UPDATE_STARTED, { platform });
    logger.info(`强制更新平台 ${platform} 的选择器`);

    const remote = await this.fetchRemoteConfig(platform);
    this.saveToLocal(platform, remote);
    const selectors = this.remoteToLocal(platform, remote);
    this.cache.set(platform, selectors);

    const result: SelectorUpdateResult = {
      platform,
      oldVersion: '-',
      newVersion: remote.version,
      updated: true,
    };

    EventBus.getInstance().emit(SelectorEvents.UPDATE_COMPLETED, result);
    logger.info(`平台 ${platform} 强制更新完成 → v${remote.version}`);
  }

  async getSelectors(platform: string): Promise<PlatformSelectors> {
    const cached = this.cache.get(platform);
    if (cached) return cached;

    const local = this.loadLocalYaml(platform);
    if (local) {
      this.cache.set(platform, local);
      EventBus.getInstance().emit(SelectorEvents.CACHE_LOADED, { platform });
      return local;
    }

    throw new Error(`平台 ${platform} 无可用选择器配置（无本地缓存）`);
  }

  getLocalVersion(platform: string): string {
    const cached = this.cache.get(platform);
    if (cached) return cached.version;
    const local = this.loadLocalYaml(platform);
    return local?.version ?? '0.0.0';
  }

  private async checkAndUpdatePlatform(platform: string): Promise<SelectorUpdateResult> {
    const localVersion = this.getLocalVersion(platform);

    let remote: RemoteSelectorConfig;
    try {
      remote = await this.fetchRemoteConfig(platform);
    } catch (err) {
      logger.warn(`平台 ${platform} 远程获取失败，保持本地版本:`, (err as Error).message);
      return { platform, oldVersion: localVersion, newVersion: localVersion, updated: false };
    }

    if (!this.isNewerVersion(remote.version, localVersion)) {
      logger.debug(`平台 ${platform} 本地 v${localVersion} 已是最新`);
      return { platform, oldVersion: localVersion, newVersion: remote.version, updated: false };
    }

    this.saveToLocal(platform, remote);
    const selectors = this.remoteToLocal(platform, remote);
    this.cache.set(platform, selectors);

    const result: SelectorUpdateResult = {
      platform,
      oldVersion: localVersion,
      newVersion: remote.version,
      updated: true,
    };

    EventBus.getInstance().emit(SelectorEvents.UPDATE_COMPLETED, result);
    logger.info(`平台 ${platform} 更新成功: v${localVersion} → v${remote.version}`);
    return result;
  }

  private isNewerVersion(remote: string, local: string): boolean {
    const parseVer = (v: string) =>
      v.split('.').map((s) => parseInt(s, 10) || 0);

    const r = parseVer(remote);
    const l = parseVer(local);
    const len = Math.max(r.length, l.length);

    for (let i = 0; i < len; i++) {
      const rv = r[i] ?? 0;
      const lv = l[i] ?? 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  private async fetchRemoteConfig(platform: string): Promise<RemoteSelectorConfig> {
    const url = `${this.remoteBaseUrl}/${platform}.yaml`;
    logger.debug(`正在获取远程配置: ${url}`);

    const body = await this.httpGet(url, REQUEST_TIMEOUT_MS);
    const parsed = yaml.parse(body) as RemoteSelectorConfig;

    if (!parsed.version || !parsed.selectors) {
      throw new Error(`远程配置格式无效: 缺少 version 或 selectors 字段`);
    }

    return parsed;
  }

  private httpGet(url: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);

      let data = '';
      const timer = setTimeout(() => {
        request.abort();
        reject(new Error(`请求超时 (${timeoutMs}ms): ${url}`));
      }, timeoutMs);

      request.on('response', (response) => {
        if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${response.statusCode}: ${url}`));
          return;
        }

        response.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf-8');
        });

        response.on('end', () => {
          clearTimeout(timer);
          resolve(data);
        });

        response.on('error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      request.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });

      request.end();
    });
  }

  private saveToLocal(platform: string, config: RemoteSelectorConfig): void {
    this.ensureSelectorsDir();
    const filePath = path.join(this.selectorsDir, `${platform}.yaml`);
    const content = yaml.stringify(config);
    fs.writeFileSync(filePath, content, 'utf-8');
    logger.debug(`已保存本地配置: ${filePath}`);
  }

  private loadLocalYaml(platform: string): PlatformSelectors | null {
    const filePath = path.join(this.selectorsDir, `${platform}.yaml`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(content);
      return this.normalizePlatformSelectors(platform, parsed);
    } catch (err) {
      logger.error(`加载本地配置失败 ${platform}:`, (err as Error).message);
      return null;
    }
  }

  private loadAllLocalCache(): void {
    if (!fs.existsSync(this.selectorsDir)) return;

    const files = fs.readdirSync(this.selectorsDir).filter((f) => f.endsWith('.yaml'));

    for (const file of files) {
      const platform = path.basename(file, '.yaml');
      const selectors = this.loadLocalYaml(platform);
      if (selectors) {
        this.cache.set(platform, selectors);
        logger.debug(`已加载本地缓存: ${platform} v${selectors.version}`);
      }
    }

    logger.info(`已加载 ${this.cache.size} 个平台的本地选择器缓存`);
  }

  private discoverPlatforms(): string[] {
    const platforms = new Set<string>();

    for (const key of this.cache.keys()) {
      platforms.add(key);
    }

    if (fs.existsSync(this.selectorsDir)) {
      const files = fs.readdirSync(this.selectorsDir);
      for (const file of files) {
        if (file.endsWith('.yaml')) {
          platforms.add(path.basename(file, '.yaml'));
        }
      }
    }

    return Array.from(platforms);
  }

  private remoteToLocal(platform: string, remote: RemoteSelectorConfig): PlatformSelectors {
    return {
      version: remote.version,
      updatedAt: remote.updatedAt,
      platform,
      login: { ...remote.selectors.login },
      upload: { ...remote.selectors.upload },
      publish: { ...remote.selectors.publish },
    };
  }

  private normalizePlatformSelectors(
    platform: string,
    raw: Record<string, unknown>,
  ): PlatformSelectors {
    return {
      version: (raw.version as string) ?? '0.0.0',
      updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
      platform,
      login: { ...((raw.selectors as Record<string, unknown>)?.login ?? {}) as Record<string, string> },
      upload: { ...((raw.selectors as Record<string, unknown>)?.upload ?? {}) as Record<string, string> },
      publish: { ...((raw.selectors as Record<string, unknown>)?.publish ?? {}) as Record<string, string> },
    };
  }

  private emitFallback(platform: string, err: Error): void {
    const local = this.cache.get(platform);
    if (local) {
      EventBus.getInstance().emit(SelectorEvents.CACHE_FALLBACK, {
        platform,
        localVersion: local.version,
        error: err.message,
      });
    }
  }

  private ensureSelectorsDir(): void {
    if (!fs.existsSync(this.selectorsDir)) {
      fs.mkdirSync(this.selectorsDir, { recursive: true });
    }
  }
}

export const selectorUpdateService = SelectorUpdateService.getInstance();
