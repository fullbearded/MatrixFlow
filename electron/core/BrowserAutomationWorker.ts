import { Worker } from 'worker_threads';
import * as path from 'path';
import { Logger } from './Logger';
import { EventBus } from './EventBus';
import type {
  CookieResult,
  PublishContext,
  PublishResult,
  ScheduleContext,
  ScheduleResult,
  CommentContext,
  CommentResult,
  StatsData,
  TimePeriod,
} from '../platform/base/types';

const logger = new Logger('BrowserAutomationWorker');

export interface BrowserWorkerConfig {
  maxRestartAttempts: number;
}

const DEFAULT_WORKER_CONFIG: BrowserWorkerConfig = {
  maxRestartAttempts: 3,
};

// -- Message protocol: main → worker -----------------------------------------

export type WorkerMessage =
  | { type: 'INIT'; config: WorkerInitConfig }
  | { type: 'LOGIN'; taskId: string; accountId: string; platform: string; headless: boolean }
  | { type: 'PUBLISH'; taskId: string; platform: string; context: Omit<PublishContext, 'page'> }
  | { type: 'SCHEDULE'; taskId: string; platform: string; context: Omit<ScheduleContext, 'page'> }
  | { type: 'COMMENT'; taskId: string; platform: string; context: CommentContext }
  | { type: 'FETCH_STATS'; taskId: string; platform: string; accountId: string; period: TimePeriod }
  | { type: 'CHECK_COOKIE'; taskId: string; platform: string; accountId: string }
  | { type: 'SHUTDOWN' };

export interface WorkerInitConfig {
  headless: boolean;
  channel: string;
}

// -- Message protocol: worker → main -----------------------------------------

export type WorkerResponse =
  | { type: 'READY' }
  | { type: 'RESULT'; taskId: string; success: boolean; data?: unknown; error?: string }
  | { type: 'PROGRESS'; taskId: string; progress: number; message: string }
  | { type: 'ERROR'; taskId: string; error: string }
  | { type: 'SHUTDOWN_COMPLETE' };

type PendingTask = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

type ProgressCallback = (progress: number, message: string) => void;

export class BrowserAutomationWorker {
  private config: BrowserWorkerConfig;
  private worker: Worker | null = null;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private progressCallbacks: Map<string, ProgressCallback> = new Map();
  private taskCounter = 0;
  private restartAttempts = 0;
  private ready = false;
  private shuttingDown = false;
  private readyResolve: ((value: void) => void) | null = null;

  constructor(config?: Partial<BrowserWorkerConfig>) {
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }

  async initialize(initConfig?: WorkerInitConfig): Promise<void> {
    if (this.worker) {
      logger.warn('Worker already initialized');
      return;
    }

    this.shuttingDown = false;
    await this.spawnWorker(initConfig);
  }

  private spawnWorker(initConfig?: WorkerInitConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, 'browser-worker.js');
      logger.info(`Spawning worker from: ${workerPath}`);

      this.readyResolve = resolve;
      this.ready = false;

      const worker = new Worker(workerPath);
      this.worker = worker;

      worker.on('message', (msg: WorkerResponse) => {
        this.handleMessage(msg);
      });

      worker.on('error', (err) => {
        logger.error(`Worker error: ${err.message}`);
        this.rejectAllPending(err);
        if (!this.shuttingDown && this.restartAttempts < this.config.maxRestartAttempts) {
          this.restartAttempts++;
          logger.info(`Restarting worker (attempt ${this.restartAttempts}/${this.config.maxRestartAttempts})`);
          this.worker = null;
          this.spawnWorker(initConfig).catch(reject);
        } else {
          reject(err);
        }
      });

      worker.on('exit', (code) => {
        if (code !== 0 && !this.shuttingDown) {
          logger.warn(`Worker exited with code ${code}`);
          this.rejectAllPending(new Error(`Worker exited with code ${code}`));
          if (this.restartAttempts < this.config.maxRestartAttempts) {
            this.restartAttempts++;
            logger.info(`Restarting worker (attempt ${this.restartAttempts}/${this.config.maxRestartAttempts})`);
            this.worker = null;
            this.spawnWorker(initConfig).catch(reject);
          }
        }
      });

