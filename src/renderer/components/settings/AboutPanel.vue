<template>
  <div class="about-panel">
    <div class="about-panel__logo">
      <span class="about-panel__logo-icon">M</span>
      <span class="about-panel__logo-text">MatrixFlow</span>
    </div>

    <div class="about-panel__info">
      <div class="about-panel__row">
        <span class="about-panel__label">版本</span>
        <span class="about-panel__value">{{ version }}</span>
      </div>
      <div class="about-panel__row">
        <span class="about-panel__label">构建日期</span>
        <span class="about-panel__value">{{ buildDate }}</span>
      </div>
      <div class="about-panel__row">
        <span class="about-panel__label">Electron</span>
        <span class="about-panel__value">{{ electronVersion }}</span>
      </div>
      <div class="about-panel__row">
        <span class="about-panel__label">Chrome</span>
        <span class="about-panel__value">{{ chromeVersion }}</span>
      </div>
      <div class="about-panel__row">
        <span class="about-panel__label">数据目录</span>
        <span class="about-panel__value about-panel__path">{{ dataDir }}</span>
      </div>
    </div>

    <el-divider />

    <div class="about-panel__links">
      <el-button text @click="openLink('https://github.com/matrixflow')">
        <el-icon><Link /></el-icon>
        GitHub
      </el-button>
      <el-button text @click="openLink('https://matrixflow.dev/docs')">
        <el-icon><Document /></el-icon>
        文档
      </el-button>
      <el-button text @click="openLink('https://matrixflow.dev/changelog')">
        <el-icon><Memo /></el-icon>
        更新日志
      </el-button>
    </div>

    <div class="about-panel__copyright">
      &copy; {{ new Date().getFullYear() }} MatrixFlow. All rights reserved.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Link, Document, Memo } from '@element-plus/icons-vue';

const version = ref('0.1.0');
const buildDate = ref('2026-05-16');
const electronVersion = ref('33.0.0');
const chromeVersion = ref('130.0.0');
const dataDir = ref('');

onMounted(async () => {
  if (!window.matrixflow) return;
  try {
    const dir = await window.matrixflow.settings.get('dataDir');
    if (dir) dataDir.value = String(dir);
  } catch {
    /* ignore */
  }
});

function openLink(url: string) {
  window.open(url, '_blank');
}
</script>

<style scoped>
.about-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6) 0;
}

.about-panel__logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.about-panel__logo-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-lg);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-semibold);
}

.about-panel__logo-text {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.about-panel__info {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.about-panel__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-sm);
}

.about-panel__row:nth-child(odd) {
  background: var(--color-bg-page);
}

.about-panel__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.about-panel__value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.about-panel__path {
  font-family: monospace;
  font-size: var(--font-size-xs);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.about-panel__links {
  display: flex;
  gap: var(--space-2);
}

.about-panel__copyright {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}
</style>
