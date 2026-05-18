<template>
  <div class="page-settings">
    <h2 class="page-settings__title">设置</h2>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="基本设置" name="general">
        <div class="settings-card">
          <el-form label-width="140px" class="settings-form">
            <el-divider content-position="left">基本设置</el-divider>

            <el-form-item label="主题">
              <el-select v-model="settings.settings.theme" @change="(v: string) => settings.updateSetting('theme', v as any)">
                <el-option label="浅色" value="light" />
                <el-option label="深色" value="dark" />
                <el-option label="跟随系统" value="auto" />
              </el-select>
            </el-form-item>

            <el-form-item label="语言">
              <el-select v-model="settings.settings.language" @change="(v: string) => settings.updateSetting('language', v as any)">
                <el-option label="简体中文" value="zh-CN" />
                <el-option label="English" value="en-US" />
              </el-select>
            </el-form-item>

            <el-divider content-position="left">任务设置</el-divider>

            <el-form-item label="并发任务数">
              <el-input-number
                v-model="settings.settings.concurrentTasks"
                :min="1"
                :max="10"
                @change="(v: number | undefined) => v && settings.updateSetting('concurrentTasks', v)"
              />
            </el-form-item>

            <el-form-item label="重试次数">
              <el-input-number
                v-model="settings.settings.retryLimit"
                :min="0"
                :max="10"
                @change="(v: number | undefined) => v && settings.updateSetting('retryLimit', v)"
              />
            </el-form-item>

            <el-divider content-position="left">Cookie 检测</el-divider>

            <el-form-item label="自动检测 Cookie">
              <el-switch
                v-model="settings.settings.autoCheckCookie"
                @change="(v: boolean) => settings.updateSetting('autoCheckCookie', v)"
              />
            </el-form-item>

            <el-form-item v-if="settings.settings.autoCheckCookie" label="检测间隔（分钟）">
              <el-input-number
                v-model="settings.settings.cookieCheckInterval"
                :min="10"
                :max="1440"
                :step="10"
                @change="(v: number | undefined) => v && settings.updateSetting('cookieCheckInterval', v)"
              />
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="浏览器配置" name="browser">
        <div class="settings-card">
          <el-form label-width="140px" class="settings-form">
            <el-divider content-position="left">浏览器模式</el-divider>

            <el-form-item label="启动模式">
              <el-radio-group
                v-model="settings.settings.browserMode"
                @change="(v: string | number | boolean) => onBrowserModeChange(v as AppSettings['browserMode'])"
              >
                <el-radio-button value="embedded">
                  内嵌 Patchright（推荐）
                </el-radio-button>
                <el-radio-button value="external_chrome">
                  外置 Chrome
                </el-radio-button>
                <el-radio-button value="external_fingerprint">
                  外置指纹浏览器
                </el-radio-button>
              </el-radio-group>
              <p class="settings-hint">内嵌模式开箱即用，反检测能力最强。外置模式适合已有指纹浏览器的用户。</p>
            </el-form-item>

            <template v-if="settings.settings.browserMode === 'external_chrome'">
              <el-divider content-position="left">Chrome 配置</el-divider>

              <el-form-item label="Chrome 路径">
                <el-input
                  v-model="settings.settings.chromePath"
                  placeholder="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                  @change="(v: string) => settings.updateSetting('chromePath', v)"
                >
                  <template #append>
                    <el-button @click="selectChromePath">选择</el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="CDP 端点">
                <el-input
                  v-model="settings.settings.cdpEndpoint"
                  placeholder="ws://127.0.0.1:9222（留空则直接启动 Chrome）"
                  @change="(v: string) => settings.updateSetting('cdpEndpoint', v)"
                />
              </el-form-item>
            </template>

            <template v-if="settings.settings.browserMode === 'external_fingerprint'">
              <el-divider content-position="left">指纹浏览器配置</el-divider>

              <el-form-item label="指纹浏览器路径">
                <el-input
                  v-model="settings.settings.fingerprintBrowserPath"
                  placeholder="选择指纹浏览器应用"
                  @change="(v: string) => settings.updateSetting('fingerprintBrowserPath', v)"
                >
                  <template #append>
                    <el-button @click="selectFingerprintPath">选择</el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="CDP 端点">
                <el-input
                  v-model="settings.settings.cdpEndpoint"
                  placeholder="ws://127.0.0.1:9222"
                  @change="(v: string) => settings.updateSetting('cdpEndpoint', v)"
                />
              </el-form-item>
              <p class="settings-hint">请先启动指纹浏览器并开启远程调试端口，MatrixFlow 将通过 CDP 协议接管。</p>
            </template>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="指纹配置" name="fingerprint">
        <div class="settings-card">
          <FingerprintSettings />
        </div>
      </el-tab-pane>

      <el-tab-pane label="代理设置" name="proxy">
        <div class="settings-card">
          <ProxySettings />
        </div>
      </el-tab-pane>

      <el-tab-pane label="平台配置" name="platform">
        <div class="settings-card">
          <PlatformSettings />
        </div>
      </el-tab-pane>

      <el-tab-pane label="License" name="license">
        <div class="settings-card">
          <LicenseSettings />
        </div>
      </el-tab-pane>

      <el-tab-pane label="通知设置" name="notification">
        <div class="settings-card">
          <NotificationSettings />
        </div>
      </el-tab-pane>

      <el-tab-pane label="数据管理" name="data">
        <div class="settings-card">
          <DataManagementSettings />
        </div>
      </el-tab-pane>

      <el-tab-pane label="关于" name="about">
        <div class="settings-card">
          <AboutPanel />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/renderer/stores/settings';
import type { AppSettings } from '@/renderer/stores/settings';
import FingerprintSettings from '@/renderer/components/settings/FingerprintSettings.vue';
import ProxySettings from '@/renderer/components/settings/ProxySettings.vue';
import PlatformSettings from '@/renderer/components/settings/PlatformSettings.vue';
import LicenseSettings from '@/renderer/components/settings/LicenseSettings.vue';
import NotificationSettings from '@/renderer/components/settings/NotificationSettings.vue';
import DataManagementSettings from '@/renderer/components/settings/DataManagementSettings.vue';
import AboutPanel from '@/renderer/components/settings/AboutPanel.vue';

const settings = useSettingsStore();
const activeTab = ref('general');

onMounted(() => {
  settings.fetchSettings();
});

async function onBrowserModeChange(mode: AppSettings['browserMode']) {
  await settings.updateSetting('browserMode', mode);
}

async function selectChromePath() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.app,.exe';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      const filePath = (file as File & { path?: string }).path || file.name;
      settings.updateSetting('chromePath', filePath);
    }
  };
  input.click();
}

async function selectFingerprintPath() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.app,.exe';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      const filePath = (file as File & { path?: string }).path || file.name;
      settings.updateSetting('fingerprintBrowserPath', filePath);
    }
  };
  input.click();
}
</script>

<style scoped>
.page-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.page-settings__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.settings-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--space-4);
}

.settings-card {
  max-width: 640px;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-hint {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-secondary, #909399);
  margin: var(--space-1, 4px) 0 0 0;
  line-height: 1.5;
}
</style>
