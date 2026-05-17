import { Logger } from '../core/Logger';
import { getAIService } from '../ai/AIService';
import type { AnomalyContext, AnomalyAlert } from '../ai/types';

const logger = new Logger('AnomalyService');

class AnomalyService {
  private alerts: Map<string, AnomalyAlert> = new Map();
  private listeners: Set<(alert: AnomalyAlert) => void> = new Set();
  private maxAlerts = 100;

  report(context: AnomalyContext): AnomalyAlert | null {
    try {
      const aiService = getAIService();
      const alert = aiService.detectAnomaly(context);

      if (alert) {
        this.alerts.set(alert.id, alert);
        this.notifyListeners(alert);
        this.pruneOldAlerts();
        logger.info(`异常告警: [${alert.severity}] ${alert.title}`);
      }

      return alert;
    } catch (error) {
      logger.error('检测异常失败:', error);
      return null;
    }
  }

  reportTaskFailed(taskId: string, accountId: string, platform: string, errorMessage: string): AnomalyAlert | null {
    return this.report({
      type: 'task_failed',
      taskId,
      accountId,
      platform,
      errorMessage,
    });
  }

  reportCookieExpiring(accountId: string, platform: string, daysLeft: number): AnomalyAlert | null {
    return this.report({
      type: 'cookie_expiring',
      accountId,
      platform,
      metadata: { daysLeft },
    });
  }

  reportAccountLimited(accountId: string, platform: string, reason: string): AnomalyAlert | null {
    return this.report({
      type: 'account_limited',
      accountId,
      platform,
      metadata: { reason },
    });
  }

  reportPublishError(taskId: string, accountId: string, platform: string, errorMessage: string): AnomalyAlert | null {
    return this.report({
      type: 'publish_error',
      taskId,
      accountId,
      platform,
      errorMessage,
    });
  }

  getActiveAlerts(): AnomalyAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.severity === 'critical' || a.severity === 'warning')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAlertsByAccount(accountId: string): AnomalyAlert[] {
    return this.getActiveAlerts().filter(a => a.context.accountId === accountId);
  }

  getAlertsByTask(taskId: string): AnomalyAlert[] {
    return this.getActiveAlerts().filter(a => a.context.taskId === taskId);
  }

  dismissAlert(alertId: string): boolean {
    return this.alerts.delete(alertId);
  }

  dismissAllForAccount(accountId: string): number {
    let count = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.context.accountId === accountId) {
        this.alerts.delete(id);
        count++;
      }
    }
    return count;
  }

  clearAll(): void {
    this.alerts.clear();
  }

  subscribe(listener: (alert: AnomalyAlert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(alert: AnomalyAlert): void {
    this.listeners.forEach(listener => {
      try {
        listener(alert);
      } catch (error) {
        logger.error('告警监听器执行失败:', error);
      }
    });
  }

  private pruneOldAlerts(): void {
    if (this.alerts.size <= this.maxAlerts) return;

    const sortedAlerts = Array.from(this.alerts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const toKeep = new Set(sortedAlerts.slice(0, this.maxAlerts).map(a => a.id));
    for (const id of this.alerts.keys()) {
      if (!toKeep.has(id)) {
        this.alerts.delete(id);
      }
    }
  }
}

export const anomalyService = new AnomalyService();
