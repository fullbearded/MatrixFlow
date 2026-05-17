<template>
  <div class="publish-calendar">
    <!-- ── 工具栏 ── -->
    <div class="pc-toolbar">
      <div class="pc-toolbar__left">
        <el-button-group>
          <el-button
            v-for="v in viewOptions"
            :key="v.value"
            :type="currentView === v.value ? 'primary' : 'default'"
            size="small"
            @click="switchView(v.value)"
          >{{ v.label }}</el-button>
        </el-button-group>
      </div>

      <div class="pc-toolbar__center">
        <el-button-group>
          <el-button size="small" @click="navigate(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <el-button size="small" class="pc-toolbar__label" disabled>
            {{ periodLabel }}
          </el-button>
          <el-button size="small" @click="navigate(1)">
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </el-button-group>
        <el-button size="small" class="pc-toolbar__today" @click="goToday">今天</el-button>
      </div>

      <div class="pc-toolbar__right">
        <el-date-picker
          v-model="pickerDate"
          size="small"
          :type="currentView === 'day' ? 'datetime' : 'date'"
          placeholder="跳转到..."
          style="width: 180px"
          @change="onPickerChange"
        />
      </div>
    </div>

    <!-- ── 月视图 ── -->
    <div v-if="currentView === 'month'" class="pc-month">
      <div class="pc-month__header">
        <span
          v-for="d in weekDayLabels"
          :key="d"
          class="pc-month__weekday"
        >{{ d }}</span>
      </div>
      <div class="pc-month__grid">
        <div
          v-for="cell in monthCells"
          :key="cell.key"
          class="pc-month__cell"
          :class="{
            'is-today': cell.isToday,
            'is-other': cell.isOther,
            'is-selected': cell.dateStr === selectedDate,
            'is-drag-over': cell.dateStr === dragOverDate,
          }"
          @click="onMonthCellClick(cell)"
          @dragover.prevent="onCellDragOver(cell)"
          @dragleave="onCellDragLeave(cell)"
          @drop="onCellDrop(cell)"
        >
          <div class="pc-month__cell-head">
            <span class="pc-month__day">{{ cell.day }}</span>
            <span v-if="cell.taskCount > 0" class="pc-month__badge">
              {{ cell.taskCount }}
            </span>
          </div>
          <div class="pc-month__cell-tasks">
            <div
              v-for="t in cell.tasks.slice(0, 3)"
              :key="t.id"
              class="pc-task-dot"
              :class="{ 'is-conflict': isConflicting(t, cell.tasks) }"
              :style="{ '--plat-color': platformColor(t.platform) }"
              draggable="true"
              @dragstart="onTaskDragStart($event, t)"
              @click.stop="emit('task-click', t)"
            >
              <span class="pc-task-dot__bar" />
              <span class="pc-task-dot__text">{{ t.contentTitle }}</span>
            </div>
            <div v-if="cell.tasks.length > 3" class="pc-month__more">
              +{{ cell.tasks.length - 3 }} 更多
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 周视图 ── -->
    <div v-else-if="currentView === 'week'" class="pc-week">
      <div class="pc-week__header">
        <div
          v-for="(col, idx) in weekColumns"
          :key="idx"
          class="pc-week__col-head"
          :class="{ 'is-today': col.isToday }"
        >
          <span class="pc-week__col-label">{{ col.label }}</span>
          <span class="pc-week__col-date">{{ col.day }}</span>
        </div>
      </div>
      <div class="pc-week__body">
        <div
          v-for="(col, idx) in weekColumns"
          :key="idx"
          class="pc-week__col"
          :class="{
            'is-today': col.isToday,
            'is-drag-over': col.dateStr === dragOverDate,
          }"
          @dragover.prevent="onCellDragOver(col)"
          @dragleave="onCellDragLeave(col)"
          @drop="onCellDrop(col)"
        >
          <div
            v-for="t in col.tasks"
            :key="t.id"
            class="pc-week-task"
            :class="{
              'is-conflict': isConflicting(t, col.tasks),
              [`pc-week-task--${t.status}`]: true,
            }"
            :style="{ '--plat-color': platformColor(t.platform) }"
            draggable="true"
            @dragstart="onTaskDragStart($event, t)"
            @click="emit('task-click', t)"
          >
            <span class="pc-week-task__bar" />
            <span class="pc-week-task__time">{{ formatTime(t.scheduledAt) }}</span>
            <span class="pc-week-task__title">{{ t.contentTitle }}</span>
            <el-icon
              v-if="isConflicting(t, col.tasks)"
              class="pc-week-task__warn"
              :title="conflictTooltip(t, col.tasks)"
            >
              <WarningFilled />
            </el-icon>
          </div>
          <div v-if="col.tasks.length === 0" class="pc-week__empty">无任务</div>
        </div>
      </div>
    </div>

    <!-- ── 日视图 ── -->
    <div v-else class="pc-day">
      <div class="pc-day__timeline">
        <div
          v-for="h in 24"
          :key="h"
          class="pc-day__hour-row"
          :class="{ 'is-drag-over': isHourDragOver(h - 1) }"
          @dragover.prevent="onHourDragOver(h - 1)"
          @dragleave="dragOverHour = null"
          @drop="onHourDrop(h - 1)"
        >
          <div class="pc-day__hour-label">{{ pad(h - 1) }}:00</div>
          <div class="pc-day__hour-slot">
            <div
              v-for="t in tasksInHour(h - 1)"
              :key="t.id"
              class="pc-day-task"
              :class="{
                'is-conflict': hasConflictInHour(h - 1),
                [`pc-day-task--${t.status}`]: true,
              }"
              :style="{
                '--plat-color': platformColor(t.platform),
                top: taskTopInHour(t),
                height: taskBlockHeight(t),
              }"
              draggable="true"
              @dragstart="onTaskDragStart($event, t)"
              @click="emit('task-click', t)"
            >
              <span class="pc-day-task__bar" />
              <div class="pc-day-task__body">
                <span class="pc-day-task__title">{{ t.contentTitle }}</span>
                <span class="pc-day-task__meta">
                  {{ formatTime(t.scheduledAt) }} · {{ platformLabel(t.platform) }}
                </span>
              </div>
              <el-icon
                v-if="hasConflictInHour(h - 1)"
                class="pc-day-task__warn"
                :title="conflictTooltip(t, tasksInHour(h - 1))"
              >
                <WarningFilled />
              </el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 拖拽时间预览浮层 ── -->
    <Teleport to="body">
      <div v-if="dragPreview.visible" class="pc-drag-preview" :style="dragPreviewStyle">
        {{ dragPreview.text }}
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { ArrowLeft, ArrowRight, WarningFilled } from '@element-plus/icons-vue';
import type { PublishTask } from '@/renderer/stores/publish';

