<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑内容"
    width="480px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    @open="initForm"
  >
    <el-form label-width="72px" @submit.prevent="handleSave">
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="输入内容标题" maxlength="100" show-word-limit />
      </el-form-item>
      <el-form-item label="类型">
        <el-radio-group v-model="form.type" disabled>
          <el-radio-button value="video">视频</el-radio-button>
          <el-radio-button value="image">图片</el-radio-button>
          <el-radio-button value="article">文章</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="输入内容描述（可选）"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status">
          <el-option label="草稿" value="draft" />
          <el-option label="待发布" value="ready" />
          <el-option label="已发布" value="published" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <div class="tag-editor">
          <el-tag
            v-for="tag in form.tags"
            :key="tag"
            closable
            size="default"
            effect="plain"
            round
            class="tag-editor__tag"
            @close="removeTag(tag)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="showTagInput"
            ref="tagInputRef"
            v-model="newTag"
            size="small"
            class="tag-editor__input"
            placeholder="输入标签"
            @keyup.enter="addTag"
            @blur="addTag"
          />
          <el-button v-else size="small" round @click="openTagInput">
            + 添加标签
          </el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { useContentStore, type ContentItem } from '@/renderer/stores/content';

const props = defineProps<{
  modelValue: boolean;
  content: ContentItem | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  saved: [];
}>();

const contentStore = useContentStore();
const saving = ref(false);
const tagInputRef = ref<InstanceType<typeof import('element-plus')['ElInput']>>();
const showTagInput = ref(false);
const newTag = ref('');

const form = reactive({
  title: '',
  type: 'video' as ContentItem['type'],
  description: '',
  status: 'draft' as ContentItem['status'],
  tags: [] as string[],
});

function initForm() {
  if (!props.content) return;
  form.title = props.content.title;
  form.type = props.content.type;
  form.description = props.content.description || '';
  form.status = props.content.status;
  form.tags = [...props.content.tags];
}

function removeTag(tag: string) {
  form.tags = form.tags.filter((t) => t !== tag);
}

function openTagInput() {
  showTagInput.value = true;
  newTag.value = '';
  nextTick(() => tagInputRef.value?.focus());
}

function addTag() {
  const tag = newTag.value.trim();
  if (tag && !form.tags.includes(tag)) {
    form.tags.push(tag);
  }
  showTagInput.value = false;
  newTag.value = '';
}

async function handleSave() {
  if (!props.content) return;
  if (!form.title.trim()) {
    ElMessage.warning('标题不能为空');
    return;
  }
  saving.value = true;
  try {
    await contentStore.updateContent(props.content.id, {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      tags: form.tags,
    });
    ElMessage.success('保存成功');
    emit('update:modelValue', false);
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.tag-editor {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.tag-editor__tag {
  font-size: var(--font-size-xs);
}

.tag-editor__input {
  width: 120px;
}
</style>
