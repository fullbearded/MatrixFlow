import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';

export class AppLifecycle {
  private static instance: AppLifecycle;
  private config: ConfigManager;
  private eventBus: EventBus;
  private initialized = false;

  constructor(config: ConfigManager, eventBus: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
  }

  static getInstance(): AppLifecycle {
    if (!AppLifecycle.instance) {
      const config = ConfigManager.getInstance();
      const eventBus = EventBus.getInstance();
      AppLifecycle.instance = new AppLifecycle(config, eventBus);
    }
    return AppLifecycle.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.config.initialize();
    this.eventBus.emit('app:initialized');
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.eventBus.emit('app:shutdown');
    await this.config.save();
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
