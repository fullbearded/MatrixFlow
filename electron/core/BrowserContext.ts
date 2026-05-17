import type { BrowserContext as PwBrowserContext, Page } from 'patchright';
import type { ManagedContext, ContextState } from './types/browser';
import { Logger } from './Logger';

const logger = new Logger('BrowserContext');

export class BrowserContext {
  private managed: ManagedContext;

  constructor(managed: ManagedContext) {
    this.managed = managed;
  }

  get accountId(): string {
    return this.managed.accountId;
  }

  get state(): ContextState {
    return this.managed.state;
  }

  get raw(): PwBrowserContext {
    return this.managed.context;
  }

  get lastActiveAt(): number {
    return this.managed.lastActiveAt;
  }

  async newPage(): Promise<Page> {
    if (this.managed.state !== 'active') {
      throw new Error(`BrowserContext for ${this.managed.accountId} is not active (state: ${this.managed.state})`);
    }
    const page = await this.managed.context.newPage();
    this.touch();
    return page;
  }

  async pages(): Promise<Page[]> {
    return this.managed.context.pages();
  }

  async closePage(page: Page): Promise<void> {
    try {
      await page.close();
    } catch (err) {
      logger.warn(`Failed to close page for ${this.managed.accountId}: ${err}`);
    }
  }

  async addCookies(cookies: Parameters<PwBrowserContext['addCookies']>[0]): Promise<void> {
    await this.managed.context.addCookies(cookies);
    this.touch();
  }

  async cookies(...urls: string[]): Promise<Awaited<ReturnType<PwBrowserContext['cookies']>>> {
    return this.managed.context.cookies(...urls);
  }

  async clearCookies(...args: any[]): Promise<void> {
    await (this.managed.context as any).clearCookies(...args);
  }

  touch(): void {
    this.managed.lastActiveAt = Date.now();
  }

  isIdle(timeoutMs: number): boolean {
    return this.managed.state === 'idle' && (Date.now() - this.managed.lastActiveAt) > timeoutMs;
  }

  isActive(): boolean {
    return this.managed.state === 'active';
  }
}
