<template>
  <el-dialog
    :model-value="modelValue"
    title="管理分组账号"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bind-header">
      <span class="bind-header__label">
        分组：<strong>{{ group?.name }}</strong>
      </span>
      <span class="bind-header__count">
        已选 {{ selectedIds.length }} 个账号
      </span>
    </div>

    <el-input
      v-model="searchQuery"
      placeholder="搜索账号名称..."
      prefix-icon="Search"
      clearable
      class="bind-search"
    />

    <div class="bind-list">
      <div
        v-for="account in filteredAccounts"
        :key="account.id"
        class="bind-item"
        :class="{ 'bind-item--selected': selectedIds.includes(account.id) }"
        @click="toggleAccount(account.id)"
      >
        <el-checkbox :model-value="selectedIds.includes(account.id)" @click.stop />
        <el-avatar :size="28" class="bind-item__avatar">
          {{ account.nickname?.charAt(0) || '?' }}
        </el-avatar>
        <span class="bind-item__name">{{ account.nickname }}</span>
        <el-tag size="small" effect="plain">{{ platformLabel(account.platform) }}</el-tag>
        <span
          class="bind-item__status"
          :class="`bind-item__status--${account.status}`"
        />
      </div>

      <Empty v-if="filteredAccounts.length === 0" text="没有匹配的账号" />
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSave">
        保存绑定 ({{ selectedIds.length }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useAccountStore } from '@/renderer/stores/account';
import { useGroupStore, type Group } from '@/renderer/stores/group';
import Empty from '@/renderer/components/common/Empty.vue';

const props = defineProps<{
  modelValue: boolean;
  group: Group | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const accountStore = useAccountStore();
const groupStore = useGroupStore();

const searchQuery = ref('');
const selectedIds = ref<string[]>([]);
const submitting = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.group) {
      selectedIds.value = [...props.group.accountIds];
      searchQuery.value = '';
    }
  },
);

const filteredAccounts = computed(() => {
  if (!searchQuery.value) return accountStore.accounts;
  const q = searchQuery.value.toLowerCase();
  return accountStore.accounts.filter((a) =>
    a.nickname.toLowerCase().includes(q),
  );
});

function toggleAccount(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

const platformMap: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  channels: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
};

function platformLabel(key: string): string {
  return platformMap[key] || key;
}

async function handleSave() {
  if (!props.group) return;
  submitting.value = true;
  try {
    await groupStore.bindAccounts(props.group.id, selectedIds.value);
    ElMessage.success('账号绑定已更新');
    emit('update:modelValue', false);
  } catch {
    ElMessage.error('保存失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.bind-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.bind-header__label {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.bind-header__label strong {
  color: var(--color-primary);
}

.bind-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.bind-search {
  margin-bottom: var(--space-3);
}

.bind-list {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.bind-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.bind-item:hover {
  background: var(--color-bg-page);
}

.bind-item--selected {
  background: rgba(64, 158, 255, 0.06);
}

.bind-item__avatar {
  flex-shrink: 0;
  background: var(--color-primary-light);
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.bind-item__name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bind-item__status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bind-item__status--online {
  background: var(--color-success);
  box-shadow: 0 0 4px var(--color-success);
}

.bind-item__status--offline {
  background: var(--color-text-placeholder);
}

.bind-item__status--expired {
  background: var(--color-danger);
}
</style>
