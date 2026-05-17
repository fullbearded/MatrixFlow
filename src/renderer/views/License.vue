<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useLicenseStore } from '@/stores/license';

const licenseStore = useLicenseStore();

const licenseKey = ref('');
const email = ref('');
const offlineFile = ref('');
const activating = ref(false);

onMounted(async () => {
  await licenseStore.checkLicense();
});

const features = computed(() => [
  { key: 'multiPanel', name: '多开面板', enabled: licenseStore.hasFeature('multiPanel') },
  { key: 'autoComment', name: '自动评论', enabled: licenseStore.hasFeature('autoComment') },
  { key: 'aiAnalysis', name: 'AI 分析', enabled: licenseStore.hasFeature('aiAnalysis') },
  { key: 'weeklyReport', name: '运营周报', enabled: licenseStore.hasFeature('weeklyReport') },
  { key: 'mcpServer', name: 'MCP Server', enabled: licenseStore.hasFeature('mcpServer') },
]);

async function activate() {
  if (!licenseKey.value || !email.value) {
    ElMessage.warning('请输入许可证密钥和邮箱');
    return;
  }

  activating.value = true;
  try {
    const result = await licenseStore.activate(licenseKey.value, email.value);
    if (result.success) {
      ElMessage.success('激活成功');
      licenseKey.value = '';
      email.value = '';
    } else {
      ElMessage.error(result.error || '激活失败');
    }
  } finally {
    activating.value = false;
  }
}

async function activateOffline() {
  if (!offlineFile.value) {
    ElMessage.warning('请选择离线激活文件');
    return;
  }

  activating.value = true;
  try {
    const result = await licenseStore.activateOffline(offlineFile.value);
    if (result.success) {
      ElMessage.success('离线激活成功');
      offlineFile.value = '';
    } else {
      ElMessage.error(result.error || '离线激活失败');
    }
  } finally {
    activating.value = false;
  }
}

async function generateOfflineRequest() {
  if (!licenseKey.value || !email.value) {
    ElMessage.warning('请输入许可证密钥和邮箱');
    return;
  }

  const requestPath = await licenseStore.generateOfflineRequest(licenseKey.value, email.value);
  if (requestPath) {
    ElMessage.success(`离线激活请求已生成: ${requestPath}`);
  } else {
    ElMessage.error('生成离线激活请求失败');
  }
}

async function deactivate() {
  const success = await licenseStore.deactivate();
  if (success) {
    ElMessage.success('已注销许可证');
  } else {
    ElMessage.error('注销失败');
  }
}
</script>

<template>
  <div class="license-view">
    <div class="license-status" v-if="licenseStore.isValid && licenseStore.license">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>许可证信息</span>
            <el-button type="danger" size="small" @click="deactivate">注销</el-button>
          </div>
        </template>

        <div class="info-row">
          <span class="label">计划:</span>
          <el-tag :type="licenseStore.license.plan === 'enterprise' ? 'danger' : 'primary'">
            {{ licenseStore.planName }}
          </el-tag>
        </div>

        <div class="info-row">
          <span class="label">邮箱:</span>
          <span>{{ licenseStore.license.email }}</span>
        </div>

        <div class="info-row">
          <span class="label">设备数:</span>
          <span>{{ licenseStore.license.activatedDevices.length }} / {{ licenseStore.license.devices }}</span>
        </div>

        <div class="info-row">
          <span class="label">到期时间:</span>
          <span :class="{ expired: licenseStore.daysRemaining < 30 }">
            {{ new Date(licenseStore.license.expiresAt).toLocaleDateString() }}
            (剩余 {{ licenseStore.daysRemaining }} 天)
          </span>
        </div>

        <el-divider />

        <div class="features">
          <span class="label">功能列表:</span>
          <div class="feature-list">
            <el-tag
              v-for="feature in features"
              :key="feature.key"
              :type="feature.enabled ? 'success' : 'info'"
              size="small"
            >
              {{ feature.name }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <div class="license-activate" v-else>
      <el-card>
        <template #header>
          <span>激活许可证</span>
        </template>

        <el-form label-width="100px">
          <el-form-item label="许可证密钥">
            <el-input v-model="licenseKey" placeholder="请输入许可证密钥" />
          </el-form-item>

          <el-form-item label="邮箱">
            <el-input v-model="email" placeholder="请输入购买时使用的邮箱" />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="activate" :loading="activating">
              在线激活
            </el-button>
            <el-button @click="generateOfflineRequest">
              生成离线激活请求
            </el-button>
          </el-form-item>
        </el-form>

        <el-divider />

        <el-form label-width="100px">
          <el-form-item label="离线激活">
            <el-input v-model="offlineFile" placeholder="选择离线激活文件" />
          </el-form-item>

          <el-form-item>
            <el-button @click="activateOffline" :loading="activating">
              离线激活
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.license-view {
  padding: 20px;
  max-width: 600px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.info-row .label {
  color: var(--el-text-color-secondary);
  min-width: 80px;
}

.expired {
  color: var(--el-color-danger);
}

.features {
  margin-top: 16px;
}

.features .label {
  color: var(--el-text-color-secondary);
  display: block;
  margin-bottom: 8px;
}

.feature-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
