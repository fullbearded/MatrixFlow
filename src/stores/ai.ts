import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AISuggestion, PrePublishCheckResult, RuleOptimizationResult } from '../../electron/ai/types';

export const useAIStore = defineStore('ai', () => {
  const enabled = ref(true);
  const currentCheckResult = ref<PrePublishCheckResult | null>(null);
  const pendingSuggestions = ref<AISuggestion[]>([]);
  const adoptedCount = ref(0);
  const dismissedCount = ref(0);

  async function prePublishCheck(context: {
    groupId: string;
    groupName: string;
    contentIds: string[];
    accounts: Array<{
      id: string;
      platform: string;
      nickname: string;
      cookieStatus: 'valid' | 'invalid' | 'expiring';
      lastPublishAt?: Date;
    }>;
    scheduleSlots: Array<{
      time: Date;
      contentId: string;
      accountIds: string[];
    }>;
    rule: {
      dailyCount: number;
      timeSlots: string[];
      randomOffsetMin: number;
      publishMode: 'server' | 'client';
    };
  }): Promise<PrePublishCheckResult> {
    const result = await window.matrixflow.ai.prePublishCheck(context);
    currentCheckResult.value = result;
    pendingSuggestions.value = [...result.suggestions];
    return result;
  }

  async function optimizeRule(context: {
    groupId: string;
    historicalData: {
      publishRecords: Array<{
        publishedAt: Date;
        platform: string;
        accountId: string;
        metrics: {
          views: number;
          likes: number;
          comments: number;
          shares: number;
        };
      }>;
      dateRange: {
        start: Date;
        end: Date;
      };
    };
    currentRule: {
      dailyCount: number;
      timeSlots: string[];
      randomOffsetMin: number;
      publishMode: 'server' | 'client';
    };
  }): Promise<RuleOptimizationResult> {
    return window.matrixflow.ai.optimizeRule(context);
  }

  function adoptSuggestion(suggestionId: string): void {
    const index = pendingSuggestions.value.findIndex(s => s.id === suggestionId);
    if (index !== -1) {
      pendingSuggestions.value.splice(index, 1);
      adoptedCount.value++;
    }
  }

  function dismissSuggestion(suggestionId: string): void {
    const index = pendingSuggestions.value.findIndex(s => s.id === suggestionId);
    if (index !== -1) {
      pendingSuggestions.value.splice(index, 1);
      dismissedCount.value++;
    }
  }

  function reset(): void {
    currentCheckResult.value = null;
    pendingSuggestions.value = [];
    adoptedCount.value = 0;
    dismissedCount.value = 0;
  }

  return {
    enabled,
    currentCheckResult,
    pendingSuggestions,
    adoptedCount,
    dismissedCount,
    prePublishCheck,
    optimizeRule,
    adoptSuggestion,
    dismissSuggestion,
    reset,
  };
});
