<template>
  <div class="page-stats">
    <!-- Tabs -->
    <el-tabs v-model="activeTab" class="stats-tabs">
      <el-tab-pane label="数据概览" name="overview">
        <div v-loading="statsStore.loading">
    <!-- KPI 卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__header">
          <el-icon :size="24" color="var(--color-primary)"><User /></el-icon>
          <span class="stat-card__title">账号总数</span>
        </div>
        <span class="stat-card__value">{{ accountStore.totalCount }}</span>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <el-icon :size="24" color="var(--color-success)"><CircleCheck /></el-icon>
          <span class="stat-card__title">在线账号</span>
        </div>
        <span class="stat-card__value">{{ accountStore.onlineCount }}</span>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <el-icon :size="24" color="var(--color-warning)"><VideoCamera /></el-icon>
          <span class="stat-card__title">内容总数</span>
        </div>
        <span class="stat-card__value">{{ contentStore.contents.length }}</span>
      </div>
      <div class="stat-card">
        <div class="stat-card__header">
          <el-icon :size="24" color="var(--color-info)"><TrendCharts /></el-icon>
          <span class="stat-card__title">发布成功率</span>
        </div>
        <span class="stat-card__value">{{ statsStore.successRate }}%</span>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="stats-filter">
      <el-radio-group v-model="dateRange" size="default" @change="onFilterChange">
        <el-radio-button value="7">近 7 天</el-radio-button>
        <el-radio-button value="30">近 30 天</el-radio-button>
        <el-radio-button value="90">近 90 天</el-radio-button>
      </el-radio-group>
      <el-select
        v-model="selectedPlatforms"
        multiple
        collapse-tags
        collapse-tags-tooltip
        placeholder="全部平台"
        size="default"
        style="width: 240px"
        @change="onFilterChange"
      >
        <el-option label="抖音" value="douyin" />
        <el-option label="小红书" value="xiaohongshu" />
        <el-option label="视频号" value="channels" />
        <el-option label="快手" value="kuaishou" />
      </el-select>
    </div>

    <!-- 趋势图 -->
    <TrendChart
      :title="trendTitle"
      :dates="trendDates"
      :series="trendSeries"
      :chart-type="'area'"
      :colors="['#409eff', '#67c23a', '#e6a23c']"
    />

    <!-- 平台对比 -->
    <PlatformComparison :platforms="filteredPlatformMetrics" />

    <!-- 账号排行榜 -->
    <div class="ranking-section">
      <div class="section-header">
        <h3>账号排行榜</h3>
        <el-select v-model="rankingMetric" size="small" style="width: 120px;">
          <el-option label="播放量" value="playCount" />
          <el-option label="点赞数" value="likeCount" />
          <el-option label="发布数" value="publishCount" />
        </el-select>
      </div>
      <el-table :data="sortedRanking" style="width: 100%">
        <el-table-column label="排名" width="80">
          <template #default="{ $index }">
            <el-tag :type="$index < 3 ? 'warning' : 'info'" size="small">
              {{ $index + 1 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="accountName" label="账号" min-width="150" />
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ getPlatformLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publishCount" label="发布数" width="100" />
        <el-table-column prop="playCount" label="播放量" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.playCount) }}
          </template>
        </el-table-column>
        <el-table-column prop="likeCount" label="点赞数" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.likeCount) }}
          </template>
        </el-table-column>
        <el-table-column prop="successRate" label="成功率" width="100">
          <template #default="{ row }">
            <el-progress :percentage="row.successRate" :stroke-width="6" :show-text="false" />
            <span style="font-size: 12px;">{{ row.successRate }}%</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 发布量柱状趋势 -->
    <TrendChart
      title="发布量趋势"
      :dates="trendDates"
      :series="publishTrendSeries"
      chart-type="bar"
    />
        </div>
      </el-tab-pane>

      <el-tab-pane label="数据监控" name="monitor">
        <MonitorPanel />
      </el-tab-pane>

      <el-tab-pane label="AI 周报" name="report">
        <WeeklyReportPanel />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { User, CircleCheck, VideoCamera, TrendCharts } from '@element-plus/icons-vue';
