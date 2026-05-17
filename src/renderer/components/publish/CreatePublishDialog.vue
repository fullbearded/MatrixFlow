<template>
  <el-dialog
    :model-value="modelValue"
    title="创建发布任务"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    @close="resetForm"
  >
    <el-form label-width="90px" label-position="right">
      <el-form-item label="选择内容" required>
        <el-select
          v-model="form.contentId"
          placeholder="选择要发布的内容"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="c in contentStore.contents"
            :key="c.id"
            :label="c.title"
            :value="c.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="发布账号" required>
        <el-select
          v-model="form.accountIds"
          multiple
          placeholder="选择发布账号"
          style="width: 100%"
        >
          <el-option
            v-for="a in accountStore.accounts"
            :key="a.id"
            :label="`${a.nickname} (${a.platform})`"
            :value="a.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="发布时间">
        <el-date-picker
          v-model="form.scheduledAt"
          type="datetime"
          placeholder="不选则使用默认日期"
          style="width: 100%"
          :disabled-date="disablePastDates"
        />
      </el-form-item>

      <el-form-item label="发布模式">
        <el-radio-group v-model="form.publishMode">
          <el-radio-button value="server">
            服务端发布
            <el-tooltip content="平台定时发布 API，设好时间后关闭应用也会按时发布" placement="top">
              <el-icon style="margin-left: 4px; vertical-align: middle;"><InfoFilled /></el-icon>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button value="client">
            客户端直发
            <el-tooltip content="到时间后由本应用直接操作浏览器发布，需保持应用运行" placement="top">
              <el-icon style="margin-left: 4px; vertical-align: middle;"><InfoFilled /></el-icon>
            </el-tooltip>
          </el-radio-button>
        </el-radio-group>
        <div v-if="!serverScheduleSupported" class="mode-hint">
          <el-text type="warning" size="small">所选平台不支持服务端定时发布，将自动使用客户端模式</el-text>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        创建任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { InfoFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAccountStore } from '@/renderer/stores/account';
import { useContentStore } from '@/renderer/stores/content';
import { usePublishStore, type PublishMode } from '@/renderer/stores/publish';

const props = defineProps<{
  modelValue: boolean;
  defaultDate?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  created: [];
}>();

const accountStore = useAccountStore();
const contentStore = useContentStore();
const publishStore = usePublishStore();

const submitting = ref(false);
const form = reactive({
  contentId: '',
  accountIds: [] as string[],
  scheduledAt: null as Date | null,
  publishMode: 'client' as PublishMode,
});

const PLATFORMS_WITHOUT_SERVER_SCHEDULE = new Set(['xiaohongshu']);

const serverScheduleSupported = computed(() => {
  const selectedAccounts = accountStore.accounts.filter(a => form.accountIds.includes(a.id));
  if (selectedAccounts.length === 0) return true;
  return selectedAccounts.every(a => !PLATFORMS_WITHOUT_SERVER_SCHEDULE.has(a.platform));
});

watch(
  () => serverScheduleSupported.value,
  (supported) => {
    if (!supported && form.publishMode === 'server') {
      form.publishMode = 'client';
    }
  },
);

watch(
  () => props.defaultDate,
  (date) => {
    if (date && props.modelValue) {
      form.scheduledAt = new Date(`${date}T10:00:00`);
    }
  },
);

function resetForm() {
  form.contentId = '';
  form.accountIds = [];
  form.scheduledAt = null;
  form.publishMode = 'client';
}

function disablePastDates(date: Date): boolean {
  return date.getTime() < Date.now() - 86400000;
}

async function handleSubmit() {
  if (!form.contentId) {
    ElMessage.warning('请选择要发布的内容');
    return;
  }
  if (form.accountIds.length === 0) {
    ElMessage.warning('请选择发布账号');
    return;
  }

  submitting.value = true;
  try {
    await publishStore.createTask({
      contentId: form.contentId,
      accountIds: form.accountIds,
      scheduledAt: form.scheduledAt ? form.scheduledAt.toISOString() : null,
      publishMode: form.publishMode,
    });
    ElMessage.success('任务创建成功');
    emit('update:modelValue', false);
    emit('created');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.mode-hint {
  margin-top: 4px;
}
</style>
