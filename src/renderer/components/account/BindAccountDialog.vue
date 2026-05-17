<template>
  <el-dialog
    :model-value="modelValue"
    title="扫码绑定账号"
    width="400px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    @open="handleOpen"
  >
    <div class="bind-dialog">
      <el-steps :active="step" finish-status="success" class="bind-dialog__steps" simple>
        <el-step title="选择平台" />
        <el-step title="扫码绑定" />
        <el-step title="完成" />
      </el-steps>

      <!-- Step 1: 选择平台 -->
      <div v-if="step === 0" class="bind-dialog__platforms">
        <div
          v-for="p in platforms"
          :key="p.value"
          class="platform-option"
          :class="{ 'platform-option--active': form.platform === p.value }"
          @click="form.platform = p.value"
        >
          <span class="platform-option__name">{{ p.label }}</span>
        </div>
      </div>

      <!-- Step 2: 扫码 -->
      <div v-else-if="step === 1" class="bind-dialog__qr">
        <div class="bind-dialog__qr-placeholder">
          <template v-if="qrLoading">
            <el-icon class="bind-dialog__qr-loading" :size="32"><Loading /></el-icon>
            <span>正在获取二维码...</span>
          </template>
          <template v-else>
            <el-icon :size="48" color="var(--color-text-placeholder)"><Iphone /></el-icon>
            <span>请使用{{ currentPlatformLabel }}APP扫码登录</span>
          </template>
        </div>
        <el-button text type="primary" @click="refreshQR">刷新二维码</el-button>
      </div>

      <!-- Step 3: 完成 -->
      <div v-else class="bind-dialog__done">
        <el-icon :size="48" color="var(--color-success)"><CircleCheckFilled /></el-icon>
        <p>账号绑定成功！</p>
      </div>
    </div>

    <template #footer>
      <el-button v-if="step > 0 && step < 3" @click="step--">上一步</el-button>
      <el-button v-if="step === 0" :disabled="!form.platform" type="primary" @click="handleNext">
        下一步
      </el-button>
      <el-button v-if="step === 2" type="primary" @click="handleFinish">完成</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { Loading, Iphone, CircleCheckFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAccountStore } from '@/renderer/stores/account';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [val: boolean]; success: [] }>();

const accountStore = useAccountStore();
const step = ref(0);
const qrLoading = ref(false);
const form = reactive({ platform: '' });

const platforms = [
  { label: '抖音', value: 'douyin' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: '视频号', value: 'channels' },
  { label: '快手', value: 'kuaishou' },
];

const currentPlatformLabel = computed(() => {
  return platforms.find((p) => p.value === form.platform)?.label || '';
});

function handleOpen() {
  step.value = 0;
  form.platform = '';
}

async function handleNext() {
  step.value = 1;
  await fetchQR();
}

async function fetchQR() {
  qrLoading.value = true;
  try {
    // 调用主进程获取二维码（实际 IPC）
    if (window.matrixflow) {
      await window.matrixflow.accounts.getQRCode(form.platform);
    }
  } finally {
    qrLoading.value = false;
  }
}

function refreshQR() {
  fetchQR();
}

async function handleFinish() {
  try {
    await accountStore.fetchAccounts();
    ElMessage.success('账号绑定成功');
    emit('update:modelValue', false);
    emit('success');
  } catch {
    ElMessage.error('绑定失败，请重试');
  }
}
</script>

<style scoped>
.bind-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) 0;
}

.bind-dialog__steps {
  width: 100%;
}

.bind-dialog__platforms {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  width: 100%;
}

.platform-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.platform-option:hover {
  border-color: var(--color-primary-light);
}

.platform-option--active {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.06);
}

.platform-option__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.bind-dialog__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.bind-dialog__qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 200px;
  height: 200px;
  background: var(--color-bg-page);
  border-radius: var(--border-radius-md);
  border: 1px dashed var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.bind-dialog__qr-loading {
  animation: spin 1s linear infinite;
  color: var(--color-primary);
}

.bind-dialog__done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) 0;
}

.bind-dialog__done p {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
