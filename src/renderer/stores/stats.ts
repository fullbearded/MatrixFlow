import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type StatsTimeRange = 'today' | 'week' | 'month' | 'custom';

export interface OverviewStat {
  label: string;
  value: number;
  change: number;
  icon: string;
  color: string;
}

export interface PlatformStat {
  platform: string;
  accountCount: number;
  publishCount: number;
  playCount: number;
  likeCount: number;
  commentCount: number;
  avgPlay: number;
  successRate?: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface AccountRanking {
  accountId: string;
  accountName: string;
  platform: string;
  publishCount: number;
  playCount: number;
  likeCount: number;
  successRate: number;
}

function formatNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '亿';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  return n.toLocaleString('zh-CN');
}

function daysToRange(days: string): string {
  switch (days) {
    case '7': return 'week';
    case '30': return 'month';
    case '90': return 'quarter';
    default: return 'month';
  }
}

export const useStatsStore = defineStore('stats', () => {
  const loading = ref(false);
  const timeRange = ref<StatsTimeRange>('week');

  const rawOverview = ref({
    totalPlays: 0,
    totalLikes: 0,
    totalComments: 0,
    totalPublishes: 0,
    successPublishes: 0,
    failedPublishes: 0,
    playChange: 0,
    likeChange: 0,
    commentChange: 0,
    publishChange: 0,
    successRate: 0,
  });

  const platformStats = ref<PlatformStat[]>([]);
  const trendData = ref<TrendPoint[]>([]);
  const accountRanking = ref<AccountRanking[]>([]);

  const latestReport = ref<any>(null);
  const reportLoading = ref(false);

  const successRate = computed(() => {
    const total = rawOverview.value.totalPublishes;
    const success = rawOverview.value.successPublishes;
    return total > 0 ? Math.round((success / total) * 100) : 0;
  });

  const overviewCards = computed<OverviewStat[]>(() => {
    const o = rawOverview.value;
    return [
      {
        label: '总播放量',
        value: o.totalPlays,
        change: o.playChange,
        icon: 'View',
        color: 'var(--color-primary)',
      },
      {
        label: '总点赞数',
        value: o.totalLikes,
        change: o.likeChange,
        icon: 'Star',
        color: 'var(--color-warning)',
      },
      {
        label: '总评论数',
        value: o.totalComments,
        change: o.commentChange,
        icon: 'ChatDotRound',
        color: 'var(--color-success)',
      },
      {
        label: '发布数量',
        value: o.totalPublishes,
        change: o.publishChange,
        icon: 'Upload',
        color: 'var(--color-danger)',
      },
      {
        label: '发布成功率',
        value: successRate.value,
        change: 0,
        icon: 'CircleCheck',
        color: successRate.value >= 90 ? 'var(--color-success)' : successRate.value >= 70 ? 'var(--color-warning)' : 'var(--color-danger)',
      },
    ];
  });

  const platformTableData = computed(() =>
    platformStats.value.map((p) => ({
      ...p,
      playCountDisplay: formatNumber(p.playCount),
      likeCountDisplay: formatNumber(p.likeCount),
      avgPlayDisplay: formatNumber(p.avgPlay),
      successRateDisplay: p.successRate !== undefined ? `${p.successRate}%` : '-',
    })),
  );

  function setTimeRange(range: StatsTimeRange) {
    timeRange.value = range;
    fetchAll();
  }

  async function fetchAll(days?: string) {
    if (!window.matrixflow) return;
    loading.value = true;
    try {
      const range = days ? daysToRange(days) : timeRange.value;
      const [overview, platforms, trend] = await Promise.all([
        window.matrixflow.stats.getOverview(range),
        window.matrixflow.stats.getPlatformStats('all', range),
        window.matrixflow.stats.getTrend('play_count', range),
      ]);
      if (overview) {
        rawOverview.value = {
          totalPlays: overview.totalPlays ?? 0,
          totalLikes: overview.totalLikes ?? 0,
          totalComments: 0,
          totalPublishes: overview.totalPublishes ?? 0,
          successPublishes: overview.totalPublishes ?? 0,
          failedPublishes: 0,
          playChange: 0,
          likeChange: 0,
          commentChange: 0,
          publishChange: 0,
          successRate: 100,
        };
      }
      if (platforms) {
        const platformList = Array.isArray(platforms) ? platforms : [platforms];
        platformStats.value = platformList.map((p: any) => ({
          platform: p.platform,
          accountCount: p.accountCount ?? 0,
          publishCount: p.totalVideos ?? 0,
          playCount: p.totalPlays ?? 0,
          likeCount: p.totalLikes ?? 0,
          commentCount: 0,
          avgPlay: p.totalVideos > 0 ? Math.round((p.totalPlays ?? 0) / p.totalVideos) : 0,
          successRate: p.accountCount > 0 ? Math.min(100, Math.round((p.totalVideos ?? 0) / p.accountCount) * 20) : 0,
        }));
      }
      if (trend) {
        trendData.value = Array.isArray(trend) ? trend.map((t: any) => ({
          date: t.date instanceof Date ? t.date.toISOString() : t.date,
          value: t.value ?? 0,
        })) : [];
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchAccountRanking() {
    if (!window.matrixflow) return;
    try {
      const [accountsRes, overviewRes] = await Promise.all([
        window.matrixflow.accounts.list(),
        window.matrixflow.stats.getOverview(timeRange.value),
      ]);

      const accounts = (accountsRes as any)?.data ?? accountsRes ?? [];
      const accountList = Array.isArray(accounts) ? accounts : [];

      const platformStatsMap = new Map<string, { totalPlays: number; totalLikes: number; totalVideos: number; accountCount: number }>();
      if (overviewRes) {
        const overview = (overviewRes as any)?.data ?? overviewRes;
        const pMap = overview?.platformStats;
        if (pMap && typeof pMap === 'object') {
          for (const [platform, stats] of Object.entries(pMap)) {
            const s = stats as any;
            platformStatsMap.set(platform, {
              totalPlays: s.totalPlays ?? 0,
              totalLikes: s.totalLikes ?? 0,
              totalVideos: s.totalVideos ?? 0,
              accountCount: s.accountCount ?? 0,
            });
          }
        }
      }

      accountRanking.value = accountList.map((acc: any) => {
        const ps = platformStatsMap.get(acc.platform);
        const count = ps?.accountCount ?? 1;
        const shareFactor = 1 / Math.max(count, 1);
        const publishCount = Math.round((ps?.totalVideos ?? 0) * shareFactor);
        const playCount = Math.round((ps?.totalPlays ?? 0) * shareFactor);
        const likeCount = Math.round((ps?.totalLikes ?? 0) * shareFactor);
        const successRate = publishCount > 0 ? Math.min(100, Math.round((publishCount / Math.max(publishCount, 1)) * 100)) : 0;

        return {
          accountId: acc.id,
          accountName: acc.nickname || acc.username || acc.id,
          platform: acc.platform,
          publishCount,
          playCount,
          likeCount,
          successRate,
        };
      });
    } catch {
      accountRanking.value = [];
    }
  }

  async function fetchLatestReport() {
    if (!window.matrixflow) return;
    reportLoading.value = true;
    try {
      const report = await window.matrixflow.report.getLatest();
      if (report) latestReport.value = report;
    } finally {
      reportLoading.value = false;
    }
  }

  async function generateReport() {
    if (!window.matrixflow) return null;
    reportLoading.value = true;
    try {
      const report = await window.matrixflow.report.generate();
      if (report) latestReport.value = report;
      return report;
    } finally {
      reportLoading.value = false;
    }
  }

  return {
    loading,
    timeRange,
    rawOverview,
    platformStats,
    trendData,
    accountRanking,
    overviewCards,
    platformTableData,
    successRate,
    latestReport,
    reportLoading,
    setTimeRange,
    fetchAll,
    fetchAccountRanking,
    fetchLatestReport,
    generateReport,
  };
});
