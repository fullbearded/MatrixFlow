<template>
  <div class="trend-chart">
    <div class="trend-chart__header">
      <span class="trend-chart__title">{{ title }}</span>
      <div class="trend-chart__actions">
        <el-radio-group v-model="chartType" size="small" @change="updateChart">
          <el-radio-button value="line">折线</el-radio-button>
          <el-radio-button value="area">面积</el-radio-button>
          <el-radio-button value="bar">柱状</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <v-chart
      ref="chartRef"
      class="trend-chart__canvas"
      :option="chartOption"
      :theme="isDark ? 'dark' : undefined"
      autoresize
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import {
  LineChart,
  BarChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { isDark } from './theme';

use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

export interface TrendSeries {
  name: string;
  data: number[];
}

const props = withDefaults(defineProps<{
  title?: string;
  dates: string[];
  series: TrendSeries[];
  chartType?: 'line' | 'area' | 'bar';
  colors?: string[];
}>(), {
  title: '趋势图',
  chartType: 'line',
  colors: () => ['#409eff', '#67c23a', '#e6a23c', '#f56c6c'],
});

const chartRef = ref<InstanceType<typeof VChart>>();

const activeChartType = ref(props.chartType);
const chartType = activeChartType;

const palette = computed(() => {
  const base = props.colors;
  return isDark.value
    ? base.map((c) => c)
    : base;
});

const chartOption = computed(() => {
  const seriesType = activeChartType.value === 'area' ? 'line' : activeChartType.value;

  const seriesList = props.series.map((s, i) => {
    const base: Record<string, unknown> = {
      name: s.name,
      type: seriesType,
      data: s.data,
      smooth: seriesType === 'line',
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      itemStyle: { color: palette.value[i % palette.value.length] },
    };

    if (activeChartType.value === 'area') {
      base.areaStyle = {
        opacity: 0.15,
      };
    }

    return base;
  });

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? '#1d1e2c' : '#fff',
      borderColor: isDark.value ? '#333' : '#e5e6eb',
      textStyle: {
        color: isDark.value ? '#a3a6b4' : '#4e5969',
        fontSize: 12,
      },
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
      itemGap: 16,
    },
    grid: {
      top: 40,
      left: 16,
      right: 16,
      bottom: 48,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: props.dates,
      boundaryGap: activeChartType.value === 'bar',
      axisLine: { lineStyle: { color: isDark.value ? '#333' : '#e5e6eb' } },
      axisLabel: {
        color: isDark.value ? '#86909c' : '#86909c',
        fontSize: 11,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.06)' : '#f2f3f5' },
      },
      axisLabel: {
        color: isDark.value ? '#86909c' : '#86909c',
        fontSize: 11,
      },
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
    ],
    series: seriesList,
  };
});

function updateChart() {
  // chartType change triggers computed re-evaluation
}

watch(isDark, () => {
  chartRef.value?.resize();
});
</script>

<style scoped>
.trend-chart {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.trend-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.trend-chart__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.trend-chart__canvas {
  width: 100%;
  height: 320px;
}
</style>
