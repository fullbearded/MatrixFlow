import { ipcMain, BrowserWindow } from 'electron';
import { PlatformRegistry } from '../platform/base/PlatformRegistry';
import { EventBus } from '../core/EventBus';
import { Logger } from '../core/Logger';
import { accountService } from '../services/AccountService';
import { publishService } from '../services/PublishService';
import { contentService } from '../services/ContentService';
import { groupService } from '../services/GroupService';
import { statsService } from '../services/StatsService';
import { getDatabase } from '../data/Database';
import { getAIService } from '../ai/AIService';
import { anomalyService } from '../services/AnomalyService';
import { monitorService } from '../services/MonitorService';
import { weeklyReportService } from '../services/WeeklyReportService';
import { multiPanelService } from '../services/MultiPanelService';
import { draftService } from '../services/DraftService';
import { commentService } from '../services/CommentService';
import { licenseService } from '../services/LicenseService';
import { proxyService } from '../services/ProxyService';
import { fingerprintTemplateRepo } from '../data/repositories/FingerprintTemplateRepository';
import { autoUpdaterService } from '../core/AutoUpdater';
import type { PrePublishContext, RuleOptimizationContext } from '../ai/types';
import type { Account } from '../services/types/account';
import type {
  PublishTask,
  PublishResult,
  PublishTaskStatusDetail,
  PublishRequest,
} from '../services/types/publish';
import type { PlatformConfig, PlatformCapabilities, CookieResult } from '../platform/base/types';
import type { PublishEvent } from '../core/types/eventbus';

const logger = new Logger('IPC');

