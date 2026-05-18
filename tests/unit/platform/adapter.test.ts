import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockRegister } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
}));

vi.mock('@electron/platform/base/PlatformRegistry', () => ({
  PlatformRegistry: { register: mockRegister },
}));

vi.mock('@electron/platform/douyin', () => ({
  douyinAdapter: { platformId: 'douyin' },
}));

vi.mock('@electron/platform/xiaohongshu', () => ({
  xiaohongshuAdapter: { platformId: 'xiaohongshu' },
}));

vi.mock('@electron/platform/channels', () => ({
  channelsAdapter: { platformId: 'channels' },
}));

vi.mock('@electron/platform/kuaishou', () => ({
  kuaishouAdapter: { platformId: 'kuaishou' },
}));

vi.mock('@electron/platform/base/types', () => ({}));
vi.mock('@electron/platform/base/interfaces', () => ({}));
vi.mock('@electron/platform/base/BaseAdapter', () => ({}));

import {
  registerAllAdapters,
  PLATFORM_IDS,
  douyinAdapter,
  xiaohongshuAdapter,
  channelsAdapter,
  kuaishouAdapter,
} from '@electron/platform/adapter';

describe('platform/adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAllAdapters', () => {
    it('registers all 4 platforms', () => {
      registerAllAdapters();

      expect(mockRegister).toHaveBeenCalledTimes(4);
      expect(mockRegister).toHaveBeenCalledWith({ platformId: 'douyin' });
      expect(mockRegister).toHaveBeenCalledWith({ platformId: 'xiaohongshu' });
      expect(mockRegister).toHaveBeenCalledWith({ platformId: 'channels' });
      expect(mockRegister).toHaveBeenCalledWith({ platformId: 'kuaishou' });
    });
  });

  describe('PLATFORM_IDS', () => {
    it('has correct keys', () => {
      expect(Object.keys(PLATFORM_IDS)).toEqual(['douyin', 'xiaohongshu', 'channels', 'kuaishou']);
    });

    it('has matching key-value pairs', () => {
      expect(PLATFORM_IDS.douyin).toBe('douyin');
      expect(PLATFORM_IDS.xiaohongshu).toBe('xiaohongshu');
      expect(PLATFORM_IDS.channels).toBe('channels');
      expect(PLATFORM_IDS.kuaishou).toBe('kuaishou');
    });
  });

  describe('re-exports', () => {
    it('exports douyinAdapter', () => {
      expect(douyinAdapter).toEqual({ platformId: 'douyin' });
    });

    it('exports xiaohongshuAdapter', () => {
      expect(xiaohongshuAdapter).toEqual({ platformId: 'xiaohongshu' });
    });

    it('exports channelsAdapter', () => {
      expect(channelsAdapter).toEqual({ platformId: 'channels' });
    });

    it('exports kuaishouAdapter', () => {
      expect(kuaishouAdapter).toEqual({ platformId: 'kuaishou' });
    });
  });
});
