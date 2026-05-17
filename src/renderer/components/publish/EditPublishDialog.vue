<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑发布任务"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template v-if="task">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="内容标题">
          {{ task.contentTitle }}
        </el-descriptions-item>
        <el-descriptions-item label="平台">
          {{ task.platform }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTypeMap[task.status]" size="small">
            {{ statusLabelMap[task.status] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发布模式">
          <el-tag :type="task.publishMode === 'server' ? 'primary' : 'success'" size="small">
            {{ task.publishMode === 'server' ? '服务端发布' : '客户端直发' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatTime(task.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-form label-width="90px" style="margin-top: var(--space-4)">
        <el-form-item label="发布时间">
          <el-date-picker
            v-model="scheduledAt"
            type="datetime"
            placeholder="选择发布时间"
            style="width: 100%"
            :disabled-date="disablePastDates"
          />
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button type="danger" @click="handleDelete">删除任务</el-button>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { usePublishStore, type PublishTask, type PublishStatus, type PublishMode } from '@/renderer/stores/publish';

const props = defineProps<{
  modelValue: boolean;
  task: PublishTask | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  updated: [];
  deleted: [];
}>();

const publishStore = usePublishStore();
const saving = ref(false);
const scheduledAt = ref<Date | null>(null);

const statusTypeMap: Record<PublishStatus, string> = {
  pending: 'info',
  scheduled: 'primary',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'info',
};

const statusLabelMap: Record<PublishStatus, string> = {
  pending: '等待中',
  scheduled: '已排期',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

watch(
  () => props.task,
  (task) => {
    if (task) {
      scheduledAt.value = new Date(task.scheduledAt);
    }
  },
  { immediate: true },
);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

function disablePastDates(date: Date): boolean {
  return date.getTime() < Date.now() - 86400000;
}

async function handleSave() {
  if (!props.task || !scheduledAt.value) return;
  saving.value = true;
  try {
    await publishStore.updateTaskSchedule(props.task.id, scheduledAt.value.toISOString());
    ElMessage.success('已更新发布时间');
    emit('update:modelValue', false);
    emit('updated');
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!props.task) return;
  try {
    await ElMessageBox.confirm('确定删除该发布任务？', '删除确认', {
      type: 'warning',
    });
    await publishStore.deleteTask(props.task.id);
    ElMessage.success('任务已删除');
    emit('deleted');
  } catch {
    // 用户取消
  }
}
</script>
