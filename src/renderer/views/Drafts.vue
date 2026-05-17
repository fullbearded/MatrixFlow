<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useDraftStore } from '@/stores/draft';

const draftStore = useDraftStore();

const drafts = computed(() => draftStore.drafts);
const loading = computed(() => draftStore.loading);

const showEditor = ref(false);
const editingDraft = ref<Draft | null>(null);

interface Draft {
  id: string;
  type: 'video' | 'image';
  title: string;
  description?: string;
  coverPath?: string;
  filePath?: string;
  status: 'draft' | 'ready';
}

onMounted(async () => {
  await draftStore.loadDrafts();
});

function createDraft() {
  editingDraft.value = null;
  showEditor.value = true;
}

function editDraft(draft: Draft) {
  editingDraft.value = { ...draft };
  showEditor.value = true;
}

async function deleteDraft(draft: Draft) {
  try {
    await ElMessageBox.confirm('确定删除该草稿？', '确认删除', {
      type: 'warning',
    });
    await draftStore.deleteDraft(draft.id);
    ElMessage.success('删除成功');
  } catch {
    // cancelled
  }
}

async function duplicateDraft(draft: Draft) {
  await draftStore.duplicateDraft(draft.id);
  ElMessage.success('已创建副本');
}

async function markAsReady(draft: Draft) {
  await draftStore.updateDraft(draft.id, { status: 'ready' });
  ElMessage.success('已标记为就绪');
}

function getPlatformConfig(draft: Draft, platform: string) {
  return draftStore.getPlatformConfig(draft.id, platform);
}
</script>

<template>
  <div class="draft-view">
    <div class="draft-toolbar">
      <el-button type="primary" @click="createDraft">新建草稿</el-button>

      <el-radio-group v-model="draftStore.filterStatus" @change="draftStore.loadDrafts">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button label="draft">草稿</el-radio-button>
        <el-radio-button label="ready">就绪</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="drafts" v-loading="loading" stripe>
      <el-table-column prop="type" label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === 'video' ? 'primary' : 'success'" size="small">
            {{ row.type === 'video' ? '视频' : '图文' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="标题" min-width="200" />

      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ready' ? 'success' : 'info'" size="small">
            {{ row.status === 'ready' ? '就绪' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="updatedAt" label="更新时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.updatedAt).toLocaleString() }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="editDraft(row)">编辑</el-button>
          <el-button size="small" @click="duplicateDraft(row)">复制</el-button>
          <el-button
            v-if="row.status === 'draft'"
            type="success"
            size="small"
            @click="markAsReady(row)"
          >
            就绪
          </el-button>
          <el-button type="danger" size="small" @click="deleteDraft(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showEditor" title="编辑草稿" width="600px">
      <draft-editor
        v-if="showEditor"
        :draft="editingDraft"
        @save="showEditor = false"
        @cancel="showEditor = false"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.draft-view {
  padding: 20px;
}

.draft-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
