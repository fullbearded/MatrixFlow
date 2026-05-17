/**
 * LLM 调用服务
 * 支持 OpenAI、DeepSeek、Qwen 等多提供商
 */

import type {
  LLMConfig,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  AIConfig,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

// 提供商默认配置
const PROVIDER_DEFAULTS: Record<LLMProvider, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'qwen2.5-72b-instruct',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-haiku-20240307',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LLMService
// ─────────────────────────────────────────────────────────────────────────────

export class LLMService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * 调用 LLM
   */
  async call(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.config.defaultProvider;
    const providerConfig = this.config.providers[provider];

    if (!providerConfig) {
      throw new Error(`LLM provider ${provider} not configured`);
    }

    const startTime = Date.now();

    try {
      const response = await this.callProvider(providerConfig, request);
      response.latency = Date.now() - startTime;
      return response;
    } catch (error) {
      // 尝试降级到其他提供商
      if (this.config.fallbackToRules) {
        throw new Error(`LLM call failed and fallback disabled: ${error}`);
      }

      // 尝试备用提供商
      for (const [name, cfg] of Object.entries(this.config.providers)) {
        if (name !== provider && cfg) {
          try {
            const response = await this.callProvider(cfg, request);
            response.latency = Date.now() - startTime;
            return response;
          } catch {
            // 继续尝试下一个
          }
        }
      }

      throw new Error(`All LLM providers failed: ${error}`);
    }
  }

  /**
   * 调用具体提供商
   */
  private async callProvider(
    config: LLMConfig,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || PROVIDER_DEFAULTS[config.provider].baseUrl;
    const model = config.model || PROVIDER_DEFAULTS[config.provider].model;

    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    // 构建请求体（兼容 OpenAI 格式）
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: request.maxTokens || config.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: request.temperature ?? config.temperature ?? DEFAULT_TEMPERATURE,
    };

    // Qwen 需要特殊处理
    if (config.provider === 'qwen') {
      body.model = `qwen-${model}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeout || DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model,
      provider: config.provider,
      latency: 0, // 由调用者填充
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 单例
// ─────────────────────────────────────────────────────────────────────────────

let llmService: LLMService | null = null;

export function initLLMService(config: AIConfig): LLMService {
  llmService = new LLMService(config);
  return llmService;
}

export function getLLMService(): LLMService {
  if (!llmService) {
    throw new Error('LLMService not initialized. Call initLLMService first.');
  }
  return llmService;
}
