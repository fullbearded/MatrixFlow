<template>
  <div class="empty">
    <el-icon class="empty__icon" :size="48"><Box /></el-icon>
    <p class="empty__text">{{ text }}</p>
    <el-button v-if="actionLabel" type="primary" @click="$emit('action')">
      {{ actionLabel }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Box } from '@element-plus/icons-vue';

withDefaults(defineProps<{
  text?: string;
  actionLabel?: string;
}>(), {
  text: '暂无数据',
});

defineEmits<{
  action: [];
}>();
</script>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) 0;
  gap: var(--space-4);
}

.empty__icon {
  color: var(--color-text-placeholder);
}

.empty__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}
</style>
