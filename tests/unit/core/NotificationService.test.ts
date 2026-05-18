import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const { mockMonitorSubscribe, mockAnomalySubscribe, mockDbPrepare } = vi.hoisted(() => ({
  mockMonitorSubscribe: vi.fn(() => vi.fn()),
  mockAnomalySubscribe: vi.fn(() => vi.fn()),
  mockDbPrepare: vi.fn(() => ({
    get: vi.fn(() => undefined),
    run: vi.fn(),
  })),
}));

vi.mock('electron', () => ({
  Notification: {
    isSupported: vi.fn(() => true),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('@electron/services/MonitorService', () => ({
  monitorService: { subscribe: mockMonitorSubscribe },
}));

vi.mock('@electron/services/AnomalyService', () => ({
  anomalyService: { subscribe: mockAnomalySubscribe },
}));

vi.mock('@electron/data/Database', () => ({
  getDatabase: vi.fn(() => ({ prepare: mockDbPrepare })),
}));

vi.mock('@electron/core/Logger', () => ({
  Logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { Notification } from 'electron';
import { notificationService } from '@electron/core/NotificationService';

describe('NotificationService', () => {
  let monitorCb: (alert: any) => void;
  let anomalyCb: (alert: any) => void;

  beforeAll(() => {
    monitorCb = mockMonitorSubscribe.mock.calls[0][0] as any;
    anomalyCb = mockAnomalySubscribe.mock.calls[0][0] as any;
  });

  beforeEach(() => {
    mockDbPrepare.mockReturnValue({ get: vi.fn(() => undefined), run: vi.fn() });
    (Notification.isSupported as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  const makeMonitorAlert = (overrides = {}) => ({
    id: 'a1',
    planId: 'p1',
    planName: 'Test Plan',
    type: 'speed' as const,
    message: 'Speed dropped',
    value: 10,
    threshold: 50,
    triggeredAt: new Date(),
    acknowledged: false,
    ...overrides,
  });

  const makeAnomalyAlert = (overrides = {}) => ({
    id: 'an1',
    type: 'publish_failure' as const,
    severity: 'critical' as const,
    title: 'Publish Failed',
    description: 'Failed to publish',
    action: 'retry' as const,
    context: {},
    createdAt: new Date(),
    ...overrides,
  });

  describe('getPreferences', () => {
    it('returns default preferences', () => {
      const prefs = notificationService.getPreferences();
      expect(prefs.enabled).toBe(true);
      expect(prefs.sound).toBe(true);
      expect(prefs.monitorAlerts).toBe(true);
      expect(prefs.anomalyAlerts).toBe(true);
      expect(prefs.criticalOnly).toBe(false);
    });

    it('returns a copy', () => {
      const prefs = notificationService.getPreferences();
      prefs.enabled = false;
      expect(notificationService.getPreferences().enabled).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('merges partial preferences', () => {
      const result = notificationService.updatePreferences({ enabled: false });
      expect(result.enabled).toBe(false);
      expect(result.sound).toBe(true);
    });

    it('persists via database', () => {
      notificationService.updatePreferences({ sound: false });
      expect(mockDbPrepare).toHaveBeenCalled();
    });
  });

  describe('monitor alert handling', () => {
    it('skips when notifications disabled', () => {
      notificationService.updatePreferences({ enabled: false });
      const showSpy = vi.spyOn(Notification, 'isSupported');
      monitorCb(makeMonitorAlert());
      expect(showSpy).not.toHaveBeenCalled();
    });

    it('skips when monitorAlerts disabled', () => {
      notificationService.updatePreferences({ monitorAlerts: false });
      monitorCb(makeMonitorAlert());
    });

    it('skips when criticalOnly enabled', () => {
      notificationService.updatePreferences({ criticalOnly: true });
      monitorCb(makeMonitorAlert());
    });
  });

  describe('anomaly alert handling', () => {
    it('allows critical anomaly when criticalOnly enabled', () => {
      notificationService.updatePreferences({ criticalOnly: true });
      expect(() => anomalyCb(makeAnomalyAlert({ severity: 'critical' }))).not.toThrow();
    });

    it('skips warning anomaly when criticalOnly enabled', () => {
      notificationService.updatePreferences({ criticalOnly: true });
      anomalyCb(makeAnomalyAlert({ severity: 'warning' }));
    });

    it('skips when anomalyAlerts disabled', () => {
      notificationService.updatePreferences({ anomalyAlerts: false });
      anomalyCb(makeAnomalyAlert());
    });
  });

  describe('unsupported notifications', () => {
    it('does not throw when Notification.isSupported() is false', () => {
      (Notification.isSupported as ReturnType<typeof vi.fn>).mockReturnValue(false);
      notificationService.updatePreferences({ enabled: true });
      expect(() => monitorCb(makeMonitorAlert())).not.toThrow();
      expect(() => anomalyCb(makeAnomalyAlert())).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('cleans up subscriptions', () => {
      notificationService.dispose();
    });
  });
});
