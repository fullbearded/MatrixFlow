import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface License {
  id: string;
  email: string;
  plan: 'starter' | 'pro' | 'enterprise';
  devices: number;
  activatedDevices: string[];
  expiresAt: Date;
  features: Record<string, boolean>;
}

export const useLicenseStore = defineStore('license', () => {
  const license = ref<License | null>(null);
  const isValid = ref(false);
  const loading = ref(false);

  const planName = computed(() => {
    const names = {
      starter: '入门版',
      pro: '专业版',
      enterprise: '企业版',
    };
    return license.value ? names[license.value.plan] : '未激活';
  });

  const daysRemaining = computed(() => {
    if (!license.value) return 0;
    const diff = new Date(license.value.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  const featureList = computed(() => {
    if (!license.value) return [];
    return Object.entries(license.value.features)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
  });

  async function checkLicense() {
    loading.value = true;
    try {
      const result = await window.matrixflow.license.status();
      isValid.value = result.valid;
      license.value = result.license;
    } finally {
      loading.value = false;
    }
  }

  async function activate(key: string, email: string): Promise<{ success: boolean; error?: string }> {
    loading.value = true;
    try {
      const result = await window.matrixflow.license.activate(key, email);
      if (result.success) {
        license.value = result.license;
        isValid.value = true;
        return { success: true };
      }
      return { success: false, error: result.error };
    } finally {
      loading.value = false;
    }
  }

  async function activateOffline(filePath: string): Promise<{ success: boolean; error?: string }> {
    loading.value = true;
    try {
      const result = await window.matrixflow.license.activateOffline(filePath);
      if (result.success) {
        license.value = result.license;
        isValid.value = true;
        return { success: true };
      }
      return { success: false, error: result.error };
    } finally {
      loading.value = false;
    }
  }

  async function generateOfflineRequest(key: string, email: string): Promise<string | null> {
    const result = await window.matrixflow.license.offlineRequest(key, email);
    return result.success ? result.data : null;
  }

  async function deactivate(): Promise<boolean> {
    const result = await window.matrixflow.license.deactivate();
    if (result.success) {
      license.value = null;
      isValid.value = false;
      return true;
    }
    return false;
  }

  function hasFeature(feature: string): boolean {
    if (!license.value || !isValid.value) return false;
    return license.value.features[feature] === true;
  }

  return {
    license,
    isValid,
    loading,
    planName,
    daysRemaining,
    featureList,
    checkLicense,
    activate,
    activateOffline,
    generateOfflineRequest,
    deactivate,
    hasFeature,
  };
});
