<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MagicStick } from '@element-plus/icons-vue';
import type { AISuggestion } from '@/types/ai';
import type { RuleOptimizationResult } from '@/types/ai';

const props = defineProps<{
  groupId: string;
  groupName: string;
  currentRule: {
    timeSlots: string[];
    dailyCount: number;
    publishMode: string;
  };
}>();

const emit = defineEmits<{
  adopt: [suggestion: AISuggestion];
  dismiss: [suggestionId: string];
}>();

const suggestions = ref<AISuggestion[]>([]);
const loading = ref(true);
const dataRange = ref(0);

onMounted(async () => {
  try {
    loading.value = true;
    const result: RuleOptimizationResult = await window.matrixflow.ai.optimizeRule({
      groupId: props.groupId,
      historicalData: {
        publishRecords: [],
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 3600 * 1000),
          end: new Date(),
        },
      },
      currentRule: {
        dailyCount: props.currentRule.dailyCount,
        timeSlots: props.currentRule.timeSlots,
        randomOffsetMin: 5,
        publishMode: props.currentRule.publishMode as 'server' | 'client',
      },
    });
    suggestions.value = result.suggestions ?? [];
    if (result.optimizations) {
      dataRange.value = 30;
    }
  } catch {
    suggestions.value = [];
  } finally {
    loading.value = false;
  }
});

const visibleSuggestions = computed(() => suggestions.value);

function levelIcon(level: AISuggestion['level']): string {
  switch (level) {
    case 'strong':
      return '\uD83D\uDCCA';
    case 'weak':
      return '\uD83D\uDCA1';
    case 'warning':
      return '\u26A0\uFE0F';
  }
}

function levelClass(level: AISuggestion['level']): string {
  switch (level) {
    case 'strong':
      return 'is-strong';
    case 'weak':
      return 'is-weak';
    case 'warning':
      return 'is-warning';
  }
}

function adoptSuggestion(suggestion: AISuggestion) {
  emit('adopt', suggestion);
}

function dismissSuggestion(suggestionId: string) {
  suggestions.value = suggestions.value.filter((s) => s.id !== suggestionId);
  emit('dismiss', suggestionId);
}
</script>

<template>
  <Transition name="banner-slide">
    <div v-if="loading" class="ai-rule-banner">
      <div class="ai-rule-banner__header">
        <div class="ai-rule-banner__skeleton-header">
          <div class="skeleton-circle"></div>
          <div class="skeleton-bar skeleton-bar--sm"></div>
          <div class="skeleton-bar skeleton-bar--xs"></div>
        </div>
      </div>
      <div class="ai-rule-banner__list">
        <div v-for="i in 2" :key="i" class="ai-rule-banner__item ai-rule-banner__item--skeleton">
          <div class="suggestion-content">
            <div class="skeleton-circle skeleton-circle--sm"></div>
            <div class="skeleton-text-group">
              <div class="skeleton-bar skeleton-bar--md"></div>
              <div class="skeleton-bar skeleton-bar--lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="visibleSuggestions.length > 0" class="ai-rule-banner">
      <div class="ai-rule-banner__header">
        <div class="ai-rule-banner__title">
          <el-icon :size="18" color="#7c3aed"><MagicStick /></el-icon>
          <span class="ai-rule-banner__label">AI 规则优化建议</span>
          <span class="ai-rule-banner__group">{{ groupName }}</span>
        </div>
        <el-tag v-if="dataRange > 0" size="small" type="info">
          基于 {{ dataRange }} 天数据
        </el-tag>
      </div>

      <div class="ai-rule-banner__list">
        <div
          v-for="suggestion in visibleSuggestions"
          :key="suggestion.id"
          class="ai-rule-banner__item"
          :class="levelClass(suggestion.level)"
        >
          <div class="suggestion-content">
            <span class="suggestion-icon">{{ levelIcon(suggestion.level) }}</span>
            <div class="suggestion-text">
              <p class="suggestion-title">{{ suggestion.title }}</p>
              <p class="suggestion-desc">{{ suggestion.description }}</p>
            </div>
          </div>
          <div class="suggestion-actions">
            <el-button
              v-if="suggestion.action"
              size="small"
              type="primary"
              @click="adoptSuggestion(suggestion)"
            >
              采纳
            </el-button>
            <el-button size="small" @click="dismissSuggestion(suggestion.id)">
              忽略
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Banner container ── */
.ai-rule-banner {
  background-color: #f5f3ff;
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: 1px solid #ede9fe;
}

/* ── Header ── */
.ai-rule-banner__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.ai-rule-banner__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ai-rule-banner__label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.ai-rule-banner__group {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background-color: rgba(124, 58, 237, 0.08);
  padding: 2px var(--space-2);
  border-radius: var(--border-radius-sm);
}

/* ── Suggestion list ── */
.ai-rule-banner__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* ── Suggestion item ── */
.ai-rule-banner__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background-color: #ffffff;
  border-radius: var(--border-radius-sm);
  border-left: 3px solid var(--color-border);
  transition: box-shadow var(--transition-fast);
}

.ai-rule-banner__item:hover {
  box-shadow: var(--shadow-sm);
}

.ai-rule-banner__item.is-strong {
  border-left-color: #7c3aed;
}

.ai-rule-banner__item.is-weak {
  border-left-color: #8c8c8c;
}

.ai-rule-banner__item.is-warning {
  border-left-color: #cf1322;
}

/* ── Suggestion content ── */
.suggestion-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.suggestion-icon {
  flex-shrink: 0;
  font-size: var(--font-size-lg);
  line-height: 1;
  margin-top: 2px;
}

.suggestion-text {
  flex: 1;
  min-width: 0;
}

.suggestion-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.4;
}

.suggestion-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 4px 0 0 0;
  line-height: 1.5;
}

/* ── Actions ── */
.suggestion-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* ── Transition ── */
.banner-slide-enter-active {
  transition: all var(--transition-base);
}

.banner-slide-leave-active {
  transition: all var(--transition-fast);
}

.banner-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.banner-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Loading skeletons ── */
.ai-rule-banner__skeleton-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.skeleton-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(90deg, #ede9fe 25%, #e0dbff 50%, #ede9fe 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-circle--sm {
  width: 20px;
  height: 20px;
}

.skeleton-bar {
  height: 14px;
  border-radius: var(--border-radius-sm);
  background: linear-gradient(90deg, #ede9fe 25%, #e0dbff 50%, #ede9fe 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-bar--xs {
  width: 64px;
}

.skeleton-bar--sm {
  width: 120px;
}

.skeleton-bar--md {
  width: 140px;
  height: 13px;
  margin-bottom: 6px;
}

.skeleton-bar--lg {
  width: 200px;
  height: 12px;
}

.ai-rule-banner__item--skeleton {
  border-left-color: #ede9fe;
}

.skeleton-text-group {
  display: flex;
  flex-direction: column;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
