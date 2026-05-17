<template>
  <div class="loading">
    <el-icon class="loading__icon" :size="32"><Loading /></el-icon>
    <p class="loading__text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue';

withDefaults(defineProps<{ text?: string }>(), {
  text: '加载中...',
});
</script>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) 0;
  gap: var(--space-3);
}

.loading__icon {
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}

.loading__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
