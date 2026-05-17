<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { usePanelStore } from '@/stores/panel';

const panelStore = usePanelStore();

const activePanels = computed(() => panelStore.panels);
const selectedAccountId = ref<string>('');

onMounted(async () => {
  await panelStore.loadAvailableAccounts();
  await panelStore.loadPanels();
});

async function openPanel() {
  if (!selectedAccountId.value) {
    ElMessage.warning('请选择账号');
    return;
  }

  if (activePanels.value.length >= panelStore.maxPanels) {
    ElMessage.warning(`最多同时打开 ${panelStore.maxPanels} 个面板`);
    return;
  }

  const result = await panelStore.openPanel(selectedAccountId.value);
  if (result) {
    ElMessage.success(`已打开 ${result.nickname} 的面板`);
    selectedAccountId.value = '';
  } else {
    ElMessage.error('打开面板失败');
  }
}

function closePanel(panelId: string) {
  panelStore.closePanel(panelId);
}

function focusPanel(panelId: string) {
  panelStore.focusPanel(panelId);
}

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    wechat: '视频号',
    kuaishou: '快手',
  };
  return labels[platform] || platform;
}
</script>

<template>
  <div class="multi-panel-view">
    <div class="panel-toolbar">
      <el-select v-model="selectedAccountId" placeholder="选择账号" style="width: 200px">
        <el-option
          v-for="account in panelStore.availableAccounts"
          :key="account.id"
          :label="`${account.nickname || account.platform} (${getPlatformLabel(account.platform)})`"
          :value="account.id"
        />
      </el-select>

      <el-button type="primary" @click="openPanel" :disabled="!selectedAccountId">
        打开面板
      </el-button>

      <span class="panel-count">
        已打开 {{ activePanels.length }} / {{ panelStore.maxPanels }} 个面板
      </span>
    </div>

    <div class="panel-tabs" v-if="activePanels.length > 0">
      <div
        v-for="panel in activePanels"
        :key="panel.id"
        class="panel-tab"
        :class="{ active: panel.id === panelStore.focusedPanelId }"
        @click="focusPanel(panel.id)"
      >
        <span class="platform-icon">{{ panel.platform.slice(0, 2).toUpperCase() }}</span>
        <span class="nickname">{{ panel.nickname }}</span>
        <el-button
          type="text"
          size="small"
          @click.stop="closePanel(panel.id)"
          class="close-btn"
        >
          ×
        </el-button>
      </div>
    </div>

    <div class="panel-content" v-if="activePanels.length > 0">
      <div class="browser-placeholder">
        <div class="placeholder-icon">
          <el-icon size="48"><Monitor /></el-icon>
        </div>
        <p class="placeholder-title">多开面板已启动</p>
        <p class="placeholder-hint">
          当前已打开 {{ activePanels.length }} 个面板，面板内容在独立浏览器窗口中展示
        </p>
        <div class="panel-list">
          <div
            v-for="panel in activePanels"
            :key="panel.id"
            class="panel-item"
            :class="{ active: panel.id === panelStore.focusedPanelId }"
            @click="focusPanel(panel.id)"
          >
            <span class="platform-badge">{{ getPlatformLabel(panel.platform) }}</span>
            <span class="panel-name">{{ panel.nickname }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-empty" v-else>
      <div class="empty-icon">
        <el-icon size="64"><Grid /></el-icon>
      </div>
      <p>暂无打开的面板</p>
      <p class="hint">选择账号后点击"打开面板"开始多开操作</p>
      <p class="hint-secondary">支持同时打开最多 10 个账号面板</p>
    </div>
  </div>
</template>

<script lang="ts">
import { Monitor, Grid } from '@element-plus/icons-vue';

export default {
  components: {
    Monitor,
    Grid,
  },
};
</script>

<style scoped>
.multi-panel-view {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.panel-count {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.panel-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.panel-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-tab:hover {
  border-color: var(--el-color-primary);
}

.panel-tab.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.platform-icon {
  font-size: 12px;
  font-weight: bold;
  color: var(--el-color-primary);
}

.nickname {
  font-size: 14px;
}

.close-btn {
  padding: 0;
  width: 20px;
  height: 20px;
}

.panel-content {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.browser-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.placeholder-icon {
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.placeholder-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
}

.placeholder-hint {
  color: var(--el-text-color-secondary);
  margin-bottom: 24px;
}

.panel-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.panel-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.panel-item:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.panel-item.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}

.platform-badge {
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.panel-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  color: var(--el-border-color);
  margin-bottom: 16px;
}

.panel-empty .hint {
  font-size: 12px;
  margin-top: 8px;
}

.hint-secondary {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}
</style>
