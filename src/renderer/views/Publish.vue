<template>
  <div class="page-publish">
    <!-- Wizard Mode -->
    <div v-if="showWizard" class="wizard-container">
      <div class="wizard-header">
        <h2 class="page-title">创建发布计划</h2>
        <el-button @click="showWizard = false">返回日历</el-button>
      </div>
      <PublishWizard @confirmed="onWizardConfirmed" @cancel="showWizard = false" />
    </div>

    <!-- Calendar Mode -->
    <div v-else>
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">发布管理</h2>
          <div class="calendar-nav">
            <el-button-group>
              <el-button @click="prevMonth">
                <el-icon><ArrowLeft /></el-icon>
              </el-button>
              <el-button disabled class="nav-month">{{ currentMonthLabel }}</el-button>
              <el-button @click="nextMonth">
                <el-icon><ArrowRight /></el-icon>
              </el-button>
            </el-button-group>
            <el-button class="btn-today" @click="goToday">今天</el-button>
          </div>
          <!-- View Mode Toggle -->
          <el-radio-group v-model="calendarViewMode" size="small" class="view-toggle">
            <el-radio-button value="month">月</el-radio-button>
            <el-radio-button value="week">周</el-radio-button>
            <el-radio-button value="day">日</el-radio-button>
          </el-radio-group>
        </div>
        <div class="header-actions">
          <el-button v-if="pendingTasks.length > 0" type="success" @click="openAICheck">
            <el-icon><Check /></el-icon>
            AI 检查 ({{ pendingTasks.length }})
          </el-button>
          <el-button type="primary" @click="showWizard = true">
            <el-icon><Plus /></el-icon>
            创建发布计划
          </el-button>
        </div>
      </div>

      <!-- AI Rule Optimization Banner -->
      <AIRuleOptimizationBanner
        v-if="activeGroupId"
        :group-id="activeGroupId"
        :group-name="activeGroupName"
        :current-rule="activeGroupRule"
        @adopt="onAdoptRuleSuggestion"
        @dismiss="() => {}"
      />

      <!-- Summary Bar -->
      <CalendarSummaryBar :tasks="publishStore.tasks" />

      <Loading v-if="publishStore.loading" />

      <!-- Month View -->
      <div v-else-if="calendarViewMode === 'month'" class="calendar">
      <div class="calendar__header">
        <span
          v-for="day in weekDays"
          :key="day"
          class="calendar__weekday"
        >{{ day }}</span>
      </div>

      <div class="calendar__body">
        <div
          v-for="cell in calendarCells"
          :key="cell.key"
          class="calendar__cell"
          :class="{
            'is-today': cell.isToday,
            'is-other-month': cell.isOtherMonth,
            'is-selected': isSelected(cell.dateStr),
            'is-drag-over': cell.isDragOver,
          }"
          @click="selectDate(cell.dateStr)"
          @dragover.prevent="onDragOver($event, cell)"
          @dragleave="onDragLeave(cell)"
          @drop="onDrop($event, cell)"
        >
          <div class="cell__date">
            <span class="cell__day">{{ cell.day }}</span>
            <span v-if="cell.taskCount > 0" class="cell__badge">{{ cell.taskCount }}</span>
          </div>

          <div class="cell__tasks">
            <div
              v-for="task in cell.tasks.slice(0, 3)"
              :key="task.id"
              class="task-chip"
              :class="`task-chip--${task.status}`"
              draggable="true"
              @dragstart="onDragStart($event, task)"
              @click.stop="openEditDialog(task)"
            >
              <span class="task-chip__icon">{{ platformIcon(task.platform) }}</span>
              <span class="task-chip__title">{{ task.contentTitle }}</span>
            </div>
            <div v-if="cell.tasks.length > 3" class="task-more">
              +{{ cell.tasks.length - 3 }} 更多
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- Week View -->
      <CalendarWeekView
        v-else-if="calendarViewMode === 'week'"
        :tasks="publishStore.tasks"
        :week-start="currentWeekStart"
        @task-contextmenu="onTaskContextMenu"
        @task-drop="onCalendarTaskDrop"
      />

      <!-- Day View -->
      <CalendarDayView
        v-else-if="calendarViewMode === 'day'"
        :tasks="publishStore.tasks"
        :date="selectedDate"
        :conflicts="conflictTaskIds"
        @task-contextmenu="onTaskContextMenu"
        @task-drop="onCalendarTaskDrop"
      />

    <CreatePublishDialog
      v-model="createVisible"
      :default-date="selectedDate"
      @created="onTaskCreated"
    />
    <EditPublishDialog
      v-model="editVisible"
      :task="editingTask"
      @updated="onTaskUpdated"
      @deleted="onTaskDeleted"
    />

      <!-- Context Menu -->
      <CalendarContextMenu
        :visible="contextMenuVisible"
        :x="contextMenuX"
        :y="contextMenuY"
        :task="contextMenuTask"
        @action="onContextMenuAction"
        @close="contextMenuVisible = false"
      />

    <el-drawer
      v-model="aiCheckVisible"
      title="AI 预发布检查"
      direction="rtl"
      size="400px"
    >
      <AICheckPanel
        v-if="aiCheckVisible"
        :group-id="aiCheckContext.groupId"
        :group-name="aiCheckContext.groupName"
        :content-ids="aiCheckContext.contentIds"
        :accounts="aiCheckContext.accounts"
        :schedule-slots="aiCheckContext.scheduleSlots"
        :rule="aiCheckContext.rule"
        @confirmed="onAICheckConfirmed"
      />
    </el-drawer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus, ArrowLeft, ArrowRight, Check } from '@element-plus/icons-vue';