// ── Props & Emits ──

const props = defineProps<{
  tasks: PublishTask[];
  selectedDate: string;
  platforms?: { id: string; name: string; color: string }[];
}>();

const emit = defineEmits<{
  'task-move': [taskId: string, newScheduledAt: string];
  'task-click': [task: PublishTask];
  'date-change': [dateStr: string];
}>();

// ── 视图状态 ──

type ViewMode = 'month' | 'week' | 'day';

const currentView = ref<ViewMode>('month');
const viewOptions = [
  { value: 'month' as ViewMode, label: '月' },
  { value: 'week' as ViewMode, label: '周' },
  { value: 'day' as ViewMode, label: '日' },
];

const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth());
const viewDay = ref(now.getDate());
const pickerDate = ref<Date | null>(null);
const dragOverDate = ref<string | null>(null);
const dragOverHour = ref<number | null>(null);

let draggedTask: PublishTask | null = null;

const dragPreview = reactive({ visible: false, text: '', x: 0, y: 0 });

const dragPreviewStyle = computed(() => ({
  left: `${dragPreview.x}px`,
  top: `${dragPreview.y}px`,
}));

// ── 平台颜色 ──

const PLATFORM_COLORS: Record<string, string> = {
  douyin: '#161823',
  kuaishou: '#ff4906',
  bilibili: '#00a1d6',
  xiaohongshu: '#fe2c55',
  wechat: '#07c160',
  toutiaohao: '#f85959',
  zhihu: '#0084ff',
  csdn: '#fc5531',
  juejin: '#007fff',
  weibo: '#e6162d',
};

