// ============================================================
// BrowserPool 类型定义
// 多 Browser 实例池 + 账号亲和性 Context 管理
// ============================================================

import type { Browser, BrowserContext as PwBrowserContext } from 'patchright';

// -----------------------------------------------------------
// 池配置
// -----------------------------------------------------------

export interface BrowserPoolConfig {
  /** 每个 Browser 实例最多承载的 context 数量 */
  maxContextsPerBrowser: number;
  /** 全局最大活动 context 数量 */
  maxActiveContexts: number;
  /** 内存水位阈值（百分比 0-100），超过则触发清理 */
  memoryWatermarkPercent: number;
  /** 空闲 context 超时释放时间（毫秒） */
  idleTimeoutMs: number;
  /** 内存监控采样间隔（毫秒） */
  memoryCheckIntervalMs: number;
  /** Patchright 启动参数 */
  launchOptions: BrowserLaunchOptions;
}

export interface BrowserLaunchOptions {
  /** 浏览器 channel */
  channel: string;
  /** 是否无头模式 */
  headless: boolean;
  /** viewport 设置（null = 最大隐蔽性） */
  viewport: null;
  /** 额外 Chromium 启动参数 */
  args: string[];
}

export const DEFAULT_POOL_CONFIG: BrowserPoolConfig = {
  maxContextsPerBrowser: 12,
  maxActiveContexts: 30,
  memoryWatermarkPercent: 40,
  idleTimeoutMs: 5 * 60 * 1000, // 5 分钟
  memoryCheckIntervalMs: 10_000, // 10 秒
  launchOptions: {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: [
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
    ],
  },
};

// -----------------------------------------------------------
// Context 状态
// -----------------------------------------------------------

export enum ContextState {
  /** 空闲，可被获取 */
  IDLE = 'idle',
  /** 正在被使用 */
  ACTIVE = 'active',
  /** 正在关闭 */
  CLOSING = 'closing',
  /** 已关闭 */
  CLOSED = 'closed',
}

// -----------------------------------------------------------
// 内部数据结构
// -----------------------------------------------------------

/** 池中的 Browser 实例包装 */
export interface PooledBrowser {
  /** Patchright Browser 实例 */
  browser: Browser;
  /** 该 Browser 下所有 accountId → ManagedContext 的映射 */
  contexts: Map<string, ManagedContext>;
  /** 创建时间 */
  createdAt: number;
  /** 是否正在关闭 */
  closing: boolean;
}

/** 账号绑定的 Context 管理 */
export interface ManagedContext {
  /** Patchright BrowserContext */
  context: PwBrowserContext;
  /** 所属 Browser 实例 ID */
  browserId: string;
  /** 绑定的账号 ID */
  accountId: string;
  /** 当前状态 */
  state: ContextState;
  /** 最后活跃时间戳 */
  lastActiveAt: number;
  /** 创建时间 */
  createdAt: number;
  /** 引用计数（acquire +1，release -1） */
  refCount: number;
}

// -----------------------------------------------------------
// 统计
// -----------------------------------------------------------

export interface PoolStats {
  /** Browser 实例总数 */
  totalBrowsers: number;
  /** 活动 context 数量 */
  activeContexts: number;
  /** 空闲 context 数量 */
  idleContexts: number;
  /** 当前进程 RSS（MB） */
  memoryUsageMb: number;
  /** 内存水位是否超限 */
  memoryOverWatermark: boolean;
  /** 账号绑定映射数量 */
  accountBindings: number;
}

// -----------------------------------------------------------
// 事件
// -----------------------------------------------------------

export enum BrowserPoolEvent {
  /** Browser 实例创建 */
  BROWSER_CREATED = 'browser-pool:browser-created',
  /** Browser 实例关闭 */
  BROWSER_CLOSED = 'browser-pool:browser-closed',
  /** Context 被获取 */
  CONTEXT_ACQUIRED = 'browser-pool:context-acquired',
  /** Context 被释放 */
  CONTEXT_RELEASED = 'browser-pool:context-released',
  /** Context 因空闲超时被回收 */
  CONTEXT_REAPED = 'browser-pool:context-reaped',
  /** 内存超过水位 */
  MEMORY_HIGH = 'browser-pool:memory-high',
  /** 内存恢复正常 */
  MEMORY_NORMAL = 'browser-pool:memory-normal',
}
