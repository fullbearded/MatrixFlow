<template>
  <div class="calendar-week">
    <div class="week-header">
      <div class="week-header__time-col" />
      <div
        v-for="day in weekDays"
        :key="day.dateStr"
        class="week-header__day"
        :class="{ 'is-today': day.isToday }"
      >
        <span class="week-header__day-name">{{ day.dayName }}</span>
        <span class="week-header__day-number">{{ day.dayNumber }}</span>
      </div>
    </div>

    <div class="week-body">
      <div
        v-for="hour in hours"
        :key="hour"
        class="week-row"
      >
        <div class="week-row__time">{{ formatHour(hour) }}</div>
        <div
          v-for="day in weekDays"
          :key="day.dateStr + '-' + hour"
          class="week-row__cell"
          :class="{ 'is-drag-over': isCellDragOver(day.dateStr, hour) }"
          @contextmenu.prevent="onCellContextMenu($event, day.dateStr, hour)"
          @dragover.prevent="onDragOver($event, day.dateStr, hour)"
          @dragleave="onDragLeave(day.dateStr, hour)"
          @drop="onDrop($event, day.dateStr, hour)"
        >
          <div
            v-for="task in getTasksForSlot(day.dateStr, hour)"
            :key="task.id"
            class="week-task"
            :class="{
              'is-conflict': conflictIds.has(task.id),
              [`week-task--${task.status}`]: true,
            }"
            :style="{ '--group-color': getGroupColor(task.groupId) }"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @contextmenu.prevent.stop="onTaskContextMenu($event, task)"
            @click="emit('task-click', task)"
          >
            <span class="week-task__bar" />
            <span class="week-task__time">{{ formatTaskTime(task.scheduledAt) }}</span>
            <span class="week-task__title">{{ task.contentTitle }}</span>
            <span class="week-task__account">{{ task.accountName }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PublishTask } from '@/renderer/stores/publish';
import { detectConflicts } from './conflict-detect';

export interface WeekDayInfo {
  dateStr: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

const props = defineProps<{
  tasks: PublishTask[];
  weekStart: Date;
  groupColors?: Map<string, string>;
}>();

const emit = defineEmits<{
  'contextmenu': [event: MouseEvent, date: string, hour: number];
  'task-contextmenu': [event: MouseEvent, task: PublishTask];
  'task-drop': [taskId: string, newScheduledAt: string];
  'task-click': [task: PublishTask];
}>();

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const hours = Array.from({ length: 18 }, (_, i) => i + 6);

const dragOverCell = ref<{ dateStr: string; hour: number } | null>(null);
let draggedTask: PublishTask | null = null;

const conflictIds = computed(() => detectConflicts(props.tasks));

const weekDays = computed<WeekDayInfo[]>(() => {
  const today = todayStr();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(props.weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = formatDateStr(d);
    return {
      dateStr,
      dayName: DAY_NAMES[d.getDay()],
      dayNumber: d.getDate(),
      isToday: dateStr === today,
    };
  });
});

function getTasksForSlot(dateStr: string, hour: number): PublishTask[] {
  return props.tasks.filter(t => {
    const taskDate = t.scheduledAt.slice(0, 10);
    const taskHour = parseInt(t.scheduledAt.slice(11, 13), 10);
    return taskDate === dateStr && taskHour === hour;
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

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return formatDateStr(new Date());
}

function isCellDragOver(dateStr: string, hour: number): boolean {
  return dragOverCell.value?.dateStr === dateStr && dragOverCell.value?.hour === hour;
}

function onDragStart(e: DragEvent, task: PublishTask) {
  draggedTask = task;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', task.id);
}

function onDragOver(_e: DragEvent, dateStr: string, hour: number) {
  dragOverCell.value = { dateStr, hour };
}

function onDragLeave(dateStr: string, hour: number) {
  if (dragOverCell.value?.dateStr === dateStr && dragOverCell.value?.hour === hour) {
    dragOverCell.value = null;
  }
}

function onDrop(_e: DragEvent, dateStr: string, hour: number) {
  dragOverCell.value = null;
  if (!draggedTask) return;
  const min = draggedTask.scheduledAt.slice(14, 16);
  const newScheduledAt = `${dateStr}T${String(hour).padStart(2, '0')}:${min}:00`;
  emit('task-drop', draggedTask.id, newScheduledAt);
  draggedTask = null;
}

function onCellContextMenu(e: MouseEvent, date: string, hour: number) {
  emit('contextmenu', e, date, hour);
}

function onTaskContextMenu(e: MouseEvent, task: PublishTask) {
  emit('task-contextmenu', e, task);
}
</script>

<style scoped>
.calendar-week {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.week-header {
  display: grid;
  grid-template-columns: 56px repeat(7, 1fr);
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.week-header__time-col {
  border-right: 1px solid var(--color-border-light);
}

.week-header__day {
  padding: var(--space-2) 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-right: 1px solid var(--color-border-light);
}

.week-header__day:last-child {
  border-right: none;
}

.week-header__day-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.week-header__day-number {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: 1.2;
}

.week-header__day.is-today .week-header__day-name {
  color: var(--color-primary);
}

.week-header__day.is-today .week-header__day-number {
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.week-body {
  overflow-y: auto;
  max-height: 480px;
}

.week-row {
  display: grid;
  grid-template-columns: 56px repeat(7, 1fr);
  min-height: 48px;
  border-bottom: 1px solid var(--color-border-light);
}

.week-row:last-child {
  border-bottom: none;
}

.week-row__time {
  padding: var(--space-1) var(--space-2) 0 0;
  text-align: right;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  border-right: 1px solid var(--color-border-light);
}

.week-row__cell {
  padding: 2px var(--space-1);
  border-right: 1px solid var(--color-border-light);
  transition: background var(--transition-fast);
  min-height: 48px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.week-row__cell:last-child {
  border-right: none;
}

.week-row__cell.is-drag-over {
  background: rgba(64, 158, 255, 0.08);
}

.week-task {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-1);
  border-radius: var(--border-radius-sm);
  font-size: 11px;
  line-height: 16px;
  cursor: grab;
  overflow: hidden;
  background: color-mix(in srgb, var(--group-color, var(--color-info)) 8%, transparent);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.week-task:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.week-task:active {
  cursor: grabbing;
}

.week-task__bar {
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--group-color, var(--color-info));
  flex-shrink: 0;
}

.week-task__time {
  color: var(--color-text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.week-task__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
  flex: 1;
}

.week-task__account {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.week-task.is-conflict {
  outline: 2px solid var(--color-danger);
  outline-offset: -1px;
}

.week-task--pending { border-left: 2px solid var(--color-info); }
.week-task--scheduled { border-left: 2px solid var(--color-primary); }
.week-task--running { border-left: 2px solid var(--color-warning); }
.week-task--completed { border-left: 2px solid var(--color-success); }
.week-task--failed { border-left: 2px solid var(--color-danger); }
</style>
