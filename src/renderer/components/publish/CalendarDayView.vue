<template>
  <div class="calendar-day">
    <div class="day-header">
      <h3 class="day-header__title">{{ formatDateLabel(date) }}</h3>
      <span class="day-header__stats">{{ dayTasks.length }} 条任务</span>
    </div>

    <div class="day-timeline">
      <div
        v-for="hour in hours"
        :key="hour"
        class="day-hour"
        :class="{ 'is-drag-over': dragOverHour === hour }"
        @contextmenu.prevent="onCellContextMenu($event, hour)"
        @dragover.prevent="onDragOver(hour)"
        @dragleave="dragOverHour = null"
        @drop="onDrop($event, hour)"
      >
        <div class="day-hour__label">{{ formatHour(hour) }}</div>
        <div class="day-hour__content">
          <div
            v-for="task in getTasksForHour(hour)"
            :key="task.id"
            class="day-task"
            :class="{
              'is-conflict': conflicts.has(task.id),
              [`day-task--${task.status}`]: true,
            }"
            :style="{ '--group-color': getGroupColor(task.groupId) }"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @contextmenu.prevent.stop="onTaskContextMenu($event, task)"
            @click="emit('task-click', task)"
          >
            <span class="day-task__bar" />
            <div class="day-task__header">
              <span class="day-task__time">{{ formatTaskTime(task.scheduledAt) }}</span>
              <el-tag size="small" :type="modeTagType(task.publishMode)">
                {{ task.publishMode === 'server' ? '服务端' : '客户端' }}
              </el-tag>
              <el-tag v-if="conflicts.has(task.id)" size="small" type="danger">冲突</el-tag>
            </div>
            <div class="day-task__body">
              <span class="day-task__title">{{ task.contentTitle }}</span>
              <span class="day-task__meta">{{ task.accountName }} · {{ task.platform }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PublishTask, PublishMode } from '@/renderer/stores/publish';

const props = defineProps<{
  tasks: PublishTask[];
  date: string;
  conflicts: Set<string>;
  groupColors?: Map<string, string>;
}>();

const emit = defineEmits<{
  'contextmenu': [event: MouseEvent, hour: number];
  'task-contextmenu': [event: MouseEvent, task: PublishTask];
  'task-drop': [taskId: string, newScheduledAt: string];
  'task-click': [task: PublishTask];
}>();

const hours = Array.from({ length: 24 }, (_, i) => i);
const dragOverHour = ref<number | null>(null);
let draggedTask: PublishTask | null = null;

const dayTasks = computed(() =>
  props.tasks.filter(t => t.scheduledAt.slice(0, 10) === props.date),
);

function getTasksForHour(hour: number): PublishTask[] {
  return dayTasks.value.filter(t => {
    const taskHour = parseInt(t.scheduledAt.slice(11, 13), 10);
    return taskHour === hour;
  });
}

function getGroupColor(groupId: string | null): string {
  if (!groupId || !props.groupColors) return 'var(--color-info)';
  return props.groupColors.get(groupId) || 'var(--color-info)';
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function formatTaskTime(iso: string): string {
  return iso.slice(11, 16);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`;
}

function modeTagType(mode: PublishMode): 'success' | 'warning' {
  return mode === 'server' ? 'success' : 'warning';
}

function onDragStart(e: DragEvent, task: PublishTask) {
  draggedTask = task;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', task.id);
}

function onDragOver(hour: number) {
  dragOverHour.value = hour;
}

function onDrop(_e: DragEvent, hour: number) {
  dragOverHour.value = null;
  if (!draggedTask) return;
  const min = draggedTask.scheduledAt.slice(14, 16);
  const newScheduledAt = `${props.date}T${String(hour).padStart(2, '0')}:${min}:00`;
  emit('task-drop', draggedTask.id, newScheduledAt);
  draggedTask = null;
}

function onCellContextMenu(e: MouseEvent, hour: number) {
  emit('contextmenu', e, hour);
}

function onTaskContextMenu(e: MouseEvent, task: PublishTask) {
  emit('task-contextmenu', e, task);
}
</script>

<style scoped>
.calendar-day {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.day-header__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.day-header__stats {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.day-timeline {
  max-height: 560px;
  overflow-y: auto;
}

.day-hour {
  display: flex;
  min-height: 56px;
  border-bottom: 1px solid var(--color-border-light);
  transition: background var(--transition-fast);
}

.day-hour:last-child {
  border-bottom: none;
}

.day-hour.is-drag-over {
  background: rgba(64, 158, 255, 0.06);
}

.day-hour__label {
  width: 56px;
  padding: var(--space-1) var(--space-2) 0 0;
  text-align: right;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  border-right: 1px solid var(--color-border-light);
}

.day-hour__content {
  flex: 1;
  padding: var(--space-1) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.day-task {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-sm);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  cursor: grab;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}

.day-task:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.day-task:active {
  cursor: grabbing;
}

.day-task__bar {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  background: var(--group-color, var(--color-info));
  flex-shrink: 0;
}

.day-task__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.day-task__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.day-task__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}

.day-task__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-task__meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.day-task.is-conflict {
  border-color: var(--color-danger);
  border-width: 2px;
  background: rgba(245, 108, 108, 0.04);
}

.day-task--pending { border-left: 3px solid var(--color-info); }
.day-task--scheduled { border-left: 3px solid var(--color-primary); }
.day-task--running { border-left: 3px solid var(--color-warning); }
.day-task--completed { border-left: 3px solid var(--color-success); }
.day-task--failed { border-left: 3px solid var(--color-danger); }
</style>
