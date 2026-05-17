import { Logger } from '../core/Logger';
import {
  initDatabase,
  closeDatabase,
  getDatabase,
  isDatabaseAvailable,
  runInTransaction,
} from '../data/Database';
import {
  accountRepo,
  AccountRepository,
} from '../data/repositories/AccountRepository';
import {
  groupRepo,
  GroupRepository,
} from '../data/repositories/GroupRepository';
import {
  groupPublishRuleRepo,
  GroupPublishRuleRepository,
} from '../data/repositories/GroupPublishRuleRepository';
import {
  fingerprintTemplateRepo,
  FingerprintTemplateRepository,
} from '../data/repositories/FingerprintTemplateRepository';
import {
  proxyRepo,
  ProxyRepository,
} from '../data/repositories/ProxyRepository';
import {
  platformConfigRepo,
  PlatformConfigRepository,
} from '../data/repositories/PlatformConfigRepository';
import {
  contentRepo,
  ContentRepository,
} from '../data/repositories/ContentRepository';
import {
  publishTaskRepo,
  PublishTaskRepository,
} from '../data/repositories/PublishTaskRepository';
import {
  taskItemRepo,
  TaskItemRepository,
} from '../data/repositories/TaskItemRepository';
import {
  draftRepo,
  DraftRepository,
} from '../data/repositories/DraftRepository';
import {
  videoStatRepo,
  VideoStatRepository,
} from '../data/repositories/VideoStatRepository';
import {
  monitorPlanRepo,
  MonitorPlanRepository,
} from '../data/repositories/MonitorPlanRepository';
import {
  publishRecordRepo,
  PublishRecordRepository,
} from '../data/repositories/PublishRecordRepository';
import {
  commentTemplateRepo,
  CommentTemplateRepository,
} from '../data/repositories/CommentTemplateRepository';
import type {
  Account,
  Group,
  GroupPublishRule,
  FingerprintTemplate,
  Proxy,
  PlatformConfig,
  Content,
  PublishTask,
  TaskItem,
  Draft,
  VideoStat,
  MonitorPlan,
  PublishRecord,
  CommentTemplate,
  PaginationOptions,
  PaginatedResult,
} from '../data/types';

const logger = new Logger('DataService');

export class DataService {
  private static instance: DataService;
  private initialized = false;

  readonly accounts: AccountRepository;
  readonly groups: GroupRepository;
  readonly groupPublishRules: GroupPublishRuleRepository;
  readonly fingerprintTemplates: FingerprintTemplateRepository;
  readonly proxies: ProxyRepository;
  readonly platformConfigs: PlatformConfigRepository;
  readonly contents: ContentRepository;
  readonly publishTasks: PublishTaskRepository;
  readonly taskItems: TaskItemRepository;
  readonly drafts: DraftRepository;
  readonly videoStats: VideoStatRepository;
  readonly monitorPlans: MonitorPlanRepository;
  readonly publishRecords: PublishRecordRepository;
  readonly commentTemplates: CommentTemplateRepository;

  private constructor() {
    this.accounts = accountRepo;
    this.groups = groupRepo;
    this.groupPublishRules = groupPublishRuleRepo;
    this.fingerprintTemplates = fingerprintTemplateRepo;
    this.proxies = proxyRepo;
    this.platformConfigs = platformConfigRepo;
    this.contents = contentRepo;
    this.publishTasks = publishTaskRepo;
    this.taskItems = taskItemRepo;
    this.drafts = draftRepo;
    this.videoStats = videoStatRepo;
    this.monitorPlans = monitorPlanRepo;
    this.publishRecords = publishRecordRepo;
    this.commentTemplates = commentTemplateRepo;
  }

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  initialize(): void {
    if (this.initialized) return;

    initDatabase();

    if (!isDatabaseAvailable()) {
      logger.warn('数据库不可用，DataService 以降级模式运行');
    }

    this.initialized = true;
    logger.info('DataService 初始化完成');
  }

  close(): void {
    closeDatabase();
    this.initialized = false;
    logger.info('DataService 已关闭');
  }

  isAvailable(): boolean {
    return this.initialized && isDatabaseAvailable();
  }

  getDb() {
    return getDatabase();
  }

  transaction<T>(fn: () => T): T {
    return runInTransaction(() => fn());
  }

  // ─── 账号 ──────────────────────────────────────────────

  async getAccount(id: string): Promise<Account | undefined> {
    return this.accounts.findById(id);
  }

  async getAccountsByPlatform(platform: string): Promise<Account[]> {
    return this.accounts.findByPlatform(platform);
  }

  async getActiveAccounts(): Promise<Account[]> {
    return this.accounts.findActive();
  }

