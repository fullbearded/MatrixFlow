<template>
  <div
    class="account-card"
    :class="{
      'account-card--expired': account.status === 'expired',
      'account-card--selected': selected,
    }"
    @click="$emit('toggleSelect', account.id)"
  >
    <div class="account-card__header">
      <el-checkbox
        :model-value="selected"
        class="account-card__checkbox"
        @click.stop
        @change="$emit('toggleSelect', account.id)"
      />
      <el-avatar :size="40" :src="account.avatar" class="account-card__avatar">
        {{ account.nickname?.charAt(0) || '?' }}
      </el-avatar>
      <div class="account-card__info">
        <span class="account-card__name">{{ account.nickname }}</span>
        <el-tag :type="platformTagType" size="small" effect="plain" class="account-card__platform">
          {{ platformLabel }}
        </el-tag>
      </div>
    </div>

    <div class="account-card__status">
      <span class="account-card__status-dot" :class="`account-card__status-dot--${account.status}`" />
      <span class="account-card__status-text">{{ statusLabel }}</span>
      <el-tag
        :type="account.cookieValid ? 'success' : 'danger'"
        size="small"
        round
        class="account-card__cookie-tag"
      >
        Cookie{{ account.cookieValid ? '有效' : '失效' }}
      </el-tag>
    </div>

    <div v-if="account.groupId" class="account-card__group">
      <el-icon :size="12"><FolderOpened /></el-icon>
      <span>{{ groupName }}</span>
    </div>

    <div class="account-card__bindings" v-if="account.fingerprintId || account.proxyId">
      <el-tag v-if="account.fingerprintId" size="small" type="info" effect="plain" class="binding-tag">
        指纹已绑定
      </el-tag>
      <el-tag v-if="account.proxyId" size="small" type="warning" effect="plain" class="binding-tag">
        代理已绑定
      </el-tag>
    </div>

    <div class="account-card__footer">
      <span class="account-card__time">{{ account.lastLogin || '未登录' }}</span>
      <div class="account-card__actions" @click.stop>
        <el-tooltip content="详情配置" placement="top">
          <el-button text size="small" @click="$emit('detail', account.id)">
            <el-icon><Setting /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="检测Cookie" placement="top">
          <el-button text size="small" @click="$emit('validate', account.id)">
            <el-icon><CircleCheck /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重新登录" placement="top">
          <el-button text size="small" @click="$emit('login', account.id)">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>
        <el-popconfirm title="确定删除该账号？" @confirm="$emit('delete', account.id)">
          <template #reference>
            <el-button text size="small" type="danger">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FolderOpened, CircleCheck, RefreshRight, Delete, Setting } from '@element-plus/icons-vue';
import type { Account } from '@/renderer/stores/account';

const props = defineProps<{
  account: Account;
  selected?: boolean;
  groups: Array<{ id: string; name: string }>;
}>();

defineEmits<{
  toggleSelect: [id: string];
  detail: [id: string];
  validate: [id: string];
  login: [id: string];
  delete: [id: string];
}>();

const platformMap: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  channels: '视频号',
  kuaishou: '快手',
  bilibili: 'B站',
};

const platformTagTypeMap: Record<string, string> = {
  douyin: '',
  xiaohongshu: 'danger',
  channels: 'success',
  kuaishou: 'warning',
  bilibili: 'primary',
};

const platformLabel = computed(() => platformMap[props.account.platform] || props.account.platform);
const platformTagType = computed(() => platformTagTypeMap[props.account.platform] || 'info');

const statusLabel = computed(() => {
  const map: Record<string, string> = { online: '在线', offline: '离线', expired: '已过期' };
  return map[props.account.status] || props.account.status;
});

const groupName = computed(() => {
  const g = props.groups.find((g) => g.id === props.account.groupId);
  return g?.name || '';
});
</script>

<style scoped>
.account-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.account-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
}

.account-card--selected {
  border-color: var(--color-primary);
  background: rgba(64, 158, 255, 0.04);
}

.account-card--expired {
  opacity: 0.7;
}

.account-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.account-card__checkbox {
  flex-shrink: 0;
}

.account-card__avatar {
  flex-shrink: 0;
  background: var(--color-primary-light);
  color: #fff;
  font-weight: var(--font-weight-semibold);
}

.account-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.account-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-card__platform {
  width: fit-content;
}

.account-card__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
}

.account-card__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.account-card__status-dot--online {
  background: var(--color-success);
  box-shadow: 0 0 4px var(--color-success);
}

.account-card__status-dot--offline {
  background: var(--color-text-placeholder);
}

.account-card__status-dot--expired {
  background: var(--color-danger);
}

.account-card__status-text {
  color: var(--color-text-secondary);
}

.account-card__cookie-tag {
  margin-left: auto;
}

.account-card__group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.account-card__bindings {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.binding-tag {
  font-size: 10px;
}

.account-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-light);
}

.account-card__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

.account-card__actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.account-card:hover .account-card__actions {
  opacity: 1;
}
</style>
