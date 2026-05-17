<template>
  <el-dialog
    :model-value="modelValue"
    title="发布内容"
    width="540px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    @open="initForm"
  >
    <div class="publish-summary">
      <p class="publish-summary__text">
        即将发布 <strong>{{ contents.length }}</strong> 个内容到以下账号：
      </p>
    </div>

    <el-form label-width="80px">
      <el-form-item label="选择账号">
        <el-select
          v-model="accountIds"
          multiple
          filterable
          placeholder="选择发布账号"
          style="width: 100%"
        >
          <el-option
            v-for="a in accountStore.accounts"
            :key="a.id"
            :label="`${a.nickname} (${a.platform})`"
            :value="a.id"
            :disabled="a.status !== 'online' || !a.cookieValid"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="定时发布">
        <el-date-picker
          v-model="scheduledAt"
          type="datetime"
          placeholder="不选则立即发布"
          style="width: 100%"
          :disabled-date="disablePastDates"
        />
      </el-form-item>
    </el-form>

    <div class="publish-contents">
      <div v-for="c in contents" :key="c.id" class="publish-contents__item">
        <span class="publish-contents__title">{{ c.title }}</span>
        <el-tag size="small" effect="plain" round>{{ typeLabel(c.type) }}</el-tag>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="publishing" @click="handlePublish">
        {{ scheduledAt ? '定时发布' : '立即发布' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useAccountStore } from '@/renderer/stores/account';
import { useTaskStore } from '@/renderer/stores/task';
import type { ContentItem } from '@/renderer/stores/content';

const props = defineProps<{
  modelValue: boolean;
  contents: ContentItem[];
}>();

defineEmits<{
  'update:modelValue': [val: boolean];
}>();

const accountStore = useAccountStore();
const taskStore = useTaskStore();
const publishing = ref(false);
const accountIds = ref<string[]>([]);
const scheduledAt = ref<Date | null>(null);

function initForm() {
  accountIds.value = [];
  scheduledAt.value = null;
  accountStore.fetchAccounts();
}

function typeLabel(type: string) {
  const map: Record<string, string> = { video: '视频', image: '图片', article: '文章' };
  return map[type] || type;
}

function disablePastDates(date: Date) {
  return date.getTime() < Date.now() - 86400000;
}

async function handlePublish() {
  if (accountIds.value.length === 0) {
    ElMessage.warning('请选择至少一个发布账号');
    return;
  }
  if (props.contents.length === 0) {
    ElMessage.warning('没有可发布的内容');
    return;
  }

  publishing.value = true;
  try {
      for (const content of props.contents) {
        for (const accountId of accountIds.value) {
          await taskStore.createTask({
            contentId: content.id,
            accountId,
          });
        }
      }
    ElMessage.success(
      scheduledAt.value
        ? `已创建 ${props.contents.length * accountIds.value.length} 个定时发布任务`
        : `已提交 ${props.contents.length * accountIds.value.length} 个发布任务`,
    );
  } finally {
    publishing.value = false;
  }
}
</script>

<style scoped>
.publish-summary {
  margin-bottom: var(--space-4);
}

.publish-summary__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-regular);
  margin: 0;
}

.publish-contents {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius-md);
  padding: var(--space-2);
}

.publish-contents__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.publish-contents__item:hover {
  background: var(--color-bg-page);
}

.publish-contents__title {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
