import { parentPort } from 'worker_threads';
import { chromium, type Browser, type BrowserContext } from 'patchright';
import type { WorkerMessage, WorkerResponse, WorkerInitConfig } from './BrowserAutomationWorker';
import type {
  PublishContext,
  PublishResult,
  ScheduleContext,
  ScheduleResult,
  CommentContext,
  CommentResult,
  StatsData,
  TimePeriod,
  CookieResult,
} from '../platform/base/types';
import type { PlatformAdapter } from '../platform/base/interfaces';

const PLATFORM_ADAPTERS: Record<string, () => PlatformAdapter> = {
  douyin: () => require('../platform/douyin').douyinAdapter as PlatformAdapter,
  xiaohongshu: () => require('../platform/xiaohongshu').xiaohongshuAdapter as PlatformAdapter,
  channels: () => require('../platform/channels').channelsAdapter as PlatformAdapter,
  kuaishou: () => require('../platform/kuaishou').kuaishouAdapter as PlatformAdapter,
};

function log(level: string, message: string): void {
  console.log(`[browser-worker] [${level}] ${message}`);
}

function send(msg: WorkerResponse): void {
  parentPort?.postMessage(msg);
}

class BrowserWorkerRuntime {
  private browser: Browser | null = null;
  private initConfig: WorkerInitConfig | null = null;

  async handleInit(config: WorkerInitConfig): Promise<void> {
    this.initConfig = config;
    log('info', `Initializing browser (headless=${config.headless}, channel=${config.channel})`);

    this.browser = await chromium.launch({
      headless: config.headless,
      channel: config.channel,
      args: [
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--no-sandbox',
      ],
    });

    log('info', 'Browser launched');
    send({ type: 'READY' });
  }

  async handleLogin(taskId: string, accountId: string, platform: string, headless: boolean): Promise<void> {
    const adapter = this.getAdapter(platform);
    const result: CookieResult = await adapter.login(accountId, headless);
    send({ type: 'RESULT', taskId, success: result.success, data: result });
  }

  async handlePublish(taskId: string, platform: string, ctx: Omit<PublishContext, 'page'>): Promise<void> {
    const adapter = this.getAdapter(platform);
    send({ type: 'PROGRESS', taskId, progress: 0.1, message: 'Starting publish' });

    const fullCtx: PublishContext = { ...ctx };
    const result: PublishResult = await adapter.publish(fullCtx);
    send({ type: 'RESULT', taskId, success: result.success, data: result });
  }

  async handleSchedule(taskId: string, platform: string, ctx: Omit<ScheduleContext, 'page'>): Promise<void> {
    const adapter = this.getAdapter(platform);
    if (!adapter.schedule) {
      send({ type: 'RESULT', taskId, success: false, error: `Platform ${platform} does not support scheduling` });
      return;
    }
    send({ type: 'PROGRESS', taskId, progress: 0.1, message: 'Starting schedule' });

    const fullCtx: ScheduleContext = { ...ctx };
    const result: ScheduleResult = await adapter.schedule(fullCtx);
    send({ type: 'RESULT', taskId, success: result.success, data: result });
  }

  async handleComment(taskId: string, platform: string, ctx: CommentContext): Promise<void> {
    const adapter = this.getAdapter(platform);
    const commentAdapter = adapter as unknown as import('../platform/base/interfaces').ICommentAdapter;
    if (typeof commentAdapter.postComment !== 'function') {
      send({ type: 'RESULT', taskId, success: false, error: `Platform ${platform} does not support comments` });
      return;
    }
    const result: CommentResult = await commentAdapter.postComment(ctx);
    send({ type: 'RESULT', taskId, success: result.success, data: result });
  }

  async handleFetchStats(taskId: string, platform: string, accountId: string, period: TimePeriod): Promise<void> {
    const adapter = this.getAdapter(platform);
    send({ type: 'PROGRESS', taskId, progress: 0.1, message: 'Fetching stats' });
    const result: StatsData = await adapter.fetchStats(accountId, period);
    send({ type: 'RESULT', taskId, success: !result.error, data: result });
  }

  async handleCheckCookie(taskId: string, platform: string, accountId: string): Promise<void> {
    const adapter = this.getAdapter(platform);
    const valid = await adapter.checkCookie(accountId);
    send({ type: 'RESULT', taskId, success: true, data: valid });
  }

  async handleShutdown(): Promise<void> {
    log('info', 'Shutting down');
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore
      }
      this.browser = null;
    }
    send({ type: 'SHUTDOWN_COMPLETE' });
    process.exit(0);
  }

  private getAdapter(platform: string): PlatformAdapter {
    const loader = PLATFORM_ADAPTERS[platform];
    if (!loader) {
      throw new Error(`Unknown platform: ${platform}`);
    }
    return loader();
  }
}

const runtime = new BrowserWorkerRuntime();

parentPort?.on('message', async (msg: WorkerMessage) => {
  try {
    switch (msg.type) {
      case 'INIT':
        await runtime.handleInit(msg.config);
        break;
      case 'LOGIN':
        await runtime.handleLogin(msg.taskId, msg.accountId, msg.platform, msg.headless);
        break;
      case 'PUBLISH':
        await runtime.handlePublish(msg.taskId, msg.platform, msg.context);
        break;
      case 'SCHEDULE':
        await runtime.handleSchedule(msg.taskId, msg.platform, msg.context);
        break;
      case 'COMMENT':
        await runtime.handleComment(msg.taskId, msg.platform, msg.context);
        break;
      case 'FETCH_STATS':
        await runtime.handleFetchStats(msg.taskId, msg.platform, msg.accountId, msg.period);
        break;
      case 'CHECK_COOKIE':
        await runtime.handleCheckCookie(msg.taskId, msg.platform, msg.accountId);
        break;
      case 'SHUTDOWN':
        await runtime.handleShutdown();
        break;
    }
  } catch (err: any) {
    const taskId = (msg as any).taskId;
    if (taskId) {
      send({ type: 'ERROR', taskId, error: err?.message ?? String(err) });
    } else {
      log('error', `Unhandled error: ${err?.message ?? err}`);
    }
  }
});
