<template>
  <div class="page-groups">
    <div class="page-groups__header">
      <h2 class="page-groups__title">分组管理</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        创建分组
      </el-button>
    </div>

    <!-- 统计概览 -->
    <div class="page-groups__stats">
      <div class="stat-card">
        <span class="stat-card__value">{{ groupStore.groupCount }}</span>
        <span class="stat-card__label">分组总数</span>
      </div>
      <div class="stat-card stat-card--success">
        <span class="stat-card__value">{{ totalAccountsBound }}</span>
        <span class="stat-card__label">已绑定账号</span>
      </div>
      <div class="stat-card stat-card--warning">
        <span class="stat-card__value">{{ activeRuleCount }}</span>
        <span class="stat-card__label">已配置规则</span>
      </div>
    </div>

    <!-- 分组卡片列表 -->
    <Loading v-if="groupStore.loading" />
    <Empty
      v-else-if="groupStore.groups.length === 0"
      text="暂无分组，创建分组来批量管理账号"
      action-label="创建分组"
      @action="openCreateDialog"
    />
    <div v-else class="page-groups__grid">
      <GroupCard
        v-for="group in groupStore.groups"
        :key="group.id"
        :group="group"
        @edit="openEditDialog"
        @manage-accounts="openBindDialog"
        @config-rules="openRuleDialog"
        @delete="handleDelete"
      />
    </div>

    <!-- 弹窗 -->
    <GroupEditDialog
      v-model="editDialogVisible"
      :group="editingGroup"
      @saved="onSaved"
    />
    <AccountBindDialog
      v-model="bindDialogVisible"
      :group="selectedGroup"
    />
    <PublishRuleDialog
      v-model="ruleDialogVisible"
      :group="selectedGroup"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useGroupStore, type Group } from '@/renderer/stores/group';
import { useAccountStore } from '@/renderer/stores/account';
import Loading from '@/renderer/components/common/Loading.vue';
import Empty from '@/renderer/components/common/Empty.vue';
import GroupCard from '@/renderer/components/group/GroupCard.vue';
import GroupEditDialog from '@/renderer/components/group/GroupEditDialog.vue';
import AccountBindDialog from '@/renderer/components/group/AccountBindDialog.vue';
import PublishRuleDialog from '@/renderer/components/group/PublishRuleDialog.vue';

const groupStore = useGroupStore();
const accountStore = useAccountStore();

const editDialogVisible = ref(false);
const bindDialogVisible = ref(false);
const ruleDialogVisible = ref(false);
const editingGroup = ref<Group | null>(null);
const selectedGroup = ref<Group | null>(null);

const totalAccountsBound = computed(() =>
  groupStore.groups.reduce((sum, g) => sum + g.accountIds.length, 0),
);

const activeRuleCount = computed(() =>
  groupStore.groups.filter((g) => g.publishRule.platforms.length > 0).length,
);

onMounted(() => {
  groupStore.fetchGroups();
  accountStore.fetchAccounts();
});

function openCreateDialog() {
  editingGroup.value = null;
  editDialogVisible.value = true;
}

function openEditDialog(group: Group) {
  editingGroup.value = group;
  editDialogVisible.value = true;
}

function openBindDialog(group: Group) {
  selectedGroup.value = group;
  bindDialogVisible.value = true;
}

function openRuleDialog(group: Group) {
  selectedGroup.value = group;
  ruleDialogVisible.value = true;
}

async function handleDelete(id: string) {
  await groupStore.deleteGroup(id);
  ElMessage.success('分组已删除');
}

function onSaved() {
  groupStore.fetchGroups();
}
</script>

<style scoped>
.page-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.page-groups__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-groups__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.page-groups__stats {
  display: flex;
  gap: var(--space-3);
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
}

.stat-card__value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.stat-card--success .stat-card__value {
  color: var(--color-success);
}

.stat-card--warning .stat-card__value {
  color: var(--color-warning);
}

.stat-card__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}

.page-groups__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .page-groups__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .page-groups__stats {
    flex-wrap: wrap;
  }

  .stat-card {
    min-width: calc(50% - var(--space-3));
  }

  .page-groups__grid {
    grid-template-columns: 1fr;
  }
}
</style>