const CHANNEL = {
  ACCOUNT_LIST: 'account:list',
  ACCOUNT_ADD: 'account:add',
  ACCOUNT_REMOVE: 'account:remove',
  ACCOUNT_VALIDATE: 'account:validate',

  PUBLISH_SUBMIT: 'publish:submit',
  PUBLISH_CANCEL: 'publish:cancel',
  PUBLISH_STATUS: 'publish:status',

  TASK_LIST: 'task:list',
  TASK_RETRY: 'task:retry',

  PLATFORM_LIST: 'platform:list',
  PLATFORM_LOGIN: 'platform:login',

  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_CREATE: 'accounts:create',
  ACCOUNTS_DELETE: 'accounts:delete',
  ACCOUNTS_LOGIN: 'accounts:login',
  ACCOUNTS_CHECK_COOKIE: 'accounts:checkCookie',
  ACCOUNTS_GET_QR_CODE: 'accounts:getQRCode',
  CONTENT_LIST: 'content:list',
  CONTENT_CREATE: 'content:create',
  CONTENT_DELETE: 'content:delete',
  CONTENT_UPDATE: 'content:update',
  CONTENT_UPLOAD_VIDEO: 'content:uploadVideo',
  GROUPS_LIST: 'groups:list',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_DELETE: 'groups:delete',
  GROUPS_BIND_ACCOUNTS: 'groups:bindAccounts',
  PUBLISH_CREATE_TASK: 'publish:createTask',
  PUBLISH_UPDATE_TASK: 'publish:updateTask',
  PUBLISH_DELETE_TASK: 'publish:deleteTask',
  PUBLISH_CANCEL_TASK: 'publish:cancelTask',
  PUBLISH_RETRY_TASK: 'publish:retryTask',
  PUBLISH_LIST_TASKS: 'publish:listTasks',
  PLATFORMS_LIST: 'platforms:list',
  PLATFORMS_GET_CONFIG: 'platforms:getConfig',
  PLATFORMS_GET_CAPABILITIES: 'platforms:getCapabilities',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  STATS_OVERVIEW: 'stats:overview',
  STATS_PLATFORM: 'stats:platform',
  STATS_TREND: 'stats:trend',
  DB_QUERY: 'db:query',
  AI_PREPUBLISH_CHECK: 'ai:prePublishCheck',
  AI_OPTIMIZE_RULE: 'ai:optimizeRule',
  AI_GET_COST_SUMMARY: 'ai:getCostSummary',
  AI_GET_ALERTS: 'ai:getAlerts',
  AI_DISMISS_ALERT: 'ai:dismissAlert',
  MONITOR_CREATE_PLAN: 'monitor:createPlan',
  MONITOR_UPDATE_PLAN: 'monitor:updatePlan',
  MONITOR_DELETE_PLAN: 'monitor:deletePlan',
  MONITOR_LIST_PLANS: 'monitor:listPlans',
  MONITOR_GET_ALERTS: 'monitor:getAlerts',
  REPORT_GENERATE: 'report:generate',
  REPORT_GET_LATEST: 'report:getLatest',
  PANEL_OPEN: 'panel:open',
  PANEL_CLOSE: 'panel:close',
  PANEL_FOCUS: 'panel:focus',
  PANEL_LIST: 'panel:list',
  DRAFT_CREATE: 'draft:create',
  DRAFT_UPDATE: 'draft:update',
  DRAFT_DELETE: 'draft:delete',
  DRAFT_LIST: 'draft:list',
  DRAFT_DUPLICATE: 'draft:duplicate',
  COMMENT_TEMPLATE_CREATE: 'comment:template:create',
  COMMENT_TEMPLATE_UPDATE: 'comment:template:update',
  COMMENT_TEMPLATE_DELETE: 'comment:template:delete',
  COMMENT_TEMPLATE_LIST: 'comment:template:list',
  COMMENT_SCHEDULE: 'comment:schedule',
  COMMENT_EXECUTE: 'comment:execute',
  COMMENT_TASK_LIST: 'comment:task:list',
  LICENSE_STATUS: 'license:status',
  LICENSE_ACTIVATE: 'license:activate',
  LICENSE_ACTIVATE_OFFLINE: 'license:activate:offline',
  LICENSE_OFFLINE_REQUEST: 'license:offline:request',
  LICENSE_DEACTIVATE: 'license:deactivate',

  PROXY_LIST: 'proxy:list',
  PROXY_GET: 'proxy:get',
  PROXY_CREATE: 'proxy:create',
  PROXY_UPDATE: 'proxy:update',
  PROXY_DELETE: 'proxy:delete',
  PROXY_CHECK: 'proxy:check',

  FINGERPRINT_LIST: 'fingerprint:list',
  FINGERPRINT_GET: 'fingerprint:get',
  FINGERPRINT_CREATE: 'fingerprint:create',
  FINGERPRINT_UPDATE: 'fingerprint:update',
  FINGERPRINT_DELETE: 'fingerprint:delete',

  ACCOUNT_SET_FINGERPRINT: 'account:setFingerprint',
  ACCOUNT_SET_PROXY: 'account:setProxy',

  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_GET_STATUS: 'update:getStatus',
} as const;

export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data };
}

function fail<T = never>(message: string): IpcResult<T> {
  return { success: false, message } as IpcResult<T>;
}

async function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (e) {
    return fail(String(e));
  }
}

interface ThrottledPushState {
  queue: PublishEvent[];
  timer: ReturnType<typeof setTimeout> | null;
  lastFlush: number;
}

const THROTTLE_MS = 500;
const pushState: ThrottledPushState = { queue: [], timer: null, lastFlush: 0 };

function throttledPush(event: PublishEvent, window: BrowserWindow | null): void {
  pushState.queue.push(event);

  if (pushState.queue.length > 100) {
    pushState.queue.splice(0, pushState.queue.length - 100);
  }

  const now = Date.now();
  const elapsed = now - pushState.lastFlush;

  if (elapsed >= THROTTLE_MS) {
    flushToRenderer(window);
  } else if (!pushState.timer) {
    pushState.timer = setTimeout(() => {
      pushState.timer = null;
      flushToRenderer(window);
    }, THROTTLE_MS - elapsed);
  }
}

function flushToRenderer(window: BrowserWindow | null): void {
  pushState.lastFlush = Date.now();
  if (pushState.queue.length === 0) return;

  const batch = pushState.queue.splice(0);
  if (window && !window.isDestroyed()) {
    window.webContents.send('publish:status', batch);
  }
}

