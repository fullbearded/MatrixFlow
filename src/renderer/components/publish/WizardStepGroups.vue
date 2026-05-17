<template>
  <div class="wizard-step-groups">
    <p class="wsg-description">选择要发布到的分组（可多选，内容将分发到所选分组下的所有账号）</p>

    <div v-if="groupStore.loading" class="wsg-loading">
      <el-icon :size="24" class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="groups.length > 0" class="wsg-grid">
      <div
        v-for="group in groups"
        :key="group.id"
        class="wsg-card"
        :class="{ 'is-selected': isSelected(group.id) }"
        :style="{ '--group-color': group.color }"
        @click="toggleSelect(group.id)"
      >
        <el-checkbox
          :model-value="isSelected(group.id)"
          class="wsg-card__check"
          @click.stop
          @change="toggleSelect(group.id)"
        />
        <div class="wsg-card__dot" />
        <div class="wsg-card__body">
          <div class="wsg-card__header">
            <span class="wsg-card__name">{{ group.name }}</span>
            <span class="wsg-card__count">{{ group.accountIds.length }} 个账号</span>
          </div>
          <div class="wsg-card__rule">
            <div class="wsg-card__rule-row">
              <span class="wsg-card__rule-label">发布节奏</span>
              <span class="wsg-card__rule-value">{{ group.publishRule.dailyCount }} 条/天</span>
            </div>
            <div class="wsg-card__rule-row">
              <span class="wsg-card__rule-label">时间槽</span>
              <span class="wsg-card__rule-value">{{ formatTimeSlots(group.publishRule.timeSlots) }}</span>
            </div>
            <div class="wsg-card__rule-row">
              <span class="wsg-card__rule-label">发布方式</span>
              <span class="wsg-card__rule-value">{{ group.publishRule.publishMode === 'server' ? '服务端发布' : '客户端直发' }}</span>
            </div>
          </div>
          <div v-if="group.publishRule.platforms.length > 0" class="wsg-card__platforms">
            <el-tag
              v-for="p in group.publishRule.platforms.slice(0, 4)"
              :key="p"
              size="small"
              effect="plain"
              round
            >
              {{ platformLabel(p) }}
            </el-tag>
            <el-tag v-if="group.publishRule.platforms.length > 4" size="small" effect="plain" round>
              +{{ group.publishRule.platforms.length - 4 }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无分组，请先创建分组" />

    <div class="wsg-footer">
      <el-button @click="$emit('prev')">上一步</el-button>
      <span class="wsg-footer__count">已选择 <strong>{{ selected.length }}</strong> 个分组</span>
      <el-button type="primary" :disabled="selected.length === 0" @click="$emit('next')">
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { useGroupStore } from '@/renderer/stores/group';

const props = defineProps<{
  contentIds: string[];
  selected: string[];
}>();

const emit = defineEmits<{
  'update:selected': [ids: string[]];
  prev: [];
  next: [];
}>();

const groupStore = useGroupStore();

const groups = groupStore.groups;

onMounted(() => {
  if (groupStore.groups.length === 0) {
    groupStore.fetchGroups();
  }
});

function isSelected(id: string): boolean {
  return props.selected.includes(id);
}

function toggleSelect(id: string) {
  const idx = props.selected.indexOf(id);
  const next = [...props.selected];
  if (idx >= 0) {
    next.splice(idx, 1);
  } else {
    next.push(id);
  }
  emit('update:selected', next);
}

function formatTimeSlots(slots: string[]): string {
  if (slots.length === 0) return '未设置';
  if (slots.length <= 3) return slots.join(' / ');
  return `${slots.slice(0, 3).join(' / ')} +${slots.length - 3}`;
}

const PLATFORM_MAP: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  channels: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
};

function platformLabel(key: string): string {
  return PLATFORM_MAP[key] || key;
}
</script>

<style scoped>
.wizard-step-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.wsg-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

/* ── Loading ── */
.wsg-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-12) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* ── Grid ── */
.wsg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
  max-height: 420px;
  overflow-y: auto;
  padding: var(--space-1);
}

/* ── Card ── */
.wsg-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  border: 2px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.wsg-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--group-color, var(--color-primary-light));
}

.wsg-card.is-selected {
  border-color: var(--group-color, var(--color-primary));
  background: color-mix(in srgb, var(--group-color, var(--color-primary)) 4%, var(--color-bg-card));
}

.wsg-card__check {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 2;
}

.wsg-card__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--group-color);
  flex-shrink: 0;
  margin-top: 5px;
  box-shadow: 0 0 6px color-mix(in srgb, var(--group-color) 40%, transparent);
}

.wsg-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.wsg-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.wsg-card__name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wsg-card__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.wsg-card__rule {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-page);
  border-radius: var(--border-radius-md);
}

.wsg-card__rule-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.wsg-card__rule-label {
  color: var(--color-text-secondary);
  min-width: 56px;
  flex-shrink: 0;
}

.wsg-card__rule-value {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wsg-card__platforms {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

/* ── Footer ── */
.wsg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-card);
  border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg);
}

.wsg-footer__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.wsg-footer__count strong {
  color: var(--color-primary);
}
</style>
