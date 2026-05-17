<template>
  <div class="page-tasks">
    <!-- Stats Cards Row -->
    <div class="page-tasks__stats">
      <div class="stat-card" v-for="card in statCards" :key="card.label">
        <span class="stat-card__value" :style="{ color: card.color }">{{ card.value }}</span>
        <span class="stat-card__label">{{ card.label }}</span>
      </div>
      <div class="stat-card stat-card--rate">
        <span class="stat-card__value">{{ successRate }}%</span>
        <span class="stat-card__label">成功率</span>
      </div>
    </div>

    <!-- View Mode Tabs -->
    <div class="page-tasks__toolbar">
      <el-radio-group v-model="viewMode" size="default">
        <el-radio-button value="summary">摘要</el-radio-button>
        <el-radio-button value="timeline">时间线</el-radio-button>
        <el-radio-button value="detail">详情</el-radio-button>
      </el-radio-group>
      <div class="toolbar-actions">
        <el-button v-if="taskStore.hasFailedTasks" type="danger" plain @click="handleRetryAll">
          全部重试 ({{ taskStore.failedTasks.length }})
        </el-button>
        <el-button @click="taskStore.fetchTasks()">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Summary View (default) -->
    <div v-if="viewMode === 'summary'" class="tasks-view tasks-view--summary">
      <!-- Failed tasks on TOP (priority) -->
      <div v-if="taskStore.hasFailedTasks" class="failed-section">
        <h4 class="section-title">⚠️ 需要处理 ({{ taskStore.failedTasks.length }})</h4>
        <div v-for="task in taskStore.failedTasks" :key="task.id" class="failed-item">
          <div class="failed-item__info">
            <el-tag type="danger" size="small">{{ platformLabel(task.platform) }}</el-tag>
            <span class="failed-item__account">{{ task.accountName }}</span>
            <span class="failed-item__content">{{ task.contentTitle }}</span>
            <span class="failed-item__error">{{ task.message || '发布失败' }}</span>
          </div>
          <div class="failed-item__actions">
            <el-button size="small" type="primary" @click="handleRetry(task.id)">重试</el-button>
            <el-button size="small" type="warning" @click="handleReLogin(task)">重新登录</el-button>
            <el-button size="small" @click="handleSkip(task.id)">跳过</el-button>
          </div>
        </div>
      </div>

      <!-- Recent completed -->
      <div class="recent-section">
        <h4 class="section-title">最近完成</h4>
        <el-table :data="recentTasks" size="small" stripe>
          <el-table-column prop="contentTitle" label="内容" min-width="150" show-overflow-tooltip />
          <el-table-column prop="accountName" label="账号" width="120" />
          <el-table-column prop="platform" label="平台" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ platformLabel(row.platform) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="completedAt" label="完成时间" width="160">
            <template #default="{ row }">{{ formatTime(row.completedAt || row.updatedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- Timeline View -->
    <div v-else-if="viewMode === 'timeline'" class="tasks-view tasks-view--timeline">
      <div v-for="[date, dayTasks] in tasksByDate" :key="date" class="timeline-day">
        <div class="timeline-day__header">
          <span class="timeline-day__date">{{ formatDate(date) }}</span>
          <span class="timeline-day__count">{{ dayTasks.length }} 条任务</span>
          <span class="timeline-day__success">{{ dayTasks.filter(t => t.status === 'success').length }} 成功</span>
        </div>
        <div class="timeline-day__tasks">
          <div v-for="task in dayTasks" :key="task.id" class="timeline-task"
               :class="'timeline-task--' + task.status">
            <span class="timeline-task__time">{{ formatTime(task.startedAt || task.createdAt) }}</span>
            <span class="timeline-task__platform">{{ platformLabel(task.platform) }}</span>
            <span class="timeline-task__account">{{ task.accountName }}</span>
            <span class="timeline-task__content">{{ task.contentTitle }}</span>
            <el-tag :type="statusType(task.status)" size="small">{{ statusLabel(task.status) }}</el-tag>
          </div>
        </div>
      </div>
      <el-empty v-if="tasksByDate.length === 0" description="暂无任务记录" />
    </div>

    <!-- Detail View -->
    <div v-else-if="viewMode === 'detail'" class="tasks-view tasks-view--detail">
      <el-table :data="taskStore.tasks" v-loading="taskStore.loading" stripe border>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="task-expand">
              <p><strong>错误信息:</strong> {{ row.message || '无' }}</p>
              <p><strong>重试次数:</strong> {{ row.retryCount }}</p>
              <p><strong>创建时间:</strong> {{ formatTime(row.createdAt) }}</p>
              <p><strong>开始时间:</strong> {{ formatTime(row.startedAt) }}</p>
              <p><strong>完成时间:</strong> {{ formatTime(row.completedAt) }}</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="contentTitle" label="内容" min-width="150" show-overflow-tooltip />
        <el-table-column prop="accountName" label="账号" width="120" />
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ platformLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="progress" label="进度" width="100">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :status="row.status === 'failed' ? 'exception' : undefined" :stroke-width="6" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button v-if="row.status === 'failed'" link type="primary" @click="handleRetry(row.id)">重试</el-button>
            <el-button v-if="row.status === 'failed'" link type="warning" @click="handleReLogin(row)">重新登录</el-button>
            <el-button v-if="row.status === 'failed'" link @click="handleSkip(row.id)">跳过</el-button>
            <el-button v-if="row.status === 'running'" link type="danger" @click="handleCancel(row.id)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Re-login Dialog -->
    <el-dialog v-model="reLoginDialogVisible" title="重新登录" width="500px">
      <p>请使用手机扫码重新登录账号: <strong>{{ reLoginAccount?.accountName }}</strong></p>
      <p>平台: <el-tag>{{ reLoginAccount?.platform }}</el-tag></p>
      <div class="relogin-qr-area">
        <el-skeleton v-if="reLoginLoading" :rows="5" animated />
        <div v-else class="relogin-placeholder">
          <el-icon :size="64"><Camera /></el-icon>
          <p>扫码区域（登录后自动关闭）</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="reLoginDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="startReLogin" :loading="reLoginLoading">开始登录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Refresh, Camera } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTaskStore } from '@/renderer/stores/task';
