<template>
  <div
    class="content-page"
    :class="{ 'content-page--dragging': isDragging }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- ── Header ── -->
    <div class="content-page__header">
      <div class="content-page__title-row">
        <h2 class="content-page__title">内容库</h2>
        <span class="content-page__count">{{ contentStore.contents.length }} 项</span>
      </div>
      <div class="content-page__actions">
        <el-button @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入内容
        </el-button>
        <el-button
          type="primary"
          :disabled="!hasSelected"
          @click="openPublishDialog"
        >
          <el-icon><Promotion /></el-icon>
          发布选中{{ hasSelected ? ` (${selectedIds.length})` : '' }}
        </el-button>
      </div>
    </div>

    <!-- ── Toolbar ── -->
    <div class="content-page__toolbar">
      <el-radio-group v-model="contentStore.statusFilter" size="default">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="draft">草稿</el-radio-button>
        <el-radio-button value="ready">待发布</el-radio-button>
        <el-radio-button value="published">已发布</el-radio-button>
      </el-radio-group>

      <el-input
        v-model="contentStore.searchQuery"
        placeholder="搜索标题或标签..."
        prefix-icon="Search"
        clearable
        class="content-page__search"
      />

      <el-button-group class="content-page__view-toggle">
        <el-button
          :type="viewMode === 'grid' ? 'primary' : 'default'"
          size="default"
          @click="viewMode = 'grid'"
        >
          <el-icon><Grid /></el-icon>
        </el-button>
        <el-button
          :type="viewMode === 'list' ? 'primary' : 'default'"
          size="default"
          @click="viewMode = 'list'"
        >
          <el-icon><List /></el-icon>
        </el-button>
      </el-button-group>

      <el-button
        v-if="hasSelected"
        type="danger"
        plain
        size="default"
        @click="handleBatchDelete"
      >
        <el-icon><Delete /></el-icon>
        删除选中 ({{ selectedIds.length }})
      </el-button>
    </div>

    <!-- ── Content Grid ── -->
    <Loading v-if="contentStore.loading" />

    <Empty
      v-else-if="contentStore.contents.length === 0"
      text="内容库为空，拖拽文件到此处或点击导入"
      action-label="导入内容"
      @action="showImportDialog = true"
    />

    <template v-else>
      <div v-if="viewMode === 'grid'" class="content-grid">
        <ContentCard
          v-for="item in contentStore.filteredContents"
          :key="item.id"
          :content="item"
          :selected="selectedIds.includes(item.id)"
          @select="toggleSelect"
          @edit="openEditDialog"
          @publish="quickPublish"
          @view="quickPublish"
          @delete="handleDelete"
        />
      </div>

      <el-table v-else :data="contentStore.filteredContents" stripe class="content-list">
        <el-table-column type="selection" width="40" :selectable="() => true" @selection-change="onTableSelect" />
        <el-table-column label="标题" min-width="200">
          <template #default="{ row }">
            <div class="content-list__title-cell">
              <el-icon :size="16">
                <VideoCamera v-if="row.type === 'video'" />
                <Picture v-else />
              </el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" round>{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="dark" round>
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'ready'"
              text
              size="small"
              type="primary"
              @click="quickPublish(row)"
            >
              发布
            </el-button>
            <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button text size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- ── Drag overlay ── -->
    <transition name="fade">
      <div v-if="isDragging" class="content-page__drop-zone">
        <el-icon :size="48" class="content-page__drop-icon"><Upload /></el-icon>
        <p class="content-page__drop-text">释放文件以导入</p>
        <p class="content-page__drop-hint">支持视频、图片文件</p>
      </div>
    </transition>

    <!-- ── Dialogs ── -->
    <ContentEditDialog
      v-model="editDialogVisible"
      :content="editingContent"
      @saved="contentStore.fetchContents()"
    />

    <PublishDialog
      v-model="publishDialogVisible"
      :contents="publishingContents"
    />

    <el-dialog v-model="showImportDialog" title="导入内容" width="460px" destroy-on-close>
      <el-form label-width="72px">
        <el-form-item label="标题">
          <el-input v-model="importForm.title" placeholder="输入内容标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="importForm.type" style="width: 100%">
            <el-option label="视频" value="video" />
            <el-option label="图片" value="image" />
            <el-option label="文章" value="article" />
          </el-select>
        </el-form-item>
        <el-form-item label="文件路径">
          <el-input v-model="importForm.filePath" placeholder="拖拽导入或手动输入路径" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="handleImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import {
  Upload,
  Promotion,
  Delete,
  Grid,
  List,
  VideoCamera,
  Picture,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useContentStore, type ContentItem } from '@/renderer/stores/content';
