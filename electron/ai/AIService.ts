import type {
  AIConfig,
  AISuggestion,
  PrePublishContext,
  PrePublishCheckResult,
  RuleOptimizationContext,
  RuleOptimizationResult,
  AnomalyContext,
  AnomalyAlert,
  ContentMatchContext,
  ContentMatchResult,
  CostRecord,
  SuggestionLevel,
} from './types';
import { LLMService, initLLMService, getLLMService } from './LLMService';
import { AICache, initAICache, getAICache } from './AICache';

const SUGGESTION_ID_PREFIX = 'sug_';
const ALERT_ID_PREFIX = 'alert_';

function generateSuggestionId(): string {
  return `${SUGGESTION_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAlertId(): string {
  return `${ALERT_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function determineSuggestionLevel(dataDays: number, sampleSize: number): SuggestionLevel {
  if (dataDays >= 30 && sampleSize >= 50) return 'strong';
  if (dataDays >= 7 && sampleSize >= 10) return 'weak';
  return 'warning';
}

export class AIService {
  private config: AIConfig;
  private llm: LLMService | null = null;
  private cache: AICache | null = null;
  private costRecords: CostRecord[] = [];

  constructor(config: AIConfig) {
    this.config = config;
    if (config.enabled) {
      this.llm = initLLMService(config);
      this.cache = initAICache({ ttl: config.cacheTTL });
    }
  }

  async prePublishCheck(context: PrePublishContext): Promise<PrePublishCheckResult> {
    if (!this.config.enabled) {
      return this.ruleBasedPrePublishCheck(context);
    }

    const cacheKey = this.cache!.generateKey('prepublish', {
      groupId: context.groupId,
      contentCount: context.contentIds.length,
      accountCount: context.accounts.length,
    });

    const cached = this.cache!.get<PrePublishCheckResult>(cacheKey);
    if (cached) {
      cached.suggestions.forEach(s => s.source = 'cache');
      return cached;
    }

    try {
      const result = await this.llmBasedPrePublishCheck(context);
      this.cache!.set(cacheKey, result);
      return result;
    } catch {
      return this.ruleBasedPrePublishCheck(context);
    }
  }

  private async llmBasedPrePublishCheck(context: PrePublishContext): Promise<PrePublishCheckResult> {
    const prompt = this.buildPrePublishPrompt(context);
    const response = await this.llm!.call({
      prompt,
      systemPrompt: '你是一个社交媒体运营专家，帮助分析发布排期的合理性。',
      temperature: 0.3,
    });

    this.trackCost('prepublish', response.usage.promptTokens, response.usage.completionTokens);

    const suggestions = this.parseSuggestions(response.content);
    const dataDays = this.estimateDataDays(context);
    const sampleSize = context.accounts.length * context.scheduleSlots.length;

    return {
      suggestions,
      checks: {
        scheduleReasonable: !suggestions.some(s => s.title.includes('排期')),
        accountHealth: !suggestions.some(s => s.title.includes('Cookie')),
        historicalDataAvailable: dataDays > 0,
        conflictsDetected: suggestions.some(s => s.level === 'warning'),
      },
      metrics: { dataDays, sampleSize, confidence: Math.min(dataDays / 30, 1) },
    };
  }

  private ruleBasedPrePublishCheck(context: PrePublishContext): PrePublishCheckResult {
    const suggestions: AISuggestion[] = [];
    const now = new Date();

    const expiringAccounts = context.accounts.filter(
      a => a.cookieStatus === 'expiring' || a.cookieStatus === 'invalid'
    );

    if (expiringAccounts.length > 0) {
      suggestions.push({
        id: generateSuggestionId(),
        level: 'warning',
        title: `${expiringAccounts.length} 个账号 Cookie 即将过期或已失效`,
        description: `以下账号需要重新登录：${expiringAccounts.map(a => a.nickname).join('、')}`,
        action: 'relogin',
        confidence: 1,
        source: 'rules',
        createdAt: now,
      });
    }

    const limitedAccounts = context.accounts.filter(a => {
      const lastPublish = a.lastPublishAt;
      if (!lastPublish) return false;
      const hoursSincePublish = (now.getTime() - lastPublish.getTime()) / (1000 * 60 * 60);
      return hoursSincePublish < 1;
    });

    if (limitedAccounts.length > 0) {
      suggestions.push({
        id: generateSuggestionId(),
        level: 'weak',
        title: `${limitedAccounts.length} 个账号 1 小时内有发布记录`,
        description: '频繁发布可能触发平台限流，建议调整发布时间',
        confidence: 0.7,
        source: 'rules',
        createdAt: now,
      });
    }

    if (context.scheduleSlots.length > 10) {
      suggestions.push({
        id: generateSuggestionId(),
        level: 'weak',
        title: '本次发布任务较多',
        description: `共 ${context.scheduleSlots.length} 个发布任务，建议分批发布`,
        confidence: 0.6,
        source: 'rules',
        createdAt: now,
      });
    }

    return {
      suggestions,
      checks: {
        scheduleReasonable: true,
        accountHealth: expiringAccounts.length === 0,
        historicalDataAvailable: false,
        conflictsDetected: false,
      },
    };
  }

  async optimizeRule(context: RuleOptimizationContext): Promise<RuleOptimizationResult> {
    if (!this.config.enabled) {
      return this.ruleBasedOptimizeRule(context);
    }

    const cacheKey = this.cache!.generateKey('rule_optimize', {
      groupId: context.groupId,
      recordCount: context.historicalData.publishRecords.length,
    });

    const cached = this.cache!.get<RuleOptimizationResult>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.llmBasedOptimizeRule(context);
      this.cache!.set(cacheKey, result);
      return result;
    } catch {
      return this.ruleBasedOptimizeRule(context);
    }
  }

  private async llmBasedOptimizeRule(context: RuleOptimizationContext): Promise<RuleOptimizationResult> {
    const prompt = this.buildRuleOptimizationPrompt(context);
    const response = await this.llm!.call({
      prompt,
      systemPrompt: '你是一个数据分析专家，帮助优化社交媒体发布策略。',
      temperature: 0.3,
    });

    this.trackCost('rule_optimization', response.usage.promptTokens, response.usage.completionTokens);

    return this.parseRuleOptimization(response.content);
  }

  private ruleBasedOptimizeRule(context: RuleOptimizationContext): RuleOptimizationResult {
    const suggestions: AISuggestion[] = [];
    const records = context.historicalData.publishRecords;

    if (records.length < 10) {
      return { suggestions: [] };
    }

    const hourPerformance: Record<number, { total: number; avgViews: number }> = {};
    records.forEach(r => {
      const hour = r.publishedAt.getHours();
      if (!hourPerformance[hour]) {
        hourPerformance[hour] = { total: 0, avgViews: 0 };
      }
      hourPerformance[hour].total++;
      hourPerformance[hour].avgViews += r.metrics.views;
    });

    Object.keys(hourPerformance).forEach(hour => {
      const h = parseInt(hour);
      hourPerformance[h].avgViews /= hourPerformance[h].total;
    });

    const sortedHours = Object.entries(hourPerformance)
      .sort((a, b) => b[1].avgViews - a[1].avgViews);

    if (sortedHours.length >= 2) {
      const best = sortedHours[0];
      const worst = sortedHours[sortedHours.length - 1];
      const improvement = ((best[1].avgViews - worst[1].avgViews) / worst[1].avgViews * 100).toFixed(0);

      if (parseInt(improvement) > 20) {
        suggestions.push({
          id: generateSuggestionId(),
          level: determineSuggestionLevel(
            (context.historicalData.dateRange.end.getTime() - context.historicalData.dateRange.start.getTime()) / (1000 * 60 * 60 * 24),
            records.length
          ),
          title: `${best[0]}:00 发布效果最佳`,
          description: `相比 ${worst[0]}:00，${best[0]}:00 发布的平均播放量高 ${improvement}%`,
          action: `调整时间槽到 ${best[0]}:00`,
          confidence: Math.min(records.length / 50, 0.9),
          source: 'rules',
          createdAt: new Date(),
        });
      }
    }

    return { suggestions };
  }

  detectAnomaly(context: AnomalyContext): AnomalyAlert | null {
    const severityMap: Record<AnomalyContext['type'], 'critical' | 'warning' | 'info'> = {
      task_failed: 'critical',
      cookie_expiring: 'warning',
      account_limited: 'warning',
      publish_error: 'critical',
    };

    const actionMap: Record<AnomalyContext['type'], AnomalyAlert['action']> = {
      task_failed: 'retry',
      cookie_expiring: 'relogin',
      account_limited: 'investigate',
      publish_error: 'retry',
    };

    const titleMap: Record<AnomalyContext['type'], string> = {
      task_failed: '发布任务失败',
      cookie_expiring: 'Cookie 即将过期',
      account_limited: '账号可能被限流',
      publish_error: '发布过程出错',
    };

    return {
      id: generateAlertId(),
      type: context.type,
      severity: severityMap[context.type],
      title: titleMap[context.type],
      description: context.errorMessage || `检测到异常：${context.type}`,
      action: actionMap[context.type],
      context,
      createdAt: new Date(),
    };
  }

  async matchContentToGroup(context: ContentMatchContext): Promise<ContentMatchResult> {
    if (!this.config.enabled || context.contents.length === 0) {
      return { matches: [], unmatched: context.contents.map(c => c.id) };
    }

    const prompt = this.buildContentMatchPrompt(context);
    const response = await this.llm!.call({
      prompt,
      systemPrompt: '你是一个内容分类专家，帮助将内容匹配到最合适的分组。',
      temperature: 0.3,
    });

    this.trackCost('content_match', response.usage.promptTokens, response.usage.completionTokens);

    return this.parseContentMatch(response.content, context);
  }

  private buildPrePublishPrompt(context: PrePublishContext): string {
    return JSON.stringify({
      task: 'prepublish_check',
      group: { id: context.groupId, name: context.groupName },
      contentCount: context.contentIds.length,
      accounts: context.accounts.map(a => ({
        platform: a.platform,
        nickname: a.nickname,
        cookieStatus: a.cookieStatus,
      })),
      schedule: context.scheduleSlots.map(s => ({
        time: s.time.toISOString(),
        accountCount: s.accountIds.length,
      })),
      rule: context.rule,
    }, null, 2);
  }

  private buildRuleOptimizationPrompt(context: RuleOptimizationContext): string {
    const metricsByHour: Record<number, { views: number; count: number }> = {};
    context.historicalData.publishRecords.forEach(r => {
      const hour = r.publishedAt.getHours();
      if (!metricsByHour[hour]) metricsByHour[hour] = { views: 0, count: 0 };
      metricsByHour[hour].views += r.metrics.views;
      metricsByHour[hour].count++;
    });

    return JSON.stringify({
      task: 'rule_optimization',
      groupId: context.groupId,
      dateRange: context.historicalData.dateRange,
      metricsByHour: Object.entries(metricsByHour).map(([hour, data]) => ({
        hour: parseInt(hour),
        avgViews: Math.round(data.views / data.count),
        sampleCount: data.count,
      })),
      currentRule: context.currentRule,
    }, null, 2);
  }

  private buildContentMatchPrompt(context: ContentMatchContext): string {
    return JSON.stringify({
      task: 'content_match',
      contents: context.contents,
      groups: context.groups,
    }, null, 2);
  }

  private parseSuggestions(content: string): AISuggestion[] {
    const suggestions: AISuggestion[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.suggestions)) {
        parsed.suggestions.forEach((s: Partial<AISuggestion>) => {
          suggestions.push({
            id: generateSuggestionId(),
            level: s.level || 'weak',
            title: s.title || '',
            description: s.description || '',
            action: s.action,
            confidence: s.confidence || 0.5,
            source: 'llm',
            createdAt: new Date(),
          });
        });
      }
    } catch {
      // 解析失败，返回空数组
    }
    return suggestions;
  }

  private parseRuleOptimization(content: string): RuleOptimizationResult {
    try {
      const parsed = JSON.parse(content);
      return {
        suggestions: this.parseSuggestions(JSON.stringify({ suggestions: parsed.suggestions || [] })),
        optimizations: parsed.optimizations,
      };
    } catch {
      return { suggestions: [] };
    }
  }

  private parseContentMatch(content: string, context: ContentMatchContext): ContentMatchResult {
    try {
      const parsed = JSON.parse(content);
      const matches = (parsed.matches || []).map((m: { contentId: string; groupId: string; confidence: number; reasoning: string }) => ({
        contentId: m.contentId,
        suggestedGroupId: m.groupId,
        confidence: m.confidence || 0.5,
        reasoning: m.reasoning || '',
      }));
      const matchedIds = new Set(matches.map((m: { contentId: string }) => m.contentId));
      const unmatched = context.contents.filter(c => !matchedIds.has(c.id)).map(c => c.id);
      return { matches, unmatched };
    } catch {
      return { matches: [], unmatched: context.contents.map(c => c.id) };
    }
  }

  private estimateDataDays(context: PrePublishContext): number {
    const lastPublishDates = context.accounts
      .filter(a => a.lastPublishAt)
      .map(a => a.lastPublishAt!.getTime());
    if (lastPublishDates.length === 0) return 0;
    const earliest = Math.min(...lastPublishDates);
    return (Date.now() - earliest) / (1000 * 60 * 60 * 24);
  }

  private trackCost(operation: string, promptTokens: number, completionTokens: number): void {
    if (!this.config.costTracking) return;
    const cost = this.calculateCost(promptTokens, completionTokens, this.config.defaultProvider);
    this.costRecords.push({
      provider: this.config.defaultProvider,
      model: this.config.providers[this.config.defaultProvider]?.model || 'unknown',
      promptTokens,
      completionTokens,
      cost,
      timestamp: new Date(),
      operation: operation as CostRecord['operation'],
    });
  }

  private calculateCost(promptTokens: number, completionTokens: number, provider: string): number {
    const rates: Record<string, { prompt: number; completion: number }> = {
      openai: { prompt: 0.15 / 1_000_000, completion: 0.6 / 1_000_000 },
      deepseek: { prompt: 0.14 / 1_000_000, completion: 0.28 / 1_000_000 },
      qwen: { prompt: 0.35 / 1_000_000, completion: 0.35 / 1_000_000 },
      anthropic: { prompt: 0.25 / 1_000_000, completion: 1.25 / 1_000_000 },
    };
    const rate = rates[provider] || rates.openai;
    return promptTokens * rate.prompt + completionTokens * rate.completion;
  }

  getCostSummary(): { totalCost: number; totalTokens: number; records: CostRecord[] } {
    const totalCost = this.costRecords.reduce((sum, r) => sum + r.cost, 0);
    const totalTokens = this.costRecords.reduce((sum, r) => sum + r.promptTokens + r.completionTokens, 0);
    return { totalCost, totalTokens, records: [...this.costRecords] };
  }

  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.llm) {
      this.llm.updateConfig(this.config);
    }
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }
}

let aiService: AIService | null = null;

export function initAIService(config: AIConfig): AIService {
  aiService = new AIService(config);
  return aiService;
}

export function getAIService(): AIService {
  if (!aiService) {
    throw new Error('AIService not initialized. Call initAIService first.');
  }
  return aiService;
}

export { LLMService, getLLMService, initLLMService };
export { AICache, getAICache, initAICache };
