<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar__brand">
      <div class="sidebar__logo">M</div>
      <transition name="fade-text">
        <span v-if="!collapsed" class="sidebar__title">MatrixFlow</span>
      </transition>
    </div>

    <nav class="sidebar__nav">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="sidebar__item"
        :class="{ 'sidebar__item--active': isActive(item.path) }"
      >
        <el-icon :size="20"><component :is="item.icon" /></el-icon>
        <transition name="fade-text">
          <span v-if="!collapsed" class="sidebar__label">{{ item.label }}</span>
        </transition>
      </router-link>
    </nav>

    <div class="sidebar__footer">
      <button class="sidebar__toggle" @click="collapsed = !collapsed">
        <el-icon :size="18">
          <Fold v-if="!collapsed" />
          <Expand v-else />
        </el-icon>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  User,
  Folder,
  Calendar,
  List,
  Grid,
  DataLine,
  Setting,
  Fold,
  Expand,
} from '@element-plus/icons-vue';

interface MenuItem {
  path: string;
  label: string;
  icon: typeof User;
}

const menuItems: MenuItem[] = [
  { path: '/accounts', label: '账号管理', icon: User },
  { path: '/content', label: '内容库', icon: Folder },
  { path: '/publish', label: '发布管理', icon: Calendar },
  { path: '/tasks', label: '任务管理', icon: List },
  { path: '/groups', label: '分组管理', icon: Grid },
  { path: '/stats', label: '数据中心', icon: DataLine },
  { path: '/settings', label: '设置', icon: Setting },
];

const route = useRoute();
const collapsed = ref(false);

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-sidebar);
  transition: width var(--transition-base);
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar--collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  height: var(--header-height);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sidebar__logo {
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-md);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: var(--font-weight-bold, 700);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.sidebar__title {
  color: var(--color-text-sidebar-active);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.sidebar__nav {
  flex: 1;
  padding: var(--space-3) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--border-radius-md);
  color: var(--color-text-sidebar);
  text-decoration: none;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.sidebar__item:hover {
  color: var(--color-text-sidebar-active);
  background: rgba(255, 255, 255, 0.05);
}

.sidebar__item--active {
  color: var(--color-primary-light);
  background: var(--color-bg-sidebar-active);
}

.sidebar__item--active:hover {
  background: var(--color-bg-sidebar-active);
}

.sidebar__label {
  font-size: var(--font-size-sm);
}

.sidebar__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sidebar__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  border-radius: var(--border-radius-md);
  color: var(--color-text-sidebar);
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar__toggle:hover {
  color: var(--color-text-sidebar-active);
  background: rgba(255, 255, 255, 0.05);
}

.fade-text-enter-active,
.fade-text-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-text-enter-from,
.fade-text-leave-to {
  opacity: 0;
}
</style>
