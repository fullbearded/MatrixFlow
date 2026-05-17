<template>
  <div class="license-settings">
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <template v-else>
      <div v-if="licenseInfo.valid" class="license-active">
        <el-alert type="success" :closable="false" show-icon>
          <template #title>
            <span class="license-title">License 已激活</span>
          </template>
          <div class="license-details">
            <p><strong>授权邮箱：</strong>{{ licenseInfo.license?.email || '-' }}</p>
            <p><strong>授权类型：</strong>{{ licenseInfo.license?.type || '标准版' }}</p>
            <p><strong>到期时间：</strong>{{ licenseInfo.license?.expiresAt || '永久有效' }}</p>
            <p><strong>设备绑定：</strong>{{ licenseInfo.license?.deviceId || '-' }}</p>
          </div>
        </el-alert>

        <el-divider content-position="left">功能授权</el-divider>

        <div class="feature-list">
          <div v-for="feature in features" :key="feature.id" class="feature-item">
            <el-icon :size="16" :color="feature.enabled ? '#67C23A' : '#909399'">
              <CircleCheck v-if="feature.enabled" />
              <CircleClose v-else />
            </el-icon>
            <span class="feature-name">{{ feature.name }}</span>
            <el-tag :type="feature.enabled ? 'success' : 'info'" size="small">
              {{ feature.enabled ? '已授权' : '未授权' }}
            </el-tag>
          </div>
        </div>

        <el-divider />

        <el-button type="danger" @click="handleDeactivate">
          注销 License
        </el-button>
      </div>

      <div v-else class="license-inactive">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>
            <span class="license-title">License 未激活</span>
          </template>
          请输入 License Key 激活软件以使用完整功能
        </el-alert>

        <el-divider content-position="left">在线激活</el-divider>

        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
          <el-form-item label="License Key" prop="key">
            <el-input v-model="form.key" placeholder="XXXX-XXXX-XXXX-XXXX" />
          </el-form-item>
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="form.email" placeholder="your@email.com" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleActivate" :loading="activating">
              在线激活
            </el-button>
          </el-form-item>
        </el-form>

        <el-divider content-position="left">离线激活</el-divider>

        <el-steps :active="offlineStep" simple>
          <el-step title="生成请求" />
          <el-step title="上传请求" />
          <el-step title="导入响应" />
        </el-steps>

        <div class="offline-actions" style="margin-top: 16px;">
          <el-button @click="handleOfflineRequest" :loading="requesting">
            生成离线请求文件
          </el-button>
          <el-button @click="showOfflineDialog = true">
            导入离线激活文件
          </el-button>
        </div>
      </div>
    </template>

    <el-dialog v-model="showOfflineDialog" title="离线激活" width="450px">
      <el-form label-width="100px">
        <el-form-item label="激活文件">
          <el-input v-model="offlineFilePath" placeholder="选择 .lic 文件" />
          <el-button style="margin-left: 8px;" @click="selectOfflineFile">选择文件</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showOfflineDialog = false">取消</el-button>
        <el-button type="primary" @click="handleOfflineActivate" :loading="activating">
          激活
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { CircleCheck, CircleClose } from '@element-plus/icons-vue';

const loading = ref(true);
const activating = ref(false);
const requesting = ref(false);
const showOfflineDialog = ref(false);
const offlineFilePath = ref('');
const offlineStep = ref(0);

interface LicenseData {
  valid: boolean;
  license?: {
    email?: string;
    type?: string;
    expiresAt?: string;
    deviceId?: string;
  };
}

const licenseInfo = ref<LicenseData>({ valid: false });

const features = ref([
  { id: 'multi_account', name: '多账号管理', enabled: true },
  { id: 'auto_publish', name: '自动发布', enabled: true },
  { id: 'ai_check', name: 'AI 预发布检查', enabled: true },
  { id: 'multi_panel', name: '多开面板', enabled: false },
  { id: 'proxy_pool', name: '代理池管理', enabled: false },
]);

const formRef = ref<FormInstance>();
const form = reactive({
  key: '',
  email: '',
});

const rules: FormRules = {
  key: [{ required: true, message: '请输入 License Key', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
};

onMounted(async () => {
  await loadLicenseStatus();
});

async function loadLicenseStatus() {
  loading.value = true;
  try {
    const result = await window.matrixflow.license.status();
    if (result.success && result.data) {
      licenseInfo.value = result.data;
    }
  } catch (error) {
    console.error('加载 License 状态失败:', error);
  } finally {
    loading.value = false;
  }
}

async function handleActivate() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  activating.value = true;
  try {
    const result = await window.matrixflow.license.activate(form.key, form.email);
    if (result.success) {
      ElMessage.success('License 激活成功');
      await loadLicenseStatus();
    } else {
      ElMessage.error(result.message || '激活失败');
    }
  } catch (error) {
    ElMessage.error('激活请求失败');
  } finally {
    activating.value = false;
  }
}

async function handleDeactivate() {
  try {
    await ElMessageBox.confirm('确定要注销 License 吗？注销后需要重新激活才能使用完整功能。', '确认注销', {
      type: 'warning',
    });

    await window.matrixflow.license.deactivate();
    ElMessage.success('License 已注销');
    await loadLicenseStatus();
  } catch {
    // 用户取消
  }
}

async function handleOfflineRequest() {
  if (!form.key || !form.email) {
    ElMessage.warning('请先填写 License Key 和邮箱');
    return;
  }

  requesting.value = true;
  try {
    const result = await window.matrixflow.license.offlineRequest(form.key, form.email);
    if (result.success && result.data) {
      ElMessage.success(`离线请求文件已生成: ${result.data}`);
      offlineStep.value = 1;
    }
  } catch (error) {
    ElMessage.error('生成离线请求失败');
  } finally {
    requesting.value = false;
  }
}

function selectOfflineFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.lic';
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      offlineFilePath.value = file.path || file.name;
    }
  };
  input.click();
}

async function handleOfflineActivate() {
  if (!offlineFilePath.value) {
    ElMessage.warning('请选择激活文件');
    return;
  }

  activating.value = true;
  try {
    const result = await window.matrixflow.license.activateOffline(offlineFilePath.value);
    if (result.success) {
      ElMessage.success('离线激活成功');
      showOfflineDialog.value = false;
      await loadLicenseStatus();
    } else {
      ElMessage.error(result.message || '激活失败');
    }
  } catch (error) {
    ElMessage.error('离线激活失败');
  } finally {
    activating.value = false;
  }
}
</script>

<style scoped>
.license-settings {
  padding: 0;
}

.loading-state {
  padding: 20px;
}

.license-active,
.license-inactive {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.license-title {
  font-weight: 500;
}

.license-details p {
  margin: 4px 0;
  font-size: 13px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
}

.feature-name {
  flex: 1;
  font-size: 14px;
}

.offline-actions {
  display: flex;
  gap: 12px;
}
</style>
