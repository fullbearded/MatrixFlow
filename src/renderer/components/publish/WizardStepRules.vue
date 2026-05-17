<template>
  <div class="wizard-step-rules">
    <div class="wsrd-header">
      <el-button type="primary" :loading="generating" @click="generateSchedule">
        <el-icon><Calendar /></el-icon>
        应用规则生成排期
      </el-button>
      <span v-if="scheduledTasks.length > 0" class="wsrd-header__summary">
        共 <strong>{{ scheduledTasks.length }}</strong> 条任务，跨 <strong>{{ uniqueDays }}</strong> 天
      </span>
    </div>

    <div v-if="scheduledTasks.length > 0" class="wsrd-table-wrap">
      <el-table :data="scheduledTasks" stripe size="small" max-height="400">
        <el-table-column prop="date" label="日期" width="120">
          <template #default="{ row }">
            <span class="wsrd-date">{{ row.date }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="时间" width="80">
          <template #default="{ row }">
            <span class="wsrd-time">{{ row.time }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="contentTitle" label="内容" min-width="150" show-overflow-tooltip />
        <el-table-column prop="groupName" label="分组" width="120">
          <template #default="{ row }">
            <el-tag
              size="small"
              :style="{
                backgroundColor: row.groupColor,
                borderColor: row.groupColor,
                color: '#fff',
              }"
              effect="dark"
              round
            >
              {{ row.groupName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="accountCount" label="账号数" width="80" align="center" />
        <el-table-column prop="publishMode" label="发布方式" width="120">
          <template #default="{ row }">
            <el-tag :type="row.publishMode === 'server' ? 'success' : 'warning'" size="small" effect="plain" round>
              {{ row.publishMode === 'server' ? '服务端发布' : '客户端直发' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-empty v-else description="点击上方按钮生成排期预览" />

    <div class="wsrd-footer">
      <el-button @click="$emit('prev')">上一步</el-button>
      <el-button type="success" :disabled="scheduledTasks.length === 0" @click="handleConfirm">
        确认发布 ({{ scheduledTasks.length }} 条)
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Calendar } from '@element-plus/icons-vue';
import { useContentStore } from '@/renderer/stores/content';
import { useGroupStore, type PublishRule } from '@/renderer/stores/group';

export interface ScheduledTaskRow {
  date: string;
  time: string;
  contentId: string;
  contentTitle: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  accountIds: string[];
  accountCount: number;
  publishMode: string;
  scheduledAt: string;
}

export interface ConfirmPayload {
  contentId: string;
  groupId: string;
  accountIds: string[];
  scheduledAt: string;
  publishMode: string;
}

const props = defineProps<{
  contentIds: string[];
  groupIds: string[];
}>();

const emit = defineEmits<{
  prev: [];
  confirm: [tasks: ConfirmPayload[]];
}>();

const contentStore = useContentStore();
const groupStore = useGroupStore();

const generating = ref(false);
const scheduledTasks = ref<ScheduledTaskRow[]>([]);

const uniqueDays = computed(() => {
  const days = new Set(scheduledTasks.value.map((t) => t.date));
  return days.size;
});

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${pad(newH)}:${pad(newM)}`;
}

const REST_DAY_KEYS: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

function isRestDay(date: Date, restDays: string[]): boolean {
  const key = REST_DAY_KEYS[date.getDay()];
  return restDays.includes(key);
}

function distributeContents(
  contents: { id: string; title: string }[],
  rule: PublishRule,
  startDate: Date,
): { date: string; time: string; contentId: string; contentTitle: string }[] {
  const result: { date: string; time: string; contentId: string; contentTitle: string }[] = [];
  const dailyCount = rule.dailyCount || 1;
  const timeSlots = rule.timeSlots.length > 0 ? rule.timeSlots : ['12:00'];
  const randomOffset = rule.randomOffsetMin || 0;

  let contentIdx = 0;
  let currentDate = new Date(startDate);

  while (contentIdx < contents.length) {
    // Skip rest days
    if (isRestDay(currentDate, rule.restDays)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dateStr = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`;

    for (let slotIdx = 0; slotIdx < dailyCount && contentIdx < contents.length; slotIdx++) {
      const baseTimeSlot = timeSlots[slotIdx % timeSlots.length];
      let time = baseTimeSlot;

      if (randomOffset > 0) {
        const offset = Math.floor(Math.random() * randomOffset * 2) - randomOffset;
        time = addMinutesToTime(baseTimeSlot, offset);
      }

      result.push({
        date: dateStr,
        time,
        contentId: contents[contentIdx].id,
        contentTitle: contents[contentIdx].title,
      });
      contentIdx++;
    }

    currentDate = addDays(currentDate, 1);
  }

  return result;
}

async function generateSchedule() {
  generating.value = true;

  // Simulate brief delay for UX feedback
  await new Promise((resolve) => setTimeout(resolve, 300));

  const tasks: ScheduledTaskRow[] = [];
  const startDate = addDays(new Date(), 1); // Start from tomorrow

  const selectedGroups = groupStore.groups.filter((g) => props.groupIds.includes(g.id));
  const selectedContents = contentStore.contents.filter((c) => props.contentIds.includes(c.id));

  for (const group of selectedGroups) {
    const contentsForGroup = selectedContents.map((c) => ({
      id: c.id,
      title: c.title,
    }));

    const distributed = distributeContents(contentsForGroup, group.publishRule, startDate);

    for (const item of distributed) {
      tasks.push({
        date: item.date,
        time: item.time,
        contentId: item.contentId,
        contentTitle: item.contentTitle,
        groupId: group.id,
        groupName: group.name,
        groupColor: group.color,
        accountIds: [...group.accountIds],
        accountCount: group.accountIds.length,
        publishMode: group.publishRule.publishMode,
        scheduledAt: `${item.date}T${item.time}:00`,
      });
    }
  }

  // Sort by date then time
  tasks.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  scheduledTasks.value = tasks;
  generating.value = false;
}

function handleConfirm() {
  const payload: ConfirmPayload[] = scheduledTasks.value.map((t) => ({
    contentId: t.contentId,
    groupId: t.groupId,
    accountIds: t.accountIds,
    scheduledAt: t.scheduledAt,
    publishMode: t.publishMode,
  }));
  emit('confirm', payload);
}
</script>

<style scoped>
.wizard-step-rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Header ── */
.wsrd-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.wsrd-header__summary {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.wsrd-header__summary strong {
  color: var(--color-primary);
}

/* ── Table ── */
.wsrd-table-wrap {
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.wsrd-date {
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-sm);
}

.wsrd-time {
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

/* ── Footer ── */
.wsrd-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-card);
  border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg);
}
</style>
