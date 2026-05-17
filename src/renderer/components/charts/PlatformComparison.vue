<template>
  <div class="platform-comparison">
    <div class="platform-comparison__grid">
      <!-- 柱状图 -->
      <div class="platform-comparison__panel">
        <div class="platform-comparison__header">
          <span class="platform-comparison__title">平台发布对比</span>
        </div>
        <v-chart
          ref="barChartRef"
          class="platform-comparison__canvas"
          :option="barOption"
          :theme="isDark ? 'dark' : undefined"
          autoresize
        />
      </div>

      <!-- 雷达图 -->
      <div class="platform-comparison__panel">
        <div class="platform-comparison__header">
          <span class="platform-comparison__title">综合能力评分</span>
        </div>
        <v-chart
          ref="radarChartRef"
          class="platform-comparison__canvas"
          :option="radarOption"
          :theme="isDark ? 'dark' : undefined"
          autoresize
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import {
  BarChart,
  RadarChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { isDark, PLATFORM_COLORS } from './theme';

use([
  BarChart,
  RadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  CanvasRenderer,
]);

export interface PlatformMetric {
  platform: string;
  publishCount: number;
  successRate: number;
  engagement: number;
  reach: number;
  consistency: number;
  speed: number;
}

const props = withDefaults(defineProps<{
  platforms: PlatformMetric[];
}>(), {
  platforms: () => [],
});

const barChartRef = ref<InstanceType<typeof VChart>>();
const radarChartRef = ref<InstanceType<typeof VChart>>();

const platformNames = computed(() => props.platforms.map((p) => p.platform));
const platformColorList = computed(() =>
  props.platforms.map((p) => PLATFORM_COLORS[p.platform] ?? '#409eff'),
);

const tooltipConfig = computed(() => ({
  backgroundColor: isDark.value ? '#1d1e2c' : '#fff',
  borderColor: isDark.value ? '#333' : '#e5e6eb',
  textStyle: {
    color: isDark.value ? '#a3a6b4' : '#4e5969',
    fontSize: 12,
  },
}));

const axisLabelStyle = computed(() => ({
  color: isDark.value ? '#86909c' : '#86909c',
  fontSize: 11,
}));

const barOption = computed(() => ({
  tooltip: {
    ...tooltipConfig.value,
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
  },
  legend: {
    top: 0,
    right: 0,
    textStyle: {
      color: isDark.value ? '#a3a6b4' : '#86909c',
      fontSize: 12,
    },
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 8,
  },
  grid: {
    top: 40,
    left: 16,
    right: 16,
    bottom: 24,
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    data: platformNames.value,
    axisLine: { lineStyle: { color: isDark.value ? '#333' : '#e5e6eb' } },
    axisLabel: axisLabelStyle.value,
    axisTick: { show: false },
  },
  yAxis: [
    {
      type: 'value',
      name: '发布量',
      nameTextStyle: { color: isDark.value ? '#86909c' : '#86909c', fontSize: 11 },
      splitLine: {
        lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.06)' : '#f2f3f5' },
      },
      axisLabel: axisLabelStyle.value,
    },
    {
      type: 'value',
      name: '成功率 %',
      nameTextStyle: { color: isDark.value ? '#86909c' : '#86909c', fontSize: 11 },
      max: 100,
      splitLine: { show: false },
      axisLabel: axisLabelStyle.value,
    },
  ],
  series: [
    {
      name: '发布量',
      type: 'bar',
      data: props.platforms.map((p) => p.publishCount),
      barWidth: '28%',
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: props.platforms.map((p, i) => ({
            offset: i === 0 ? 0 : 1,
            color: PLATFORM_COLORS[p.platform] ?? '#409eff',
          })),
        },
        borderRadius: [4, 4, 0, 0],
      },
    },
    {
      name: '成功率',
      type: 'bar',
      yAxisIndex: 1,
      data: props.platforms.map((p) => p.successRate),
      barWidth: '28%',
      itemStyle: {
        color: '#67c23a',
        borderRadius: [4, 4, 0, 0],
        opacity: 0.7,
      },
    },
  ],
}));

const radarDimensions = [
  { name: '互动率', key: 'engagement' as const },
  { name: '触达率', key: 'reach' as const },
  { name: '稳定性', key: 'consistency' as const },
  { name: '速度', key: 'speed' as const },
  { name: '成功率', key: 'successRate' as const },
];

const radarOption = computed(() => ({
  tooltip: {
    ...tooltipConfig.value,
  },
  legend: {
    top: 0,
    right: 0,
    textStyle: {
      color: isDark.value ? '#a3a6b4' : '#86909c',
      fontSize: 12,
    },
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 8,
  },
  radar: {
    center: ['50%', '56%'],
    radius: '60%',
    indicator: radarDimensions.map((d) => ({
      name: d.name,
      max: 100,
    })),
    axisName: {
      color: isDark.value ? '#86909c' : '#86909c',
      fontSize: 11,
    },
    splitLine: {
      lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.06)' : '#f2f3f5' },
    },
    splitArea: {
      areaStyle: { color: isDark.value ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
    },
    axisLine: {
      lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.08)' : '#e5e6eb' },
    },
  },
  series: [
    {
      type: 'radar',
      data: props.platforms.map((p) => ({
        value: radarDimensions.map((d) => p[d.key]),
        name: p.platform,
        lineStyle: { color: PLATFORM_COLORS[p.platform] ?? '#409eff', width: 2 },
        areaStyle: { color: PLATFORM_COLORS[p.platform] ?? '#409eff', opacity: 0.1 },
        itemStyle: { color: PLATFORM_COLORS[p.platform] ?? '#409eff' },
      })),
    },
  ],
}));

watch(isDark, () => {
  barChartRef.value?.resize();
  radarChartRef.value?.resize();
});
</script>

<style scoped>
.platform-comparison {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.platform-comparison__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}

.platform-comparison__panel {
  min-width: 0;
}

.platform-comparison__header {
  margin-bottom: var(--space-3);
}

.platform-comparison__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.platform-comparison__canvas {
  width: 100%;
  height: 320px;
}

@media (max-width: 900px) {
  .platform-comparison__grid {
    grid-template-columns: 1fr;
  }
}
</style>
