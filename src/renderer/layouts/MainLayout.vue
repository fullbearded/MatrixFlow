<template>
  <div class="main-layout">
    <Sidebar />
    <div class="main-layout__body">
      <Header />
      <main class="main-layout__content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '@/renderer/components/Sidebar.vue';
import Header from '@/renderer/components/Header.vue';
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.main-layout__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-layout__content {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
  background: var(--color-bg-page);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