import type { Task, TaskStatus } from '@/renderer/stores/task';

const taskStore = useTaskStore();

const viewMode = ref<'summary' | 'timeline' | 'detail'>('summary');
const reLoginDialogVisible = ref(false);
const reLoginLoading = ref(false);
const reLoginAccount = ref<Task | null>(null);

let unlisten: (() => void) | null = null;

onMounted(async () => {
  await taskStore.fetchTasks();
  unlisten = taskStore.listenIpcEvents();
});

onUnmounted(() => {
  unlisten?.();
});

// ── Computed ──

const statCards = computed(() => [
  { label: '全部', value: taskStore.stats.total, color: 'var(--color-text-primary)' },
  { label: '等待中', value: taskStore.stats.pending, color: 'var(--color-info)' },
  { label: '进行中', value: taskStore.stats.running, color: 'var(--color-primary)' },
  { label: '已完成', value: taskStore.stats.success, color: 'var(--color-success)' },
  { label: '失败', value: taskStore.stats.failed, color: 'var(--color-danger)' },
]);

const successRate = computed(() => {
  const { total, success } = taskStore.stats;
  if (total === 0) return 0;
  return Math.round((success / total) * 100);
});

const recentTasks = computed(() => {
  return taskStore.tasks
    .filter(t => t.status === 'success' || t.status === 'failed' || t.status === 'cancelled')
    .sort((a, b) => {
      const timeA = a.completedAt || a.updatedAt;
      const timeB = b.completedAt || b.updatedAt;
      return timeB.localeCompare(timeA);
    })
    .slice(0, 20);
});

const tasksByDate = computed(() => {
  const map = new Map<string, Task[]>();
  const sorted = [...taskStore.tasks].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  for (const task of sorted) {
    const date = task.createdAt.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(task);
  }
  return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
});

// ── Handlers ──

async function handleRetry(id: string) {
  try {
    await taskStore.retryTask(id);
    ElMessage.success('重试已提交');
  } catch {
    ElMessage.error('重试失败');
  }
}

async function handleSkip(id: string) {
  try {
    await taskStore.cancelTask(id);
    ElMessage.success('已跳过');
  } catch {
    ElMessage.error('操作失败');
  }
}

function handleReLogin(task: Task) {
  reLoginAccount.value = task;
  reLoginDialogVisible.value = true;
}

async function startReLogin() {
  if (!reLoginAccount.value) return;
  reLoginLoading.value = true;
  try {
    await window.matrixflow.accounts.login(reLoginAccount.value.accountId);
    ElMessage.success('登录成功');
    reLoginDialogVisible.value = false;
    // Retry the failed task after successful login
    await taskStore.retryTask(reLoginAccount.value.id);
  } catch {
    ElMessage.error('登录失败，请重试');
  } finally {
    reLoginLoading.value = false;
  }
}