import { usePublishStore, type PublishTask, type PublishMode } from '@/renderer/stores/publish';
import { useGroupStore } from '@/renderer/stores/group';
import Loading from '@/renderer/components/common/Loading.vue';
import CreatePublishDialog from '@/renderer/components/publish/CreatePublishDialog.vue';
import EditPublishDialog from '@/renderer/components/publish/EditPublishDialog.vue';
import PublishWizard from '@/renderer/components/publish/PublishWizard.vue';
import CalendarWeekView from '@/renderer/components/publish/CalendarWeekView.vue';
import CalendarDayView from '@/renderer/components/publish/CalendarDayView.vue';
import CalendarContextMenu from '@/renderer/components/publish/CalendarContextMenu.vue';
import CalendarSummaryBar from '@/renderer/components/publish/CalendarSummaryBar.vue';
import AIRuleOptimizationBanner from '@/renderer/components/publish/AIRuleOptimizationBanner.vue';
import AICheckPanel from '@/components/AICheckPanel.vue';

const publishStore = usePublishStore();
const groupStore = useGroupStore();

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth());
const selectedDate = ref(formatDate(now));

const createVisible = ref(false);
const editVisible = ref(false);
const editingTask = ref<PublishTask | null>(null);
const dragOverDate = ref<string | null>(null);
const aiCheckVisible = ref(false);
const showWizard = ref(false);
const calendarViewMode = ref<'month' | 'week' | 'day'>('month');
let draggedTask: PublishTask | null = null;

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuTask = ref<{ id: string; contentTitle: string } | undefined>(undefined);

// Active group for AI banner
const activeGroupId = computed(() => {
  const groups = [...new Set(publishStore.tasks.map(t => t.groupId).filter(Boolean))];
  return groups[0] || '';
});
const activeGroupName = computed(() => {
  if (!activeGroupId.value) return '';
  return groupStore.getGroupById(activeGroupId.value)?.name || '';
});
const activeGroupRule = computed(() => {
  if (!activeGroupId.value) return { timeSlots: [], dailyCount: 0, publishMode: 'server' };
  const group = groupStore.getGroupById(activeGroupId.value);
  return {
    timeSlots: group?.publishRule?.timeSlots || [],
    dailyCount: group?.publishRule?.dailyCount || 3,
    publishMode: group?.publishRule?.publishMode || 'server',
  };
});

// Conflict detection
const conflictTaskIds = computed(() => {
  const seen = new Map<string, Set<string>>();
  const ids = new Set<string>();
  for (const task of publishStore.tasks) {
    const date = task.scheduledAt.slice(0, 10);
    const key = `${task.accountId}:${date}`;
    if (!seen.has(key)) seen.set(key, new Set());
    const groups = seen.get(key)!;
    if (task.groupId) groups.add(task.groupId);
  }
  for (const task of publishStore.tasks) {
    const date = task.scheduledAt.slice(0, 10);
    const key = `${task.accountId}:${date}`;
    const groups = seen.get(key);
    if (groups && groups.size > 1) ids.add(task.id);
  }
  return ids;
});

// Week view helper
const currentWeekStart = computed(() => {
  const d = new Date(selectedDate.value);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
});

const pendingTasks = computed(() =>
  publishStore.tasks.filter(t => t.status === 'pending' || t.status === 'scheduled')
);

