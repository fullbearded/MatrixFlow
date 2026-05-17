import type { AIConfig } from '../ai/types';

const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  defaultProvider: 'openai',
  providers: {
    openai: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
    },
    deepseek: {
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
    },
    qwen: {
      provider: 'qwen',
      model: 'qwen2.5-72b-instruct',
      apiKey: process.env.QWEN_API_KEY || '',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
    },
  },
  cacheTTL: 24 * 60 * 60 * 1000,
  fallbackToRules: true,
  costTracking: true,
};

class AIConfigManager {
  private config: AIConfig;

  constructor() {
    this.config = { ...DEFAULT_AI_CONFIG };
  }

  load(userConfig: Partial<AIConfig>): void {
    this.config = {
      ...this.config,
      ...userConfig,
      providers: {
        ...this.config.providers,
        ...userConfig.providers,
      },
    };
  }

  get(): AIConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setProvider(provider: AIConfig['defaultProvider']): void {
    this.config.defaultProvider = provider;
  }

  setApiKey(provider: keyof AIConfig['providers'], apiKey: string): void {
    if (this.config.providers[provider]) {
      this.config.providers[provider]!.apiKey = apiKey;
    }
  }
}

export const aiConfigManager = new AIConfigManager();
export { DEFAULT_AI_CONFIG };