export interface PlatformInfo {
  platformId: string;
  config: PlatformConfig;
  capabilities: PlatformCapabilities;
}

export function registerIpcHandlers(): void {
  let mainWindow: BrowserWindow | null = null;

  const getMainWindow = (): BrowserWindow | null => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      const windows = BrowserWindow.getAllWindows();
      mainWindow = windows.length > 0 ? windows[0] : null;
    }
    return mainWindow;
  };

  const eventBus = EventBus.getInstance();
  eventBus.subscribe((event: PublishEvent) => {
    throttledPush(event, getMainWindow());
  });

  // ─── 账号管理 ──────────────────────────────────────────

  ipcMain.handle(CHANNEL.ACCOUNT_LIST, async (): Promise<IpcResult<Account[]>> => {
    return wrap(() => accountService.getAllAccounts());
  });

  ipcMain.handle(CHANNEL.ACCOUNT_ADD, async (_e, platform: string, groupId?: string): Promise<IpcResult<Account>> => {
    return wrap(() => accountService.bindAccount(platform, groupId));
  });

  ipcMain.handle(CHANNEL.ACCOUNT_REMOVE, async (_e, accountId: string): Promise<IpcResult> => {
    return wrap(async () => {
      await accountService.deleteAccount(accountId);
      return undefined;
    });
  });

  ipcMain.handle(CHANNEL.ACCOUNT_VALIDATE, async (_e, accountId: string): Promise<IpcResult<boolean>> => {
    return wrap(() => accountService.validateCookie(accountId));
  });

  // ─── 发布管理 ──────────────────────────────────────────

  ipcMain.handle(CHANNEL.PUBLISH_SUBMIT, async (_e, request: PublishRequest): Promise<IpcResult<PublishTask>> => {
    return wrap(() => publishService.createPublishTask(request));
  });

  ipcMain.handle(CHANNEL.PUBLISH_CANCEL, async (_e, taskId: string): Promise<IpcResult> => {
    return wrap(async () => {
      await publishService.cancelPublish(taskId);
      return undefined;
    });
  });

  ipcMain.handle(CHANNEL.PUBLISH_STATUS, async (_e, taskId: string): Promise<IpcResult<PublishTaskStatusDetail>> => {
    return wrap(() => publishService.getTaskStatus(taskId));
  });

  // ─── 任务管理 ──────────────────────────────────────────

  ipcMain.handle(CHANNEL.TASK_LIST, async (_e, contentId?: string): Promise<IpcResult<PublishTask[]>> => {
    return wrap(() => publishService.getContentTasks(contentId ?? ''));
  });

  ipcMain.handle(CHANNEL.TASK_RETRY, async (_e, taskId: string): Promise<IpcResult<PublishResult>> => {
    return wrap(() => publishService.executeNow(taskId));
  });

  // ─── 平台管理 ──────────────────────────────────────────

  ipcMain.handle(CHANNEL.PLATFORM_LIST, async (): Promise<IpcResult<PlatformInfo[]>> => {
    const adapters = PlatformRegistry.getAllAdapters();
    const infos: PlatformInfo[] = adapters.map((a) => ({
      platformId: a.platformId,
      config: a.config,
      capabilities: a.capabilities,
    }));
    return ok(infos);
  });

  ipcMain.handle(CHANNEL.PLATFORM_LOGIN, async (_e, accountId: string): Promise<IpcResult<CookieResult>> => {
    return wrap(async () => {
      const account = await accountService.getAccount(accountId);
      if (!account) throw new Error('账号不存在');
      const adapter = PlatformRegistry.getAdapter(account.platform);
      if (!adapter) throw new Error(`平台 ${account.platform} 未注册`);
      return adapter.login(accountId, false);
    });
  });

  // ─── 兼容旧频道 ────────────────────────────────────────

  ipcMain.handle(CHANNEL.ACCOUNTS_LIST, async () => {
    return accountService.getAllAccounts();
  });

  ipcMain.handle(CHANNEL.ACCOUNTS_CREATE, async (_e, data: { platform: string; groupId?: string }) => {
    try {
      const account = await accountService.bindAccount(data.platform, data.groupId);
      return { success: true, data: account };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.ACCOUNTS_DELETE, async (_e, id: string) => {
    try {
      await accountService.deleteAccount(id);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.ACCOUNTS_LOGIN, async (_e, accountId: string) => {
    try {
      const account = await accountService.getAccount(accountId);
      if (!account) return { success: false, message: '账号不存在' };
      const adapter = PlatformRegistry.getAdapter(account.platform);
      if (!adapter) return { success: false, message: `平台 ${account.platform} 未注册` };
      const result = await adapter.login(accountId, false);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.ACCOUNTS_CHECK_COOKIE, async (_e, accountId: string) => {
    try {
      const valid = await accountService.validateCookie(accountId);
      return { success: true, valid };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.ACCOUNTS_GET_QR_CODE, async (_e, accountId: string) => {
    try {
      const account = await accountService.getAccount(accountId);
      if (!account) return { success: false, message: '账号不存在' };
      const adapter = PlatformRegistry.getAdapter(account.platform);
      if (!adapter) return { success: false, message: `平台 ${account.platform} 未注册` };
      const qrCode = await adapter.getQRCode(accountId);
      return { success: true, data: qrCode };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.CONTENT_LIST, async () => contentService.getAllContents());

  ipcMain.handle(CHANNEL.CONTENT_CREATE, async (_e, data: { filePath: string }) => {
    try {
      const content = await contentService.importContent(data.filePath);
      return { success: true, data: content };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.CONTENT_DELETE, async (_e, id: string) => {
    try {
      await contentService.deleteContent(id);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.CONTENT_UPDATE, async (_e, id: string, data: any) => {
    try {
      const updated = await contentService.updateContent(id, data);
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.CONTENT_UPLOAD_VIDEO, async (_e, data: { filePath: string }) => {
    try {
      const content = await contentService.importContent(data.filePath);
      return { success: true, data: content };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.GROUPS_LIST, async () => groupService.getAllGroups());

  ipcMain.handle(CHANNEL.GROUPS_CREATE, async (_e, data: { name: string; description?: string; color?: string }) => {
    try {
      const group = await groupService.createGroup(data.name, data.description, data.color);
      return { success: true, data: group };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.GROUPS_UPDATE, async (_e, id: string, data: any) => {
    try {
      await groupService.updateGroup(id, data);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.GROUPS_DELETE, async (_e, id: string) => {
    try {
      await groupService.deleteGroup(id);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.GROUPS_BIND_ACCOUNTS, async (_e, groupId: string, accountIds: string[]) => {
    try {
      await groupService.addAccountsToGroup(groupId, accountIds);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.PUBLISH_CREATE_TASK, async (_e, data: PublishRequest) => {
    try {
      const task = await publishService.createPublishTask(data);
      return { success: true, data: task };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.PUBLISH_UPDATE_TASK, async (_e, taskId: string, data: any) => {
    try {
      await publishService.updateTask(taskId, data);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.PUBLISH_CANCEL_TASK, async (_e, taskId: string) => {
    try {
      await publishService.cancelPublish(taskId);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.PUBLISH_DELETE_TASK, async (_e, taskId: string) => {
    try {
      await publishService.deleteTask(taskId);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.PUBLISH_RETRY_TASK, async (_e, taskId: string) => {
    try {
      await publishService.executeNow(taskId);
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.PUBLISH_LIST_TASKS, async (_e, filter?: { contentId?: string }) => {
    try {
      return await publishService.getContentTasks(filter?.contentId ?? '');
    } catch {
      return [];
    }
  });

  ipcMain.handle(CHANNEL.PLATFORMS_LIST, async () => PlatformRegistry.getSupportedPlatforms());

  ipcMain.handle(CHANNEL.PLATFORMS_GET_CONFIG, async (_e, platformId: string) => {
    const adapter = PlatformRegistry.getAdapter(platformId);
    return adapter?.config ?? null;
  });

  ipcMain.handle(CHANNEL.PLATFORMS_GET_CAPABILITIES, async (_e, platformId: string) => {
    const adapter = PlatformRegistry.getAdapter(platformId);
    return adapter?.capabilities ?? null;
  });

  ipcMain.handle(CHANNEL.SETTINGS_GET, async (_e, key: string) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT value FROM platform_configs WHERE key = ?');
      const row = stmt.get(key) as any;
      return row?.value || null;
    } catch {
      return null;
    }
  });

  ipcMain.handle(CHANNEL.SETTINGS_SET, async (_e, key: string, value: any) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO platform_configs (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);
      stmt.run(key, JSON.stringify(value));
      return { success: true };
    } catch (error) {
      return { success: false, message: `${error}` };
    }
  });

  ipcMain.handle(CHANNEL.STATS_OVERVIEW, async (_, { range }: { range?: string }) => {
    try {
      const days = range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 90;
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      return await statsService.getOverviewStats({ start, end });
    } catch {
      return null;
    }
  });

  ipcMain.handle(CHANNEL.STATS_PLATFORM, async (_, { platform, range }: { platform: string; range?: string }) => {
    try {
      const days = range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 90;
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      return await statsService.fetchPlatformStats(platform, { start, end });
    } catch {
      return null;
    }
  });

  ipcMain.handle(CHANNEL.STATS_TREND, async (_, { metric, range }: { metric?: string; range?: string }) => {
    try {
      const days = range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 90;
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      return await statsService.getTrendData(metric || 'play_count', { start, end });
    } catch {
      return [];
    }
  });

  // 安全警告: db:query 已禁用，避免任意 SQL 执行风险
  // 如需数据访问，请使用具体的 IPC 通道（如 account:list, content:list 等）
  ipcMain.handle(CHANNEL.DB_QUERY, async () => {
    logger.warn('db:query 接口已被禁用（安全原因）');
    return { success: false, message: '此接口已禁用，请使用具体的数据访问 API' };
  });

  ipcMain.handle(CHANNEL.AI_PREPUBLISH_CHECK, async (_e, context: PrePublishContext) => {
    try {
      const aiService = getAIService();
      return await aiService.prePublishCheck(context);
    } catch (error) {
      logger.error('AI 预发布检查失败:', error);
      return {
        suggestions: [],
        checks: {
          scheduleReasonable: true,
          accountHealth: true,
          historicalDataAvailable: false,
          conflictsDetected: false,
        },
      };
    }
  });

  ipcMain.handle(CHANNEL.AI_OPTIMIZE_RULE, async (_e, context: RuleOptimizationContext) => {
    try {
      const aiService = getAIService();
      return await aiService.optimizeRule(context);
    } catch (error) {
      logger.error('AI 规则优化失败:', error);
      return { suggestions: [] };
    }
  });

  ipcMain.handle(CHANNEL.AI_GET_COST_SUMMARY, async () => {
    try {
      const aiService = getAIService();
      return aiService.getCostSummary();
    } catch {
      return { totalCost: 0, totalTokens: 0, records: [] };
    }
  });

  ipcMain.handle(CHANNEL.AI_GET_ALERTS, async (_e, accountId?: string) => {
    try {
      if (accountId) {
        return anomalyService.getAlertsByAccount(accountId);
      }
      return anomalyService.getActiveAlerts();
    } catch {
      return [];
    }
  });

  ipcMain.handle(CHANNEL.AI_DISMISS_ALERT, async (_e, alertId: string) => {
    return anomalyService.dismissAlert(alertId);
  });

  ipcMain.handle(CHANNEL.MONITOR_CREATE_PLAN, async (_e, plan: Omit<import('../services/MonitorService').MonitorPlan, 'id' | 'createdAt'>) => {
    try {
      return monitorService.createPlan(plan);
    } catch (error) {
      return { success: false, message: String(error) };
    }
  });

  ipcMain.handle(CHANNEL.MONITOR_UPDATE_PLAN, async (_e, id: string, updates: Partial<import('../services/MonitorService').MonitorPlan>) => {
    return monitorService.updatePlan(id, updates);
  });

  ipcMain.handle(CHANNEL.MONITOR_DELETE_PLAN, async (_e, id: string) => {
    return monitorService.deletePlan(id);
  });

  ipcMain.handle(CHANNEL.MONITOR_LIST_PLANS, async () => {
    return monitorService.getAllPlans();
  });

  ipcMain.handle(CHANNEL.MONITOR_GET_ALERTS, async () => {
    return monitorService.getActiveAlerts();
  });

  ipcMain.handle(CHANNEL.REPORT_GENERATE, async () => {
    try {
      return await weeklyReportService.generateReport();
    } catch (error) {
      return { success: false, message: String(error) };
    }
  });

  ipcMain.handle(CHANNEL.REPORT_GET_LATEST, async () => {
    return await weeklyReportService.getLatestReport();
  });

  ipcMain.handle(CHANNEL.PANEL_OPEN, async (_, { accountId }: { accountId: string }) => {
    const panel = await multiPanelService.openPanel(accountId);
    return panel ? ok(panel) : fail('打开面板失败');
  });

  ipcMain.handle(CHANNEL.PANEL_CLOSE, (_, { panelId }: { panelId: string }) => {
    multiPanelService.closePanel(panelId);
    return ok(null);
  });

  ipcMain.handle(CHANNEL.PANEL_FOCUS, (_, { panelId }: { panelId: string }) => {
    multiPanelService.focusPanel(panelId);
    return ok(null);
  });

  ipcMain.handle(CHANNEL.PANEL_LIST, () => {
    return ok(multiPanelService.getActivePanels());
  });

  ipcMain.handle(CHANNEL.DRAFT_CREATE, async (_, data) => {
    const draft = draftService.createDraft(data);
    return ok(draft);
  });

  ipcMain.handle(CHANNEL.DRAFT_UPDATE, async (_, { draftId, updates }) => {
    const draft = draftService.updateDraft(draftId, updates);
    return draft ? ok(draft) : fail('草稿不存在');
  });

  ipcMain.handle(CHANNEL.DRAFT_DELETE, async (_, { draftId }) => {
    const success = draftService.deleteDraft(draftId);
    return success ? ok(null) : fail('删除失败');
  });

  ipcMain.handle(CHANNEL.DRAFT_LIST, async (_, { status }) => {
    return ok(draftService.listDrafts(status));
  });

  ipcMain.handle(CHANNEL.DRAFT_DUPLICATE, async (_, { draftId }) => {
    const draft = draftService.duplicateDraft(draftId);
    return draft ? ok(draft) : fail('复制失败');
  });

  ipcMain.handle(CHANNEL.COMMENT_TEMPLATE_CREATE, async (_, data) => {
    const template = commentService.createTemplate(data);
    return ok(template);
  });

  ipcMain.handle(CHANNEL.COMMENT_TEMPLATE_UPDATE, async (_, { templateId, updates }) => {
    const template = commentService.updateTemplate(templateId, updates);
    return template ? ok(template) : fail('模板不存在');
  });

  ipcMain.handle(CHANNEL.COMMENT_TEMPLATE_DELETE, async (_, { templateId }) => {
    const success = commentService.deleteTemplate(templateId);
    return success ? ok(null) : fail('删除失败');
  });

  ipcMain.handle(CHANNEL.COMMENT_TEMPLATE_LIST, async (_, { platform }) => {
    return ok(commentService.listTemplates(platform));
  });

  ipcMain.handle(CHANNEL.COMMENT_SCHEDULE, async (_, { templateId, accountId, videoId }) => {
    const task = await commentService.scheduleComment(templateId, accountId, '', videoId);
    return task ? ok(task) : fail('创建评论任务失败');
  });

  ipcMain.handle(CHANNEL.COMMENT_EXECUTE, async (_, { taskId }) => {
    const success = await commentService.executeComment(taskId);
    return success ? ok(null) : fail('执行失败');
  });

  ipcMain.handle(CHANNEL.COMMENT_TASK_LIST, async () => {
    return ok([]);
  });

  ipcMain.handle(CHANNEL.LICENSE_STATUS, () => {
    return ok({
      valid: licenseService.validateLicense(),
      license: licenseService.getLicense(),
    });
  });

  ipcMain.handle(CHANNEL.LICENSE_ACTIVATE, async (_, { key, email }) => {
    const result = await licenseService.activateLicense(key, email);
    return result;
  });

  ipcMain.handle(CHANNEL.LICENSE_ACTIVATE_OFFLINE, async (_, { filePath }) => {
    const result = await licenseService.activateOffline(filePath);
    return result;
  });

  ipcMain.handle(CHANNEL.LICENSE_OFFLINE_REQUEST, async (_, { key, email }) => {
    const requestPath = licenseService.generateOfflineRequest(key, email);
    return ok(requestPath);
  });

  ipcMain.handle(CHANNEL.LICENSE_DEACTIVATE, () => {
    licenseService.deactivate();
    return ok(null);
  });

  ipcMain.handle(CHANNEL.PROXY_LIST, async () => {
    return wrap(() => proxyService.getAllProxies());
  });

  ipcMain.handle(CHANNEL.PROXY_GET, async (_, { id }: { id: string }) => {
    return wrap(() => proxyService.getProxyById(id));
  });

  ipcMain.handle(CHANNEL.PROXY_CREATE, async (_, data: { name: string; protocol: string; host: string; port: number; username?: string; password?: string }) => {
    return wrap(() => proxyService.createProxy(data));
  });

  ipcMain.handle(CHANNEL.PROXY_UPDATE, async (_, { id, data }: { id: string; data: any }) => {
    return wrap(() => proxyService.updateProxy(id, data));
  });

  ipcMain.handle(CHANNEL.PROXY_DELETE, async (_, { id }: { id: string }) => {
    return wrap(async () => {
      await proxyService.deleteProxy(id);
      return undefined;
    });
  });

  ipcMain.handle(CHANNEL.PROXY_CHECK, async (_, { id }: { id: string }) => {
    return wrap(() => proxyService.checkProxy(id));
  });

  ipcMain.handle(CHANNEL.FINGERPRINT_LIST, async () => {
    const result = await fingerprintTemplateRepo.findAll();
    return ok(result.data);
  });

  ipcMain.handle(CHANNEL.FINGERPRINT_GET, async (_, { id }: { id: string }) => {
    return wrap(() => fingerprintTemplateRepo.findById(id));
  });

  ipcMain.handle(CHANNEL.FINGERPRINT_CREATE, async (_, data: any) => {
    return wrap(() => fingerprintTemplateRepo.insert(data));
  });

  ipcMain.handle(CHANNEL.FINGERPRINT_UPDATE, async (_, { id, data }: { id: string; data: any }) => {
    return wrap(() => fingerprintTemplateRepo.update(id, data));
  });

  ipcMain.handle(CHANNEL.FINGERPRINT_DELETE, async (_, { id }: { id: string }) => {
    return wrap(() => fingerprintTemplateRepo.deleteById(id));
  });

  ipcMain.handle(CHANNEL.ACCOUNT_SET_FINGERPRINT, async (_, { accountId, fingerprintId }: { accountId: string; fingerprintId: string | null }) => {
    return wrap(async () => {
      await accountService.setFingerprint(accountId, fingerprintId);
      return undefined;
    });
  });

  ipcMain.handle(CHANNEL.ACCOUNT_SET_PROXY, async (_, { accountId, proxyId }: { accountId: string; proxyId: string | null }) => {
    return wrap(async () => {
      await accountService.setProxy(accountId, proxyId);
      return undefined;
    });
  });

  ipcMain.handle(CHANNEL.UPDATE_CHECK, async () => {
    const status = await autoUpdaterService.checkForUpdates();
    return ok(status);
  });

  ipcMain.handle(CHANNEL.UPDATE_DOWNLOAD, async () => {
    await autoUpdaterService.downloadUpdate();
    return ok(null);
  });

  ipcMain.handle(CHANNEL.UPDATE_INSTALL, async () => {
    await autoUpdaterService.installUpdate();
    return ok(null);
  });

  ipcMain.handle(CHANNEL.UPDATE_GET_STATUS, () => {
    return ok(autoUpdaterService.getStatus());
  });

  logger.info('IPC 处理器已注册');
}
