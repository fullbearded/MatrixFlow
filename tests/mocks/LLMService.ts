import { vi } from 'vitest';
import type { LLMRequest, LLMResponse, AIConfig } from '@electron/ai/types';

export function createLLMServiceMock() {
  const defaultResponse: LLMResponse = {
    content: 'mocked LLM response',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    model: 'gpt-4o-mini',
    provider: 'openai',
    latency: 100,
  };

  return {
    call: vi.fn<(request: LLMRequest) => Promise<LLMResponse>>(
      () => Promise.resolve({ ...defaultResponse })
    ),
    updateConfig: vi.fn<(config: Partial<AIConfig>) => void>(),
    getConfig: vi.fn<() => AIConfig>(
      (): AIConfig => ({
        enabled: true,
        defaultProvider: 'openai',
        providers: {},
        cacheTTL: 86400000,
        fallbackToRules: true,
        costTracking: false,
      })
    ),
    __setDefaultResponse: (response: Partial<LLMResponse>) => {
      Object.assign(defaultResponse, response);
    },
  };
}

export type LLMServiceMock = ReturnType<typeof createLLMServiceMock>;
