// ============================================================
// PlatformConfigLoader — 平台 YAML 配置加载器
// 支持：YAML 加载、配置验证、热重载、默认配置生成
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { app } from 'electron';
import { Logger } from './Logger';
import { EventBus } from './EventBus';

const logger = new Logger('PlatformConfigLoader');

// --- YAML 配置类型定义 ---

export interface PlatformYamlConfig {
  platform: {
    id: string;
    name: string;
    domain: string;
    creatorCenter: string;
    publishPage: string;
    uploadPage: string;
    loginPage: string;
  };
  capabilities: {
    login: boolean;
    upload: boolean;
    publish: boolean;
    schedule: boolean;
    stats: boolean;
    comment: boolean;
  };
  rateLimits: {
    uploadPerHour: number;
    publishPerDay: number;
    minInterval: number;
  };
  timeouts: {
    login: number;
    upload: number;
    publish: number;
  };
  features: {
    scheduledPublish: boolean;
    draft: boolean;
    coverImage: boolean;
    topics: boolean;
    location: boolean;
    commerce: boolean;
  };
  selectors: {
    version: string;
    source: 'remote' | 'local';
    url?: string;
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigChangeEvent {
  platformId: string;
  timestamp: Date;
}

// --- 事件常量 ---

export const PlatformConfigEvents = {
  CONFIG_LOADED: 'platform-config:loaded',
  CONFIG_CHANGED: 'platform-config:changed',
  CONFIG_RELOAD_FAILED: 'platform-config:reload-failed',
  CONFIG_VALIDATION_ERROR: 'platform-config:validation-error',
} as const;

// --- 验证规则 ---

const REQUIRED_PLATFORM_FIELDS: (keyof PlatformYamlConfig['platform'])[] = [
  'id', 'name', 'domain', 'creatorCenter', 'publishPage', 'uploadPage', 'loginPage',
];

const REQUIRED_CAPABILITY_FIELDS: (keyof PlatformYamlConfig['capabilities'])[] = [
  'login', 'upload', 'publish', 'schedule', 'stats', 'comment',
];

const REQUIRED_RATE_LIMIT_FIELDS: (keyof PlatformYamlConfig['rateLimits'])[] = [
  'uploadPerHour', 'publishPerDay', 'minInterval',
];

const REQUIRED_TIMEOUT_FIELDS: (keyof PlatformYamlConfig['timeouts'])[] = [
  'login', 'upload', 'publish',
];

const REQUIRED_FEATURE_FIELDS: (keyof PlatformYamlConfig['features'])[] = [
  'scheduledPublish', 'draft', 'coverImage', 'topics', 'location', 'commerce',
];

const REQUIRED_SELECTOR_FIELDS: (keyof PlatformYamlConfig['selectors'])[] = [
  'version', 'source',
];

// ============================================================

export class PlatformConfigLoader {
  private static instance: PlatformConfigLoader;

  /** 运行时配置缓存：platformId → 解析后的配置 */
  private configs: Map<string, PlatformYamlConfig> = new Map();

  /** 内置默认配置目录（随应用打包） */
  private bundledConfigDir: string;

  /** 用户覆盖配置目录（userData 下，运行时可修改） */
  private userConfigDir: string;

  /** fs.watch watchers，用于热重载 */
  private watchers: Map<string, fs.FSWatcher> = new Map();

  /** 防抖定时器 */
  private reloadTimers: Map<string, NodeJS.Timeout> = new Map();

  private initialized = false;

  private constructor() {
    // 内置配置：electron/config/platforms/
    this.bundledConfigDir = path.join(__dirname, '..', 'config', 'platforms');
    // 用户覆盖配置：userData/platform-configs/
    this.userConfigDir = path.join(app.getPath('userData'), 'platform-configs');
  }

  static getInstance(): PlatformConfigLoader {
    if (!PlatformConfigLoader.instance) {
      PlatformConfigLoader.instance = new PlatformConfigLoader();
    }
    return PlatformConfigLoader.instance;
  }

  // ---- 初始化 ----

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 确保用户配置目录存在
    if (!fs.existsSync(this.userConfigDir)) {
      fs.mkdirSync(this.userConfigDir, { recursive: true });
    }

    // 加载所有平台配置
    await this.loadAllConfigs();

    // 启动文件监听（热重载）
    this.startWatching();

    this.initialized = true;
    logger.info('平台配置加载器已初始化');
  }

  // ---- 配置读取 ----

  getConfig(platformId: string): PlatformYamlConfig | undefined {
    return this.configs.get(platformId);
  }

  getAllConfigs(): Map<string, PlatformYamlConfig> {
    return new Map(this.configs);
  }

  getPlatformIds(): string[] {
    return Array.from(this.configs.keys());
  }

  // ---- 配置修改（运行时） ----

  async updateConfig(platformId: string, config: PlatformYamlConfig): Promise<void> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      const error = `配置验证失败: ${validation.errors.join('; ')}`;
      logger.error(error);
      EventBus.getInstance().emit(PlatformConfigEvents.CONFIG_VALIDATION_ERROR, {
        platformId,
        errors: validation.errors,
      });
      throw new Error(error);
    }

