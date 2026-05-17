<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
      @click.stop
    >
      <template v-if="task">
        <div class="context-menu__item" @click="emit('action', 'view-detail')">
          <el-icon><View /></el-icon>
          <span>查看详情</span>
        </div>
        <div class="context-menu__item" @click="emit('action', 'replace-content')">
          <el-icon><Switch /></el-icon>
          <span>替换内容</span>
        </div>
        <div class="context-menu__item" @click="emit('action', 'exclude-account')">
          <el-icon><Remove /></el-icon>
          <span>排除账号</span>
        </div>
        <div class="context-menu__divider" />
        <div class="context-menu__item context-menu__item--danger" @click="emit('action', 'delete')">
          <el-icon><Delete /></el-icon>
          <span>删除任务</span>
        </div>
      </template>
      <template v-else>
        <div class="context-menu__item" @click="emit('action', 'add-task')">
          <el-icon><Plus /></el-icon>
          <span>添加任务</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { View, Switch, Remove, Delete, Plus } from '@element-plus/icons-vue';

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  task?: { id: string; contentTitle: string } | null;
}>();

const emit = defineEmits<{
  action: [action: ContextMenuAction];
  close: [];
}>();

export type ContextMenuAction =
  | 'view-detail'
  | 'replace-content'
  | 'exclude-account'
  | 'delete'
  | 'add-task';

const adjustedX = computed(() => {
  const menuWidth = 180;
  return props.x + menuWidth > window.innerWidth
    ? props.x - menuWidth
    : props.x;
});

const adjustedY = computed(() => {
  const menuHeight = props.task ? 200 : 48;
  return props.y + menuHeight > window.innerHeight
    ? props.y - menuHeight
    : props.y;
});

function handleClickOutside() {
  if (props.visible) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  padding: var(--space-1) 0;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-light);
}

.context-menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-regular);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.context-menu__item:hover {
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.context-menu__item--danger {
  color: var(--color-danger);
}

.context-menu__item--danger:hover {
  background: rgba(245, 108, 108, 0.06);
  color: var(--color-danger);
}

.context-menu__divider {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--color-border-light);
}
</style>
