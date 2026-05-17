<template>
  <div
    class="content-card"
    :class="{
      'content-card--selected': selected,
      'content-card--published': content.status === 'published',
    }"
    @click="$emit('select', content.id)"
  >
    <div class="content-card__thumb">
      <el-checkbox
        :model-value="selected"
        class="content-card__checkbox"
        @click.stop
        @change="$emit('select', content.id)"
      />

      <div v-if="content.thumbnail" class="content-card__image" :style="{ backgroundImage: `url(${content.thumbnail})` }" />
      <div v-else class="content-card__placeholder">
        <el-icon :size="32"><VideoCamera v-if="content.type === 'video'" /><Picture v-else /></el-icon>
      </div>

      <span v-if="content.duration" class="content-card__duration">
        {{ content.duration }}
      </span>

      <div class="content-card__type-badge">
        {{ typeLabel }}
      </div>
    </div>

    <div class="content-card__body">
      <h4 class="content-card__title" :title="content.title">{{ content.title }}</h4>

      <p v-if="content.description" class="content-card__desc">{{ content.description }}</p>

      <div v-if="content.tags.length" class="content-card__tags">
        <el-tag
          v-for="tag in displayTags"
          :key="tag"
          size="small"
          effect="plain"
          round
          class="content-card__tag"
        >
          {{ tag }}
        </el-tag>
        <span v-if="content.tags.length > 3" class="content-card__tag-more">+{{ content.tags.length - 3 }}</span>
      </div>

      <div class="content-card__footer">
        <el-tag :type="statusTagType" size="small" effect="dark" round>
          {{ statusLabel }}
        </el-tag>
        <span class="content-card__date">{{ formatDate }}</span>
      </div>
    </div>

    <div class="content-card__actions" @click.stop>
      <el-tooltip content="编辑" placement="top">
        <el-button text size="small" @click="$emit('edit', content)">
          <el-icon><Edit /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip v-if="content.status === 'ready'" content="发布" placement="top">
        <el-button text size="small" type="primary" @click="$emit('publish', content)">
          <el-icon><Promotion /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip v-else-if="content.status === 'published'" content="查看" placement="top">
        <el-button text size="small" @click="$emit('view', content)">
          <el-icon><View /></el-icon>
        </el-button>
      </el-tooltip>
      <el-popconfirm title="确定删除该内容？" @confirm="$emit('delete', content.id)">
        <template #reference>
          <el-button text size="small" type="danger">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-popconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Edit,
  Delete,
  Promotion,
  View,
  VideoCamera,
  Picture,
} from '@element-plus/icons-vue';
import type { ContentItem } from '@/renderer/stores/content';

const props = defineProps<{
  content: ContentItem;
  selected?: boolean;
}>();

defineEmits<{
  select: [id: string];
  edit: [content: ContentItem];
  publish: [content: ContentItem];
  view: [content: ContentItem];
  delete: [id: string];
}>();

const typeMap: Record<string, string> = {
  video: '视频',
  image: '图片',
  article: '文章',
};

const statusMap: Record<string, { label: string; type: string }> = {
  draft: { label: '草稿', type: 'info' },
  ready: { label: '待发布', type: 'warning' },
  published: { label: '已发布', type: 'success' },
};

const typeLabel = computed(() => typeMap[props.content.type] || props.content.type);
const statusLabel = computed(() => statusMap[props.content.status]?.label || props.content.status);
const statusTagType = computed(() => statusMap[props.content.status]?.type || 'info');
const displayTags = computed(() => props.content.tags.slice(0, 3));
const formatDate = computed(() => {
  const d = new Date(props.content.createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return d.toLocaleDateString('zh-CN');
});
</script>

<style scoped>
.content-card {
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

.content-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.content-card:hover .content-card__actions {
  opacity: 1;
  transform: translateY(0);
}

.content-card--selected {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.03);
}

.content-card--published {
  opacity: 0.85;
}

/* ── Thumbnail ── */
.content-card__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--color-bg-page);
  overflow: hidden;
}

.content-card__image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  transition: transform var(--transition-base);
}

.content-card:hover .content-card__image {
  transform: scale(1.03);
}

.content-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-placeholder);
  background: linear-gradient(135deg, var(--color-border-light) 0%, var(--color-bg-page) 100%);
}

.content-card__checkbox {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: 2;
}

.content-card__duration {
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

.content-card__type-badge {
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

/* ── Body ── */
.content-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  flex: 1;
}

.content-card__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  line-height: 1.4;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.content-card__desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.content-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.content-card__tag {
  font-size: 10px;
  border: none;
  background: var(--color-bg-page);
  color: var(--color-text-secondary);
}

.content-card__tag-more {
  font-size: 10px;
  color: var(--color-text-placeholder);
}

.content-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-light);
}

.content-card__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

/* ── Actions overlay ── */
.content-card__actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98) 60%, transparent);
  opacity: 0;
  transform: translateY(4px);
  transition: all var(--transition-fast);
  z-index: 3;
}
</style>
