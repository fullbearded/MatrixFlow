import { vi } from 'vitest';

export function createDatabaseMock() {
  const prepareResult = {
    run: vi.fn(),
    all: vi.fn<() => unknown[]>(() => []),
    get: vi.fn(() => undefined),
    pluck: vi.fn(),
  };

  return {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => prepareResult),
    transaction: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    close: vi.fn(),
    __prepareResult: prepareResult,
  };
}

export type DatabaseMock = ReturnType<typeof createDatabaseMock>;
