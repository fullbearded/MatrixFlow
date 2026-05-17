import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface PanelInfo {
  id: string;
  accountId: string;
  platform: string;
  nickname: string;
}

interface Account {
  id: string;
  platform: string;
  nickname?: string;
}

export const usePanelStore = defineStore('panel', () => {
  const panels = ref<PanelInfo[]>([]);
  const availableAccounts = ref<Account[]>([]);
  const focusedPanelId = ref<string | null>(null);
  const maxPanels = 10;

  async function loadAvailableAccounts() {
    try {
      const accounts = await window.matrixflow.accounts.list();
      availableAccounts.value = accounts || [];
    } catch (error) {
      console.error('加载账号列表失败:', error);
      availableAccounts.value = [];
    }
  }

  async function openPanel(accountId: string): Promise<PanelInfo | null> {
    if (panels.value.length >= maxPanels) {
      return null;
    }

    try {
      const result = await window.matrixflow.panel.open(accountId);
      if (result.success && result.data) {
        const panel: PanelInfo = {
          id: result.data.id,
          accountId: result.data.accountId,
          platform: result.data.platform,
          nickname: result.data.nickname,
        };
        panels.value.push(panel);
        focusedPanelId.value = panel.id;
        return panel;
      }
      return null;
    } catch (error) {
      console.error('打开面板失败:', error);
      return null;
    }
  }

  async function closePanel(panelId: string) {
    try {
      await window.matrixflow.panel.close(panelId);
      panels.value = panels.value.filter(p => p.id !== panelId);
      if (focusedPanelId.value === panelId) {
        focusedPanelId.value = panels.value.length > 0 ? panels.value[0].id : null;
      }
    } catch (error) {
      console.error('关闭面板失败:', error);
    }
  }

  async function focusPanel(panelId: string) {
    try {
      await window.matrixflow.panel.focus(panelId);
      focusedPanelId.value = panelId;
    } catch (error) {
      console.error('聚焦面板失败:', error);
    }
  }

  async function loadPanels() {
    try {
      const result = await window.matrixflow.panel.list();
      if (result.success && result.data) {
        panels.value = result.data.map((p: any) => ({
          id: p.id,
          accountId: p.accountId,
          platform: p.platform,
          nickname: p.nickname,
        }));
        if (panels.value.length > 0) {
          focusedPanelId.value = panels.value[0].id;
        }
      }
    } catch (error) {
      console.error('加载面板列表失败:', error);
    }
  }

  return {
    panels,
    availableAccounts,
    focusedPanelId,
    maxPanels,
    loadAvailableAccounts,
    openPanel,
    closePanel,
    focusPanel,
    loadPanels,
  };
});
