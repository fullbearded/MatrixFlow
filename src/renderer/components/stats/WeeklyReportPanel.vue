<template>
  <div class="weekly-report-panel">
    <!-- Header -->
    <div class="report-header">
      <div class="report-header__left">
        <h2 class="report-header__title">AI 运营周报</h2>
        <span v-if="currentReport" class="report-header__meta">
          {{ formatDate(currentReport.period.start) }} ~ {{ formatDate(currentReport.period.end) }}
        </span>
      </div>
      <el-button
        type="primary"
        :loading="generating"
        @click="generateReport"
      >
        <el-icon v-if="!generating"><Document /></el-icon>
        {{ generating ? '生成中...' : '生成新周报' }}
      </el-button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="report-loading">
      <el-icon class="is-loading" :size="32" color="var(--color-primary)"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!currentReport" class="report-empty">
      <el-icon :size="64" color="var(--color-text-placeholder)"><Document /></el-icon>
      <h3 class="report-empty__title">还没有周报</h3>
      <p class="report-empty__desc">AI 将根据你的发布数据自动生成运营分析周报</p>
      <el-button type="primary" size="large" @click="generateReport" :loading="generating">
        生成第一份周报
      </el-button>
    </div>

    <!-- Report Content -->
    <div v-else class="report-content">
      <!-- Highlights -->
      <div v-if="currentReport.highlights?.length" class="report-highlights">
        <h3 class="report-section__title">本周亮点</h3>
        <ul class="report-highlights__list">
          <li
            v-for="(item, idx) in currentReport.highlights"
            :key="idx"
            class="report-highlights__item"
          >
            <el-icon color="var(--color-primary)" :size="14"><Star /></el-icon>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>

      <!-- Generated time -->
      <div class="report-meta">
        <el-icon :size="14" color="var(--color-text-secondary)"><Clock /></el-icon>
        <span>生成时间：{{ formatDateTime(currentReport.generatedAt) }}</span>
      </div>

      <!-- Report body -->
      <div class="report-body" v-html="renderedContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Document, Loading, Star, Clock } from '@element-plus/icons-vue';
import DOMPurify from 'dompurify';

interface WeeklyReport {
  id: string;
  title: string;
  content: string;
  generatedAt: string;
  period: { start: string; end: string };
  highlights: string[];
}

const loading = ref(false);
const generating = ref(false);
const currentReport = ref<WeeklyReport | null>(null);

onMounted(async () => {
  await fetchLatestReport();
});

async function fetchLatestReport() {
  if (!window.matrixflow) return;
  loading.value = true;
  try {
    const report = await window.matrixflow.report.getLatest();
    if (report) {
      currentReport.value = report as WeeklyReport;
    }
  } finally {
    loading.value = false;
  }
}

async function generateReport() {
  if (!window.matrixflow) return;
  generating.value = true;
  try {
    const report = await window.matrixflow.report.generate();
    if (report) {
      currentReport.value = report as WeeklyReport;
      ElMessage.success('周报生成成功');
    }
  } catch (e: any) {
    ElMessage.error(`生成失败: ${e.message || '未知错误'}`);
  } finally {
    generating.value = false;
  }
}

/** Simple markdown → HTML (sanitized via DOMPurify) */
const renderedContent = computed(() => {
  if (!currentReport.value?.content) return '';
  const raw = currentReport.value.content;
  const html = raw
    .split('\n')
    .map((line: string) => {
      // Headers
      if (line.startsWith('### ')) return `<h4 class="md-h4">${line.slice(4)}</h4>`;
      if (line.startsWith('## ')) return `<h3 class="md-h3">${line.slice(3)}</h3>`;
      if (line.startsWith('# ')) return `<h2 class="md-h2">${line.slice(2)}</h2>`;
      // Horizontal rule
      if (line.trim() === '---') return '<hr class="md-hr" />';
      // Unordered list
      if (line.startsWith('- ')) return `<li class="md-li">${inlineFormat(line.slice(2))}</li>`;
      // Numbered list
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (olMatch) return `<li class="md-li">${inlineFormat(olMatch[2])}</li>`;
      // Empty line
      if (line.trim() === '') return '<br />';
      // Paragraph
      return `<p class="md-p">${inlineFormat(line)}</p>`;
    })
    .join('\n');
  return DOMPurify.sanitize(html);
});

function inlineFormat(text: string): string {
  // Bold
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.weekly-report-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.report-header__left {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.report-header__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.report-header__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Loading */
.report-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* Empty State */
.report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-12) 0;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
}

.report-empty__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-regular);
}

.report-empty__desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Report Content */
.report-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.report-section__title {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* Highlights */
.report-highlights__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.report-highlights__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  color: var(--color-text-regular);
  line-height: var(--line-height-base);
}

/* Meta */
.report-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Markdown Rendered Body */
.report-body {
  font-size: var(--font-size-base);
  color: var(--color-text-regular);
  line-height: var(--line-height-base);
}

.report-body :deep(.md-h2) {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.report-body :deep(.md-h3) {
  margin: var(--space-3) 0 var(--space-2);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.report-body :deep(.md-h4) {
  margin: var(--space-2) 0 var(--space-1);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.report-body :deep(.md-p) {
  margin: var(--space-1) 0;
}

.report-body :deep(.md-li) {
  margin: var(--space-1) 0;
  padding-left: var(--space-4);
  position: relative;
}

.report-body :deep(.md-li)::before {
  content: '•';
  position: absolute;
  left: var(--space-1);
  color: var(--color-text-secondary);
}

.report-body :deep(.md-hr) {
  border: none;
  border-top: 1px solid var(--color-border-light);
  margin: var(--space-4) 0;
}

.report-body :deep(strong) {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
</style>
