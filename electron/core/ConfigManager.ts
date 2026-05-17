import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { app } from 'electron';

interface AppConfig {
  dataDir: string;
  logLevel: string;
  maxConcurrentPublish: number;
  browserMode: 'embedded' | 'system-chrome' | 'fingerprint';
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.yaml');
    this.config = this.getDefaultConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getDefaultConfig(): AppConfig {
    const userDataPath = app.getPath('userData');
    return {
      dataDir: path.join(userDataPath, 'data'),
      logLevel: 'info',
      maxConcurrentPublish: 5,
      browserMode: 'system-chrome',
    };
  }

  async initialize(): Promise<void> {
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const loadedConfig = yaml.parse(content);
      this.config = { ...this.config, ...loadedConfig };
    }

    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }

    const cookiesDir = path.join(this.config.dataDir, 'cookies');
    const mediaDir = path.join(this.config.dataDir, 'media');
    if (!fs.existsSync(cookiesDir)) fs.mkdirSync(cookiesDir, { recursive: true });
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  async save(): Promise<void> {
    const content = yaml.stringify(this.config);
    fs.writeFileSync(this.configPath, content, 'utf-8');
  }
}
