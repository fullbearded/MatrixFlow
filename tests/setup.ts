import { vi } from 'vitest';

// Mock electron 模块
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/tmp/matrixflow-test',
        logs: '/tmp/matrixflow-test/logs',
      };
      return paths[name] || '/tmp/matrixflow-test';
    }),
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    webContents: {
      send: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
    close: vi.fn(),
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
}));

vi.mock('electron-log', () => {
  const logFn = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const transports = {
    file: {
      resolvePathFn: vi.fn(),
      maxSize: 10 * 1024 * 1024,
      format: '',
    },
  };

  return {
    ...logFn,
    transports,
    default: {
      ...logFn,
      transports,
    },
  };
});

// Mock patchright
vi.mock('patchright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        close: vi.fn(() => Promise.resolve()),
      })),
      close: vi.fn(() => Promise.resolve()),
    })),
    launchPersistentContext: vi.fn(() => Promise.resolve({
      close: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      run: vi.fn(),
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
    })),
    transaction: vi.fn((fn: Function) => (...args: unknown[]) => fn(...args)),
    close: vi.fn(),
  };

  return {
    default: vi.fn(() => mockDb),
    __mockDb: mockDb,
  };
});
