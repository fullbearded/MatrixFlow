import { contextBridge, ipcRenderer } from 'electron';
import type { IpcResult } from './ipc/handlers';
import type { Account } from './services/types/account';
import type {
  PublishTask,
  PublishResult,
  PublishTaskStatusDetail,
  PublishRequest,
} from './services/types/publish';
import type { PlatformConfig, PlatformCapabilities, CookieResult } from './platform/base/types';
import type { PrePublishContext, PrePublishCheckResult, RuleOptimizationContext, RuleOptimizationResult, CostRecord } from './ai/types';

type Invoke<T> = Promise<IpcResult<T>>;

const ALLOWED_CHANNELS = new Set([
  'publish:status',
  'task:progress',
  'task:status-change',
  'account:login-status-updated',
  'update:status',
  'update:progress',
]);

const api = {
  account: {
    list: (): Invoke<Account[]> => ipcRenderer.invoke('account:list'),
    add: (platform: string, groupId?: string): Invoke<Account> =>
      ipcRenderer.invoke('account:add', platform, groupId),
    remove: (accountId: string): Invoke<void> =>
      ipcRenderer.invoke('account:remove', accountId),
    validate: (accountId: string): Invoke<boolean> =>
      ipcRenderer.invoke('account:validate', accountId),
    setFingerprint: (accountId: string, fingerprintId: string | null): Invoke<void> =>
      ipcRenderer.invoke('account:setFingerprint', { accountId, fingerprintId }),
    setProxy: (accountId: string, proxyId: string | null): Invoke<void> =>
      ipcRenderer.invoke('account:setProxy', { accountId, proxyId }),
  },

  publish: {
    submit: (request: PublishRequest): Invoke<PublishTask> =>
      ipcRenderer.invoke('publish:submit', request),
    cancel: (taskId: string): Invoke<void> =>
      ipcRenderer.invoke('publish:cancel', taskId),
    status: (taskId: string): Invoke<PublishTaskStatusDetail> =>
      ipcRenderer.invoke('publish:status', taskId),
  },

  task: {
    list: (contentId?: string): Invoke<PublishTask[]> =>
      ipcRenderer.invoke('task:list', contentId),
    retry: (taskId: string): Invoke<PublishResult> =>
      ipcRenderer.invoke('task:retry', taskId),
  },

  platform: {
    list: (): Invoke<Array<{ platformId: string; config: PlatformConfig; capabilities: PlatformCapabilities }>> =>
      ipcRenderer.invoke('platform:list'),
    login: (accountId: string): Invoke<CookieResult> =>
      ipcRenderer.invoke('platform:login', accountId),
  },

  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    create: (data: { platform: string; groupId?: string }) =>
      ipcRenderer.invoke('accounts:create', data),
    delete: (id: string) => ipcRenderer.invoke('accounts:delete', id),
    login: (accountId: string) => ipcRenderer.invoke('accounts:login', accountId),
    checkCookie: (accountId: string) =>
      ipcRenderer.invoke('accounts:checkCookie', accountId),
    getQRCode: (accountId: string) =>
      ipcRenderer.invoke('accounts:getQRCode', accountId),
  },

  content: {
    list: () => ipcRenderer.invoke('content:list'),
    create: (data: { filePath: string }) =>
      ipcRenderer.invoke('content:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('content:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('content:delete', id),
    uploadVideo: (data: { filePath: string }) =>
      ipcRenderer.invoke('content:uploadVideo', data),
  },

  groups: {
    list: () => ipcRenderer.invoke('groups:list'),
    create: (data: { name: string; description?: string; color?: string }) =>
      ipcRenderer.invoke('groups:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('groups:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('groups:delete', id),
    bindAccounts: (groupId: string, accountIds: string[]) =>
      ipcRenderer.invoke('groups:bindAccounts', groupId, accountIds),
  },

  platforms: {
    list: () => ipcRenderer.invoke('platforms:list'),
    getConfig: (platformId: string) =>
      ipcRenderer.invoke('platforms:getConfig', platformId),
    getCapabilities: (platformId: string) =>
      ipcRenderer.invoke('platforms:getCapabilities', platformId),
  },

  notification: {
    getPreferences: () => ipcRenderer.invoke('notification:getPreferences'),
    updatePreferences: (prefs: Record<string, unknown>) =>
      ipcRenderer.invoke('notification:updatePreferences', prefs),
    test: () => ipcRenderer.invoke('notification:test'),
  },

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('settings:set', key, value),
  },

  stats: {
    getOverview: (range?: string) => ipcRenderer.invoke('stats:overview', { range }),
    getPlatformStats: (platform: string, range?: string) =>
      ipcRenderer.invoke('stats:platform', { platform, range }),
    getTrend: (metric?: string, range?: string) =>
      ipcRenderer.invoke('stats:trend', { metric, range }),
  },

  ai: {
    prePublishCheck: (context: PrePublishContext): Promise<PrePublishCheckResult> =>
      ipcRenderer.invoke('ai:prePublishCheck', context),
    optimizeRule: (context: RuleOptimizationContext): Promise<RuleOptimizationResult> =>
      ipcRenderer.invoke('ai:optimizeRule', context),
    getCostSummary: (): Promise<{ totalCost: number; totalTokens: number; records: CostRecord[] }> =>
      ipcRenderer.invoke('ai:getCostSummary'),
    getAlerts: (accountId?: string): Promise<any[]> =>
      ipcRenderer.invoke('ai:getAlerts', accountId),
    dismissAlert: (alertId: string): Promise<boolean> =>
      ipcRenderer.invoke('ai:dismissAlert', alertId),
  },

  monitor: {
    createPlan: (plan: any): Promise<any> =>
      ipcRenderer.invoke('monitor:createPlan', plan),
    updatePlan: (id: string, updates: any): Promise<any> =>
      ipcRenderer.invoke('monitor:updatePlan', id, updates),
    deletePlan: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('monitor:deletePlan', id),
    listPlans: (): Promise<any[]> =>
      ipcRenderer.invoke('monitor:listPlans'),
    getAlerts: (): Promise<any[]> =>
      ipcRenderer.invoke('monitor:getAlerts'),
  },

  report: {
    generate: (): Promise<any> =>
      ipcRenderer.invoke('report:generate'),
    getLatest: (): Promise<any> =>
      ipcRenderer.invoke('report:getLatest'),
  },

  panel: {
    open: (accountId: string) =>
      ipcRenderer.invoke('panel:open', { accountId }),
    close: (panelId: string) =>
      ipcRenderer.invoke('panel:close', { panelId }),
    focus: (panelId: string) =>
      ipcRenderer.invoke('panel:focus', { panelId }),
    list: () =>
      ipcRenderer.invoke('panel:list'),
  },

  draft: {
    create: (data: any) =>
      ipcRenderer.invoke('draft:create', data),
    update: (draftId: string, updates: any) =>
      ipcRenderer.invoke('draft:update', { draftId, updates }),
    delete: (draftId: string) =>
      ipcRenderer.invoke('draft:delete', { draftId }),
    list: (status?: string) =>
      ipcRenderer.invoke('draft:list', { status }),
    duplicate: (draftId: string) =>
      ipcRenderer.invoke('draft:duplicate', { draftId }),
  },

  comment: {
    template: {
      create: (data: any) =>
        ipcRenderer.invoke('comment:template:create', data),
      update: (templateId: string, updates: any) =>
        ipcRenderer.invoke('comment:template:update', { templateId, updates }),
      delete: (templateId: string) =>
        ipcRenderer.invoke('comment:template:delete', { templateId }),
      list: (platform?: string) =>
        ipcRenderer.invoke('comment:template:list', { platform }),
    },
    schedule: (templateId: string, accountId: string, videoId: string) =>
      ipcRenderer.invoke('comment:schedule', { templateId, accountId, videoId }),
    execute: (taskId: string) =>
      ipcRenderer.invoke('comment:execute', { taskId }),
    task: {
      list: () =>
        ipcRenderer.invoke('comment:task:list'),
    },
  },

  license: {
    status: () =>
      ipcRenderer.invoke('license:status'),
    activate: (key: string, email: string) =>
      ipcRenderer.invoke('license:activate', { key, email }),
    activateOffline: (filePath: string) =>
      ipcRenderer.invoke('license:activate:offline', { filePath }),
    offlineRequest: (key: string, email: string) =>
      ipcRenderer.invoke('license:offline:request', { key, email }),
    deactivate: () =>
      ipcRenderer.invoke('license:deactivate'),
  },

  proxy: {
    list: () =>
      ipcRenderer.invoke('proxy:list'),
    get: (id: string) =>
      ipcRenderer.invoke('proxy:get', { id }),
    create: (data: { name: string; protocol: string; host: string; port: number; username?: string; password?: string }) =>
      ipcRenderer.invoke('proxy:create', data),
    update: (id: string, data: any) =>
      ipcRenderer.invoke('proxy:update', { id, data }),
    delete: (id: string) =>
      ipcRenderer.invoke('proxy:delete', { id }),
    check: (id: string) =>
      ipcRenderer.invoke('proxy:check', { id }),
  },

  fingerprint: {
    list: () =>
      ipcRenderer.invoke('fingerprint:list'),
    get: (id: string) =>
      ipcRenderer.invoke('fingerprint:get', { id }),
    create: (data: any) =>
      ipcRenderer.invoke('fingerprint:create', data),
    update: (id: string, data: any) =>
      ipcRenderer.invoke('fingerprint:update', { id, data }),
    delete: (id: string) =>
      ipcRenderer.invoke('fingerprint:delete', { id }),
  },

  update: {
    check: () =>
      ipcRenderer.invoke('update:check'),
    download: () =>
      ipcRenderer.invoke('update:download'),
    install: () =>
      ipcRenderer.invoke('update:install'),
    getStatus: () =>
      ipcRenderer.invoke('update:getStatus'),
  },

  data: {
    createBackup: (): Invoke<import('./data/Database').BackupInfo> =>
      ipcRenderer.invoke('data:createBackup'),
    listBackups: (): Invoke<import('./data/Database').BackupInfo[]> =>
      ipcRenderer.invoke('data:listBackups'),
    restoreBackup: (backupId: string): Invoke<null> =>
      ipcRenderer.invoke('data:restoreBackup', backupId),
    deleteBackup: (backupId: string): Invoke<null> =>
      ipcRenderer.invoke('data:deleteBackup', backupId),
    clearData: (type: 'logs' | 'cache' | 'all'): Invoke<null> =>
      ipcRenderer.invoke('data:clear', type),
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.warn(`IPC channel "${channel}" not in allowlist`);
      return () => {};
    }
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  onPublishStatus: (callback: (batch: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, batch: unknown[]) =>
      callback(batch);
    ipcRenderer.on('publish:status', handler);
    return () => ipcRenderer.removeListener('publish:status', handler);
  },

  onTaskProgress: (callback: (taskId: string, progress: number, message?: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: string, progress: number, message?: string) =>
      callback(taskId, progress, message);
    ipcRenderer.on('task:progress', handler);
    return () => ipcRenderer.removeListener('task:progress', handler);
  },

  onTaskStatusChange: (callback: (taskId: string, status: string, data?: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: string, status: string, data?: unknown) =>
      callback(taskId, status, data);
    ipcRenderer.on('task:status-change', handler);
    return () => ipcRenderer.removeListener('task:status-change', handler);
  },
};

contextBridge.exposeInMainWorld('matrixflow', api);

export type MatrixFlowAPI = typeof api;
