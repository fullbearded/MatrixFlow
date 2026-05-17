<template>
  <div class="group-card" :style="{ '--group-color': group.color }">
    <div class="group-card__header">
      <span class="group-card__dot" />
      <span class="group-card__name">{{ group.name }}</span>
      <span class="group-card__count">{{ group.accountIds.length }} 个账号</span>
    </div>

    <div class="group-card__body">
      <div class="group-card__info-row">
        <span class="group-card__label">发布时间</span>
        <span class="group-card__value">
          {{ group.publishRule.publishStartTime }} - {{ group.publishRule.publishEndTime }}
        </span>
      </div>
      <div class="group-card__info-row">
        <span class="group-card__label">发布间隔</span>
        <span class="group-card__value">{{ group.publishRule.intervalMinutes }} 分钟</span>
      </div>
      <div class="group-card__info-row">
        <span class="group-card__label">平台</span>
        <div class="group-card__platforms">
          <el-tag
            v-for="p in displayPlatforms"
            :key="p"
            size="small"
            effect="plain"
            class="group-card__platform-tag"
          >
            {{ platformLabel(p) }}
          </el-tag>
          <el-tag v-if="group.publishRule.platforms.length === 0" size="small" effect="plain">
            全部
          </el-tag>
        </div>
      </div>
    </div>

    <div class="group-card__footer">
      <el-button text size="small" @click.stop="$emit('edit', group)">
        <el-icon><Edit /></el-icon>
        编辑
      </el-button>
      <el-button text size="small" @click.stop="$emit('manageAccounts', group)">
        <el-icon><User /></el-icon>
        管理账号
      </el-button>
      <el-button text size="small" @click.stop="$emit('configRules', group)">
        <el-icon><Setting /></el-icon>
        发布规则
      </el-button>
      <el-popconfirm
        title="确定删除该分组？分组内的账号不会被删除。"
        @confirm="$emit('delete', group.id)"
      >
        <template #reference>
          <el-button text size="small" type="danger" @click.stop>
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </template>
      </el-popconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Edit, User, Setting, Delete } from '@element-plus/icons-vue';
import type { Group } from '@/renderer/stores/group';

const props = defineProps<{
  group: Group;
}>();

defineEmits<{
  edit: [group: Group];
  manageAccounts: [group: Group];
  configRules: [group: Group];
  delete: [id: string];
}>();

const platformMap: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  channels: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
};

function platformLabel(key: string): string {
  return platformMap[key] || key;
}

const displayPlatforms = computed(() => props.group.publishRule.platforms.slice(0, 3));
</script>

<style scoped>
.group-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.group-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--group-color, var(--color-primary-light));
}

.group-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.group-card__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--group-color);
  flex-shrink: 0;
  box-shadow: 0 0 6px color-mix(in srgb, var(--group-color) 40%, transparent);
}

.group-card__name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-card__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.group-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-page);
  border-radius: var(--border-radius-md);
}

.group-card__info-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.group-card__label {
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 56px;
}

.group-card__value {
  color: var(--color-text-primary);
}

.group-card__platforms {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.group-card__platform-tag {
  font-size: var(--font-size-xs);
}

.group-card__footer {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-light);
}
</style>
