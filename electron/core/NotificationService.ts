import { Notification, BrowserWindow } from 'electron';
import { Logger } from './Logger';
import { monitorService } from '../services/MonitorService';
import { anomalyService } from '../services/AnomalyService';
import type { MonitorAlert } from '../services/MonitorService';
import type { AnomalyAlert } from '../ai/types';
import { getDatabase } from '../data/Database';

const logger = new Logger('NotificationService');

export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  monitorAlerts: boolean;
  anomalyAlerts: boolean;
  criticalOnly: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  sound: true,
  monitorAlerts: true,
  anomalyAlerts: true,
  criticalOnly: false,
};

class NotificationService {
  private preferences: NotificationPreferences = { ...DEFAULT_PREFS };
  private unsubMonitor: (() => void) | null = null;
  private unsubAnomaly: (() => void) | null = null;

  constructor() {
    this.loadPreferences();
    this.unsubMonitor = monitorService.subscribe(this.onMonitorAlert.bind(this));
    this.unsubAnomaly = anomalyService.subscribe(this.onAnomalyAlert.bind(this));
    logger.info('NotificationService 已初始化');
  }

  dispose(): void {
    this.unsubMonitor?.();
    this.unsubAnomaly?.();
    logger.info('NotificationService 已释放');
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  updatePreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
    Object.assign(this.preferences, prefs);
    this.savePreferences();
    return this.getPreferences();
  }

  sendTest(): void {
    this.showNotification('测试通知', '如果你看到了这条通知，说明桌面通知功能正常工作');
  }

  private onMonitorAlert(alert: MonitorAlert): void {
    if (!this.preferences.enabled || !this.preferences.monitorAlerts) return;
    if (this.preferences.criticalOnly) return;
    this.showNotification(
      `监控告警: ${alert.planName}`,
      alert.message,
    );
  }

  private onAnomalyAlert(alert: AnomalyAlert): void {
    if (!this.preferences.enabled || !this.preferences.anomalyAlerts) return;
    if (this.preferences.criticalOnly && alert.severity !== 'critical') return;
    this.showNotification(
      `异常告警: ${alert.title}`,
      alert.description,
    );
  }

  private showNotification(title: string, body: string): void {
    if (!Notification.isSupported()) {
      logger.warn('系统不支持桌面通知');
      return;
    }

    const notification = new Notification({
      title,
      body,
      silent: !this.preferences.sound,
    });

    notification.on('click', () => {
      const windows = BrowserWindow.getAllWindows();
      const mainWin = windows.find(w => !w.isDestroyed());
      if (mainWin) {
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.focus();
      }
    });

    notification.show();
  }

  private loadPreferences(): void {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT value FROM platform_configs WHERE key = ?');
      const row = stmt.get('notification.preferences') as { value: string } | undefined;
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        Object.assign(this.preferences, parsed);
      }
    } catch {
      // ignore
    }
  }

  private savePreferences(): void {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO platform_configs (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);
      stmt.run('notification.preferences', JSON.stringify(this.preferences));
    } catch (error) {
      logger.error('保存通知偏好失败:', error);
    }
  }
}

export const notificationService = new NotificationService();
