import { vi } from 'vitest';

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function mockIPC(handlers: Record<string, (...args: unknown[]) => unknown>) {
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    }),
    on: vi.fn(),
  };

  const ipcRenderer = {
    invoke: vi.fn(async (channel: string, ...args: unknown[]) => {
      const handler = handlers[channel];
      if (handler) return handler(...args);
      throw new Error(`No handler for IPC channel: ${channel}`);
    }),
    on: vi.fn(),
    send: vi.fn(),
  };

  return { ipcMain, ipcRenderer };
}

export function advanceTimersByTime(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  return new Promise((resolve) => setImmediate(resolve));
}