const PLATFORM_LABELS: Record<string, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  bilibili: 'B站',
  xiaohongshu: '小红书',
  wechat: '微信',
  toutiaohao: '头条号',
  zhihu: '知乎',
  csdn: 'CSDN',
  juejin: '掘金',
  weibo: '微博',
};

function platformColor(plat: string): string {
  if (props.platforms) {
    const found = props.platforms.find(p => p.id === plat);
    if (found) return found.color;
  }
  return PLATFORM_COLORS[plat] || '#909399';
}

function platformLabel(plat: string): string {
  if (props.platforms) {
    const found = props.platforms.find(p => p.id === plat);
    if (found) return found.name;
  }
  return PLATFORM_LABELS[plat] || plat;
}

// ── 日期工具 ──

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function todayStr(): string {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

function getHour(iso: string): number {
  return parseInt(iso.slice(11, 13), 10);
}

function getMinute(iso: string): number {
  return parseInt(iso.slice(14, 16), 10);
}

function tasksForDate(dateStr: string): PublishTask[] {
  return props.tasks.filter(t => t.scheduledAt.slice(0, 10) === dateStr);
}

const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六'];

// ── 周期标签 ──

const periodLabel = computed(() => {
  const y = viewYear.value;
  const m = viewMonth.value;
  if (currentView.value === 'month') {
    return `${y}年${m + 1}月`;
  }
  if (currentView.value === 'week') {
    // 计算当前周的范围
    const d = new Date(y, m, viewDay.value);
    const dow = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dow + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.getMonth() + 1}月${monday.getDate()}日 — ${sunday.getMonth() + 1}月${sunday.getDate()}日`;
  }
  return `${y}年${m + 1}月${viewDay.value}日`;
});

// ── 月视图 ──

interface MonthCell {
  key: string;
  dateStr: string;
  day: number;
  isToday: boolean;
  isOther: boolean;
  tasks: PublishTask[];
  taskCount: number;
}

const monthCells = computed<MonthCell[]>(() => {
  const y = viewYear.value;
  const m = viewMonth.value;
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const today = todayStr();

  const cells: MonthCell[] = [];

  // 上月填充
  const pm = m === 0 ? 11 : m - 1;
  const py = m === 0 ? y - 1 : y;
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevDays - i;
    const ds = toDateStr(py, pm, day);
    const tasks = tasksForDate(ds);
    cells.push({ key: ds, dateStr: ds, day, isToday: ds === today, isOther: true, tasks, taskCount: tasks.length });
  }

  // 当月
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = toDateStr(y, m, day);
    const tasks = tasksForDate(ds);
    cells.push({ key: ds, dateStr: ds, day, isToday: ds === today, isOther: false, tasks, taskCount: tasks.length });
  }

  // 下月填充到 42 格
  const nm = m === 11 ? 0 : m + 1;
  const ny = m === 11 ? y + 1 : y;
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const ds = toDateStr(ny, nm, day);
    const tasks = tasksForDate(ds);
    cells.push({ key: ds, dateStr: ds, day, isToday: ds === today, isOther: true, tasks, taskCount: tasks.length });
  }

  return cells;
});

// ── 周视图 ──

interface WeekColumn {
  dateStr: string;
  label: string;
  day: number;
  isToday: boolean;
  tasks: PublishTask[];
}

const weekColumns = computed<WeekColumn[]>(() => {
  const d = new Date(viewYear.value, viewMonth.value, viewDay.value);
  const dow = d.getDay();
  // 周一为起始
  const mondayOffset = (dow + 6) % 7;

  const cols: WeekColumn[] = [];
  const today = todayStr();

  for (let i = 0; i < 7; i++) {
    const date = new Date(d);
    date.setDate(d.getDate() - mondayOffset + i);
    const dateStr = toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
    const tasks = tasksForDate(dateStr);
    cols.push({
      dateStr,
      label: weekDayLabels[date.getDay()],
      day: date.getDate(),
      isToday: dateStr === today,
      tasks,
    });
  }

  return cols;
});

// ── 日视图 ──

const dayTasks = computed(() => {
  const ds = toDateStr(viewYear.value, viewMonth.value, viewDay.value);
  return tasksForDate(ds);
});

function tasksInHour(h: number): PublishTask[] {
  return dayTasks.value.filter(t => getHour(t.scheduledAt) === h);
}

function taskTopInHour(t: PublishTask): string {
  const min = getMinute(t.scheduledAt);
  return `${(min / 60) * 100}%`;
}

function taskBlockHeight(t: PublishTask): string {
  // 默认持续 30 分钟
  return '50%';
}

function isHourDragOver(h: number): boolean {
  return dragOverHour.value === h;
}

// ── 冲突检测 ──

function isConflicting(task: PublishTask, siblings: PublishTask[]): boolean {
  // 同一小时内同一平台有多个任务即冲突
  const hour = getHour(task.scheduledAt);
  return siblings.some(
    s => s.id !== task.id && s.platform === task.platform && getHour(s.scheduledAt) === hour,
  );
}

function hasConflictInHour(h: number): boolean {
  const hourTasks = tasksInHour(h);
  const platforms = new Map<string, number>();
  for (const t of hourTasks) {
    platforms.set(t.platform, (platforms.get(t.platform) || 0) + 1);
  }
  return [...platforms.values()].some(c => c > 1);
}

function conflictTooltip(task: PublishTask, siblings: PublishTask[]): string {
  const conflicts = siblings.filter(
    s => s.id !== task.id && s.platform === task.platform && getHour(s.scheduledAt) === getHour(task.scheduledAt),
  );
  const names = conflicts.map(c => c.contentTitle).join('、');
  return `与「${names}」存在时间冲突`;
}

// ── 拖拽 ──

function onTaskDragStart(e: DragEvent, task: PublishTask) {
  draggedTask = task;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', task.id);

  // 监听全局拖拽移动以显示预览
  document.addEventListener('dragover', onGlobalDragMove);
  document.addEventListener('dragend', onGlobalDragEnd);
}

function onGlobalDragMove(e: DragEvent) {
  if (!draggedTask) return;
  dragPreview.visible = true;
  dragPreview.text = `移动: ${draggedTask.contentTitle}`;
  dragPreview.x = e.clientX + 12;
  dragPreview.y = e.clientY - 28;
}

function onGlobalDragEnd() {
  dragPreview.visible = false;
  dragOverDate.value = null;
  dragOverHour.value = null;
  draggedTask = null;
  document.removeEventListener('dragover', onGlobalDragMove);
  document.removeEventListener('dragend', onGlobalDragEnd);
}

function onCellDragOver(cell: { dateStr: string }) {
  dragOverDate.value = cell.dateStr;
}

function onCellDragLeave(cell: { dateStr: string }) {
  if (dragOverDate.value === cell.dateStr) {
    dragOverDate.value = null;
  }
}

function onCellDrop(cell: { dateStr: string }) {
  dragOverDate.value = null;
  if (!draggedTask) return;

  const timePart = draggedTask.scheduledAt.slice(11, 16);
  const newScheduledAt = `${cell.dateStr}T${timePart}:00`;
  emit('task-move', draggedTask.id, newScheduledAt);
  draggedTask = null;
}

function onHourDragOver(h: number) {
  dragOverHour.value = h;
}

function onHourDrop(h: number) {
  dragOverHour.value = null;
  if (!draggedTask) return;

  const dateStr = toDateStr(viewYear.value, viewMonth.value, viewDay.value);
  const min = getMinute(draggedTask.scheduledAt);
  const newScheduledAt = `${dateStr}T${pad(h)}:${pad(min)}:00`;
  emit('task-move', draggedTask.id, newScheduledAt);
  draggedTask = null;
}

// ── 视图切换与导航 ──

function switchView(v: ViewMode) {
  currentView.value = v;
}

function navigate(dir: -1 | 1) {
  if (currentView.value === 'month') {
    viewMonth.value += dir;
    if (viewMonth.value > 11) { viewMonth.value = 0; viewYear.value++; }
    if (viewMonth.value < 0) { viewMonth.value = 11; viewYear.value--; }
  } else if (currentView.value === 'week') {
    const d = new Date(viewYear.value, viewMonth.value, viewDay.value + dir * 7);
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    viewDay.value = d.getDate();
  } else {
    const d = new Date(viewYear.value, viewMonth.value, viewDay.value + dir);
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    viewDay.value = d.getDate();
  }
}

function goToday() {
  const t = new Date();
  viewYear.value = t.getFullYear();
  viewMonth.value = t.getMonth();
  viewDay.value = t.getDate();
  emit('date-change', toDateStr(t.getFullYear(), t.getMonth(), t.getDate()));
}

function onMonthCellClick(cell: MonthCell) {
  emit('date-change', cell.dateStr);
  // 如果有任务，自动切换到日视图
  if (cell.taskCount > 0) {
    const d = new Date(cell.dateStr);
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    viewDay.value = d.getDate();
    currentView.value = 'day';
  }
}

function onPickerChange(val: Date | null) {
  if (!val) return;
  viewYear.value = val.getFullYear();
  viewMonth.value = val.getMonth();
  viewDay.value = val.getDate();
  emit('date-change', toDateStr(val.getFullYear(), val.getMonth(), val.getDate()));
}

// ── 同步外部 selectedDate ──

watch(
  () => props.selectedDate,
  (ds) => {
    if (!ds) return;
    const d = new Date(ds);
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
    viewDay.value = d.getDate();
  },
);
</script>

<style scoped>
/* ── 全局 ── */
.publish-calendar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* ── 工具栏 ── */
.pc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.pc-toolbar__center {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pc-toolbar__label {
  min-width: 180px;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
}

.pc-toolbar__today {
  font-size: var(--font-size-sm);
}

/* ── 月视图 ── */
.pc-month__header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.pc-month__weekday {
  padding: var(--space-3) 0;
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.pc-month__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.pc-month__cell {
  min-height: 110px;
  padding: var(--space-2);
  border-right: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: background var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pc-month__cell:nth-child(7n) {
  border-right: none;
}

.pc-month__cell:hover {
  background: var(--color-bg-page);
}

.pc-month__cell.is-other {
  opacity: 0.4;
}

.pc-month__cell.is-today {
  background: rgba(64, 158, 255, 0.04);
}

.pc-month__cell.is-today .pc-month__day {
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pc-month__cell.is-selected {
  box-shadow: inset 0 0 0 2px var(--color-primary-light);
}

.pc-month__cell.is-drag-over {
  background: rgba(64, 158, 255, 0.08);
}

.pc-month__cell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pc-month__day {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: 24px;
}

.pc-month__badge {
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pc-month__cell-tasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}

.pc-month__more {
  font-size: 10px;
  color: var(--color-text-secondary);
  padding-left: var(--space-1);
}

/* ── 任务点（月视图） ── */
.pc-task-dot {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-1);
  border-radius: var(--border-radius-sm);
  font-size: 11px;
  line-height: 18px;
  cursor: grab;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: color-mix(in srgb, var(--plat-color, #909399) 8%, transparent);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.pc-task-dot:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.pc-task-dot:active {
  cursor: grabbing;
}

.pc-task-dot__bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--plat-color, #909399);
  flex-shrink: 0;
}

.pc-task-dot__text {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-regular);
}

.pc-task-dot.is-conflict {
  outline: 2px solid var(--color-danger);
  outline-offset: -1px;
}

/* ── 周视图 ── */
.pc-week__header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.pc-week__col-head {
  padding: var(--space-3) 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.pc-week__col-head.is-today {
  color: var(--color-primary);
}

.pc-week__col-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.pc-week__col-head.is-today .pc-week__col-label {
  color: var(--color-primary);
}

.pc-week__col-date {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: 1.2;
}

.pc-week__col-head.is-today .pc-week__col-date {
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pc-week__body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  min-height: 300px;
}

.pc-week__col {
  padding: var(--space-2);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: background var(--transition-fast);
}

.pc-week__col:nth-child(7n) {
  border-right: none;
}

.pc-week__col.is-today {
  background: rgba(64, 158, 255, 0.03);
}

.pc-week__col.is-drag-over {
  background: rgba(64, 158, 255, 0.08);
}

.pc-week__empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
  text-align: center;
  padding: var(--space-8) 0;
}

/* ── 周视图任务卡 ── */
.pc-week-task {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  cursor: grab;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  position: relative;
}

.pc-week-task:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.pc-week-task:active {
  cursor: grabbing;
}

.pc-week-task__bar {
  width: 4px;
  height: 100%;
  min-height: 20px;
  border-radius: 2px;
  background: var(--plat-color, #909399);
  flex-shrink: 0;
}

.pc-week-task__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.pc-week-task__title {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.pc-week-task__warn {
  color: var(--color-danger);
  font-size: 14px;
  flex-shrink: 0;
}

.pc-week-task.is-conflict {
  border-color: var(--color-danger);
  border-width: 2px;
}

/* 状态色 */
.pc-week-task--pending {
  border-left: 3px solid var(--color-info);
}
.pc-week-task--scheduled {
  border-left: 3px solid var(--color-primary);
}
.pc-week-task--running {
  border-left: 3px solid var(--color-warning);
}
.pc-week-task--completed {
  border-left: 3px solid var(--color-success);
}
.pc-week-task--failed {
  border-left: 3px solid var(--color-danger);
}

/* ── 日视图 ── */
.pc-day__timeline {
  max-height: 500px;
  overflow-y: auto;
}

.pc-day__hour-row {
  display: flex;
  min-height: 60px;
  border-bottom: 1px solid var(--color-border-light);
  transition: background var(--transition-fast);
}

.pc-day__hour-row.is-drag-over {
  background: rgba(64, 158, 255, 0.06);
}

.pc-day__hour-label {
  width: 56px;
  padding: var(--space-2) var(--space-2) 0 0;
  text-align: right;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.pc-day__hour-slot {
  flex: 1;
  position: relative;
  padding: var(--space-1) var(--space-2);
  border-left: 1px solid var(--color-border-light);
}

/* ── 日视图任务块 ── */
.pc-day-task {
  position: absolute;
  left: var(--space-2);
  right: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  cursor: grab;
  z-index: 1;
  transition: box-shadow var(--transition-fast);
  overflow: hidden;
}

.pc-day-task:hover {
  box-shadow: var(--shadow-md);
  z-index: 2;
}

.pc-day-task:active {
  cursor: grabbing;
}

.pc-day-task__bar {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  background: var(--plat-color, #909399);
  flex-shrink: 0;
}

.pc-day-task__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  overflow: hidden;
}

.pc-day-task__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-day-task__meta {
  font-size: 10px;
  color: var(--color-text-secondary);
}

.pc-day-task__warn {
  color: var(--color-danger);
  font-size: 14px;
  flex-shrink: 0;
}

.pc-day-task.is-conflict {
  border-color: var(--color-danger);
  border-width: 2px;
  background: rgba(245, 108, 108, 0.04);
}

/* 状态色（日视图） */
.pc-day-task--pending { border-left: 3px solid var(--color-info); }
.pc-day-task--scheduled { border-left: 3px solid var(--color-primary); }
.pc-day-task--running { border-left: 3px solid var(--color-warning); }
.pc-day-task--completed { border-left: 3px solid var(--color-success); }
.pc-day-task--failed { border-left: 3px solid var(--color-danger); }

/* ── 拖拽预览浮层 ── */
.pc-drag-preview {
  position: fixed;
  z-index: 9999;
  padding: var(--space-1) var(--space-2);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--font-size-xs);
  border-radius: var(--border-radius-sm);
  pointer-events: none;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .pc-toolbar {
    flex-direction: column;
    gap: var(--space-2);
    align-items: stretch;
  }

  .pc-toolbar__left,
  .pc-toolbar__center,
  .pc-toolbar__right {
    justify-content: center;
    display: flex;
  }

  .pc-month__cell {
    min-height: 70px;
  }

  .pc-week__body {
    min-height: 200px;
  }
}
</style>