async function handleCancel(id: string) {
  try {
    await ElMessageBox.confirm('确定取消该任务？', '取消确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await taskStore.cancelTask(id);
    ElMessage.success('任务已取消');
  } catch {
    // 用户取消确认
  }
}

async function handleRetryAll() {
  try {
    await ElMessageBox.confirm(
      `确定重试全部 ${taskStore.failedTasks.length} 个失败任务？`,
      '批量重试',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    );
    await taskStore.retryAllFailed();
    ElMessage.success('批量重试已提交');
  } catch {
    // 用户取消确认
  }
}

// ── Helpers ──

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    channels: '视频号',
    kuaishou: '快手',
  };
  return labels[platform] || platform;
}

function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    pending: '等待中',
    running: '进行中',
    success: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return labels[status] || status;
}

function statusType(status: TaskStatus): '' | 'success' | 'warning' | 'danger' | 'info' {
  const types: Record<TaskStatus, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    pending: 'info',
    running: '',
    success: 'success',
    failed: 'danger',
    cancelled: 'warning',
  };
  return types[status] || '';
}

function formatTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${y}-${m}-${day} ${weekdays[d.getDay()]}`;
}
</script>

<style scoped>
.page-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Stats Cards ── */
.page-tasks__stats {
  display: flex;
  gap: var(--space-3);
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
}

.stat-card__value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.stat-card--rate .stat-card__value {
  color: var(--color-primary);
}

.stat-card__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}

/* ── Toolbar ── */
.page-tasks__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-actions {
  display: flex;
  gap: var(--space-2);
}

/* ── Section Title ── */
.section-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

/* ── Tasks View Container ── */
.tasks-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Summary View: Failed Section ── */
.failed-section {
  padding: var(--space-4);
  background: rgba(245, 108, 108, 0.06);
  border: 1px solid rgba(245, 108, 108, 0.2);
  border-radius: var(--border-radius-md);
}

.failed-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-sm);
  margin-bottom: var(--space-2);
  transition: box-shadow var(--transition-fast);
}

.failed-item:last-child {
  margin-bottom: 0;
}

.failed-item:hover {
  box-shadow: var(--shadow-sm);
}

.failed-item__info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.failed-item__account {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.failed-item__content {
  font-size: var(--font-size-sm);
  color: var(--color-text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.failed-item__error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.failed-item__actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
  margin-left: var(--space-3);
}

/* ── Timeline View ── */
.timeline-day {
  padding-left: var(--space-6);
  position: relative;
}

.timeline-day::before {
  content: '';
  position: absolute;
  left: var(--space-2);
  top: 28px;
  bottom: 0;
  width: 2px;
  background: var(--color-border);
}

.timeline-day:last-child::before {
  display: none;
}

.timeline-day__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  position: relative;
}

.timeline-day__header::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-6) + var(--space-2) - 3px);
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.timeline-day__date {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.timeline-day__count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.timeline-day__success {
  font-size: var(--font-size-xs);
  color: var(--color-success);
}

.timeline-day__tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.timeline-task {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-sm);
  border-left: 3px solid var(--color-border);
  font-size: var(--font-size-sm);
  transition: box-shadow var(--transition-fast);
}

.timeline-task:hover {
  box-shadow: var(--shadow-sm);
}

.timeline-task--success {
  border-left-color: var(--color-success);
}

.timeline-task--failed {
  border-left-color: var(--color-danger);
}

.timeline-task--running {
  border-left-color: var(--color-primary);
}

.timeline-task--pending {
  border-left-color: var(--color-info);
}

.timeline-task--cancelled {
  border-left-color: var(--color-warning);
}

.timeline-task__time {
  color: var(--color-text-secondary);
  font-family: monospace;
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

.timeline-task__platform {
  color: var(--color-text-regular);
  flex-shrink: 0;
}

.timeline-task__account {
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.timeline-task__content {
  color: var(--color-text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* ── Detail View: Expand ── */
.task-expand {
  padding: var(--space-4);
  line-height: var(--line-height-base);
  color: var(--color-text-regular);
  font-size: var(--font-size-sm);
}

.task-expand p {
  margin: var(--space-1) 0;
}

/* ── Re-login Dialog ── */
.relogin-qr-area {
  margin-top: var(--space-4);
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.relogin-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .page-tasks__stats {
    flex-wrap: wrap;
  }

  .stat-card {
    min-width: calc(33% - var(--space-3));
  }

  .page-tasks__toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .failed-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .failed-item__actions {
    margin-left: 0;
    margin-top: var(--space-2);
  }
}
</style>
