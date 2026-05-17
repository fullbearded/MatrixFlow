<template>
  <el-dialog
    :model-value="modelValue"
    title="发布规则配置"
    width="620px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="rule-header">
      分组：<strong>{{ group?.name }}</strong>
    </div>

    <div class="template-section">
      <div class="template-cards">
        <div
          v-for="tpl in RULE_TEMPLATES"
          :key="tpl.id"
          class="template-card"
          :class="{ 'template-card--active': selectedTemplate === tpl.id }"
          @click="applyTemplate(tpl)"
        >
          <div class="template-card__icon">{{ tpl.icon }}</div>
          <div class="template-card__name">{{ tpl.name }}</div>
          <div class="template-card__desc">{{ tpl.description }}</div>
          <div class="template-card__slots">
            <el-tag
              v-for="slot in tpl.timeSlots"
              :key="slot"
              size="small"
              type="info"
              class="template-card__tag"
            >
              {{ slot }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <el-divider>或自定义配置</el-divider>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="rule-form">
      <el-form-item label="目标平台" prop="platforms">
        <el-checkbox-group v-model="form.platforms">
          <el-checkbox value="douyin">抖音</el-checkbox>
          <el-checkbox value="xiaohongshu">小红书</el-checkbox>
          <el-checkbox value="channels">视频号</el-checkbox>
          <el-checkbox value="kuaishou">快手</el-checkbox>
          <el-checkbox value="bilibili">B站</el-checkbox>
        </el-checkbox-group>
        <div class="form-hint">不选则视为全部平台</div>
      </el-form-item>

      <el-form-item label="发布时段" prop="timeSlots">
        <div class="time-slots-editor">
          <el-tag
            v-for="(slot, index) in form.timeSlots"
            :key="index"
            closable
            type="primary"
            class="time-slot-tag"
            @close="removeTimeSlot(index)"
          >
            {{ slot }}
          </el-tag>
          <el-time-select
            v-if="showTimeSlotInput"
            ref="timeSlotInputRef"
            v-model="newTimeSlot"
            placeholder="添加时段"
            start="00:00"
            step="00:30"
            end="23:30"
            class="time-slot-input"
            @change="addTimeSlot"
            @blur="showTimeSlotInput = false"
          />
          <el-button
            v-else
            size="small"
            @click="showTimeSlotInput = true"
          >
            + 添加时段
          </el-button>
        </div>
      </el-form-item>

      <el-form-item label="发布模式" prop="publishMode">
        <el-radio-group v-model="form.publishMode">
          <el-radio value="server">服务端发布（平台定时）</el-radio>
          <el-radio value="client">客户端直发（到点执行）</el-radio>
        </el-radio-group>
        <div class="form-hint">
          {{ form.publishMode === 'server' ? '由平台定时功能在设定时间自动发布' : '由本应用在设定时间驱动浏览器执行发布' }}
        </div>
      </el-form-item>

      <el-form-item label="每日条数" prop="dailyCount">
        <el-input-number
          v-model="form.dailyCount"
          :min="1"
          :max="50"
          controls-position="right"
        />
        <span class="form-unit">条/天</span>
      </el-form-item>

      <el-form-item label="随机偏移" prop="randomOffsetMin">
        <el-slider
          v-model="form.randomOffsetMin"
          :min="0"
          :max="30"
          :step="1"
          :format-tooltip="(val: number) => `±${val} 分钟`"
          show-stops
          class="offset-slider"
        />
        <div class="form-hint">在实际发布时间上随机增加或减少的分钟数</div>
      </el-form-item>

      <el-form-item label="发布顺序" prop="publishOrder">
        <el-select v-model="form.publishOrder" placeholder="选择发布顺序">
          <el-option label="上传顺序" value="upload_order" />
          <el-option label="随机顺序" value="random" />
          <el-option label="手动指定" value="manual" />
        </el-select>
      </el-form-item>

      <el-form-item label="休息日" prop="restDays">
        <el-checkbox-group v-model="form.restDays">
          <el-checkbox
            v-for="day in REST_DAY_OPTIONS"
            :key="day.value"
            :value="day.value"
          >
            {{ day.label }}
          </el-checkbox>
        </el-checkbox-group>
        <div class="form-hint">选中的日期不发布内容</div>
      </el-form-item>

      <el-form-item label="发布时间" prop="publishStartTime">
        <div class="time-range">
          <el-time-select
            v-model="form.publishStartTime"
            :max-time="form.publishEndTime"
            placeholder="开始时间"
            start="00:00"
            step="00:30"
            end="23:30"
          />
          <span class="time-range__sep">至</span>
          <el-time-select
            v-model="form.publishEndTime"
            :min-time="form.publishStartTime"
            placeholder="结束时间"
            start="00:30"
            step="00:30"
            end="24:00"
          />
        </div>
      </el-form-item>

      <el-form-item label="发布间隔" prop="intervalMinutes">
        <el-input-number
          v-model="form.intervalMinutes"
          :min="5"
          :max="1440"
          :step="5"
          controls-position="right"
        />
        <span class="form-unit">分钟</span>
      </el-form-item>

      <el-form-item label="每日上限" prop="dailyLimit">
        <el-input-number
          v-model="form.dailyLimit"
          :min="1"
          :max="100"
          controls-position="right"
        />
        <span class="form-unit">条</span>
      </el-form-item>

      <el-form-item label="随机延迟">
        <el-switch v-model="form.randomDelay" />
        <div class="form-hint">开启后在间隔时间上随机增加 0~5 分钟</div>
      </el-form-item>

      <el-form-item label="启用规则">
        <el-switch v-model="form.isActive" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSave">保存规则</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import {
  useGroupStore,
  type Group,
  type PublishRule,
  RULE_TEMPLATES,
  REST_DAY_OPTIONS,
} from '@/renderer/stores/group';
import type { RuleTemplate } from '@/renderer/stores/group';

