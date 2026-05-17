<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import AISuggestionCard from './AISuggestionCard.vue';
import type { AISuggestion, PrePublishCheckResult } from '@/types/ai';

const props = defineProps<{
  groupId: string;
  groupName: string;
  contentIds: string[];
  accounts: Array<{
    id: string;
    platform: string;
    nickname: string;
    cookieStatus: 'valid' | 'invalid' | 'expiring';
    lastPublishAt?: Date;
  }>;
  scheduleSlots: Array<{
    time: Date;
    contentId: string;
    accountIds: string[];
  }>;
  rule: {
    dailyCount: number;
    timeSlots: string[];
    randomOffsetMin: number;
    publishMode: 'server' | 'client';
  };
}>();

const emit = defineEmits<{
  'update:slots': [slots: typeof props.scheduleSlots];
  confirmed: [];
}>();

const loading = ref(false);
const checkResult = ref<PrePublishCheckResult | null>(null);
const adoptedSuggestions = ref<Set<string>>(new Set());
const dismissedSuggestions = ref<Set<string>>(new Set());

const visibleSuggestions = computed(() => {
  if (!checkResult.value) return [];
  return checkResult.value.suggestions.filter(
    s => !adoptedSuggestions.value.has(s.id) && !dismissedSuggestions.value.has(s.id)
  );
});

const hasWarnings = computed(() => {
  return visibleSuggestions.value.some(s => s.level === 'warning');
});

const canConfirm = computed(() => {
  if (!checkResult.value) return true;
  return !hasWarnings.value || adoptedSuggestions.value.size > 0;
});

async function runCheck() {
  loading.value = true;
  try {
    const result = await window.matrixflow.ai.prePublishCheck({
      groupId: props.groupId,
      groupName: props.groupName,
      contentIds: props.contentIds,
      accounts: props.accounts,
      scheduleSlots: props.scheduleSlots,
      rule: props.rule,
    });
    checkResult.value = result;
  } catch (error) {
    console.error('AI pre-publish check failed:', error);
    checkResult.value = {
      suggestions: [],
      checks: {
        scheduleReasonable: true,
        accountHealth: true,
        historicalDataAvailable: false,
        conflictsDetected: false,
      },
    };
  } finally {
    loading.value = false;
  }
}

function handleAdopt(suggestion: AISuggestion) {
  adoptedSuggestions.value.add(suggestion.id);
  if (suggestion.data?.adjustedSlots) {
    emit('update:slots', suggestion.data.adjustedSlots as typeof props.scheduleSlots);
  }
}

function handleDismiss(suggestion: AISuggestion) {
  dismissedSuggestions.value.add(suggestion.id);
}

function handleConfirm() {
  emit('confirmed');
}

onMounted(() => {
  runCheck();
});
</script>

<template>
  <div class="ai-check-panel">
    <div class="panel-header">
      <h3>AI 预发布检查</h3>
      <el-button
        v-if="!loading"
        size="small"
        :icon="RefreshRight"
        @click="runCheck"
      >
        重新检查
      </el-button>
    </div>

    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>AI 正在分析发布计划...</span>
    </div>

    <div v-else-if="!checkResult" class="empty-state">
      <span>点击"重新检查"开始 AI 分析</span>
    </div>

    <div v-else class="check-content">
      <div v-if="visibleSuggestions.length === 0" class="all-clear">
        <el-icon><CircleCheck /></el-icon>
        <span>所有检查通过，可以发布</span>
      </div>

      <div v-else class="suggestions-list">
        <AISuggestionCard
          v-for="suggestion in visibleSuggestions"
          :key="suggestion.id"
          :suggestion="suggestion"
          @adopt="handleAdopt"
          @dismiss="handleDismiss"
        />
      </div>

      <div class="check-summary">
        <div class="summary-item">
          <span class="label">排期合理</span>
          <el-icon :class="checkResult.checks.scheduleReasonable ? 'success' : 'error'">
            <CircleCheck v-if="checkResult.checks.scheduleReasonable" />
            <CircleClose v-else />
          </el-icon>
        </div>
        <div class="summary-item">
          <span class="label">账号健康</span>
          <el-icon :class="checkResult.checks.accountHealth ? 'success' : 'error'">
            <CircleCheck v-if="checkResult.checks.accountHealth" />
            <CircleClose v-else />
          </el-icon>
        </div>
        <div class="summary-item">
          <span class="label">历史数据</span>
          <el-icon :class="checkResult.checks.historicalDataAvailable ? 'success' : 'warning'">
            <CircleCheck v-if="checkResult.checks.historicalDataAvailable" />
            <Warning v-else />
          </el-icon>
        </div>
      </div>

      <div class="confirm-actions">
        <el-button
          type="primary"
          size="large"
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          {{ canConfirm ? '确认发布' : '请先处理异常提醒' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { RefreshRight, Loading, CircleCheck, CircleClose, Warning } from '@element-plus/icons-vue';
export default {
  components: { RefreshRight, Loading, CircleCheck, CircleClose, Warning },
};
</script>

<style scoped>
.ai-check-panel {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: #262626;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: #8c8c8c;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #8c8c8c;
}

.check-content {
  min-height: 200px;
}

.all-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: #52c41a;
  font-size: 16px;
}

.suggestions-list {
  margin-bottom: 20px;
}

.check-summary {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-item .label {
  color: #595959;
  font-size: 14px;
}

.summary-item .success {
  color: #52c41a;
}

.summary-item .error {
  color: #cf1322;
}

.summary-item .warning {
  color: #faad14;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}
</style>
