<template>
  <div class="page-accounts">
    <!-- 页面标题区 -->
    <div class="page-accounts__header">
      <h2 class="page-accounts__title">账号管理</h2>
      <div class="page-accounts__actions">
        <el-button type="primary" @click="bindDialogVisible = true">
          <el-icon><Plus /></el-icon>
          添加账号
        </el-button>
        <el-button @click="$router.push('/groups')">
          <el-icon><Grid /></el-icon>
          分组管理
        </el-button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="page-accounts__stats">
      <div class="stat-card">
        <span class="stat-card__value">{{ accountStore.totalCount }}</span>
        <span class="stat-card__label">总账号</span>
      </div>
      <div class="stat-card stat-card--success">
        <span class="stat-card__value">{{ accountStore.onlineCount }}</span>
        <span class="stat-card__label">在线</span>
      </div>
      <div class="stat-card stat-card--warning">
        <span class="stat-card__value">{{ expiredCount }}</span>
        <span class="stat-card__label">已过期</span>
      </div>
      <div class="stat-card stat-card--danger">
        <span class="stat-card__value">{{ cookieInvalidCount }}</span>
        <span class="stat-card__label">Cookie失效</span>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="page-accounts__toolbar">
      <div class="page-accounts__filters">
        <el-radio-group v-model="platformFilter" size="default">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="douyin">抖音</el-radio-button>
          <el-radio-button value="xiaohongshu">小红书</el-radio-button>
          <el-radio-button value="channels">视频号</el-radio-button>
          <el-radio-button value="kuaishou">快手</el-radio-button>
        </el-radio-group>

        <el-select
          v-model="groupFilter"
          placeholder="选择分组"
          clearable
          style="width: 140px"
        >
          <el-option
            v-for="g in mockGroups"
            :key="g.id"
            :label="g.name"
            :value="g.id"
          />
        </el-select>

        <el-input
          v-model="searchQuery"
          placeholder="搜索账号名称..."
          prefix-icon="Search"
          clearable
          style="width: 200px"
        />
      </div>

      <!-- 批量操作 -->
      <transition name="batch-slide">
        <div v-if="selectedIds.length > 0" class="page-accounts__batch">
          <span class="page-accounts__batch-count">已选 {{ selectedIds.length }} 项</span>
          <el-select
            v-model="batchGroupId"
            placeholder="移入分组"
            size="small"
            style="width: 120px"
            @change="handleBatchGroup"
          >
            <el-option
              v-for="g in mockGroups"
              :key="g.id"
              :label="g.name"
              :value="g.id"
            />
          </el-select>
          <el-popconfirm title="确定删除选中的账号？" @confirm="handleBatchDelete">
            <template #reference>
              <el-button type="danger" size="small">批量删除</el-button>
            </template>
          </el-popconfirm>
          <el-button size="small" @click="selectedIds = []">取消选择</el-button>
        </div>
      </transition>
    </div>

    <!-- 账号卡片网格 -->
    <Loading v-if="accountStore.loading" />
    <Empty
      v-else-if="filteredAccounts.length === 0"
      text="暂无匹配的账号"
      action-label="添加账号"
      @action="bindDialogVisible = true"
    />
    <div v-else class="page-accounts__grid">
      <AccountCard
        v-for="account in filteredAccounts"
        :key="account.id"
        :account="account"
        :selected="selectedIds.includes(account.id)"
        :groups="mockGroups"
        @toggle-select="toggleSelect"
        @detail="handleDetail"
        @validate="handleCheckCookie"
        @login="handleLogin"
        @delete="handleDelete"
      />
    </div>

    <!-- 绑定账号弹窗 -->
    <BindAccountDialog
      v-model="bindDialogVisible"
      @success="handleRefresh"
    />

    <!-- 账号详情弹窗 -->
    <AccountDetailDialog
      v-model="detailDialogVisible"
      :account="selectedAccount"
      :groups="mockGroups"
      @changed="handleRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus, Grid } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAccountStore } from '@/renderer/stores/account';
