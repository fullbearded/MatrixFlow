<script setup lang="ts">
import { computed } from 'vue';
import type { AISuggestion } from '@/types/ai';

const props = defineProps<{
  suggestion: AISuggestion;
}>();

const emit = defineEmits<{
  adopt: [suggestion: AISuggestion];
  dismiss: [suggestion: AISuggestion];
}>();

const levelConfig = computed(() => {
  switch (props.suggestion.level) {
    case 'strong':
      return {
        color: '#722ed1',
        backgroundColor: '#f9f0ff',
        borderColor: '#d3adf7',
        icon: '💡',
        label: '强建议',
      };
    case 'weak':
      return {
        color: '#8c8c8c',
        backgroundColor: '#fafafa',
        borderColor: '#d9d9d9',
        icon: '💭',
        label: '弱建议',
      };
    case 'warning':
      return {
        color: '#cf1322',
        backgroundColor: '#fff1f0',
        borderColor: '#ffa39e',
        icon: '⚠️',
        label: '异常提醒',
      };
  }
});

const sourceLabel = computed(() => {
  switch (props.suggestion.source) {
    case 'llm':
      return 'AI 分析';
    case 'rules':
      return '规则检测';
    case 'cache':
      return '缓存';
  }
});

function handleAdopt() {
  emit('adopt', props.suggestion);
}

function handleDismiss() {
  emit('dismiss', props.suggestion);
}
</script>

<template>
  <div
    class="ai-suggestion-card"
    :style="{
      backgroundColor: levelConfig.backgroundColor,
      borderColor: levelConfig.borderColor,
    }"
  >
    <div class="suggestion-header">
      <span class="level-badge" :style="{ backgroundColor: levelConfig.color }">
        {{ levelConfig.icon }} {{ levelConfig.label }}
      </span>
      <span class="source-tag">{{ sourceLabel }}</span>
    </div>

    <div class="suggestion-body">
      <h4 class="suggestion-title" :style="{ color: levelConfig.color }">
        {{ suggestion.title }}
      </h4>
      <p class="suggestion-desc">{{ suggestion.description }}</p>

      <div v-if="suggestion.action" class="suggestion-action">
        <span class="action-label">建议操作：</span>
        <span class="action-text">{{ suggestion.action }}</span>
      </div>
    </div>

    <div class="suggestion-footer">
      <div class="confidence-bar">
        <span class="confidence-label">置信度</span>
        <div class="confidence-track">
          <div
            class="confidence-fill"
            :style="{
              width: `${suggestion.confidence * 100}%`,
              backgroundColor: levelConfig.color,
            }"
          />
        </div>
        <span class="confidence-value">{{ Math.round(suggestion.confidence * 100) }}%</span>
      </div>

      <div class="action-buttons">
        <el-button size="small" @click="handleDismiss">忽略</el-button>
        <el-button
          size="small"
          type="primary"
          :style="{ backgroundColor: levelConfig.color, borderColor: levelConfig.color }"
          @click="handleAdopt"
        >
          采纳并重排
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-suggestion-card {
  border-radius: 8px;
  border: 1px solid;
  padding: 16px;
  margin-bottom: 12px;
}

.suggestion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.level-badge {
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.source-tag {
  color: #8c8c8c;
  font-size: 12px;
}

.suggestion-body {
  margin-bottom: 16px;
}

.suggestion-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.suggestion-desc {
  color: #595959;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.suggestion-action {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
}

.action-label {
  color: #8c8c8c;
  font-size: 12px;
}

.action-text {
  color: #262626;
  font-size: 14px;
  font-weight: 500;
}

.suggestion-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.confidence-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.confidence-label {
  color: #8c8c8c;
  font-size: 12px;
}

.confidence-track {
  width: 60px;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.confidence-value {
  color: #595959;
  font-size: 12px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 8px;
}
</style>