  async createAccount(data: Omit<Account, 'created_at' | 'updated_at'>): Promise<Account> {
    return this.accounts.insert(data);
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<Account> {
    return this.accounts.update(id, data);
  }

  async deleteAccount(id: string): Promise<boolean> {
    return this.accounts.deleteById(id);
  }

  // ─── 分组 ──────────────────────────────────────────────

  async getGroup(id: string): Promise<Group | undefined> {
    return this.groups.findById(id);
  }

  async getAllGroups(): Promise<Group[]> {
    return this.groups.findOrdered();
  }

  async createGroup(data: Omit<Group, 'created_at' | 'updated_at'>): Promise<Group> {
    return this.groups.insert(data);
  }

  async updateGroup(id: string, data: Partial<Group>): Promise<Group> {
    return this.groups.update(id, data);
  }

  async deleteGroup(id: string): Promise<boolean> {
    return this.groups.deleteById(id);
  }

  // ─── 内容 ──────────────────────────────────────────────

  async getContent(id: string): Promise<Content | undefined> {
    return this.contents.findById(id);
  }

  async getContentsByType(type: string, options?: PaginationOptions): Promise<PaginatedResult<Content>> {
    return this.contents.findByType(type, options);
  }

  async searchContents(keyword: string): Promise<Content[]> {
    return this.contents.search(keyword);
  }

  async createContent(data: Omit<Content, 'created_at' | 'updated_at'>): Promise<Content> {
    return this.contents.insert(data);
  }

  async updateContent(id: string, data: Partial<Content>): Promise<Content> {
    return this.contents.update(id, data);
  }

  async deleteContent(id: string): Promise<boolean> {
    return this.contents.deleteById(id);
  }

  // ─── 发布任务 ──────────────────────────────────────────

  async getPublishTask(id: string): Promise<PublishTask | undefined> {
    return this.publishTasks.findById(id);
  }

  async getPublishTasksByStatus(status: string, options?: PaginationOptions): Promise<PaginatedResult<PublishTask>> {
    return this.publishTasks.findByStatus(status, options);
  }

  async getPendingScheduledTasks(beforeTime: string): Promise<PublishTask[]> {
    return this.publishTasks.findPendingScheduled(beforeTime);
  }

  async createPublishTask(data: Omit<PublishTask, 'created_at' | 'updated_at'>): Promise<PublishTask> {
    return this.publishTasks.insert(data);
  }

  async updatePublishTask(id: string, data: Partial<PublishTask>): Promise<PublishTask> {
    return this.publishTasks.update(id, data);
  }

  async deletePublishTask(id: string): Promise<boolean> {
    return this.publishTasks.deleteById(id);
  }

  // ─── 任务项 ────────────────────────────────────────────

  async getTaskItem(id: string): Promise<TaskItem | undefined> {
    return this.taskItems.findById(id);
  }

  async getTaskItemsByTaskId(taskId: string): Promise<TaskItem[]> {
    return this.taskItems.findByTaskId(taskId);
  }

  async createTaskItems(items: Omit<TaskItem, 'created_at' | 'updated_at'>[]): Promise<TaskItem[]> {
    return this.taskItems.createBatch(items);
  }

  async updateTaskItem(id: string, data: Partial<TaskItem>): Promise<TaskItem> {
    return this.taskItems.update(id, data);
  }

  // ─── 指纹模板 ──────────────────────────────────────────

  async getFingerprintTemplate(id: string): Promise<FingerprintTemplate | undefined> {
    return this.fingerprintTemplates.findById(id);
  }

  async createFingerprintTemplate(data: Omit<FingerprintTemplate, 'created_at' | 'updated_at'>): Promise<FingerprintTemplate> {
    return this.fingerprintTemplates.insert(data);
  }

  async updateFingerprintTemplate(id: string, data: Partial<FingerprintTemplate>): Promise<FingerprintTemplate> {
    return this.fingerprintTemplates.update(id, data);
  }

  async deleteFingerprintTemplate(id: string): Promise<boolean> {
    return this.fingerprintTemplates.deleteById(id);
  }

  // ─── 代理 ──────────────────────────────────────────────

  async getProxy(id: string): Promise<Proxy | undefined> {
    return this.proxies.findById(id);
  }

  async getActiveProxies(): Promise<Proxy[]> {
    return this.proxies.findActive();
  }

  async createProxy(data: Omit<Proxy, 'created_at' | 'updated_at'>): Promise<Proxy> {
    return this.proxies.insert(data);
  }

  async updateProxy(id: string, data: Partial<Proxy>): Promise<Proxy> {
    return this.proxies.update(id, data);
  }

  async deleteProxy(id: string): Promise<boolean> {
    return this.proxies.deleteById(id);
  }

  // ─── 平台配置 ──────────────────────────────────────────

  async getPlatformConfig(id: string): Promise<PlatformConfig | undefined> {
    return this.platformConfigs.findById(id);
  }

  async getPlatformConfigsByPlatform(platform: string): Promise<PlatformConfig[]> {
    return this.platformConfigs.findByPlatform(platform);
  }

  async upsertPlatformConfig(platform: string, key: string, value: string, description?: string): Promise<PlatformConfig> {
    return this.platformConfigs.upsert(platform, key, value, description);
  }

  // ─── 草稿 ──────────────────────────────────────────────

  async getDraft(id: string): Promise<Draft | undefined> {
    return this.drafts.findById(id);
  }

  async getDraftsByPlatform(platform: string): Promise<Draft[]> {
    return this.drafts.findByPlatform(platform);
  }

  async createDraft(data: Omit<Draft, 'created_at' | 'updated_at'>): Promise<Draft> {
    return this.drafts.insert(data);
  }

  async updateDraft(id: string, data: Partial<Draft>): Promise<Draft> {
    return this.drafts.update(id, data);
  }

  async deleteDraft(id: string): Promise<boolean> {
    return this.drafts.deleteById(id);
  }

  // ─── 视频统计 ──────────────────────────────────────────

  async getVideoStat(id: string): Promise<VideoStat | undefined> {
    return this.videoStats.findById(id);
  }

  async getVideoStatsHistory(platformVideoId: string, options?: PaginationOptions): Promise<PaginatedResult<VideoStat>> {
    return this.videoStats.getStatsHistory(platformVideoId, options);
  }

  async createVideoStat(data: Omit<VideoStat, 'created_at'>): Promise<VideoStat> {
    return this.videoStats.insert(data);
  }

  // ─── 监控计划 ──────────────────────────────────────────

  async getMonitorPlan(id: string): Promise<MonitorPlan | undefined> {
    return this.monitorPlans.findById(id);
  }

  async getEnabledMonitorPlans(): Promise<MonitorPlan[]> {
    return this.monitorPlans.findEnabled();
  }

  async getDueMonitorPlans(): Promise<MonitorPlan[]> {
    return this.monitorPlans.findDueNow();
  }

  async createMonitorPlan(data: Omit<MonitorPlan, 'created_at' | 'updated_at'>): Promise<MonitorPlan> {
    return this.monitorPlans.insert(data);
  }

  async updateMonitorPlan(id: string, data: Partial<MonitorPlan>): Promise<MonitorPlan> {
    return this.monitorPlans.update(id, data);
  }

  async deleteMonitorPlan(id: string): Promise<boolean> {
    return this.monitorPlans.deleteById(id);
  }

  // ─── 评论模板 ──────────────────────────────────────────

  async getCommentTemplate(id: string): Promise<CommentTemplate | undefined> {
    return this.commentTemplates.findById(id);
  }

  async getCommentTemplatesByCategory(category: string): Promise<CommentTemplate[]> {
    return this.commentTemplates.findByCategory(category);
  }

  async getRandomComment(platform?: string): Promise<CommentTemplate | undefined> {
    return this.commentTemplates.getRandomEnabled(platform);
  }

  async createCommentTemplate(data: Omit<CommentTemplate, 'created_at' | 'updated_at'>): Promise<CommentTemplate> {
    return this.commentTemplates.insert(data);
  }

  async updateCommentTemplate(id: string, data: Partial<CommentTemplate>): Promise<CommentTemplate> {
    return this.commentTemplates.update(id, data);
  }

  async deleteCommentTemplate(id: string): Promise<boolean> {
    return this.commentTemplates.deleteById(id);
  }

  // ─── 分组发布规则 ──────────────────────────────────────

  async getGroupPublishRules(groupId: string): Promise<GroupPublishRule[]> {
    return this.groupPublishRules.findByGroupId(groupId);
  }

  async getEnabledGroupPublishRules(groupId: string): Promise<GroupPublishRule[]> {
    return this.groupPublishRules.findEnabledByGroup(groupId);
  }

  async createGroupPublishRule(data: Omit<GroupPublishRule, 'created_at' | 'updated_at'>): Promise<GroupPublishRule> {
    return this.groupPublishRules.insert(data);
  }

  async updateGroupPublishRule(id: string, data: Partial<GroupPublishRule>): Promise<GroupPublishRule> {
    return this.groupPublishRules.update(id, data);
  }

  async deleteGroupPublishRule(id: string): Promise<boolean> {
    return this.groupPublishRules.deleteById(id);
  }
}

export const dataService = DataService.getInstance();
