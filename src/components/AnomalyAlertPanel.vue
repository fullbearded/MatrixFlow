<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const alerts = ref<any[]>([]);
const expanded = ref(false);

const criticalAlerts = computed(() =>
  alerts.value.filter(a => a.severity === 'critical')
);

const warningAlerts = computed(() =>
  alerts.value.filter(a => a.severity === 'warning')
);

const hasAlerts = computed(() => alerts.value.length > 0);

async function fetchAlerts() {
  try {
    const result = await window.matrixflow.ai.getAlerts();
    alerts.value = result;
  } catch (error) {
    console.error('获取告警失败:', error);
  }
}

async function dismissAlert(alertId: string) {
  try {
    await window.matrixflow.ai.dismissAlert(alertId);
    alerts.value = alerts.value.filter(a => a.id !== alertId);
  } catch (error) {
    console.error('关闭告警失败:', error);
  }
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    retry: '重试',
    relogin: '重新登录',
    skip: '跳过',
    investigate: '查看详情',
  };
  return labels[action] || action;
}

function handleAction(alert: any) {
  if (alert.action === 'relogin') {
    window.matrixflow.accounts.login(alert.context.accountId);
  } else if (alert.action === 'retry' && alert.context.taskId) {
    window.matrixflow.publish.retryTask(alert.context.taskId);
  }
  dismissAlert(alert.id);
}

onMounted(() => {
  fetchAlerts();
  const interval = setInterval(fetchAlerts, 30000);
  onUnmounted(() => clearInterval(interval));
});
</script>

<template>
  <div v-if="hasAlerts" class="anomaly-alert-panel">
    <div class="alert-header" @click="expanded = !expanded">
      <div class="header-left">
        <el-badge :value="criticalAlerts.length" :max="99" type="danger">
          <el-icon><Bell /></el-icon>
        </el-badge>
        <span class="alert-title">
          {{ criticalAlerts.length > 0 ? `${criticalAlerts.length} 个异常需要处理` : `${warningAlerts.length} 个提醒` }}
        </span>
      </div>
      <el-icon :class="{ expanded }">
        <ArrowDown />
      </el-icon>
    </div>

    <div v-show="expanded" class="alert-list">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="alert-item"
        :class="alert.severity"
      >
        <div class="alert-icon">
          <el-icon v-if="alert.severity === 'critical'" color="#cf1322">
            <CircleClose />
          </el-icon>
          <el-icon v-else-if="alert.severity === 'warning'" color="#faad14">
            <Warning />
          </el-icon>
          <el-icon v-else color="#8c8c8c">
            <InfoFilled />
          </el-icon>
        </div>

        <div class="alert-content">
          <div class="alert-title-text">{{ alert.title }}</div>
          <div class="alert-desc">{{ alert.description }}</div>
        </div>

        <div class="alert-actions">
          <el-button size="small" @click.stop="dismissAlert(alert.id)">
            忽略
          </el-button>
          <el-button
            v-if="alert.action !== 'investigate'"
            size="small"
            :type="alert.severity === 'critical' ? 'danger' : 'primary'"
            @click="handleAction(alert)"
          >
            {{ getActionLabel(alert.action) }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Bell, ArrowDown, CircleClose, Warning, InfoFilled } from '@element-plus/icons-vue';
export default {
  components: { Bell, ArrowDown, CircleClose, Warning, InfoFilled },
};
</script>

<style scoped>
.anomaly-alert-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 16px;
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.alert-header:hover {
  background: #f5f5f5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert-title {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.expanded {
  transform: rotate(180deg);
}

.alert-list {
  max-height: 300px;
  overflow-y: auto;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-item.critical {
  background: #fff1f0;
}

.alert-item.warning {
  background: #fffbe6;
}

.alert-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title-text {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  margin-bottom: 4px;
}

.alert-desc {
  font-size: 13px;
  color: #595959;
  line-height: 1.5;
}

.alert-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
