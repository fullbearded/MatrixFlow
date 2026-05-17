import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface Panel {
  id: string;
  accountId: string;
  platform: string;
  nickname: string;
  createdAt: Date;
}

interface Account {
  id: string;
  platform: string;
  nickname: string;
}

export const usePanelStore = defineStore('panel', () => {
  const panels = ref<Panel[]>([]);
  const availableAccounts = ref<Account[]>([]);
  const focusedPanelId = ref<string | null>(null);
  const maxPanels = ref(10);

  const focusedPanel = computed(() => panels.value.find((p) => p.id === focusedPanelId.value));

  async function loadAvailableAccounts() {
    const result = await window.matrixflow.account.list();
    if (result.success && result.data) {
      availableAccounts.value = result.data;
    }
  }

  async function openPanel(accountId: string): Promise<Panel | null> {
    const result = await window.matrixflow.panel.open(accountId);
    if (result.success && result.data) {
      panels.value.push(result.data);
      focusedPanelId.value = result.data.id;
      return result.data;
    }
    return null;
  }

  function closePanel(panelId: string) {
    const index = panels.value.findIndex((p) => p.id === panelId);
    if (index !== -1) {
      panels.value.splice(index, 1);
      window.matrixflow.panel.close(panelId);

      if (focusedPanelId.value === panelId) {
        focusedPanelId.value = panels.value[0]?.id ?? null;
      }
    }
  }

  function focusPanel(panelId: string) {
    focusedPanelId.value = panelId;
    window.matrixflow.panel.focus(panelId);
  }

  return {
    panels,
    availableAccounts,
    focusedPanelId,
    focusedPanel,
    maxPanels,
    loadAvailableAccounts,
    openPanel,
    closePanel,
    focusPanel,
  };
});
