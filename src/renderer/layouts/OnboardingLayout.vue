<template>
  <div class="onboarding-layout">
    <div class="onboarding-layout__card">
      <div class="onboarding-layout__brand">
        <div class="onboarding-layout__logo">M</div>
        <h1 class="onboarding-layout__name">MatrixFlow</h1>
      </div>

      <el-steps
        :active="activeStep"
        :space="120"
        class="onboarding-layout__steps"
        finish-status="success"
        simple
      >
        <el-step title="欢迎" />
        <el-step title="添加账号" />
        <el-step title="浏览器" />
        <el-step title="完成" />
      </el-steps>

      <div class="onboarding-layout__content">
        <slot />
      </div>

      <div class="onboarding-layout__footer">
        <el-button
          v-if="showBack"
          @click="$emit('back')"
        >
          上一步
        </el-button>
        <div class="onboarding-layout__spacer" />
        <el-button
          v-if="showSkip"
          link
          type="info"
          @click="$emit('skip')"
        >
          跳过
        </el-button>
        <el-button
          v-if="showNext"
          type="primary"
          :disabled="nextDisabled"
          @click="$emit('next')"
        >
          {{ nextLabel }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeStep: number;
  showBack?: boolean;
  showNext?: boolean;
  showSkip?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
}>();

defineEmits<{
  next: [];
  back: [];
  skip: [];
}>();
</script>

<style scoped>
.onboarding-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-page);
}

.onboarding-layout__card {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-10) var(--space-8);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  margin: var(--space-6);
}

.onboarding-layout__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.onboarding-layout__logo {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
}

.onboarding-layout__name {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.onboarding-layout__steps {
  margin: 0 auto;
}

.onboarding-layout__content {
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.onboarding-layout__footer {
  display: flex;
  align-items: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.onboarding-layout__spacer {
  flex: 1;
}
</style>
