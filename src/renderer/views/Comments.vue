<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useCommentStore } from '@/stores/comment';

const commentStore = useCommentStore();

const templates = computed(() => commentStore.templates);
const tasks = computed(() => commentStore.tasks);

const showTemplateEditor = ref(false);
const editingTemplate = ref<CommentTemplate | null>(null);

interface CommentTemplate {
  id: string;
  platform: string;
  name: string;
  content: string;
  triggerCondition: 'after_publish' | 'threshold';
  delay?: number;
}

onMounted(async () => {
  await commentStore.loadTemplates();
  await commentStore.loadTasks();
});

function createTemplate() {
  editingTemplate.value = null;
  showTemplateEditor.value = true;
}

function editTemplate(template: CommentTemplate) {
  editingTemplate.value = { ...template };
  showTemplateEditor.value = true;
}

async function deleteTemplate(template: CommentTemplate) {
  await commentStore.deleteTemplate(template.id);
  ElMessage.success('删除成功');
}

async function executeTask(taskId: string) {
  await commentStore.executeTask(taskId);
  ElMessage.success('评论已发送');
}
</script>

<template>
  <div class="comment-view">
    <div class="comment-section">
      <div class="section-header">
        <h3>评论模板</h3>
        <el-button type="primary" size="small" @click="createTemplate">新建模板</el-button>
      </div>

      <el-table :data="templates" stripe>
        <el-table-column prop="platform" label="平台" width="100" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="triggerCondition" label="触发条件" width="120">
          <template #default="{ row }">
            {{ row.triggerCondition === 'after_publish' ? '发布后' : '达到阈值' }}
            <span v-if="row.delay">({{ row.delay }}秒后)</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="editTemplate(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="deleteTemplate(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="comment-section">
      <div class="section-header">
        <h3>评论任务</h3>
      </div>

      <el-table :data="tasks" stripe>
        <el-table-column prop="platform" label="平台" width="100" />
        <el-table-column prop="videoId" label="视频ID" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : 'info'"
              size="small"
            >
              {{ row.status === 'completed' ? '已完成' : row.status === 'failed' ? '失败' : '待执行' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="primary"
              size="small"
              @click="executeTask(row.id)"
            >
              执行
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showTemplateEditor" title="编辑评论模板" width="500px">
      <comment-template-editor
        v-if="showTemplateEditor"
        :template="editingTemplate"
        @save="showTemplateEditor = false"
        @cancel="showTemplateEditor = false"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.comment-view {
  padding: 20px;
}

.comment-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}
</style>
