import { chromium, type Browser, type LaunchOptions } from 'patchright';
import { Logger } from './Logger';

const logger = new Logger('BrowserFactory');

/**
 * 浏览器启动模式
 * - embedded: 内嵌 Patchright（推荐，反检测能力最强）
 * - external_chrome: 外置 Chrome 浏览器
 * - external_fingerprint: 外置指纹浏览器（通过 CDP 接管）
 */
export type BrowserMode = 'embedded' | 'external_chrome' | 'external_fingerprint';

export interface BrowserFactoryConfig {
  mode: BrowserMode;
  /** Chrome 可执行文件路径（external_chrome 模式） */
  chromePath?: string;
  /** 指纹浏览器路径（external_fingerprint 模式） */
  fingerprintBrowserPath?: string;
  /** CDP WebSocket 端点（external_chrome / external_fingerprint 模式） */
  cdpEndpoint?: string;
}

const DEFAULT_FACTORY_CONFIG: BrowserFactoryConfig = {
  mode: 'embedded',
};

export class BrowserFactory {
  private config: BrowserFactoryConfig;

  constructor(config?: Partial<BrowserFactoryConfig>) {
    this.config = { ...DEFAULT_FACTORY_CONFIG, ...config };
  }

  async createBrowser(options?: LaunchOptions): Promise<Browser> {
    switch (this.config.mode) {
      case 'embedded':
        return this.launchEmbedded(options);
      case 'external_chrome':
        return this.connectExternalChrome(options);
      case 'external_fingerprint':
        return this.connectFingerprintBrowser();
      default:
        return this.launchEmbedded(options);
    }
  }

  private async launchEmbedded(options?: LaunchOptions): Promise<Browser> {
    logger.info('Launching embedded Patchright browser');
    return chromium.launch({
      headless: false,
      ...options,
    });
  }

  private async connectExternalChrome(options?: LaunchOptions): Promise<Browser> {
    const endpoint = this.config.cdpEndpoint;
    if (endpoint) {
      logger.info(`Connecting to external Chrome via CDP: ${endpoint}`);
      return chromium.connectOverCDP(endpoint);
    }

    const chromePath = this.config.chromePath;
    if (!chromePath) {
      throw new Error('Chrome path not configured. Please set chromePath in browser settings.');
    }

    logger.info(`Launching external Chrome at: ${chromePath}`);
    return chromium.launch({
      executablePath: chromePath,
      headless: false,
      ...options,
    });
  }

  private async connectFingerprintBrowser(): Promise<Browser> {
    const endpoint = this.config.cdpEndpoint;
    if (!endpoint) {
      throw new Error(
        'Fingerprint browser CDP endpoint not configured. Please start the fingerprint browser first and set cdpEndpoint.',
      );
    }

    logger.info(`Connecting to fingerprint browser via CDP: ${endpoint}`);
    return chromium.connectOverCDP(endpoint);
  }

  updateConfig(config: Partial<BrowserFactoryConfig>): void {
    Object.assign(this.config, config);
    logger.info(`BrowserFactory config updated, mode=${this.config.mode}`);
  }

  getConfig(): Readonly<BrowserFactoryConfig> {
    return this.config;
  }

  getMode(): BrowserMode {
    return this.config.mode;
  }
}