import type { Account } from '@/renderer/stores/account';
import Loading from '@/renderer/components/common/Loading.vue';
import Empty from '@/renderer/components/common/Empty.vue';
import AccountCard from '@/renderer/components/account/AccountCard.vue';
import BindAccountDialog from '@/renderer/components/account/BindAccountDialog.vue';
import AccountDetailDialog from '@/renderer/components/account/AccountDetailDialog.vue';

const accountStore = useAccountStore();

// 筛选状态
const platformFilter = ref('');
const groupFilter = ref('');
const searchQuery = ref('');
const bindDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const selectedAccount = ref<Account | null>(null);
const selectedIds = ref<string[]>([]);
const batchGroupId = ref('');

// 分组数据（后续从独立分组 store 获取）
const mockGroups = ref<Array<{ id: string; name: string }>>([
  { id: 'g1', name: '默认分组' },
  { id: 'g2', name: '测试号' },
  { id: 'g3', name: '主力号' },
]);

// 筛选后的账号列表
const filteredAccounts = computed(() => {
  let list = accountStore.accounts;

  if (platformFilter.value) {
    list = list.filter((a) => a.platform === platformFilter.value);
  }
  if (groupFilter.value) {
    list = list.filter((a) => a.groupId === groupFilter.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((a) => a.nickname.toLowerCase().includes(q));
  }

  return list;
});

// 统计数据
const expiredCount = computed(() =>
  accountStore.accounts.filter((a) => a.status === 'expired').length,
);
const cookieInvalidCount = computed(() =>
  accountStore.accounts.filter((a) => !a.cookieValid).length,
);

onMounted(() => {
  accountStore.fetchAccounts();
});

function handleRefresh() {
  accountStore.fetchAccounts();
}

function handleDetail(id: string) {
  selectedAccount.value = accountStore.accounts.find(a => a.id === id) || null;
  detailDialogVisible.value = true;
}

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

async function handleLogin(id: string) {
  try {
    await accountStore.loginAccount(id);
    ElMessage.success('登录请求已发送');
  } catch {
    ElMessage.error('登录失败');
  }
}

async function handleCheckCookie(id: string) {
  try {
    const valid = await accountStore.checkCookie(id);
    ElMessage(valid ? 'Cookie 有效' : 'Cookie 已失效，请重新登录');
  } catch {
    ElMessage.error('检测失败');
  }
}

async function handleDelete(id: string) {
  await accountStore.deleteAccount(id);
  selectedIds.value = selectedIds.value.filter((sid) => sid !== id);
  ElMessage.success('已删除');
}

function handleBatchGroup(groupId: string) {
  if (!groupId) return;
  // 批量分组操作（通过 store 更新）
  accountStore.accounts.forEach((a) => {
    if (selectedIds.value.includes(a.id)) {
      a.groupId = groupId;
    }
  });
  ElMessage.success(`已将 ${selectedIds.value.length} 个账号移入分组`);
  batchGroupId.value = '';
  selectedIds.value = [];
}

async function handleBatchDelete() {
  for (const id of selectedIds.value) {
    await accountStore.deleteAccount(id);
  }
  ElMessage.success('批量删除完成');
  selectedIds.value = [];
}
</script>

<style scoped>
.page-accounts {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── 标题区 ── */
.page-accounts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-accounts__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.page-accounts__actions {
  display: flex;
  gap: var(--space-2);
}

/* ── 统计卡片 ── */
.page-accounts__stats {
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

.stat-card--danger .stat-card__value {
  color: var(--color-danger);
}

.stat-card__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}

/* ── 工具栏 ── */
.page-accounts__toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.page-accounts__filters {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.page-accounts__batch {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--color-primary-light);
}

.page-accounts__batch-count {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

.batch-slide-enter-active,
.batch-slide-leave-active {
  transition: all var(--transition-fast);
}

.batch-slide-enter-from,
.batch-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── 卡片网格 ── */
.page-accounts__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .page-accounts__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .page-accounts__stats {
    flex-wrap: wrap;
  }

  .stat-card {
    min-width: calc(50% - var(--space-3));
  }

  .page-accounts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
