<template>
  <header class="header">
    <div class="header__left">
      <h1 class="header__title">{{ currentTitle }}</h1>
    </div>

    <div class="header__right">
      <el-badge :value="taskStore.runningTasks.length" :hidden="taskStore.runningTasks.length === 0" :max="99">
        <el-button text @click="$router.push('/tasks')">
          <el-icon :size="18"><List /></el-icon>
        </el-button>
      </el-badge>

      <el-divider direction="vertical" />

      <div class="header__user">
        <el-avatar :size="30" class="header__avatar">
          <el-icon :size="16"><User /></el-icon>
        </el-avatar>
        <span class="header__username">管理员</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { List, User } from '@element-plus/icons-vue';
import { useTaskStore } from '@/renderer/stores/task';

const route = useRoute();
const taskStore = useTaskStore();

const currentTitle = computed(() => {
  return (route.meta?.title as string) ?? 'MatrixFlow';
});
</script>

<style scoped>
.header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.header__left {
  display: flex;
  align-items: center;
}

.header__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.header__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header__user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header__avatar {
  background: var(--color-primary);
  color: #fff;
}

.header__username {
  font-size: var(--font-size-sm);
  color: var(--color-text-regular);
}
</style>
