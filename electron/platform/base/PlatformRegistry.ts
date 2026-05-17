import type { PlatformAdapter } from './interfaces';
import { Logger } from '../../core/Logger';

const logger = new Logger('PlatformRegistry');

class PlatformRegistryClass {
  private adapters: Map<string, PlatformAdapter> = new Map();

  register(adapter: PlatformAdapter): void {
    const platformId = adapter.platformId;
    if (this.adapters.has(platformId)) {
      logger.warn(`平台 ${platformId} 已注册，将被覆盖`);
    }
    this.adapters.set(platformId, adapter);
    logger.info(`平台 ${platformId} 已注册`);
  }

  getAdapter(platformId: string): PlatformAdapter | undefined {
    return this.adapters.get(platformId);
  }

  getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }

  hasPlatform(platformId: string): boolean {
    return this.adapters.has(platformId);
  }
}

export const PlatformRegistry = new PlatformRegistryClass();