    // 写入用户覆盖配置
    const userConfigPath = path.join(this.userConfigDir, `${platformId}.yaml`);
    const content = yaml.stringify(config as unknown as Record<string, unknown>);
    fs.writeFileSync(userConfigPath, content, 'utf-8');

    // 更新内存缓存
    this.configs.set(platformId, config);

    logger.info(`平台 ${platformId} 配置已更新`);
    EventBus.getInstance().emit(PlatformConfigEvents.CONFIG_CHANGED, {
      platformId,
      timestamp: new Date(),
    } satisfies ConfigChangeEvent);
  }

  // ---- 重置配置 ----

  async resetConfig(platformId: string): Promise<void> {
    const userConfigPath = path.join(this.userConfigDir, `${platformId}.yaml`);
    if (fs.existsSync(userConfigPath)) {
      fs.unlinkSync(userConfigPath);
    }

    // 重新加载内置配置
    const config = this.loadBundledConfig(platformId);
    if (config) {
      this.configs.set(platformId, config);
      logger.info(`平台 ${platformId} 配置已重置为默认值`);
      EventBus.getInstance().emit(PlatformConfigEvents.CONFIG_CHANGED, {
        platformId,
        timestamp: new Date(),
      } satisfies ConfigChangeEvent);
    }
  }

  // ---- 验证 ----

  validateConfig(config: unknown): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config || typeof config !== 'object') {
      return { valid: false, errors: ['配置必须为非空对象'], warnings };
    }

    const cfg = config as Record<string, any>;

    // 验证 platform 段
    this.validateSection(cfg, 'platform', REQUIRED_PLATFORM_FIELDS, errors);
    if (cfg.platform?.id && typeof cfg.platform.id === 'string') {
      if (!/^[a-z][a-z0-9-]*$/.test(cfg.platform.id)) {
        errors.push('platform.id 必须为小写字母、数字和连字符组成，且以字母开头');
      }
    }
    if (cfg.platform?.creatorCenter && typeof cfg.platform.creatorCenter === 'string') {
      if (!cfg.platform.creatorCenter.startsWith('https://')) {
        warnings.push('platform.creatorCenter 建议使用 HTTPS 协议');
      }
    }

    // 验证 capabilities 段
    this.validateSection(cfg, 'capabilities', REQUIRED_CAPABILITY_FIELDS, errors);

    // 验证 rateLimits 段
    this.validateSection(cfg, 'rateLimits', REQUIRED_RATE_LIMIT_FIELDS, errors);
    if (cfg.rateLimits) {
      if (cfg.rateLimits.uploadPerHour !== undefined && cfg.rateLimits.uploadPerHour <= 0) {
        errors.push('rateLimits.uploadPerHour 必须为正整数');
      }
      if (cfg.rateLimits.publishPerDay !== undefined && cfg.rateLimits.publishPerDay <= 0) {
        errors.push('rateLimits.publishPerDay 必须为正整数');
      }
      if (cfg.rateLimits.minInterval !== undefined && cfg.rateLimits.minInterval < 0) {
        errors.push('rateLimits.minInterval 不能为负数');
      }
    }

    // 验证 timeouts 段
    this.validateSection(cfg, 'timeouts', REQUIRED_TIMEOUT_FIELDS, errors);
    if (cfg.timeouts) {
      for (const field of REQUIRED_TIMEOUT_FIELDS) {
        const val = cfg.timeouts[field];
        if (val !== undefined && (typeof val !== 'number' || val < 1000)) {
          warnings.push(`timeouts.${field} 值 ${val}ms 偏低，建议 >= 1000ms`);
        }
      }
    }

    // 验证 features 段
    this.validateSection(cfg, 'features', REQUIRED_FEATURE_FIELDS, errors);

    // 验证 selectors 段
    this.validateSection(cfg, 'selectors', REQUIRED_SELECTOR_FIELDS, errors);
    if (cfg.selectors?.source && !['remote', 'local'].includes(cfg.selectors.source)) {
      errors.push('selectors.source 必须为 "remote" 或 "local"');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ---- 生成默认配置 ----

  static generateDefaultConfig(platformId: string, platformName: string, domain: string): PlatformYamlConfig {
    return {
      platform: {
        id: platformId,
        name: platformName,
        domain,
        creatorCenter: `https://creator.${domain}`,
        publishPage: `https://creator.${domain}/publish`,
        uploadPage: `https://creator.${domain}/upload`,
        loginPage: `https://creator.${domain}/login`,
      },
      capabilities: {
        login: true,
        upload: true,
        publish: true,
        schedule: false,
        stats: false,
        comment: false,
      },
      rateLimits: {
        uploadPerHour: 10,
        publishPerDay: 50,
        minInterval: 300,
      },
      timeouts: {
        login: 300000,
        upload: 600000,
        publish: 120000,
      },
      features: {
        scheduledPublish: false,
        draft: true,
        coverImage: true,
        topics: false,
        location: false,
        commerce: false,
      },
      selectors: {
        version: '1.0.0',
        source: 'local',
      },
    };
  }

  // ---- 热重载 ----

  async reloadConfig(platformId: string): Promise<void> {
    try {
      const config = this.loadPlatformConfig(platformId);
      if (config) {
        const validation = this.validateConfig(config);
        if (!validation.valid) {
          logger.error(`平台 ${platformId} 热重载配置验证失败: ${validation.errors.join('; ')}`);
          EventBus.getInstance().emit(PlatformConfigEvents.CONFIG_RELOAD_FAILED, {
            platformId,
            errors: validation.errors,
          });
          return;
        }

        this.configs.set(platformId, config);
        logger.info(`平台 ${platformId} 配置已热重载`);
        EventBus.getInstance().emit(PlatformConfigEvents.CONFIG_CHANGED, {
          platformId,
          timestamp: new Date(),
        } satisfies ConfigChangeEvent);
      }
    } catch (error) {
      logger.error(`平台 ${platformId} 配置热重载失败`, error);
      EventBus.getInstance().emit(PlatformConfigEvents.CONFIG_RELOAD_FAILED, {
        platformId,
        errors: [(error as Error).message],
      });
    }
  }

  // ---- 清理 ----

  dispose(): void {
    for (const [platformId, watcher] of this.watchers) {
      watcher.close();
      logger.debug(`已停止监听 ${platformId} 配置文件`);
    }
    this.watchers.clear();

    for (const [, timer] of this.reloadTimers) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private async loadAllConfigs(): Promise<void> {
    // 扫描内置配置目录
    const bundledConfigs = this.scanConfigDir(this.bundledConfigDir);
    // 扫描用户配置目录
    const userConfigs = this.scanConfigDir(this.userConfigDir);

    // 合并：用户配置覆盖内置配置
    const allPlatformIds = new Set([...bundledConfigs.keys(), ...userConfigs.keys()]);

    for (const platformId of allPlatformIds) {
      const config = this.loadPlatformConfig(platformId);
      if (config) {
        const validation = this.validateConfig(config);
        if (validation.valid) {
          this.configs.set(platformId, config);
          logger.info(`已加载平台 ${platformId} 配置`);
          if (validation.warnings.length > 0) {
            logger.warn(`平台 ${platformId} 配置警告: ${validation.warnings.join('; ')}`);
          }
        } else {
          logger.error(`平台 ${platformId} 配置验证失败: ${validation.errors.join('; ')}`);
          // 加载失败时回退到内置默认
          const defaultConfig = this.loadBundledConfig(platformId);
          if (defaultConfig) {
            this.configs.set(platformId, defaultConfig);
            logger.warn(`平台 ${platformId} 已回退到内置默认配置`);
          }
        }
      }
    }
  }

  private scanConfigDir(dir: string): Map<string, string> {
    const result = new Map<string, string>();
    if (!fs.existsSync(dir)) return result;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const platformId = path.basename(file, path.extname(file));
        result.set(platformId, path.join(dir, file));
      }
    }
    return result;
  }

  /**
   * 加载平台配置：优先使用用户覆盖配置，否则使用内置配置
   */
  private loadPlatformConfig(platformId: string): PlatformYamlConfig | undefined {
    const userConfigPath = path.join(this.userConfigDir, `${platformId}.yaml`);
    if (fs.existsSync(userConfigPath)) {
      return this.parseYamlFile(userConfigPath);
    }

    return this.loadBundledConfig(platformId);
  }

  /**
   * 加载内置默认配置
   */
  private loadBundledConfig(platformId: string): PlatformYamlConfig | undefined {
    const bundledPath = path.join(this.bundledConfigDir, `${platformId}.yaml`);
    if (!fs.existsSync(bundledPath)) {
      return undefined;
    }
    return this.parseYamlFile(bundledPath);
  }

  private parseYamlFile(filePath: string): PlatformYamlConfig | undefined {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(content);
      return parsed as PlatformYamlConfig;
    } catch (error) {
      logger.error(`解析 YAML 文件失败: ${filePath}`, error);
      return undefined;
    }
  }

  /**
   * 启动文件监听，支持热重载
   */
  private startWatching(): void {
    // 监听用户配置目录（运行时修改）
    if (fs.existsSync(this.userConfigDir)) {
      const watcher = fs.watch(this.userConfigDir, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) return;

        const platformId = path.basename(filename, path.extname(filename));
        this.debouncedReload(platformId);
      });
      this.watchers.set('__user_dir__', watcher);
    }

    // 监听内置配置目录（开发阶段）
    if (fs.existsSync(this.bundledConfigDir)) {
      const watcher = fs.watch(this.bundledConfigDir, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) return;

        const platformId = path.basename(filename, path.extname(filename));
        this.debouncedReload(platformId);
      });
      this.watchers.set('__bundled_dir__', watcher);
    }
  }

  /**
   * 防抖重载：500ms 内多次变更只触发一次
   */
  private debouncedReload(platformId: string): void {
    const existing = this.reloadTimers.get(platformId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.reloadTimers.delete(platformId);
      this.reloadConfig(platformId);
    }, 500);

    this.reloadTimers.set(platformId, timer);
  }

  /**
   * 验证配置段是否包含所有必需字段
   */
  private validateSection(
    cfg: Record<string, any>,
    section: string,
    requiredFields: string[],
    errors: string[],
  ): void {
    if (!cfg[section]) {
      errors.push(`缺少 ${section} 配置段`);
      return;
    }

    for (const field of requiredFields) {
      if (cfg[section][field] === undefined || cfg[section][field] === null) {
        errors.push(`${section}.${field} 字段缺失`);
      }
    }
  }
}

export const platformConfigLoader = PlatformConfigLoader.getInstance();
