import { chromium } from 'patchright';
import type { Browser, BrowserContext } from 'patchright';
import { Logger } from '../core/Logger';

const logger = new Logger('BrowserPool');

export interface ContextOptions {
  viewport?: { width: number; height: number } | null;
  userAgent?: string;
  extraArgs?: Record<string, string>;
}

export interface BrowserInstance {
  browser: Browser;
  contexts: Map<string, BrowserContext>;
  createdAt: number;
  lastActivity: number;
  memoryUsageMb: number;
}

export interface PoolStats {
  totalBrowsers: number;
  totalContexts: number;
  activeContexts: number;
  idleContexts: number;
  memoryUsageMb: number;
  memoryOverWatermark: boolean;
}

type ContextMeta = {
  accountId: string;
  browserIndex: number;
  state: 'active' | 'idle' | 'closing' | 'closed';
  lastActiveAt: number;
  createdAt: number;
  refCount: number;
};

export class BrowserPool {
  private instances: BrowserInstance[] = [];
  private contextMetas: Map<string, ContextMeta> = new Map();

  private readonly maxContextsPerBrowser = 15;
  private readonly maxActiveContexts = 30;
  private readonly idleTimeoutMs = 600_000;
  private readonly reapIntervalMs = 30_000;
  private readonly memoryCheckIntervalMs = 10_000;
  private readonly memoryWatermarkPercent = 40;

  private reapTimer: ReturnType<typeof setInterval> | null = null;
  private memoryTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private shuttingDown = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.reapTimer = setInterval(() => this.reapIdleContexts(), this.reapIntervalMs);
    this.memoryTimer = setInterval(() => this.checkMemory(), this.memoryCheckIntervalMs);

