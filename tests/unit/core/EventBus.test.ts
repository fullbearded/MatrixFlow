import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@electron/core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    eventBus.removeAllHandlers();
  });

  describe('on / emit', () => {
    it('触发事件时调用已注册的处理器', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.emit('test-event', 'arg1', 'arg2');

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('支持多个处理器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('multi-event', handler1);
      eventBus.on('multi-event', handler2);
      eventBus.emit('multi-event', 'data');

      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('处理器异常不影响其他处理器', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const normalHandler = vi.fn();

      eventBus.on('error-event', errorHandler);
      eventBus.on('error-event', normalHandler);
      eventBus.emit('error-event');

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });

    it('不监听的事件不应报错', () => {
      expect(() => eventBus.emit('unknown-event')).not.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('on 返回的函数可取消订阅', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('unsub-event', handler);

      unsubscribe();
      eventBus.emit('unsub-event');

      expect(handler).not.toHaveBeenCalled();
    });

    it('重复取消订阅不报错', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('dup-unsub', handler);

      unsubscribe();
      unsubscribe();

      expect(() => eventBus.emit('dup-unsub')).not.toThrow();
    });
  });

  describe('removeAllHandlers', () => {
    it('移除指定事件的所有处理器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('remove-target', handler1);
      eventBus.on('remove-target', handler2);
      eventBus.on('keep-target', vi.fn());

      eventBus.removeAllHandlers('remove-target');
      eventBus.emit('remove-target');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('不带参数移除所有处理器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('event-a', handler1);
      eventBus.on('event-b', handler2);

      eventBus.removeAllHandlers();
      eventBus.emit('event-a');
      eventBus.emit('event-b');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('subscribe / emitPublishEvent', () => {
    it('订阅后接收 PublishEvent', () => {
      const callback = vi.fn();
      eventBus.subscribe(callback);

      const testEvent = {
        type: 'task_start' as const,
        taskId: 'task_001',
        platform: 'douyin',
        accountId: 'account_001',
        timestamp: Date.now(),
      };

      vi.useFakeTimers();
      eventBus.emitPublishEvent(testEvent);
      vi.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalled();
      const received = callback.mock.calls[0][0];
      expect(received.taskId).toBe('task_001');
      expect(received.type).toBe('task_start');

      vi.useRealTimers();
    });

    it('取消订阅后不再接收', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.subscribe(callback);

      unsubscribe();

      const testEvent = {
        type: 'task_done' as const,
        taskId: 'task_002',
        platform: 'douyin',
        accountId: 'account_001',
        timestamp: Date.now(),
      };

      vi.useFakeTimers();
      eventBus.emitPublishEvent(testEvent);
      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('getHistory / clearHistory', () => {
    it('emitPublishEvent 记录历史', () => {
      vi.useFakeTimers();

      eventBus.emitPublishEvent({
        type: 'task_start',
        taskId: 'task_001',
        platform: 'douyin',
        accountId: 'account_001',
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(1000);

      const history = eventBus.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].taskId).toBe('task_001');

      vi.useRealTimers();
    });

    it('clearHistory 清空历史', () => {
      vi.useFakeTimers();

      eventBus.emitPublishEvent({
        type: 'task_start',
        taskId: 'task_001',
        platform: 'douyin',
        accountId: 'account_001',
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(1000);
      eventBus.clearHistory();
      expect(eventBus.getHistory()).toEqual([]);

      vi.useRealTimers();
    });

    it('历史超过 100 条时淘汰旧记录', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 110; i++) {
        eventBus.emitPublishEvent({
          type: 'task_start',
          taskId: `task_${i}`,
          platform: 'douyin',
          accountId: 'account_001',
          timestamp: Date.now(),
        });
      }

      vi.advanceTimersByTime(1000);
      const history = eventBus.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);

      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('destroy 清理所有状态', () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      eventBus.subscribe(callback);

      eventBus.emitPublishEvent({
        type: 'task_start',
        taskId: 'task_001',
        platform: 'douyin',
        accountId: 'account_001',
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(eventBus.getHistory().length).toBe(1);

      eventBus.destroy();

      expect(eventBus.getHistory()).toEqual([]);
      expect(callback).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