import Loading from '@/renderer/components/common/Loading.vue';
import Empty from '@/renderer/components/common/Empty.vue';
import ContentCard from '@/renderer/components/content/ContentCard.vue';
import ContentEditDialog from '@/renderer/components/content/ContentEditDialog.vue';
import PublishDialog from '@/renderer/components/content/PublishDialog.vue';

const contentStore = useContentStore();

// ── View state ──
const viewMode = ref<'grid' | 'list'>('grid');
const selectedIds = ref<string[]>([]);
const isDragging = ref(false);
let dragCounter = 0;

// ── Edit dialog ──
const editDialogVisible = ref(false);
const editingContent = ref<ContentItem | null>(null);

// ── Publish dialog ──
const publishDialogVisible = ref(false);
const publishingContents = ref<ContentItem[]>([]);

// ── Import dialog ──
const showImportDialog = ref(false);
const importing = ref(false);
const importForm = reactive({ title: '', type: 'video' as ContentItem['type'], filePath: '' });

const hasSelected = computed(() => selectedIds.value.length > 0);

onMounted(() => {
  contentStore.fetchContents();
});

// ── Selection ──
function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(idx, 1);
  }
}

function onTableSelect(rows: ContentItem[]) {
  selectedIds.value = rows.map((r) => r.id);
}

// ── Drag & Drop ──
function onDragOver() {
  dragCounter++;
  isDragging.value = true;
}

function onDragLeave() {
  dragCounter--;
  if (dragCounter <= 0) {
    isDragging.value = false;
    dragCounter = 0;
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  dragCounter = 0;
  if (!e.dataTransfer?.files.length) return;
  const file = e.dataTransfer.files[0];
  if (file) {
    importForm.filePath = file.path || file.name;
    importForm.title = file.name.replace(/\.[^.]+$/, '');
    importForm.type = file.type.startsWith('image') ? 'image' : 'video';
    showImportDialog.value = true;
  }
}

// ── Import ──
async function handleImport() {
  if (!importForm.title.trim()) {
    ElMessage.warning('请填写标题');
    return;
  }
  importing.value = true;
  try {
    await contentStore.createContent({
      title: importForm.title.trim(),
      type: importForm.type,
      filePath: importForm.filePath || undefined,
    });
    ElMessage.success('导入成功');
    showImportDialog.value = false;
    importForm.title = '';
    importForm.filePath = '';
  } finally {
    importing.value = false;
  }
}

// ── Edit ──
function openEditDialog(content: ContentItem) {
  editingContent.value = content;
  editDialogVisible.value = true;
}

// ── Publish ──
function openPublishDialog() {
  const contents = selectedIds.value
    .map((id) => contentStore.contents.find((c) => c.id === id))
    .filter((c): c is ContentItem => !!c);
  if (contents.length === 0) return;
  publishingContents.value = contents;
  publishDialogVisible.value = true;
}

function quickPublish(content: ContentItem) {
  publishingContents.value = [content];
  publishDialogVisible.value = true;
}

// ── Delete ──
async function handleDelete(id: string) {
  await contentStore.deleteContent(id);
  selectedIds.value = selectedIds.value.filter((sid) => sid !== id);
  ElMessage.success('已删除');
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedIds.value.length} 个内容？`,
      '批量删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await contentStore.batchDelete(selectedIds.value);
    ElMessage.success(`已删除 ${selectedIds.value.length} 个内容`);
    selectedIds.value = [];
  } catch {
    // cancelled
  }
}

// ── Labels ──
function typeLabel(type: string) {
  const map: Record<string, string> = { video: '视频', image: '图片', article: '文章' };
  return map[type] || type;
}

function statusType(status: string) {
  const map: Record<string, string> = { draft: 'info', ready: 'warning', published: 'success' };
  return map[status] || 'info';
}

function statusLabel(status: string) {
  const map: Record<string, string> = { draft: '草稿', ready: '待发布', published: '已发布' };
  return map[status] || status;
}
</script>

<style scoped>
.content-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  position: relative;
  min-height: 100%;
}

.content-page--dragging {
  outline: 2px dashed var(--color-primary);
  outline-offset: -4px;
  border-radius: var(--border-radius-md);
}

/* ── Header ── */
.content-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.content-page__title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.content-page__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.content-page__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}

.content-page__actions {
  display: flex;
  gap: var(--space-2);
}

/* ── Toolbar ── */
.content-page__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.content-page__search {
  width: 240px;
}

.content-page__view-toggle {
  margin-left: auto;
}

/* ── Grid ── */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
}

/* ── List ── */
.content-list__title-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-primary);
}

/* ── Drop zone overlay ── */
.content-page__drop-zone {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: rgba(64, 158, 255, 0.06);
  border: 2px dashed var(--color-primary);
  border-radius: var(--border-radius-lg);
  z-index: 10;
  backdrop-filter: blur(2px);
}

.content-page__drop-icon {
  color: var(--color-primary);
}

.content-page__drop-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  margin: 0;
}

.content-page__drop-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