    this.initialized = true;
    logger.info('BrowserPool initialized');
  }

  async getContext(accountId: string, options: ContextOptions = {}): Promise<BrowserContext> {
    if (!this.initialized) throw new Error('BrowserPool not initialized');
    if (this.shuttingDown) throw new Error('BrowserPool is shutting down');

    const existing = this.findActiveContext(accountId);
    if (existing) {
      this.touchContext(accountId);
      logger.info(`Reused context for account=${accountId}`);
      return existing;
    }

    const activeCount = this.countByState('active');
    if (activeCount >= this.maxActiveContexts) {
      await this.evictOldestIdle();
    }

    const instance = await this.selectOrCreateInstance();
    const ctx = await instance.browser.newContext({
      viewport: options.viewport ?? null,
      userAgent: options.userAgent,
    });

    instance.contexts.set(accountId, ctx);
    instance.lastActivity = Date.now();

    this.contextMetas.set(accountId, {
      accountId,
      browserIndex: this.instances.indexOf(instance),
      state: 'active',
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
      refCount: 1,
    });

    logger.info(`Created context for account=${accountId}, active=${this.countByState('active')}`);
    return ctx;
  }

  async releaseContext(accountId: string): Promise<void> {
    const meta = this.contextMetas.get(accountId);
    if (!meta) {
      logger.warn(`releaseContext: unknown accountId=${accountId}`);
      return;
    }

    meta.refCount = Math.max(0, meta.refCount - 1);

    if (meta.refCount <= 0) {
      meta.state = 'idle';
      meta.lastActiveAt = Date.now();
    }

    logger.info(`Released context for account=${accountId}, refCount=${meta.refCount}`);
  }

  getStats(): PoolStats {
    let active = 0;
    let idle = 0;
    let total = 0;

    for (const meta of this.contextMetas.values()) {
      total++;
      if (meta.state === 'active') active++;
      else if (meta.state === 'idle') idle++;
    }

    const rssMb = this.getProcessRssMb();
    const totalMemMb = this.getSystemTotalMemoryMb();
    const usagePercent = totalMemMb > 0 ? (rssMb / totalMemMb) * 100 : 0;

    return {
      totalBrowsers: this.instances.length,
      totalContexts: total,
      activeContexts: active,
      idleContexts: idle,
      memoryUsageMb: rssMb,
      memoryOverWatermark: usagePercent > this.memoryWatermarkPercent,
    };
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    if (this.reapTimer) { clearInterval(this.reapTimer); this.reapTimer = null; }
    if (this.memoryTimer) { clearInterval(this.memoryTimer); this.memoryTimer = null; }

    const closeOps: Promise<void>[] = [];

    for (const instance of this.instances) {
      closeOps.push(this.closeInstance(instance));
    }

    await Promise.allSettled(closeOps);

    this.instances = [];
    this.contextMetas.clear();
    this.initialized = false;
    this.shuttingDown = false;

    logger.info('BrowserPool shutdown complete');
  }

  private findActiveContext(accountId: string): BrowserContext | null {
    const meta = this.contextMetas.get(accountId);
    if (!meta) return null;

    if (meta.state === 'closed' || meta.state === 'closing') {
      this.contextMetas.delete(accountId);
      const instance = this.instances[meta.browserIndex];
      instance?.contexts.delete(accountId);
      return null;
    }

    const instance = this.instances[meta.browserIndex];
    if (!instance) {
      this.contextMetas.delete(accountId);
      return null;
    }

    const ctx = instance.contexts.get(accountId);
    if (!ctx) {
      this.contextMetas.delete(accountId);
      return null;
    }

    return ctx;
  }

  private touchContext(accountId: string): void {
    const meta = this.contextMetas.get(accountId);
    if (!meta) return;

    meta.state = 'active';
    meta.refCount++;
    meta.lastActiveAt = Date.now();

    const instance = this.instances[meta.browserIndex];
    if (instance) instance.lastActivity = Date.now();
  }

  private async selectOrCreateInstance(): Promise<BrowserInstance> {
    let best: BrowserInstance | null = null;
    let bestCount = Infinity;

    for (const inst of this.instances) {
      const count = inst.contexts.size;
      if (count < this.maxContextsPerBrowser && count < bestCount) {
        best = inst;
        bestCount = count;
      }
    }

    if (best) return best;
    return this.launchInstance();
  }

  private async launchInstance(): Promise<BrowserInstance> {
    logger.info('Launching new browser instance');

    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: [
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--no-sandbox',
      ],
    });

    const instance: BrowserInstance = {
      browser,
      contexts: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      memoryUsageMb: 0,
    };

    this.instances.push(instance);
    logger.info(`Browser instance launched, total=${this.instances.length}`);
    return instance;
  }

  private async evictOldestIdle(): Promise<void> {
    let oldestMeta: ContextMeta | null = null;

    for (const meta of this.contextMetas.values()) {
      if (meta.state === 'idle') {
        if (!oldestMeta || meta.lastActiveAt < oldestMeta.lastActiveAt) {
          oldestMeta = meta;
        }
      }
    }

    if (!oldestMeta) {
      logger.warn('No idle context to evict, at capacity');
      return;
    }

    logger.info(`Evicting idle context for account=${oldestMeta.accountId}`);
    await this.destroyContext(oldestMeta.accountId);
  }

  private async destroyContext(accountId: string): Promise<void> {
    const meta = this.contextMetas.get(accountId);
    if (!meta) return;

    const instance = this.instances[meta.browserIndex];

    try {
      meta.state = 'closing';
      const ctx = instance?.contexts.get(accountId);
      if (ctx) await ctx.close();
      meta.state = 'closed';
    } catch (err) {
      logger.warn(`Error closing context for account=${accountId}: ${err}`);
    }

    instance?.contexts.delete(accountId);
    this.contextMetas.delete(accountId);

    if (instance && instance.contexts.size === 0) {
      await this.tryCloseInstance(instance);
    }
  }

  private async tryCloseInstance(instance: BrowserInstance): Promise<void> {
    if (instance.contexts.size > 0) return;

    const idx = this.instances.indexOf(instance);
    if (idx === -1) return;

    try {
      await instance.browser.close();
      this.instances.splice(idx, 1);
      logger.info(`Closed empty browser instance, remaining=${this.instances.length}`);
    } catch (err) {
      logger.error(`Error closing browser instance: ${err}`);
    }
  }

  private async reapIdleContexts(): Promise<void> {
    const now = Date.now();
    const toReap: string[] = [];

    for (const [accountId, meta] of this.contextMetas) {
      if (meta.state === 'idle' && (now - meta.lastActiveAt) > this.idleTimeoutMs) {
        toReap.push(accountId);
      }
    }

    if (toReap.length === 0) return;

    logger.info(`Reaping ${toReap.length} idle context(s)`);

    for (const accountId of toReap) {
      await this.destroyContext(accountId);
    }
  }

  private checkMemory(): void {
    const rssMb = this.getProcessRssMb();
    const totalMb = this.getSystemTotalMemoryMb();
    const usagePercent = totalMb > 0 ? (rssMb / totalMb) * 100 : 0;

    if (usagePercent > this.memoryWatermarkPercent) {
      logger.warn(`Memory over watermark: ${usagePercent.toFixed(1)}% > ${this.memoryWatermarkPercent}%`);

      for (const instance of this.instances) {
        instance.memoryUsageMb = rssMb;
      }
    }
  }

  private async closeInstance(instance: BrowserInstance): Promise<void> {
    for (const [accountId, ctx] of instance.contexts) {
      try {
        await ctx.close();
        const meta = this.contextMetas.get(accountId);
        if (meta) meta.state = 'closed';
      } catch (err) {
        logger.warn(`Error closing context for account=${accountId}: ${err}`);
      }
    }

    try {
      await instance.browser.close();
    } catch (err) {
      logger.error(`Error closing browser: ${err}`);
    }
  }

  private countByState(state: ContextMeta['state']): number {
    let count = 0;
    for (const meta of this.contextMetas.values()) {
      if (meta.state === state) count++;
    }
    return count;
  }

  private getProcessRssMb(): number {
    const mem = process.memoryUsage();
    return Math.round((mem.rss / 1024 / 1024) * 100) / 100;
  }

  private getSystemTotalMemoryMb(): number {
    const os = require('os') as typeof import('os');
    return os.totalmem() / 1024 / 1024;
  }
}

export const browserPool = new BrowserPool();
