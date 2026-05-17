<template>
  <div
    class="task-item"
    :class="`task-item--${task.status}`"
    @click="$emit('view', task)"
  >
    <div class="task-item__header">
      <div class="task-item__icon-wrap" :class="`task-item__icon-wrap--${task.status}`">
        <el-icon :size="16">
          <Loading v-if="task.status === 'running'" />
          <CircleCheckFilled v-else-if="task.status === 'success'" />
          <CircleCloseFilled v-else-if="task.status === 'failed'" />
          <Clock v-else-if="task.status === 'pending'" />
          <WarningFilled v-else />
        </el-icon>
      </div>
      <div class="task-item__info">
        <div class="task-item__title-row">
          <span class="task-item__title">{{ titleLabel }}</span>
          <el-tag
            :type="statusTagType"
            size="small"
            round
            class="task-item__status-tag"
          >
            {{ statusLabel }}
          </el-tag>
        </div>
        <div class="task-item__meta">
          <span v-if="task.platform" class="task-item__meta-item">
            <el-icon :size="12"><Monitor /></el-icon>
            {{ platformLabel }}
          </span>
          <span v-if="task.accountName" class="task-item__meta-item">
            <el-icon :size="12"><User /></el-icon>
            {{ task.accountName }}
          </span>
          <span class="task-item__meta-item">
            <el-icon :size="12"><Clock /></el-icon>
            {{ timeLabel }}
          </span>
        </div>
      </div>
      <div v-if="task.status === 'running'" class="task-item__progress-value">
        {{ task.progress }}%
      </div>
    </div>

    <div v-if="task.status === 'running'" class="task-item__progress">
      <el-progress
        :percentage="task.progress"
        :stroke-width="6"
        :show-text="false"
        :color="progressColor"
      />
    </div>

    <div v-if="task.status === 'failed' && task.message" class="task-item__error">
      <el-icon :size="14"><WarningFilled /></el-icon>
      <span>{{ task.message }}</span>
    </div>

    <div class="task-item__footer" @click.stop>
      <el-button
        v-if="task.status === 'running'"
        text
        size="small"
        type="warning"
        @click="$emit('cancel', task.id)"
      >
        取消
      </el-button>
      <el-button
        v-if="task.status === 'failed'"
        text
        size="small"
        type="primary"
        @click="$emit('retry', task.id)"
      >
        重试
      </el-button>
      <el-button
        v-if="task.status === 'success'"
        text
        size="small"
        @click="$emit('view', task)"
      >
        查看
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Loading,
  CircleCheckFilled,
  CircleCloseFilled,
  Clock,
  WarningFilled,
  Monitor,
  User,
} from '@element-plus/icons-vue';
import type { Task, TaskStatus } from '@/renderer/stores/task';

const props = defineProps<{
  task: Task;
}>();

defineEmits<{
  retry: [id: string];
  cancel: [id: string];
  view: [task: Task];
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

const titleLabel = computed(() => {
  const action = typeMap[props.task.type] || props.task.type;
  const target = props.task.contentTitle || '';
  return target ? `${action} - ${target}` : action;
});

const platformLabel = computed(() => platformMap[props.task.platform] || props.task.platform);
const statusLabel = computed(() => statusMap[props.task.status]);
const statusTagType = computed(() => statusTagTypeMap[props.task.status]);
const progressColor = computed(() => '#409eff');

const timeLabel = computed(() => {
  if (props.task.status === 'success' && props.task.completedAt) {
    return `完成: ${formatTime(props.task.completedAt)}`;
  }
  if (props.task.status === 'failed') {
    return `失败: ${formatTime(props.task.updatedAt)}`;
  }
  if (props.task.startedAt) {
    return `开始: ${formatTime(props.task.startedAt)}`;
  }
  return `创建: ${formatTime(props.task.createdAt)}`;
});

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
</script>

<style scoped>
.task-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.task-item:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
}

.task-item--failed {
  border-left: 3px solid var(--color-danger);
}

.task-item--running {
  border-left: 3px solid var(--color-primary);
}

.task-item--success {
  border-left: 3px solid var(--color-success);
}

.task-item--pending {
  border-left: 3px solid var(--color-info);
  opacity: 0.75;
}

.task-item--cancelled {
  opacity: 0.5;
}

.task-item__header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.task-item__icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg-page);
  color: var(--color-text-secondary);
}

.task-item__icon-wrap--running {
  background: rgba(64, 158, 255, 0.1);
  color: var(--color-primary);
}

.task-item__icon-wrap--success {
  background: rgba(103, 194, 58, 0.1);
  color: var(--color-success);
}

.task-item__icon-wrap--failed {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
}

.task-item__icon-wrap--pending {
  background: rgba(144, 147, 153, 0.1);
  color: var(--color-info);
}

.task-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task-item__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.task-item__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-item__status-tag {
  flex-shrink: 0;
}

.task-item__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.task-item__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.task-item__progress-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  flex-shrink: 0;
  min-width: 44px;
  text-align: right;
}

.task-item__progress {
  margin: 0 var(--space-4);
}

.task-item__error {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: rgba(245, 108, 108, 0.06);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-xs);
  color: var(--color-danger);
}

.task-item__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-light);
}
</style>
