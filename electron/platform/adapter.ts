export * from './base/types';
export * from './base/interfaces';
export * from './base/BaseAdapter';
export { PlatformRegistry } from './base/PlatformRegistry';

export { douyinAdapter } from './douyin';
export { xiaohongshuAdapter } from './xiaohongshu';
export { channelsAdapter } from './channels';
export { kuaishouAdapter } from './kuaishou';

import { PlatformRegistry } from './base/PlatformRegistry';
import { douyinAdapter } from './douyin';
import { xiaohongshuAdapter } from './xiaohongshu';
import { channelsAdapter } from './channels';
import { kuaishouAdapter } from './kuaishou';

export function registerAllAdapters(): void {
  PlatformRegistry.register(douyinAdapter);
  PlatformRegistry.register(xiaohongshuAdapter);
  PlatformRegistry.register(channelsAdapter);
  PlatformRegistry.register(kuaishouAdapter);
}

export const PLATFORM_IDS = {
  douyin: 'douyin',
  xiaohongshu: 'xiaohongshu',
  channels: 'channels',
  kuaishou: 'kuaishou',
} as const;

export type PlatformId = (typeof PLATFORM_IDS)[keyof typeof PLATFORM_IDS];
