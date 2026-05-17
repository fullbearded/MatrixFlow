import { contextBridge, ipcRenderer } from 'electron';

interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

type Invoke<T> = Promise<IpcResult<T>>;

const ALLOWED_CHANNELS = new Set([
  'publish:status',
  'task:progress',
  'task:status-change',
  'poc:status',
  'account:login-status-updated',
]);

contextBridge.exposeInMainWorld('matrixflow', {
  runPoc: (type: string): Promise<unknown> => ipcRenderer.invoke('poc:run', type),

  onStatus: (callback: (msg: string) => void): void => {
    ipcRenderer.removeAllListeners('poc:status');
    ipcRenderer.on('poc:status', (_event, msg) => callback(msg));
  },

  launchPatchright: (): Promise<unknown> => ipcRenderer.invoke('poc:launch'),

  account: {
    list: (): Invoke<unknown[]> => ipcRenderer.invoke('account:list'),
    add: (platform: string, groupId?: string): Invoke<unknown> =>
      ipcRenderer.invoke('account:add', platform, groupId),
    remove: (accountId: string): Invoke<void> =>
      ipcRenderer.invoke('account:remove', accountId),
    validate: (accountId: string): Invoke<boolean> =>
      ipcRenderer.invoke('account:validate', accountId),
  },

  publish: {
    submit: (request: unknown): Invoke<unknown> =>
      ipcRenderer.invoke('publish:submit', request),
    cancel: (taskId: string): Invoke<void> =>
      ipcRenderer.invoke('publish:cancel', taskId),
    status: (taskId: string): Invoke<unknown> =>
      ipcRenderer.invoke('publish:status', taskId),
    createTask: (data: unknown): Invoke<unknown> =>
      ipcRenderer.invoke('publish:createTask', data),
    updateTask: (taskId: string, data: Record<string, unknown>): Invoke<void> =>
      ipcRenderer.invoke('publish:updateTask', taskId, data),
    deleteTask: (taskId: string): Invoke<void> =>
      ipcRenderer.invoke('publish:deleteTask', taskId),
    cancelTask: (taskId: string): Invoke<void> =>
      ipcRenderer.invoke('publish:cancelTask', taskId),
    retryTask: (taskId: string): Invoke<unknown> =>
      ipcRenderer.invoke('publish:retryTask', taskId),
    listTasks: (filter?: Record<string, unknown>): Invoke<unknown[]> =>
      ipcRenderer.invoke('publish:listTasks', filter),
  },

  task: {
    list: (contentId?: string): Invoke<unknown[]> =>
      ipcRenderer.invoke('task:list', contentId),
    retry: (taskId: string): Invoke<unknown> =>
      ipcRenderer.invoke('task:retry', taskId),
  },

  platform: {
    list: (): Invoke<unknown[]> => ipcRenderer.invoke('platform:list'),
    login: (accountId: string): Invoke<unknown> =>
      ipcRenderer.invoke('platform:login', accountId),
  },

  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    create: (data: { platform: string; groupId?: string }) =>
      ipcRenderer.invoke('accounts:create', data),
    delete: (id: string) => ipcRenderer.invoke('accounts:delete', id),
    login: (id: string) => ipcRenderer.invoke('accounts:login', id),
    checkCookie: (id: string) => ipcRenderer.invoke('accounts:checkCookie', id),
    getQRCode: (id: string) => ipcRenderer.invoke('accounts:getQRCode', id),
  },

  content: {
    list: () => ipcRenderer.invoke('content:list'),
    create: (data: { filePath: string }) =>
      ipcRenderer.invoke('content:create', data),
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

  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('settings:set', key, value),
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
});
