<template>
  <OnboardingLayout
    :active-step="currentStep"
    :show-back="currentStep > 0 && currentStep < 3"
    :show-next="currentStep < 3"
    :show-skip="currentStep === 1 || currentStep === 2"
    :next-disabled="nextDisabled"
    :next-label="currentStep === 2 ? '完成配置' : '下一步'"
    @next="handleNext"
    @back="currentStep--"
    @skip="handleSkip"
  >
    <!-- Step 0: Welcome -->
    <template v-if="currentStep === 0">
      <div class="step-welcome">
        <h2 class="step-welcome__title">欢迎使用 MatrixFlow</h2>
        <p class="step-welcome__desc">
          一站式多平台内容分发工具，让你的创作触达更多受众。
        </p>
        <div class="step-welcome__features">
          <div class="feature-item">
            <el-icon :size="24" color="var(--color-primary)"><Platform /></el-icon>
            <div>
              <strong>四大平台</strong>
              <span>抖音 · 小红书 · 视频号 · 快手</span>
            </div>
          </div>
          <div class="feature-item">
            <el-icon :size="24" color="var(--color-success)"><Promotion /></el-icon>
            <div>
              <strong>批量发布</strong>
              <span>多账号一键同步分发</span>
            </div>
          </div>
          <div class="feature-item">
            <el-icon :size="24" color="var(--color-warning)"><MagicStick /></el-icon>
            <div>
              <strong>AI 助手</strong>
              <span>智能标题、标签、发布时间建议</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Step 1: Add Account -->
    <template v-if="currentStep === 1">
      <div class="step-account">
        <h3 class="step-account__title">添加第一个账号</h3>
        <p class="step-account__desc">选择一个平台并登录你的账号。</p>

        <el-select
          v-model="selectedPlatform"
          placeholder="选择平台"
          size="large"
          class="step-account__select"
        >
          <el-option label="抖音" value="douyin" />
          <el-option label="小红书" value="xiaohongshu" />
          <el-option label="视频号" value="channels" />
          <el-option label="快手" value="kuaishou" />
        </el-select>

        <el-button
          type="primary"
          size="large"
          :disabled="!selectedPlatform"
          :loading="loginLoading"
          class="step-account__login-btn"
          @click="handleLogin"
        >
          扫码登录
        </el-button>

        <p v-if="accountAdded" class="step-account__success">
          <el-icon color="var(--color-success)"><CircleCheckFilled /></el-icon>
          账号添加成功！你可以继续添加或进入下一步。
        </p>
      </div>
    </template>

    <!-- Step 2: Browser Config -->
    <template v-if="currentStep === 2">
      <div class="step-browser">
        <h3 class="step-browser__title">浏览器配置</h3>
        <p class="step-browser__desc">
          选择 MatrixFlow 驱动浏览器的方式，后续可在设置中修改。
        </p>

        <el-radio-group
          v-model="browserMode"
          class="step-browser__radio-group"
        >
          <div class="browser-option" :class="{ 'browser-option--active': browserMode === 'embedded' }" @click="browserMode = 'embedded'">
            <el-radio value="embedded" size="large">
              <div class="browser-option__content">
                <strong>内嵌 Patchright</strong>
                <span>推荐 · 开箱即用，反检测能力最强</span>
              </div>
            </el-radio>
          </div>
          <div class="browser-option" :class="{ 'browser-option--active': browserMode === 'external_chrome' }" @click="browserMode = 'external_chrome'">
            <el-radio value="external_chrome" size="large">
              <div class="browser-option__content">
                <strong>外置 Chrome</strong>
                <span>使用本地安装的 Chrome 浏览器</span>
              </div>
            </el-radio>
          </div>
          <div class="browser-option" :class="{ 'browser-option--active': browserMode === 'external_fingerprint' }" @click="browserMode = 'external_fingerprint'">
            <el-radio value="external_fingerprint" size="large">
              <div class="browser-option__content">
                <strong>外置指纹浏览器</strong>
                <span>适合已有指纹浏览器的用户</span>
              </div>
            </el-radio>
          </div>
        </el-radio-group>

        <template v-if="browserMode === 'external_chrome'">
          <el-input
            v-model="chromePath"
            placeholder="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            class="step-browser__path-input"
          >
            <template #prepend>Chrome 路径</template>
          </el-input>
        </template>

        <template v-if="browserMode === 'external_fingerprint'">
          <el-input
            v-model="fingerprintBrowserPath"
            placeholder="选择指纹浏览器应用路径"
            class="step-browser__path-input"
          >
            <template #prepend>指纹浏览器路径</template>
          </el-input>
        </template>
      </div>
    </template>

    <!-- Step 3: Done -->
    <template v-if="currentStep === 3">
      <div class="step-done">
        <el-icon :size="48" color="var(--color-success)"><CircleCheckFilled /></el-icon>
        <h3 class="step-done__title">一切就绪！</h3>
        <p class="step-done__desc">
          你已完成初始设置，现在可以开始使用 MatrixFlow 管理和发布内容了。
        </p>
        <el-button
          type="primary"
          size="large"
          class="step-done__start-btn"
          @click="handleFinish"
        >
          开始使用 MatrixFlow
        </el-button>
      </div>
    </template>
  </OnboardingLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Platform, Promotion, MagicStick, CircleCheckFilled } from '@element-plus/icons-vue';
