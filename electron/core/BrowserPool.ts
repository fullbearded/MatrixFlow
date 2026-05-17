import type { Browser } from 'patchright';
import { Logger } from './Logger';
import { EventBus } from './EventBus';
import { BrowserContext } from './BrowserContext';
import { BrowserFactory } from './BrowserFactory';
import type { BrowserFactoryConfig, BrowserMode } from './BrowserFactory';
import {
  DEFAULT_POOL_CONFIG,
  ContextState,
  BrowserPoolEvent,
} from './types/browser';
import type {
  BrowserPoolConfig,
  PooledBrowser,
  ManagedContext,
  PoolStats,
} from './types/browser';

const logger = new Logger('BrowserPool');

export class BrowserPool {
  private static instance: BrowserPool;

  private config: BrowserPoolConfig;
  private factory: BrowserFactory;
  private browsers: Map<string, PooledBrowser> = new Map();
  private accountIdToBrowserId: Map<string, string> = new Map();
  private wrapperCache: Map<string, BrowserContext> = new Map();

  private initialized = false;
  private shuttingDown = false;
  private memoryTimer: ReturnType<typeof setInterval> | null = null;
  private reapTimer: ReturnType<typeof setInterval> | null = null;
  private browserIdCounter = 0;

  private constructor(config?: Partial<BrowserPoolConfig>) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.factory = new BrowserFactory();
  }

  static getInstance(config?: Partial<BrowserPoolConfig>): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool(config);
    }
    return BrowserPool.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Already initialized, skipping');
      return;
    }

    logger.info('Initializing BrowserPool');
    logger.info(`Config: maxContextsPerBrowser=${this.config.maxContextsPerBrowser}, maxActiveContexts=${this.config.maxActiveContexts}, memoryWatermark=${this.config.memoryWatermarkPercent}%`);

    this.startMemoryMonitor();
    this.startIdleReaper();

    this.initialized = true;
    logger.info('BrowserPool initialized');
  }

  async acquireContext(accountId: string): Promise<BrowserContext> {
    if (!this.initialized) throw new Error('BrowserPool not initialized');
    if (this.shuttingDown) throw new Error('BrowserPool is shutting down');

    const existing = this.findExistingContext(accountId);
    if (existing) {
      return this.activateExisting(existing, accountId);
    }

    const activeCount = this.countActiveContexts();
    if (activeCount >= this.config.maxActiveContexts) {
      await this.evictIdleContext();
    }

    const pooled = await this.selectOrCreateBrowser();
    const managed = await this.createManagedContext(pooled, accountId);

    pooled.contexts.set(accountId, managed);
    const browserId = this.getBrowserId(pooled);
    this.accountIdToBrowserId.set(accountId, browserId);

    const wrapper = new BrowserContext(managed);
    this.wrapperCache.set(accountId, wrapper);

    EventBus.getInstance().emit(BrowserPoolEvent.CONTEXT_ACQUIRED, { accountId });
    logger.info(`Context acquired for account=${accountId}, browser=${browserId}, active=${this.countActiveContexts()}`);

    return wrapper;
  }

  releaseContext(accountId: string): void {
    const browserId = this.accountIdToBrowserId.get(accountId);
    if (!browserId) {
      logger.warn(`releaseContext: no binding for accountId=${accountId}`);
      return;
    }

    const pooled = this.browsers.get(browserId);
    if (!pooled) return;

    const managed = pooled.contexts.get(accountId);
    if (!managed) return;

    managed.refCount = Math.max(0, managed.refCount - 1);

    if (managed.refCount <= 0) {
      managed.state = ContextState.IDLE;
      managed.lastActiveAt = Date.now();
    }

    EventBus.getInstance().emit(BrowserPoolEvent.CONTEXT_RELEASED, { accountId, refCount: managed.refCount });
    logger.info(`Context released for account=${accountId}, refCount=${managed.refCount}`);
  }

  getStats(): PoolStats {
    let activeContexts = 0;
    let idleContexts = 0;
    let totalBindings = 0;

    for (const pooled of this.browsers.values()) {
      for (const ctx of pooled.contexts.values()) {
        if (ctx.state === ContextState.ACTIVE) activeContexts++;
        else if (ctx.state === ContextState.IDLE) idleContexts++;
      }
      totalBindings += pooled.contexts.size;
    }

    const rssMb = this.getProcessRssMb();
    const watermark = this.config.memoryWatermarkPercent;
    const totalMemoryMb = this.getSystemTotalMemoryMb();
    const usagePercent = totalMemoryMb > 0 ? (rssMb / totalMemoryMb) * 100 : 0;

    return {
      totalBrowsers: this.browsers.size,
      activeContexts,
      idleContexts,
      memoryUsageMb: rssMb,
      memoryOverWatermark: usagePercent > watermark,
      accountBindings: totalBindings,
    };
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    logger.info('Shutting down BrowserPool');

    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const [id, pooled] of this.browsers) {
      pooled.closing = true;
      closePromises.push(this.closePooledBrowser(id, pooled));
    }

    await Promise.allSettled(closePromises);

    this.browsers.clear();
    this.accountIdToBrowserId.clear();
    this.wrapperCache.clear();

    this.initialized = false;
    this.shuttingDown = false;
    logger.info('BrowserPool shutdown complete');
  }

  private async closePooledBrowser(id: string, pooled: PooledBrowser): Promise<void> {
    try {
      for (const [accountId, ctx] of pooled.contexts) {
        try {
          ctx.state = ContextState.CLOSING;
          await ctx.context.close();
          ctx.state = ContextState.CLOSED;
          logger.debug(`Closed context for account=${accountId}`);
        } catch (err) {
          logger.warn(`Error closing context for account=${accountId}: ${err}`);
        }
      }

      await pooled.browser.close();
      EventBus.getInstance().emit(BrowserPoolEvent.BROWSER_CLOSED, { browserId: id });
      logger.info(`Browser ${id} closed`);
    } catch (err) {
      logger.error(`Error closing browser ${id}: ${err}`);
    }
  }

  private findExistingContext(accountId: string): ManagedContext | null {
    const browserId = this.accountIdToBrowserId.get(accountId);
    if (!browserId) return null;

    const pooled = this.browsers.get(browserId);
    if (!pooled || pooled.closing) {
      this.accountIdToBrowserId.delete(accountId);
      this.wrapperCache.delete(accountId);
      return null;
    }

    const managed = pooled.contexts.get(accountId);
    if (!managed || managed.state === ContextState.CLOSED || managed.state === ContextState.CLOSING) {
      pooled.contexts.delete(accountId);
      this.accountIdToBrowserId.delete(accountId);
      this.wrapperCache.delete(accountId);
      return null;
    }

    return managed;
  }

  private async activateExisting(managed: ManagedContext, accountId: string): Promise<BrowserContext> {
    managed.state = ContextState.ACTIVE;
    managed.refCount++;
    managed.lastActiveAt = Date.now();

    let wrapper = this.wrapperCache.get(accountId);
    if (!wrapper) {
      wrapper = new BrowserContext(managed);
      this.wrapperCache.set(accountId, wrapper);
    }

    logger.info(`Reused existing context for account=${accountId}, refCount=${managed.refCount}`);
    EventBus.getInstance().emit(BrowserPoolEvent.CONTEXT_ACQUIRED, { accountId, reused: true });

    return wrapper;
  }

  private async selectOrCreateBrowser(): Promise<PooledBrowser> {
    let best: PooledBrowser | null = null;
    let bestCount = Infinity;

    for (const pooled of this.browsers.values()) {
      if (pooled.closing) continue;
      const count = pooled.contexts.size;
      if (count < this.config.maxContextsPerBrowser && count < bestCount) {
        best = pooled;
        bestCount = count;
      }
    }

    if (best) return best;

    return this.launchNewBrowser();
  }

  setMode(mode: BrowserMode, factoryConfig?: Partial<BrowserFactoryConfig>): void {
    this.factory.updateConfig({ mode, ...factoryConfig });
    logger.info(`BrowserPool mode set to: ${mode}`);
  }

  private async launchNewBrowser(): Promise<PooledBrowser> {
    const id = (++this.browserIdCounter).toString();
    const opts = this.config.launchOptions;
    const mode = this.factory.getMode();

    logger.info(`Launching browser #${id} (mode=${mode}), channel=${opts.channel}, headless=${opts.headless}`);

    const browser: Browser = await this.factory.createBrowser({
      channel: opts.channel,
      headless: opts.headless,
      args: opts.args,
    });

    const pooled: PooledBrowser = {
      browser,
      contexts: new Map(),
      createdAt: Date.now(),
      closing: false,
    };

    this.browsers.set(id, pooled);

    EventBus.getInstance().emit(BrowserPoolEvent.BROWSER_CREATED, { browserId: id });
    logger.info(`Browser #${id} launched, total browsers=${this.browsers.size}`);

    return pooled;
  }

  private async createManagedContext(pooled: PooledBrowser, accountId: string): Promise<ManagedContext> {
    const browserId = this.getBrowserId(pooled);

    logger.debug(`Creating new context for account=${accountId} on browser=${browserId}`);

    const pwCtx = await pooled.browser.newContext({
      viewport: this.config.launchOptions.viewport,
    });

    const managed: ManagedContext = {
      context: pwCtx,
      browserId,
      accountId,
      state: ContextState.ACTIVE,
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
      refCount: 1,
    };

    return managed;
  }

  private getBrowserId(pooled: PooledBrowser): string {
    for (const [id, p] of this.browsers) {
      if (p === pooled) return id;
    }
    return 'unknown';
  }

  private countActiveContexts(): number {
    let count = 0;
    for (const pooled of this.browsers.values()) {
      for (const ctx of pooled.contexts.values()) {
        if (ctx.state === ContextState.ACTIVE) count++;
      }
    }
    return count;
  }

  private async evictIdleContext(): Promise<void> {
    let oldest: ManagedContext | null = null;
    let oldestBrowserId = '';
    let oldestAccountId = '';

    for (const [browserId, pooled] of this.browsers) {
      for (const [accountId, ctx] of pooled.contexts) {
        if (ctx.state === ContextState.IDLE) {
          if (!oldest || ctx.lastActiveAt < oldest.lastActiveAt) {
            oldest = ctx;
            oldestBrowserId = browserId;
            oldestAccountId = accountId;
          }
        }
      }
    }

    if (!oldest) {
      logger.warn('No idle context to evict, at capacity');
      return;
    }

    logger.info(`Evicting idle context for account=${oldestAccountId}`);
    await this.destroyContext(oldestBrowserId, oldestAccountId, oldest);
  }

  private async destroyContext(browserId: string, accountId: string, managed: ManagedContext): Promise<void> {
    try {
      managed.state = ContextState.CLOSING;
      await managed.context.close();
      managed.state = ContextState.CLOSED;
    } catch (err) {
      logger.warn(`Error closing context for account=${accountId}: ${err}`);
    }

    const pooled = this.browsers.get(browserId);
    if (pooled) {
      pooled.contexts.delete(accountId);
      if (pooled.contexts.size === 0) {
        await this.tryCloseEmptyBrowser(browserId, pooled);
      }
    }

    this.accountIdToBrowserId.delete(accountId);
    this.wrapperCache.delete(accountId);

    EventBus.getInstance().emit(BrowserPoolEvent.CONTEXT_REAPED, { accountId, reason: 'evicted' });
  }

  private async tryCloseEmptyBrowser(browserId: string, pooled: PooledBrowser): Promise<void> {
    if (pooled.contexts.size > 0) return;

    pooled.closing = true;
    try {
      await pooled.browser.close();
      this.browsers.delete(browserId);
      EventBus.getInstance().emit(BrowserPoolEvent.BROWSER_CLOSED, { browserId });
      logger.info(`Closed empty browser ${browserId}`);
    } catch (err) {
      logger.error(`Error closing browser ${browserId}: ${err}`);
    }
  }

  private startMemoryMonitor(): void {
    const eventBus = EventBus.getInstance();
    let wasOverWatermark = false;

    this.memoryTimer = setInterval(() => {
      const rssMb = this.getProcessRssMb();
      const totalMb = this.getSystemTotalMemoryMb();
      const usagePercent = totalMb > 0 ? (rssMb / totalMb) * 100 : 0;
      const overWatermark = usagePercent > this.config.memoryWatermarkPercent;

      logger.debug(`Memory: RSS=${rssMb}MB, usage=${usagePercent.toFixed(1)}%, watermark=${this.config.memoryWatermarkPercent}%`);

      if (overWatermark && !wasOverWatermark) {
        logger.warn(`Memory over watermark: ${usagePercent.toFixed(1)}% > ${this.config.memoryWatermarkPercent}%`);
        eventBus.emit(BrowserPoolEvent.MEMORY_HIGH, { rssMb, usagePercent });
        wasOverWatermark = true;
      } else if (!overWatermark && wasOverWatermark) {
        logger.info(`Memory back to normal: ${usagePercent.toFixed(1)}%`);
        eventBus.emit(BrowserPoolEvent.MEMORY_NORMAL, { rssMb, usagePercent });
        wasOverWatermark = false;
      }
    }, this.config.memoryCheckIntervalMs);
  }

  private startIdleReaper(): void {
    this.reapTimer = setInterval(() => {
      this.reapIdleContexts();
    }, 30_000);
  }

  private async reapIdleContexts(): Promise<void> {
    const timeoutMs = this.config.idleTimeoutMs;
    const now = Date.now();
    const toReap: Array<{ browserId: string; accountId: string; managed: ManagedContext }> = [];

    for (const [browserId, pooled] of this.browsers) {
      if (pooled.closing) continue;
      for (const [accountId, ctx] of pooled.contexts) {
        if (ctx.state === ContextState.IDLE && (now - ctx.lastActiveAt) > timeoutMs) {
          toReap.push({ browserId, accountId, managed: ctx });
        }
      }
    }

    if (toReap.length === 0) return;

    logger.info(`Reaping ${toReap.length} idle context(s)`);

    for (const { browserId, accountId, managed } of toReap) {
      await this.destroyContext(browserId, accountId, managed);
    }
  }

  private getProcessRssMb(): number {
    const mem = process.memoryUsage();
    return Math.round(mem.rss / 1024 / 1024 * 100) / 100;
  }

  private getSystemTotalMemoryMb(): number {
    const os = require('os') as typeof import('os');
    return os.totalmem() / 1024 / 1024;
  }
}

export const browserPool = BrowserPool.getInstance();
