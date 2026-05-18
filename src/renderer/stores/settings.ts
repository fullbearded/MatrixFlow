import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
  concurrentTasks: number;
  retryLimit: number;
  autoCheckCookie: boolean;
  cookieCheckInterval: number;
  proxyEnabled: boolean;
  proxyUrl: string;
  dataDir: string;
  browserMode: 'embedded' | 'external_chrome' | 'external_fingerprint';
  chromePath: string;
  fingerprintBrowserPath: string;
  cdpEndpoint: string;
  onboardingCompleted: boolean;
  notificationEnabled: boolean;
  notificationSound: boolean;
  notificationMonitorAlerts: boolean;
  notificationAnomalyAlerts: boolean;
  notificationCriticalOnly: boolean;
}

const defaultSettings: AppSettings = {
  theme: 'light',
  language: 'zh-CN',
  concurrentTasks: 3,
  retryLimit: 3,
  autoCheckCookie: true,
  cookieCheckInterval: 60,
  proxyEnabled: false,
  proxyUrl: '',
  dataDir: '',
  browserMode: 'embedded',
  chromePath: '',
  fingerprintBrowserPath: '',
  cdpEndpoint: '',
  onboardingCompleted: false,
  notificationEnabled: true,
  notificationSound: true,
  notificationMonitorAlerts: true,
  notificationAnomalyAlerts: true,
  notificationCriticalOnly: false,
};

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...defaultSettings });
  const loading = ref(false);

  async function fetchSettings() {
    if (!window.matrixflow) return;
    loading.value = true;
    try {
      const keys = Object.keys(defaultSettings) as (keyof AppSettings)[];
      const entries = await Promise.all(
        keys.map(async (key) => {
          const val = await window.matrixflow.settings.get(key);
          return [key, val ?? defaultSettings[key]] as const;
        }),
      );
      settings.value = Object.fromEntries(entries) as AppSettings;
    } finally {
      loading.value = false;
    }
  }

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    if (!window.matrixflow) return;
    await window.matrixflow.settings.set(key, value);
    settings.value[key] = value;
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    if (!window.matrixflow) return;
    await Promise.all(
      Object.entries(patch).map(([key, value]) => window.matrixflow.settings.set(key, value)),
    );
    Object.assign(settings.value, patch);
  }

  function resetToDefault() {
    settings.value = { ...defaultSettings };
  }

  return {
    settings,
    loading,
    fetchSettings,
    updateSetting,
    updateSettings,
    resetToDefault,
  };
});