const props = defineProps<{
  modelValue: boolean;
  group: Group | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const groupStore = useGroupStore();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const selectedTemplate = ref<string | null>(null);
const showTimeSlotInput = ref(false);
const newTimeSlot = ref('');
const timeSlotInputRef = ref<InstanceType<typeof import('element-plus')['ElTimeSelect']>>();

const form = reactive<PublishRule>({
  platforms: [],
  timeSlots: ['09:00', '12:00', '18:00'],
  randomOffsetMin: 10,
  dailyCount: 3,
  publishMode: 'client',
  publishOrder: 'upload_order',
  restDays: [],
  isActive: true,
  publishStartTime: '08:00',
  publishEndTime: '22:00',
  intervalMinutes: 30,
  dailyLimit: 10,
  randomDelay: true,
});

const rules: FormRules = {
  publishStartTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  publishEndTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  intervalMinutes: [{ required: true, message: '请设置发布间隔', trigger: 'change' }],
  dailyLimit: [{ required: true, message: '请设置每日上限', trigger: 'change' }],
};

watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.group?.publishRule) {
      Object.assign(form, { ...props.group.publishRule });
      selectedTemplate.value = null;
    }
  },
);

watch(showTimeSlotInput, async (val) => {
  if (val) {
    await nextTick();
    timeSlotInputRef.value?.focus();
  }
});

function applyTemplate(tpl: RuleTemplate) {
  selectedTemplate.value = tpl.id;
  form.timeSlots = [...tpl.timeSlots];
  form.dailyCount = tpl.dailyCount;
  form.randomOffsetMin = tpl.randomOffsetMin;
  form.dailyLimit = tpl.dailyCount;
  form.publishStartTime = tpl.timeSlots[0] || '08:00';
  form.publishEndTime = tpl.timeSlots[tpl.timeSlots.length - 1] || '22:00';
}

function addTimeSlot(val: string) {
  if (val && !form.timeSlots.includes(val)) {
    const sorted = [...form.timeSlots, val].sort();
    form.timeSlots = sorted;
  }
  newTimeSlot.value = '';
  showTimeSlotInput.value = false;
}

function removeTimeSlot(index: number) {
  form.timeSlots.splice(index, 1);
}

async function handleSave() {
  if (!formRef.value || !props.group) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    await groupStore.updateGroup(props.group.id, {
      publishRule: { ...form },
    });
    ElMessage.success('发布规则已保存');
    emit('update:modelValue', false);
  } catch {
    ElMessage.error('保存失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.rule-header {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
}

.rule-header strong {
  color: var(--color-primary);
}

.template-section {
  margin-bottom: var(--space-4);
}

.template-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.template-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  background: var(--color-bg-card);
}

.template-card:hover {
  border-color: var(--color-primary-light);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.template-card--active {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.04);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.template-card__icon {
  font-size: 28px;
  line-height: 1;
  margin-bottom: var(--space-2);
}

.template-card__name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.template-card__desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.template-card__slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  justify-content: center;
}

.template-card__tag {
  font-size: 11px;
}

.rule-form {
  max-height: 480px;
  overflow-y: auto;
  padding-right: var(--space-2);
}

.time-slots-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.time-slot-tag {
  font-variant-numeric: tabular-nums;
}

.time-slot-input {
  width: 120px;
}

.offset-slider {
  width: 100%;
  max-width: 300px;
}

.time-range {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.time-range__sep {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.form-unit {
  margin-left: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
  margin-top: var(--space-1);
}
</style>
