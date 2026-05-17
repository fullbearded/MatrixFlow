import { BrowserWindow } from 'electron';
import { Logger } from './Logger';
import type {
  PublishEvent,
  PublishEventHandler,
  ThrottleState,
} from './types/eventbus';
import {
  IPC_CHANNEL_PUBLISH_STATUS,
  EVENTBUS_THROTTLE_MS,
} from './types/eventbus';

type EventHandler = (...args: any[]) => void;

const logger = new Logger('EventBus');

export class EventBus {
  private static instance: EventBus;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private mainWindow: BrowserWindow | null = null;

  private listeners: Set<PublishEventHandler> = new Set();
  private throttleState: ThrottleState = {
    lastEmitTime: 0,
    pendingEvent: null,
    timer: null,
  };
  private eventQueue: PublishEvent[] = [];
  private readonly maxQueueSize = 100;

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (err) {
          logger.error(`事件处理器异常: event=${event}`, err);
        }
      });
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, ...args);
    }
  }

  removeAllHandlers(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  subscribe(callback: PublishEventHandler): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  emitPublishEvent(event: PublishEvent): void {
    const enriched: PublishEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };

    this.enqueue(enriched);
    this.throttledFlush();
  }

  broadcast(event: PublishEvent): void {
    const enriched: PublishEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };

    this.notifyListeners(enriched);
    this.sendToRenderer(enriched);
  }

  getHistory(): PublishEvent[] {
    return [...this.eventQueue];
  }

  clearHistory(): void {
    this.eventQueue = [];
  }

  destroy(): void {
    if (this.throttleState.timer) {
      clearTimeout(this.throttleState.timer);
      this.throttleState.timer = null;
    }
    this.throttleState.pendingEvent = null;
    this.listeners.clear();
    this.eventQueue = [];
  }

  private enqueue(event: PublishEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }
  }

  private throttledFlush(): void {
    const now = Date.now();
    const elapsed = now - this.throttleState.lastEmitTime;

    if (elapsed >= EVENTBUS_THROTTLE_MS) {
      this.flush();
    } else if (!this.throttleState.timer) {
      this.throttleState.timer = setTimeout(() => {
        this.throttleState.timer = null;
        this.flush();
      }, EVENTBUS_THROTTLE_MS - elapsed);
    }
  }

  private flush(): void {
    this.throttleState.lastEmitTime = Date.now();

    const latest = this.eventQueue[this.eventQueue.length - 1];
    if (!latest) return;

    this.notifyListeners(latest);
    this.sendToRenderer(latest);
  }

  private notifyListeners(event: PublishEvent): void {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        logger.error('PublishEvent listener error', err);
      }
    });
  }

  private sendToRenderer(event: PublishEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNEL_PUBLISH_STATUS, event);
    }
  }
}
