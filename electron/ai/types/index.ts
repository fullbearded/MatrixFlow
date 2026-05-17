/**
 * AI 模块类型定义
 */

// ─────────────────────────────────────────────────────────────────────────────
// LLM 配置
// ─────────────────────────────────────────────────────────────────────────────

export type LLMProvider = 'openai' | 'deepseek' | 'qwen' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface AIConfig {
  enabled: boolean;
  defaultProvider: LLMProvider;
  providers: Partial<Record<LLMProvider, LLMConfig>>;
  cacheTTL: number; // 缓存过期时间（毫秒），默认 24h
  fallbackToRules: boolean; // LLM 失败时是否降级到规则引擎
  costTracking: boolean; // 是否追踪成本
}

// ─────────────────────────────────────────────────────────────────────────────
// AI 建议类型（三档建议）
// ─────────────────────────────────────────────────────────────────────────────

export type SuggestionLevel = 'strong' | 'weak' | 'warning';

export interface AISuggestion {
  id: string;
  level: SuggestionLevel;
  title: string;
  description: string;
  action?: string; // 建议的操作，如 "调整时间槽到 12:00"
  data?: Record<string, unknown>; // 支持建议的数据
  confidence: number; // 0-1 置信度
  source: string; // 建议来源：'llm' | 'rules' | 'cache'
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 预发布检查
// ─────────────────────────────────────────────────────────────────────────────

export interface PrePublishContext {
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
    publishMode: 'server_publish' | 'client_direct';
  };
}

export interface PrePublishCheckResult {
  suggestions: AISuggestion[];
  checks: {
    scheduleReasonable: boolean;
    accountHealth: boolean;
    historicalDataAvailable: boolean;
    conflictsDetected: boolean;
  };
  metrics?: {
    dataDays: number; // 历史数据天数
    sampleSize: number; // 样本量
    confidence: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 规则优化
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleOptimizationContext {
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
    publishMode: 'server_publish' | 'client_direct';
  };
}

export interface RuleOptimizationResult {
  suggestions: AISuggestion[];
  optimizations?: {
    suggestedTimeSlots?: string[];
    suggestedDailyCount?: number;
    suggestedPublishMode?: 'server_publish' | 'client_direct';
    reasoning: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 异常检测
// ─────────────────────────────────────────────────────────────────────────────

export interface AnomalyContext {
  type: 'task_failed' | 'cookie_expiring' | 'account_limited' | 'publish_error';
  taskId?: string;
  accountId?: string;
  platform?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyAlert {
  id: string;
  type: AnomalyContext['type'];
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action: 'retry' | 'relogin' | 'skip' | 'investigate';
  context: AnomalyContext;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 内容分组匹配
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentMatchContext {
  contents: Array<{
    id: string;
    title: string;
    description?: string;
    tags?: string[];
    duration?: number;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    keywords?: string[];
  }>;
}

export interface ContentMatchResult {
  matches: Array<{
    contentId: string;
    suggestedGroupId: string;
    confidence: number;
    reasoning: string;
  }>;
  unmatched: string[]; // 无法匹配的内容 ID
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM 请求/响应
// ─────────────────────────────────────────────────────────────────────────────

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: LLMProvider;
  latency: number; // 毫秒
}

// ─────────────────────────────────────────────────────────────────────────────
// 缓存
// ─────────────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  ttl: number;
  hits: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 成本追踪
// ─────────────────────────────────────────────────────────────────────────────

export interface CostRecord {
  provider: LLMProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number; // 美元
  timestamp: Date;
  operation: string; // 'prepublish' | 'rule_optimization' | 'content_match'
}
