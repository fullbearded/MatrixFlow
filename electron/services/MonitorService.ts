import { Logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { getDatabase, isDatabaseAvailable } from '../data/Database';

const logger = new Logger('MonitorService');

export interface MonitorPlan {
  id: string;
  type: 'speed' | 'account' | 'video';
  name: string;
  accountIds: string[];
  metric: 'views' | 'likes' | 'comments' | 'shares';
  threshold: number;
  condition: 'above' | 'below';
  intervalMin: number;
  enabled: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

export interface MonitorAlert {
  id: string;
  planId: string;
  planName: string;
  type: MonitorPlan['type'];
  message: string;
  value: number;
  threshold: number;
  triggeredAt: Date;
  acknowledged: boolean;
}

export interface MonitorEventType {
  ALERT_TRIGGERED: 'monitor:alert_triggered';
  ALERT_ACKNOWLEDGED: 'monitor:alert_acknowledged';
  PLAN_UPDATED: 'monitor:plan_updated';
}

export const MonitorEvent: MonitorEventType = {
  ALERT_TRIGGERED: 'monitor:alert_triggered',
  ALERT_ACKNOWLEDGED: 'monitor:alert_acknowledged',
  PLAN_UPDATED: 'monitor:plan_updated',
};

class MonitorService {
  private static instance: MonitorService;
  private eventBus: EventBus;
  private plans: Map<string, MonitorPlan> = new Map();
  private alerts: Map<string, MonitorAlert> = new Map();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private listeners: Set<(alert: MonitorAlert) => void> = new Set();

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  initialize(): void {
    this.loadPlans();
    this.startAllMonitors();
    logger.info('MonitorService 已初始化');
  }

  dispose(): void {
    this.stopAllMonitors();
    this.plans.clear();
    this.alerts.clear();
    logger.info('MonitorService 已释放');
  }

  createPlan(plan: Omit<MonitorPlan, 'id' | 'createdAt'>): MonitorPlan {
    const id = `mon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newPlan: MonitorPlan = {
      ...plan,
      id,
      createdAt: new Date(),
    };

    this.plans.set(id, newPlan);
    this.savePlan(newPlan);

    if (plan.enabled) {
      this.startMonitor(id);
    }

    this.eventBus.emit(MonitorEvent.PLAN_UPDATED, newPlan);
    logger.info(`创建监控计划: ${plan.name}`);
    return newPlan;
  }

  updatePlan(id: string, updates: Partial<MonitorPlan>): MonitorPlan | null {
    const plan = this.plans.get(id);
    if (!plan) return null;

    const updated = { ...plan, ...updates };
    this.plans.set(id, updated);
    this.savePlan(updated);

    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        this.startMonitor(id);
      } else {
        this.stopMonitor(id);
      }
    }

    this.eventBus.emit(MonitorEvent.PLAN_UPDATED, updated);
    return updated;
  }

  deletePlan(id: string): boolean {
    this.stopMonitor(id);
    const deleted = this.plans.delete(id);
    if (deleted) {
      this.deletePlanFromDb(id);
      logger.info(`删除监控计划: ${id}`);
    }
    return deleted;
  }

  getPlan(id: string): MonitorPlan | undefined {
    return this.plans.get(id);
  }

  getAllPlans(): MonitorPlan[] {
    return Array.from(this.plans.values());
  }

  getActiveAlerts(): MonitorAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => !a.acknowledged)
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.eventBus.emit(MonitorEvent.ALERT_ACKNOWLEDGED, alert);
    return true;
  }

  subscribe(listener: (alert: MonitorAlert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private startMonitor(planId: string): void {
    const plan = this.plans.get(planId);
    if (!plan || !plan.enabled) return;

    if (this.timers.has(planId)) {
      this.stopMonitor(planId);
    }

    const intervalMs = plan.intervalMin * 60 * 1000;
    const timer = setInterval(() => this.checkPlan(plan), intervalMs);
    this.timers.set(planId, timer);

    this.checkPlan(plan);
    logger.info(`启动监控: ${plan.name}`);
  }

  private stopMonitor(planId: string): void {
    const timer = this.timers.get(planId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(planId);
      logger.info(`停止监控: ${planId}`);
    }
  }

  private async checkPlan(plan: MonitorPlan): Promise<void> {
    try {
      const value = await this.fetchMetricValue(plan);
      const triggered = plan.condition === 'above'
        ? value > plan.threshold
        : value < plan.threshold;

      if (triggered) {
        this.triggerAlert(plan, value);
      }
    } catch (error) {
      logger.error(`监控检查失败: ${plan.name}`, error);
    }
  }

  private async fetchMetricValue(plan: MonitorPlan): Promise<number> {
    if (!isDatabaseAvailable()) return 0;
    const db = getDatabase();

    const now = new Date();
    const since = new Date(now.getTime() - plan.intervalMin * 60 * 1000);

    if (plan.type === 'speed') {
      const row = db.prepare(`
        SELECT COALESCE(SUM(vs.${this.metricToColumn(plan.metric)}), 0) as total
        FROM video_stats vs
        JOIN task_items ti ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
        WHERE ti.account_id IN (${plan.accountIds.map(() => '?').join(',')})
          AND vs.fetch_time >= ? AND vs.fetch_time <= ?
      `).get(...plan.accountIds, since.toISOString(), now.toISOString()) as { total: number } | undefined;

      return row?.total ?? 0;
    }

    if (plan.type === 'account') {
      const row = db.prepare(`
        SELECT COALESCE(SUM(vs.${this.metricToColumn(plan.metric)}), 0) as total
        FROM video_stats vs
        JOIN task_items ti ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
        WHERE ti.account_id IN (${plan.accountIds.map(() => '?').join(',')})
      `).get(...plan.accountIds) as { total: number } | undefined;

      return row?.total ?? 0;
    }

    return 0;
  }

  private metricToColumn(metric: string): string {
    const map: Record<string, string> = {
      views: 'play_count',
      likes: 'like_count',
      comments: 'comment_count',
      shares: 'share_count',
    };
    return map[metric] || 'play_count';
  }

  private triggerAlert(plan: MonitorPlan, value: number): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const alert: MonitorAlert = {
      id: alertId,
      planId: plan.id,
      planName: plan.name,
      type: plan.type,
      message: `${plan.name}: ${plan.metric} ${plan.condition === 'above' ? '超过' : '低于'} 阈值 (${value} ${plan.condition === 'above' ? '>' : '<'} ${plan.threshold})`,
      value,
      threshold: plan.threshold,
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alertId, alert);
    plan.lastTriggeredAt = alert.triggeredAt;

    this.eventBus.emit(MonitorEvent.ALERT_TRIGGERED, alert);
    this.listeners.forEach(listener => listener(alert));

    logger.warn(`监控告警: ${alert.message}`);
  }

  private startAllMonitors(): void {
    for (const plan of this.plans.values()) {
      if (plan.enabled) {
        this.startMonitor(plan.id);
      }
    }
  }

  private stopAllMonitors(): void {
    for (const planId of this.timers.keys()) {
      this.stopMonitor(planId);
    }
  }

  private loadPlans(): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    try {
      const rows = db.prepare(`
        SELECT id, type, name, account_ids, metric, threshold, condition, interval_min, enabled, created_at, last_triggered_at
        FROM monitor_plans
        WHERE enabled = 1
      `).all() as Array<{
        id: string;
        type: string;
        name: string;
        account_ids: string;
        metric: string;
        threshold: number;
        condition: string;
        interval_min: number;
        enabled: number;
        created_at: string;
        last_triggered_at: string | null;
      }>;

      for (const row of rows) {
        this.plans.set(row.id, {
          id: row.id,
          type: row.type as MonitorPlan['type'],
          name: row.name,
          accountIds: JSON.parse(row.account_ids),
          metric: row.metric as MonitorPlan['metric'],
          threshold: row.threshold,
          condition: row.condition as MonitorPlan['condition'],
          intervalMin: row.interval_min,
          enabled: row.enabled === 1,
          createdAt: new Date(row.created_at),
          lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : undefined,
        });
      }
    } catch (error) {
      logger.error('加载监控计划失败', error);
    }
  }

  private savePlan(plan: MonitorPlan): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    try {
      db.prepare(`
        INSERT INTO monitor_plans (id, type, name, account_ids, metric, threshold, condition, interval_min, enabled, created_at, last_triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          account_ids = excluded.account_ids,
          metric = excluded.metric,
          threshold = excluded.threshold,
          condition = excluded.condition,
          interval_min = excluded.interval_min,
          enabled = excluded.enabled,
          last_triggered_at = excluded.last_triggered_at
      `).run(
        plan.id,
        plan.type,
        plan.name,
        JSON.stringify(plan.accountIds),
        plan.metric,
        plan.threshold,
        plan.condition,
        plan.intervalMin,
        plan.enabled ? 1 : 0,
        plan.createdAt.toISOString(),
        plan.lastTriggeredAt?.toISOString() ?? null
      );
    } catch (error) {
      logger.error('保存监控计划失败', error);
    }
  }

  private deletePlanFromDb(id: string): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    try {
      db.prepare('DELETE FROM monitor_plans WHERE id = ?').run(id);
    } catch (error) {
      logger.error('删除监控计划失败', error);
    }
  }
}

export const monitorService = MonitorService.getInstance();
