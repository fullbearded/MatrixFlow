<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑监控计划' : '新建监控计划'"
    width="600px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    @closed="resetForm"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <!-- Plan type -->
      <el-form-item label="监控类型" prop="type">
        <el-radio-group v-model="form.type" @change="onTypeChange">
          <el-radio value="speed">播放流速监控</el-radio>
          <el-radio value="account">账号指标监控</el-radio>
          <el-radio value="work">作品指标监控</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- Name -->
      <el-form-item label="计划名称" prop="name">
        <el-input v-model="form.name" placeholder="输入监控计划名称" maxlength="30" show-word-limit />
      </el-form-item>

      <!-- Metric (depends on type) -->
      <el-form-item label="监控指标" prop="metric">
        <el-select v-model="form.metric" placeholder="选择监控指标" style="width: 100%">
          <el-option
            v-for="opt in metricOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <!-- Threshold -->
      <el-form-item label="阈值" prop="threshold">
        <el-input-number
          v-model="form.threshold"
          :min="0"
          :precision="0"
          :step="10"
          controls-position="right"
          style="width: 200px"
        />
        <span class="threshold-hint">{{ thresholdHint }}</span>
      </el-form-item>

      <!-- Check interval -->
      <el-form-item label="检查间隔" prop="intervalMin">
        <el-select v-model="form.intervalMin" style="width: 200px">
          <el-option :value="5" label="5 分钟" />
          <el-option :value="10" label="10 分钟" />
          <el-option :value="15" label="15 分钟" />
          <el-option :value="30" label="30 分钟" />
          <el-option :value="60" label="60 分钟" />
        </el-select>
      </el-form-item>

      <!-- Account selector -->
      <el-form-item label="监控账号" prop="accountIds">
        <el-select
          v-model="form.accountIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择要监控的账号（留空监控全部）"
          style="width: 100%"
        >
          <el-option
            v-for="a in accountStore.accounts"
            :key="a.id"
            :label="`${a.nickname} (${platformLabel(a.platform)})`"
            :value="a.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存修改' : '确认创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useAccountStore } from '@/renderer/stores/account';

export interface MonitorPlan {
  id: string;
  type: 'speed' | 'account' | 'work';
  name: string;
  accountIds: string[];
  metric: string;
  threshold: number;
  intervalMin: number;
  enabled: boolean;
  createdAt: string;
}

const props = defineProps<{
  modelValue: boolean;
  plan?: MonitorPlan | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const accountStore = useAccountStore();
const formRef = ref<FormInstance>();
const submitting = ref(false);

const isEdit = computed(() => !!props.plan?.id);

const metricMap: Record<string, { label: string; value: string }[]> = {
  speed: [
    { label: '播放增量', value: 'playIncrement' },
    { label: '点赞增量', value: 'likeIncrement' },
  ],
  account: [
    { label: '总粉丝', value: 'totalFans' },
    { label: '总点赞', value: 'totalLikes' },
    { label: '总作品', value: 'totalWorks' },
  ],
  work: [
    { label: '播放量', value: 'playCount' },
    { label: '点赞数', value: 'likeCount' },
    { label: '评论数', value: 'commentCount' },
    { label: '收藏数', value: 'collectCount' },
    { label: '转发数', value: 'shareCount' },
  ],
};

const metricOptions = computed(() => metricMap[form.type] ?? []);

const thresholdHints: Record<string, string> = {
  playIncrement: '低于此增量时触发告警',
  likeIncrement: '低于此增量时触发告警',
  totalFans: '粉丝数低于此值时触发告警',
  totalLikes: '点赞数低于此值时触发告警',
  totalWorks: '作品数低于此值时触发告警',
  playCount: '播放量低于此值时触发告警',
  likeCount: '点赞数低于此值时触发告警',
  commentCount: '评论数低于此值时触发告警',
  collectCount: '收藏数低于此值时触发告警',
  shareCount: '转发数低于此值时触发告警',
};

const thresholdHint = computed(() => thresholdHints[form.metric] ?? '设置告警阈值');

const form = reactive({
  type: 'speed' as 'speed' | 'account' | 'work',
  name: '',
  metric: '',
  threshold: 100,
  intervalMin: 15,
  accountIds: [] as string[],
});

const rules: FormRules = {
  type: [{ required: true, message: '请选择监控类型', trigger: 'change' }],
  name: [
    { required: true, message: '请输入计划名称', trigger: 'blur' },
    { min: 1, max: 30, message: '长度在 1 到 30 个字符', trigger: 'blur' },
  ],
  metric: [{ required: true, message: '请选择监控指标', trigger: 'change' }],
  threshold: [{ required: true, message: '请设置阈值', trigger: 'change' }],
  intervalMin: [{ required: true, message: '请选择检查间隔', trigger: 'change' }],
};

const platformMap: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  channels: '视频号',
  kuaishou: '快手',
};

function platformLabel(key: string): string {
  return platformMap[key] || key;
}

function onTypeChange() {
  form.metric = '';
  form.threshold = 100;
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.plan) {
      form.type = props.plan.type;
      form.name = props.plan.name;
      form.metric = props.plan.metric;
      form.threshold = props.plan.threshold;
      form.intervalMin = props.plan.intervalMin;
      form.accountIds = [...props.plan.accountIds];
    }
  },
);

function resetForm() {
  form.type = 'speed';
  form.name = '';
  form.metric = '';
  form.threshold = 100;
  form.intervalMin = 15;
  form.accountIds = [];
}

async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const payload = {
      type: form.type,
      name: form.name,
      metric: form.metric,
      threshold: form.threshold,
      intervalMin: form.intervalMin,
      accountIds: form.accountIds,
    };

    if (isEdit.value && props.plan) {
      await window.matrixflow.monitor.updatePlan(props.plan.id, payload);
      ElMessage.success('监控计划已更新');
    } else {
      await window.matrixflow.monitor.createPlan(payload);
      ElMessage.success('监控计划创建成功');
    }
    emit('update:modelValue', false);
    emit('saved');
  } catch {
    ElMessage.error('操作失败，请重试');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.threshold-hint {
  margin-left: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
