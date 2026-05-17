<template>
  <div class="monitor-panel">
    <!-- Header -->
    <div class="monitor-panel__header">
      <h3>数据监控</h3>
      <el-button type="primary" @click="showCreateDialog">新建监控计划</el-button>
    </div>

    <!-- Alert banner -->
    <div v-if="alerts.length > 0" class="monitor-panel__alerts">
      <el-alert
        v-for="alert in alerts"
        :key="alert.id"
        :title="alert.message"
        :type="alert.severity"
        show-icon
        closable
        @close="dismissAlert(alert.id)"
      />
    </div>

    <!-- Plans table -->
    <div class="monitor-panel__table">
      <el-table :data="plans" v-loading="loading" stripe>
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">
            <el-tag :type="typeTagColor(row.type)">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="metric" label="监控指标" width="120">
          <template #default="{ row }">
            {{ metricLabel(row.metric) }}
          </template>
        </el-table-column>
        <el-table-column prop="threshold" label="阈值" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.threshold) }}
          </template>
        </el-table-column>
        <el-table-column prop="intervalMin" label="检查间隔" width="100">
          <template #default="{ row }">
            {{ row.intervalMin }}分钟
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="togglePlan(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="editPlan(row)">编辑</el-button>
            <el-button link type="danger" @click="deletePlan(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Empty state -->
    <el-empty
      v-if="!loading && plans.length === 0"
      description="暂无监控计划，创建一个开始监控"
    />

    <!-- Create/Edit dialog -->
    <MonitorPlanDialog
      v-model="dialogVisible"
      :plan="editingPlan"
      @saved="onPlanSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MonitorPlanDialog from './MonitorPlanDialog.vue';
import type { MonitorPlan } from './MonitorPlanDialog.vue';

interface MonitorAlert {
  id: string;
  planId: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
  triggeredAt: string;
}

const plans = ref<MonitorPlan[]>([]);
const alerts = ref<MonitorAlert[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingPlan = ref<MonitorPlan | null>(null);

const typeLabelMap: Record<string, string> = {
  speed: '播放流速',
  account: '账号指标',
  work: '作品指标',
};

const typeColorMap: Record<string, 'primary' | 'success' | 'warning'> = {
  speed: 'primary',
  account: 'success',
  work: 'warning',
};

const metricLabelMap: Record<string, string> = {
  playIncrement: '播放增量',
  likeIncrement: '点赞增量',
  totalFans: '总粉丝',
  totalLikes: '总点赞',
  totalWorks: '总作品',
  playCount: '播放量',
  likeCount: '点赞数',
  commentCount: '评论数',
  collectCount: '收藏数',
  shareCount: '转发数',
};

function typeLabel(type: string): string {
  return typeLabelMap[type] ?? type;
}

function typeTagColor(type: string): 'primary' | 'success' | 'warning' {
  return typeColorMap[type] ?? 'info';
}

function metricLabel(metric: string): string {
  return metricLabelMap[metric] ?? metric;
}

function formatNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '亿';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  return n.toLocaleString('zh-CN');
}

async function fetchPlans() {
  loading.value = true;
  try {
    const list = await window.matrixflow.monitor.listPlans();
    plans.value = (list ?? []) as MonitorPlan[];
  } catch {
    plans.value = [];
  } finally {
    loading.value = false;
  }
}

async function fetchAlerts() {
  try {
    const list = await window.matrixflow.monitor.getAlerts();
    alerts.value = (list ?? []) as MonitorAlert[];
  } catch {
    alerts.value = [];
  }
}

async function dismissAlert(alertId: string) {
  try {
    await window.matrixflow.ai.dismissAlert(alertId);
    alerts.value = alerts.value.filter((a) => a.id !== alertId);
  } catch {
    // silent
  }
}

function showCreateDialog() {
  editingPlan.value = null;
  dialogVisible.value = true;
}

function editPlan(plan: MonitorPlan) {
  editingPlan.value = { ...plan };
  dialogVisible.value = true;
}

async function togglePlan(plan: MonitorPlan) {
  try {
    await window.matrixflow.monitor.updatePlan(plan.id, { enabled: plan.enabled });
    ElMessage.success(plan.enabled ? '监控已启用' : '监控已暂停');
  } catch {
    plan.enabled = !plan.enabled;
    ElMessage.error('状态切换失败');
  }
}

async function deletePlan(plan: MonitorPlan) {
  try {
    await ElMessageBox.confirm(
      `确定要删除监控计划「${plan.name}」吗？`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await window.matrixflow.monitor.deletePlan(plan.id);
    plans.value = plans.value.filter((p) => p.id !== plan.id);
    ElMessage.success('已删除');
  } catch {
    // cancelled or failed
  }
}

function onPlanSaved() {
  fetchPlans();
}

onMounted(() => {
  fetchPlans();
  fetchAlerts();
});
</script>

<style scoped>
.monitor-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.monitor-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.monitor-panel__header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.monitor-panel__alerts {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.monitor-panel__table {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}
</style>