const aiCheckContext = computed(() => {
  const tasks = pendingTasks.value;
  const groups = [...new Set(tasks.map(t => t.groupId).filter(Boolean))];
  const uniqueAccounts = new Map<string, PublishTask>();
  for (const t of tasks) {
    if (t.accountId && !uniqueAccounts.has(t.accountId)) {
      uniqueAccounts.set(t.accountId, t);
    }
  }

  const primaryMode: PublishMode = tasks[0]?.publishMode ?? 'server';

  return {
    groupId: groups[0] || '',
    groupName: groups[0] || '默认分组',
    contentIds: [...new Set(tasks.map(t => t.contentId).filter(Boolean))],
    accounts: [...uniqueAccounts.entries()].map(([id, t]) => ({
      id,
      platform: t.platform,
      nickname: t.accountName,
      cookieStatus: 'valid' as const,
    })),
    scheduleSlots: tasks.map(t => ({
      time: new Date(t.scheduledAt),
      contentId: t.contentId,
      accountIds: [t.accountId],
    })),
    rule: {
      dailyCount: tasks.length,
      timeSlots: [...new Set(tasks.map(t => t.scheduledAt.slice(11, 16)))],
      randomOffsetMin: 5,
      publishMode: primaryMode,
    },
  };
});

const currentMonthLabel = computed(() => {
  return `${viewYear.value}年${viewMonth.value + 1}月`;
});

interface CalendarCell {
  key: string;
  dateStr: string;
  day: number;
  isToday: boolean;
  isOtherMonth: boolean;
  isDragOver: boolean;
  tasks: PublishTask[];
  taskCount: number;
}

