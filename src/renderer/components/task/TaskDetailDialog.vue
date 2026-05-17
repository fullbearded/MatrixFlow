<template>
  <el-dialog
    :model-value="modelValue"
    title="任务详情"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template v-if="task">
      <div class="task-detail">
        <div class="task-detail__section">
          <div class="task-detail__row">
            <span class="task-detail__label">任务ID</span>
            <span class="task-detail__value task-detail__value--mono">{{ task.id }}</span>
          </div>
          <div class="task-detail__row">
            <span class="task-detail__label">任务类型</span>
            <span class="task-detail__value">{{ typeLabel }}</span>
          </div>
          <div class="task-detail__row">
            <span class="task-detail__label">状态</span>
            <el-tag :type="statusTagType" size="small" round>{{ statusLabel }}</el-tag>
          </div>
          <div class="task-detail__row">
            <span class="task-detail__label">平台</span>
            <span class="task-detail__value">{{ platformLabel }}</span>
          </div>
          <div v-if="task.accountName" class="task-detail__row">
            <span class="task-detail__label">账号</span>
            <span class="task-detail__value">{{ task.accountName }}</span>
          </div>
          <div v-if="task.contentTitle" class="task-detail__row">
            <span class="task-detail__label">内容</span>
            <span class="task-detail__value">{{ task.contentTitle }}</span>
          </div>
        </div>

        <div class="task-detail__section">
          <div class="task-detail__row">
            <span class="task-detail__label">进度</span>
            <div class="task-detail__progress">
              <el-progress
                :percentage="task.progress"
                :stroke-width="8"
                :status="progressStatus"
              />
            </div>
          </div>
          <div v-if="task.message" class="task-detail__row">
            <span class="task-detail__label">消息</span>
            <span class="task-detail__value">{{ task.message }}</span>
          </div>
          <div class="task-detail__row">
            <span class="task-detail__label">重试次数</span>
            <span class="task-detail__value">{{ task.retryCount }}</span>
          </div>
        </div>

        <div class="task-detail__section">
          <div class="task-detail__row">
            <span class="task-detail__label">创建时间</span>
            <span class="task-detail__value">{{ formatDateTime(task.createdAt) }}</span>
          </div>
          <div v-if="task.startedAt" class="task-detail__row">
            <span class="task-detail__label">开始时间</span>
            <span class="task-detail__value">{{ formatDateTime(task.startedAt) }}</span>
          </div>
          <div v-if="task.completedAt" class="task-detail__row">
            <span class="task-detail__label">完成时间</span>
            <span class="task-detail__value">{{ formatDateTime(task.completedAt) }}</span>
          </div>
          <div class="task-detail__row">
            <span class="task-detail__label">更新时间</span>
            <span class="task-detail__value">{{ formatDateTime(task.updatedAt) }}</span>
          </div>
        </div>

        <div v-if="task.status === 'failed' && task.errorCode" class="task-detail__section task-detail__section--error">
          <div class="task-detail__row">
            <span class="task-detail__label">错误码</span>
            <span class="task-detail__value task-detail__value--mono">{{ task.errorCode }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
      <el-button
        v-if="task?.status === 'failed'"
        type="primary"
        @click="$emit('retry', task!.id)"
      >
        重试
      </el-button>
      <el-button
        v-if="task?.status === 'running'"
        type="warning"
        @click="$emit('cancel', task!.id)"
      >
        取消任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Task, TaskStatus } from '@/renderer/stores/task';

const props = defineProps<{
  modelValue: boolean;
  task?: Task | null;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
  retry: [id: string];
  cancel: [id: string];
}>();

const platformMap: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  channels: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
};

const typeMap: Record<string, string> = {
  publish: '发布视频',
  check_cookie: '检测Cookie',
  login: '登录',
};

const statusMap: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '进行中',
  success: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const statusTagTypeMap: Record<TaskStatus, string> = {
  pending: 'info',
  running: '',
  success: 'success',
  failed: 'danger',
  cancelled: 'warning',
};

const typeLabel = computed(() => typeMap[props.task?.type || ''] || props.task?.type);
const platformLabel = computed(() => platformMap[props.task?.platform || ''] || props.task?.platform);
const statusLabel = computed(() => statusMap[props.task?.status || 'pending']);
const statusTagType = computed(() => statusTagTypeMap[props.task?.status || 'pending']);

const progressStatus = computed(() => {
  if (!props.task) return undefined;
  if (props.task.status === 'success') return 'success' as const;
  if (props.task.status === 'failed') return 'exception' as const;
  return undefined;
});

function formatDateTime(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${MM}-${dd} ${hh}:${mm}:${ss}`;
}
</script>

<style scoped>
.task-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.task-detail__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.task-detail__section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.task-detail__section--error {
  background: rgba(245, 108, 108, 0.04);
  padding: var(--space-3);
  border-radius: var(--border-radius-md);
  border: 1px solid rgba(245, 108, 108, 0.15);
}

.task-detail__row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.task-detail__label {
  width: 80px;
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.task-detail__value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  word-break: break-all;
}

.task-detail__value--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: var(--font-size-xs);
}

.task-detail__progress {
  flex: 1;
}
</style>