      if (initConfig) {
        this.postMessage({ type: 'INIT', config: initConfig });
      } else {
        this.postMessage({
          type: 'INIT',
          config: { headless: false, channel: 'chrome' },
        });
      }
    });
  }

  private handleMessage(msg: WorkerResponse): void {
    switch (msg.type) {
      case 'READY':
        this.ready = true;
        this.restartAttempts = 0;
        logger.info('Worker ready');
        if (this.readyResolve) {
          this.readyResolve();
          this.readyResolve = null;
        }
        break;

      case 'RESULT': {
        const pending = this.pendingTasks.get(msg.taskId);
        if (pending) {
          this.pendingTasks.delete(msg.taskId);
          this.progressCallbacks.delete(msg.taskId);
          if (msg.success) {
            pending.resolve(msg.data);
          } else {
            pending.reject(new Error(msg.error ?? 'Unknown worker error'));
          }
        }
        break;
      }

      case 'PROGRESS': {
        const cb = this.progressCallbacks.get(msg.taskId);
        if (cb) cb(msg.progress, msg.message);
        break;
      }

      case 'ERROR': {
        const pending = this.pendingTasks.get(msg.taskId);
        if (pending) {
          this.pendingTasks.delete(msg.taskId);
          this.progressCallbacks.delete(msg.taskId);
          pending.reject(new Error(msg.error));
        }
        break;
      }

      case 'SHUTDOWN_COMPLETE':
        logger.info('Worker shutdown complete');
        break;
    }
  }

  private nextTaskId(): string {
    return `task-${++this.taskCounter}-${Date.now()}`;
  }

  private postMessage(msg: WorkerMessage): void {
    if (!this.worker) throw new Error('Worker not initialized');
    this.worker.postMessage(msg);
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pendingTasks) {
      pending.reject(err);
    }
    this.pendingTasks.clear();
    this.progressCallbacks.clear();
  }

  private executeTask<T>(msg: WorkerMessage, onProgress?: ProgressCallback): Promise<T> {
    if (!this.ready || !this.worker) {
      return Promise.reject(new Error('Worker not ready'));
    }

    return new Promise<T>((resolve, reject) => {
      const taskId = (msg as any).taskId ?? this.nextTaskId();
      (msg as any).taskId = taskId;

      this.pendingTasks.set(taskId, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });

      if (onProgress) {
        this.progressCallbacks.set(taskId, onProgress);
      }

      this.postMessage(msg);
    });
  }

  async executeLogin(
    accountId: string,
    platform: string,
    headless = false,
  ): Promise<CookieResult> {
    const taskId = this.nextTaskId();
    return this.executeTask<CookieResult>({
      type: 'LOGIN',
      taskId,
      accountId,
      platform,
      headless,
    });
  }

  async executePublish(
    platform: string,
    context: Omit<PublishContext, 'page'>,
    onProgress?: ProgressCallback,
  ): Promise<PublishResult> {
    const taskId = this.nextTaskId();
    return this.executeTask<PublishResult>(
      { type: 'PUBLISH', taskId, platform, context },
      onProgress,
    );
  }

  async executeSchedule(
    platform: string,
    context: Omit<ScheduleContext, 'page'>,
  ): Promise<ScheduleResult> {
    const taskId = this.nextTaskId();
    return this.executeTask<ScheduleResult>({
      type: 'SCHEDULE',
      taskId,
      platform,
      context,
    });
  }

  async executeComment(
    platform: string,
    context: CommentContext,
  ): Promise<CommentResult> {
    const taskId = this.nextTaskId();
    return this.executeTask<CommentResult>({
      type: 'COMMENT',
      taskId,
      platform,
      context,
    });
  }

  async executeFetchStats(
    platform: string,
    accountId: string,
    period: TimePeriod,
  ): Promise<StatsData> {
    const taskId = this.nextTaskId();
    return this.executeTask<StatsData>({
      type: 'FETCH_STATS',
      taskId,
      platform,
      accountId,
      period,
    });
  }

  async executeCheckCookie(
    platform: string,
    accountId: string,
  ): Promise<boolean> {
    const taskId = this.nextTaskId();
    return this.executeTask<boolean>({
      type: 'CHECK_COOKIE',
      taskId,
      platform,
      accountId,
    });
  }

  async shutdown(): Promise<void> {
    if (!this.worker) return;
    this.shuttingDown = true;

    try {
      this.postMessage({ type: 'SHUTDOWN' });

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('Worker shutdown timed out, terminating');
          this.terminateWorker();
          resolve();
        }, 10_000);

        const handler = (msg: WorkerResponse) => {
          if (msg.type === 'SHUTDOWN_COMPLETE') {
            clearTimeout(timeout);
            this.worker?.off('message', handler);
            resolve();
          }
        };

        this.worker!.on('message', handler);
      });
    } catch {
      this.terminateWorker();
    }

    this.worker = null;
    this.ready = false;
    this.shuttingDown = false;
    this.rejectAllPending(new Error('Worker shutting down'));
    logger.info('BrowserAutomationWorker shutdown complete');
  }

  private terminateWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
    }
  }

  isReady(): boolean {
    return this.ready;
  }
}
