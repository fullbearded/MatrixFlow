<template>
  <div class="wizard-step-content">
    <div class="wsc-header">
      <el-input
        v-model="searchQuery"
        placeholder="搜索内容..."
        prefix-icon="Search"
        clearable
        class="wsc-header__search"
      />
      <el-radio-group v-model="typeFilter" size="small">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="video">视频</el-radio-button>
        <el-radio-button value="image">图文</el-radio-button>
      </el-radio-group>
      <el-button type="primary" @click="handleUpload">
        <el-icon><Upload /></el-icon>
        上传新内容
      </el-button>
    </div>

    <div v-if="contentStore.loading" class="wsc-loading">
      <el-icon :size="24" class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="filteredContents.length > 0" class="wsc-grid">
      <div
        v-for="content in filteredContents"
        :key="content.id"
        class="wsc-card"
        :class="{ 'is-selected': isSelected(content.id) }"
        @click="toggleSelect(content.id)"
      >
        <el-checkbox
          :model-value="isSelected(content.id)"
          class="wsc-card__check"
          @click.stop
          @change="toggleSelect(content.id)"
        />
        <div class="wsc-card__thumb">
          <div v-if="content.thumbnail" class="wsc-card__image" :style="{ backgroundImage: `url(${content.thumbnail})` }" />
          <div v-else class="wsc-card__placeholder">
            <el-icon :size="28">
              <VideoCamera v-if="content.type === 'video'" />
              <Picture v-else />
            </el-icon>
          </div>
          <span v-if="content.duration" class="wsc-card__duration">{{ content.duration }}</span>
          <span class="wsc-card__type-badge">{{ typeLabel(content.type) }}</span>
        </div>
        <div class="wsc-card__body">
          <span class="wsc-card__title" :title="content.title">{{ content.title }}</span>
          <div class="wsc-card__meta">
            <el-tag
              :type="statusTagType(content.status)"
              size="small"
              effect="dark"
              round
            >
              {{ statusLabel(content.status) }}
            </el-tag>
            <span v-if="content.tags.length" class="wsc-card__tags">
              {{ content.tags.slice(0, 2).join('、') }}
              <template v-if="content.tags.length > 2">+{{ content.tags.length - 2 }}</template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无内容，请先上传" />

    <div class="wsc-footer">
      <span class="wsc-footer__count">已选择 <strong>{{ selected.length }}</strong> 条内容</span>
      <el-button type="primary" :disabled="selected.length === 0" @click="$emit('next')">
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Upload, VideoCamera, Picture, Loading } from '@element-plus/icons-vue';
import { useContentStore, type ContentItem } from '@/renderer/stores/content';

const props = defineProps<{
  selected: string[];
}>();

const emit = defineEmits<{
  'update:selected': [ids: string[]];
  next: [];
}>();

const contentStore = useContentStore();

const searchQuery = ref('');
const typeFilter = ref<'' | ContentItem['type']>('');

onMounted(() => {
  if (contentStore.contents.length === 0) {
    contentStore.fetchContents();
  }
});

const filteredContents = computed(() => {
  let list = contentStore.contents;

  if (typeFilter.value) {
    list = list.filter((c) => c.type === typeFilter.value);
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return list;
});

function isSelected(id: string): boolean {
  return props.selected.includes(id);
}

function toggleSelect(id: string) {
  const idx = props.selected.indexOf(id);
  const next = [...props.selected];
  if (idx >= 0) {
    next.splice(idx, 1);
  } else {
    next.push(id);
  }
  emit('update:selected', next);
}

const TYPE_LABELS: Record<string, string> = {
  video: '视频',
  image: '图文',
  article: '文章',
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

const STATUS_MAP: Record<string, { label: string; type: string }> = {
  draft: { label: '草稿', type: 'info' },
  ready: { label: '待发布', type: 'warning' },
  published: { label: '已发布', type: 'success' },
};

function statusLabel(status: string): string {
  return STATUS_MAP[status]?.label || status;
}

function statusTagType(status: string): string {
  return STATUS_MAP[status]?.type || 'info';
}

function handleUpload() {
  // UI trigger only — actual upload is handled by parent
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'video/*,image/*';
  input.click();
}
</script>

<style scoped>
.wizard-step-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Header ── */
.wsc-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.wsc-header__search {
  width: 240px;
}

/* ── Loading ── */
.wsc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-12) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* ── Grid ── */
.wsc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
  max-height: 420px;
  overflow-y: auto;
  padding: var(--space-1);
}

/* ── Card ── */
.wsc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  border: 2px solid transparent;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  overflow: hidden;
}

.wsc-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.wsc-card.is-selected {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.03);
}

.wsc-card__check {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: 2;
}

.wsc-card__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--color-bg-page);
  overflow: hidden;
}

.wsc-card__image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  transition: transform var(--transition-base);
}

.wsc-card:hover .wsc-card__image {
  transform: scale(1.03);
}

.wsc-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-placeholder);
  background: linear-gradient(135deg, var(--color-border-light) 0%, var(--color-bg-page) 100%);
}

.wsc-card__duration {
  position: absolute;
  bottom: var(--space-1);
  right: var(--space-2);
  padding: 1px var(--space-1);
  border-radius: var(--border-radius-sm);
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.wsc-card__type-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  padding: 1px var(--space-2);
  border-radius: var(--border-radius-sm);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  backdrop-filter: blur(4px);
}

.wsc-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  flex: 1;
}

.wsc-card__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wsc-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.wsc-card__tags {
  font-size: 10px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Footer ── */
.wsc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-card);
  border-radius: 0 0 var(--border-radius-lg) var(--border-radius-lg);
}

.wsc-footer__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.wsc-footer__count strong {
  color: var(--color-primary);
}
</style>
