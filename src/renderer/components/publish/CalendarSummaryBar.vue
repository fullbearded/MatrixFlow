<template>
  <div class="calendar-summary">
    <div class="summary-item">
      <span class="summary-item__value">{{ totalContent }}</span>
      <span class="summary-item__label">内容数</span>
    </div>
    <div class="summary-divider" />
    <div class="summary-item">
      <span class="summary-item__value">{{ totalTasks }}</span>
      <span class="summary-item__label">任务数</span>
    </div>
    <div class="summary-divider" />
    <div class="summary-item" :class="{ 'is-warning': conflictCount > 0 }">
      <span class="summary-item__value">{{ conflictCount }}</span>
      <span class="summary-item__label">冲突</span>
    </div>
    <div class="summary-divider" />
    <div class="summary-item">
      <span class="summary-item__value">{{ earliestPublish }}</span>
      <span class="summary-item__label">最早发布</span>
    </div>
    <div class="summary-divider" />
    <div class="summary-item">
      <span class="summary-item__value">{{ latestPublish }}</span>
      <span class="summary-item__label">最晚发布</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { detectConflicts } from './conflict-detect';

const props = defineProps<{
  tasks: Array<{
    id: string;
    contentId: string;
    accountId: string;
    scheduledAt: string;
    groupId: string | null;
  }>;
}>();

const totalContent = computed(() => new Set(props.tasks.map(t => t.contentId)).size);
const totalTasks = computed(() => props.tasks.length);

const conflictCount = computed(() => detectConflicts(props.tasks).size);

const earliestPublish = computed(() => {
  if (props.tasks.length === 0) return '-';
  const sorted = [...props.tasks].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return formatDateTime(sorted[0].scheduledAt);
});

const latestPublish = computed(() => {
  if (props.tasks.length === 0) return '-';
  const sorted = [...props.tasks].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return formatDateTime(sorted[0].scheduledAt);
});

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.calendar-summary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 64px;
}

.summary-item__value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.summary-item__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.summary-item.is-warning .summary-item__value {
  color: var(--color-danger);
}

.summary-item.is-warning .summary-item__label {
  color: var(--color-danger);
}

.summary-divider {
  width: 1px;
  height: 28px;
  background: var(--color-border);
  flex-shrink: 0;
}
</style>
