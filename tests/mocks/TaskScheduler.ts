import { vi } from 'vitest';
import type { ITask, ITaskResult, TaskStatus } from '@electron/core/types/task';

export function createTaskSchedulerMock() {
  return {
    schedule: vi.fn(),
    scheduleAt: vi.fn(),
    schedulePeriodic: vi.fn(() => 'periodic_mock_id'),
    cancel: vi.fn(() => true),
    cancelPeriodic: vi.fn(),
    getPendingTasks: vi.fn<() => ITask[]>(() => []),
    getTask: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getStats: vi.fn(() => ({
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      periodicCount: 0,
    })),
    onTaskExecute: vi.fn<(task: ITask) => Promise<ITaskResult>>(
      () => Promise.resolve({ success: true })
    ),
  };
}

export type TaskSchedulerMock = ReturnType<typeof createTaskSchedulerMock>;