import { useSettingsStore } from '@/renderer/stores/settings';
import { useAccountStore } from '@/renderer/stores/account';
import type { AppSettings } from '@/renderer/stores/settings';
import OnboardingLayout from '@/renderer/layouts/OnboardingLayout.vue';

const router = useRouter();
const settingsStore = useSettingsStore();
const accountStore = useAccountStore();

const currentStep = ref(0);
const selectedPlatform = ref('');
const loginLoading = ref(false);
const accountAdded = ref(false);
const browserMode = ref<AppSettings['browserMode']>('embedded');
const chromePath = ref('');
const fingerprintBrowserPath = ref('');

const nextDisabled = computed(() => {
  if (currentStep.value === 1) return false;
  return false;
});

async function handleNext() {
  if (currentStep.value === 2) {
    const patch: Partial<AppSettings> = { browserMode: browserMode.value };
    if (browserMode.value === 'external_chrome') {
      patch.chromePath = chromePath.value;
    }
    if (browserMode.value === 'external_fingerprint') {
      patch.fingerprintBrowserPath = fingerprintBrowserPath.value;
    }
    await settingsStore.updateSettings(patch);
  }
  currentStep.value++;
}

function handleSkip() {
  currentStep.value++;
}

async function handleLogin() {
  if (!selectedPlatform.value) return;
  loginLoading.value = true;
  try {
    const account = await accountStore.createAccount({
      platform: selectedPlatform.value,
    } as any);
    if (account?.id) {
      await accountStore.loginAccount(account.id);
    }
    accountAdded.value = true;
    ElMessage.success('登录请求已发送');
  } catch {
    ElMessage.error('登录失败，请稍后重试');
  } finally {
    loginLoading.value = false;
  }
}

async function handleFinish() {
  await settingsStore.updateSetting('onboardingCompleted', true);
  router.replace('/');
}
</script>

<style scoped>
/* ── Step 0: Welcome ── */
.step-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.step-welcome__title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.step-welcome__desc {
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  line-height: var(--line-height-base);
}

.step-welcome__features {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  margin-top: var(--space-4);
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-page);
  border-radius: var(--border-radius-md);
}

.feature-item strong {
  display: block;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.feature-item span {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* ── Step 1: Add Account ── */
.step-account {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.step-account__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.step-account__desc {
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
}

.step-account__select {
  width: 100%;
  max-width: 320px;
}

.step-account__login-btn {
  width: 100%;
  max-width: 320px;
}

.step-account__success {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-success);
  margin: 0;
}

/* ── Step 2: Browser ── */
.step-browser {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.step-browser__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.step-browser__desc {
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-base);
}

.step-browser__radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.browser-option {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.browser-option:hover {
  border-color: var(--color-primary-light);
}

.browser-option--active {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.04);
}

.browser-option__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.browser-option__content strong {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.browser-option__content span {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.step-browser__path-input {
  margin-top: var(--space-2);
}

/* ── Step 3: Done ── */
.step-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) 0;
}

.step-done__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.step-done__desc {
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  max-width: 400px;
  line-height: var(--line-height-base);
}

.step-done__start-btn {
  margin-top: var(--space-4);
}
</style>