const calendarCells = computed<CalendarCell[]>(() => {
  const year = viewYear.value;
  const month = viewMonth.value;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayStr = formatDate(new Date());
  const cells: CalendarCell[] = [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const dateStr = formatStr(prevYear, prevMonth, day);
    const tasks = getTasksForDate(dateStr);
    cells.push({
      key: dateStr,
      dateStr,
      day,
      isToday: dateStr === todayStr,
      isOtherMonth: true,
      isDragOver: dateStr === dragOverDate.value,
      tasks,
      taskCount: tasks.length,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatStr(year, month, day);
    const tasks = getTasksForDate(dateStr);
    cells.push({
      key: dateStr,
      dateStr,
      day,
      isToday: dateStr === todayStr,
      isOtherMonth: false,
      isDragOver: dateStr === dragOverDate.value,
      tasks,
      taskCount: tasks.length,
    });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const dateStr = formatStr(nextYear, nextMonth, day);
    const tasks = getTasksForDate(dateStr);
    cells.push({
      key: dateStr,
      dateStr,
      day,
      isToday: dateStr === todayStr,
      isOtherMonth: true,
      isDragOver: dateStr === dragOverDate.value,
      tasks,
      taskCount: tasks.length,
    });
  }

  return cells;
});

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTasksForDate(dateStr: string): PublishTask[] {
  return publishStore.tasksByDate.get(dateStr) || [];
}

function isSelected(dateStr: string): boolean {
  return selectedDate.value === dateStr;
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value--;
  } else {
    viewMonth.value--;
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value++;
  } else {
    viewMonth.value++;
  }
}

function goToday() {
  const today = new Date();
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
  selectedDate.value = formatDate(today);
}

function selectDate(dateStr: string) {
  selectedDate.value = dateStr;
}

function platformIcon(platform: string): string {
  const icons: Record<string, string> = {
    douyin: '🎵',
    kuaishou: '🎬',
    bilibili: '📺',
    xiaohongshu: '📕',
    wechat: '💬',
  };
  return icons[platform] || '📱';
}

function openCreateDialog() {
  createVisible.value = true;
}

function openEditDialog(task: PublishTask) {
  editingTask.value = task;
  editVisible.value = true;
}

function onDragStart(e: DragEvent, task: PublishTask) {
  draggedTask = task;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', task.id);
}

function onDragOver(e: DragEvent, cell: CalendarCell) {
  e.dataTransfer!.dropEffect = 'move';
  dragOverDate.value = cell.dateStr;
}

function onDragLeave(cell: CalendarCell) {
  if (dragOverDate.value === cell.dateStr) {
    dragOverDate.value = null;
  }
}

async function onDrop(_e: DragEvent, cell: CalendarCell) {
  dragOverDate.value = null;
  if (!draggedTask) return;

  const newScheduledAt = `${cell.dateStr}T${draggedTask.scheduledAt.slice(11, 16)}`;
  await publishStore.updateTaskSchedule(draggedTask.id, newScheduledAt);
  draggedTask = null;
}

function onTaskCreated() {
  publishStore.fetchTasks();
}

function onTaskUpdated() {
  publishStore.fetchTasks();
}

function onTaskDeleted() {
  editVisible.value = false;
  publishStore.fetchTasks();
}

function openAICheck() {
  aiCheckVisible.value = true;
}

function onAICheckConfirmed() {
  aiCheckVisible.value = false;
  publishStore.confirmPendingTasks();
}

// Wizard integration
async function onWizardConfirmed(tasks: Array<{ contentId: string; groupId: string; accountIds: string[]; scheduledAt: string; publishMode: string }>) {
  for (const task of tasks) {
    await publishStore.createTask({
      contentId: task.contentId,
      accountIds: task.accountIds,
      scheduledAt: task.scheduledAt,
      publishMode: task.publishMode as PublishMode,
    });
  }
  showWizard.value = false;
  publishStore.fetchTasks();
}

// Context menu handlers
function onTaskContextMenu(event: MouseEvent, task: PublishTask) {
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuTask.value = { id: task.id, contentTitle: task.contentTitle };
  contextMenuVisible.value = true;
}

function onContextMenuAction(action: string) {
  contextMenuVisible.value = false;
  if (!contextMenuTask.value) return;
  const taskId = contextMenuTask.value.id;
  switch (action) {
    case 'view-detail': {
      const task = publishStore.tasks.find(t => t.id === taskId);
      if (task) openEditDialog(task);
      break;
    }
    case 'delete':
      publishStore.deleteTask(taskId);
      break;
    case 'exclude-account':
      publishStore.deleteTask(taskId);
      break;
  }
}

// Calendar task drop (week/day views)
async function onCalendarTaskDrop(taskId: string, newScheduledAt: string) {
  await publishStore.updateTaskSchedule(taskId, newScheduledAt);
}

// AI rule suggestion adoption
async function onAdoptRuleSuggestion(suggestion: { data?: Record<string, unknown> }) {
  if (!activeGroupId.value || !suggestion.data) return;
  const payload = suggestion.data;
  const currentGroup = groupStore.getGroupById(activeGroupId.value);
  if (!currentGroup) return;
  await groupStore.updateGroup(activeGroupId.value, {
    publishRule: { ...currentGroup.publishRule, ...payload },
  });
}

onMounted(() => {
  publishStore.fetchTasks();
  groupStore.fetchGroups();
});
</script>

<style scoped>
.page-publish {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.page-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.nav-month {
  min-width: 120px;
  font-weight: var(--font-weight-medium);
}

.btn-today {
  font-size: var(--font-size-sm);
}

.view-toggle {
  margin-left: var(--space-4);
}

.wizard-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.calendar {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.calendar__header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.calendar__weekday {
  padding: var(--space-3) 0;
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.calendar__body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar__cell {
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

.calendar__cell:nth-child(7n) {
  border-right: none;
}

.calendar__cell:hover {
  background: var(--color-bg-page);
}

.calendar__cell.is-other-month {
  opacity: 0.45;
}

.calendar__cell.is-today {
  background: rgba(64, 158, 255, 0.04);
}

.calendar__cell.is-today .cell__day {
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.calendar__cell.is-selected {
  box-shadow: inset 0 0 0 2px var(--color-primary-light);
}

.calendar__cell.is-drag-over {
  background: rgba(64, 158, 255, 0.08);
}

.cell__date {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.cell__day {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: 24px;
}

.cell__badge {
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

.cell__tasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}

.task-chip {
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
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.task-chip:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.task-chip:active {
  cursor: grabbing;
}

.task-chip--pending {
  background: rgba(144, 147, 153, 0.1);
  color: var(--color-info);
  border-left: 2px solid var(--color-info);
}

.task-chip--scheduled {
  background: rgba(64, 158, 255, 0.08);
  color: var(--color-primary);
  border-left: 2px solid var(--color-primary);
}

.task-chip--running {
  background: rgba(230, 162, 60, 0.1);
  color: var(--color-warning);
  border-left: 2px solid var(--color-warning);
}

.task-chip--completed {
  background: rgba(103, 194, 58, 0.1);
  color: var(--color-success);
  border-left: 2px solid var(--color-success);
}

.task-chip--failed {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
  border-left: 2px solid var(--color-danger);
}

.task-chip__icon {
  flex-shrink: 0;
  font-size: 12px;
}

.task-chip__title {
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-more {
  font-size: 10px;
  color: var(--color-text-secondary);
  padding-left: var(--space-1);
}
</style>