import { useAccountStore } from '@/renderer/stores/account';
import { useContentStore } from '@/renderer/stores/content';
import { useTaskStore } from '@/renderer/stores/task';
import { useStatsStore } from '@/renderer/stores/stats';
import { TrendChart, PlatformComparison } from '@/renderer/components/charts';
import { isDark } from '@/renderer/components/charts';
import type { TrendSeries } from '@/renderer/components/charts/TrendChart.vue';
import type { PlatformMetric } from '@/renderer/components/charts/PlatformComparison.vue';
import WeeklyReportPanel from '@/renderer/components/stats/WeeklyReportPanel.vue';
import MonitorPanel from '@/renderer/components/stats/MonitorPanel.vue';

const activeTab = ref('overview');
const accountStore = useAccountStore();
const contentStore = useContentStore();
const taskStore = useTaskStore();
const statsStore = useStatsStore();

const dateRange = ref<'7' | '30' | '90'>('30');
const selectedPlatforms = ref<string[]>([]);
const rankingMetric = ref<'playCount' | 'likeCount' | 'publishCount'>('playCount');

onMounted(() => {
  accountStore.fetchAccounts();
  contentStore.fetchContents();
  taskStore.fetchTasks();
  statsStore.fetchAll(dateRange.value);
  statsStore.fetchAccountRanking();
});

onUnmounted(() => {
  observer.disconnect();
});

function onFilterChange() {
  statsStore.fetchAll(dateRange.value);
}

const trendDates = computed(() => {
  const data = statsStore.trendData;
  if (data.length === 0) return generateDates(Number(dateRange.value));
  return data.map((p) => {
    const d = new Date(p.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
});

const trendTitle = computed(() => `互动数据趋势（近 ${dateRange.value} 天）`);

const trendSeries = computed<TrendSeries[]>(() => {
  const data = statsStore.trendData;
  if (data.length === 0) return [];
  return [
    {
      name: '播放量',
      data: data.map((p) => p.value),
    },
  ];
});

const publishTrendSeries = computed<TrendSeries[]>(() => {
  const data = statsStore.trendData;
  if (data.length === 0) return [];
  return [
    {
      name: '发布量',
      data: data.map((p) => p.value),
    },
  ];
});

const allPlatformMetrics = computed<PlatformMetric[]>(() => {
  const raw = statsStore.platformStats;
  if (raw.length === 0) return [];
  return raw.map((p) => ({
    platform: getPlatformLabel(p.platform),
    publishCount: p.publishCount,
    successRate: p.successRate ?? (p.accountCount > 0 ? Math.round((p.publishCount / p.accountCount) * 100) : 0),
    engagement: p.playCount > 0 ? Math.min(100, Math.round((p.likeCount / p.playCount) * 1000)) : 0,
    reach: p.playCount > 0 ? Math.min(100, Math.round((p.playCount / (p.publishCount || 1)) / 100)) : 0,
    consistency: p.accountCount > 0 ? Math.round((p.publishCount / p.accountCount) * 10) : 0,
    speed: p.publishCount > 0 ? 70 : 0,
  }));
});

const filteredPlatformMetrics = computed(() => {
  if (selectedPlatforms.value.length === 0) return allPlatformMetrics.value;
  return allPlatformMetrics.value.filter((p) => {
    const platformKey = getPlatformKey(p.platform);
    return selectedPlatforms.value.includes(platformKey);
  });
});

const sortedRanking = computed(() => {
  const ranking = statsStore.accountRanking;
  return [...ranking].sort((a, b) => b[rankingMetric.value] - a[rankingMetric.value]);
});

function generateDates(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return result;
}

function formatNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '亿';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  return n.toLocaleString('zh-CN');
}

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    channels: '视频号',
    wechat: '视频号',
    kuaishou: '快手',
  };
  return labels[platform] || platform;
}

function getPlatformKey(label: string): string {
  const keys: Record<string, string> = {
    '抖音': 'douyin',
    '小红书': 'xiaohongshu',
    '视频号': 'channels',
    '快手': 'kuaishou',
  };
  return keys[label] || label;
}

isDark.value = document.documentElement.classList.contains('dark');
const observer = new MutationObserver(() => {
  isDark.value = document.documentElement.classList.contains('dark');
});
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
</script>

<style scoped>
.page-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.stats-tabs {
  --el-tabs-header-height: 44px;
}

.stats-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--space-4);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.stat-card {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.stat-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.stat-card__title {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.stat-card__value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.stats-filter {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.ranking-section {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
