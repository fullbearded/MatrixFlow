<template>
  <div class="publish-wizard">
    <el-steps :active="currentStep" finish-status="success" align-center class="pw-steps">
      <el-step title="选择内容" description="上传或从内容库选择" />
      <el-step title="选择分组" description="为内容指定发布分组" />
      <el-step title="确认排期" description="预览并确认发布计划" />
    </el-steps>

    <div class="pw-body">
      <WizardStepContent
        v-if="currentStep === 0"
        :selected="selectedContentIds"
        @update:selected="selectedContentIds = $event"
        @next="nextStep"
      />
      <WizardStepGroups
        v-else-if="currentStep === 1"
        :content-ids="selectedContentIds"
        :selected="selectedGroupIds"
        @update:selected="selectedGroupIds = $event"
        @prev="prevStep"
        @next="nextStep"
      />
      <WizardStepRules
        v-else-if="currentStep === 2"
        :content-ids="selectedContentIds"
        :group-ids="selectedGroupIds"
        @prev="prevStep"
        @confirm="handleConfirm"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import WizardStepContent from './WizardStepContent.vue';
import WizardStepGroups from './WizardStepGroups.vue';
import WizardStepRules from './WizardStepRules.vue';

export interface WizardConfirmedTask {
  contentId: string;
  groupId: string;
  accountIds: string[];
  scheduledAt: string;
  publishMode: string;
}

const emit = defineEmits<{
  confirmed: [tasks: WizardConfirmedTask[]];
  cancel: [];
}>();

const currentStep = ref(0);
const selectedContentIds = ref<string[]>([]);
const selectedGroupIds = ref<string[]>([]);

function nextStep() {
  if (currentStep.value < 2) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function handleConfirm(tasks: WizardConfirmedTask[]) {
  emit('confirmed', tasks);
}
</script>

<style scoped>
.publish-wizard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.pw-steps {
  padding: var(--space-5) var(--space-6) 0;
}

.pw-body {
  padding: var(--space-4) var(--space-6) var(--space-6);
}
</style>
