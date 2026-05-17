import type { BrowserWindow } from 'electron';

export type PublishEventType =
  | 'task_start'
  | 'task_progress'
  | 'task_done'
  | 'task_failed';

export interface PublishEvent {
  type: PublishEventType;
  taskId: string;
  platform: string;
  accountId: string;
  progress?: number;
  message?: string;
  timestamp: number;
}

export type PublishEventHandler = (event: PublishEvent) => void;

export interface ThrottleState {
  lastEmitTime: number;
  pendingEvent: PublishEvent | null;
  timer: ReturnType<typeof setTimeout> | null;
}

export const IPC_CHANNEL_PUBLISH_STATUS = 'publish:status' as const;

export const EVENTBUS_THROTTLE_MS = 500;

export interface IEventBusPublish {
  subscribe(callback: PublishEventHandler): () => void;
  emit(event: PublishEvent): void;
  broadcast(event: PublishEvent): void;
  setMainWindow(window: BrowserWindow): void;
  getHistory(): PublishEvent[];
  clearHistory(): void;
  destroy(): void;
}
