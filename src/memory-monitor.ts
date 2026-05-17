// ============================================================
// 浏览器上下文内存监控
// 用于验证单 BrowserContext < 200MB 的 Go/No-Go 标准
// ============================================================

import type { BrowserContext } from 'patchright';

/**
 * 内存统计
 */
export interface MemoryStats {
  /** 进程 RSS（常驻内存集）*/
  rssMb: number;
  /** V8 堆已用 */
  heapUsedMb: number;
  /** V8 堆总量 */
  heapTotalMb: number;
  /** C++ 绑定到 JS 的内存 */
  externalMb: number;
  /** 采样时间戳 */
  timestamp: number;
}

/**
 * 测量当前进程的内存使用
 * @param context BrowserContext（预留，未来可获取浏览器级别指标）
 * @returns 内存统计
 */
export async function measureContextMemory(
  _context?: BrowserContext
): Promise<MemoryStats> {
  const mem = process.memoryUsage();

  const stats: MemoryStats = {
    rssMb: roundTo2(mem.rss / 1024 / 1024),
    heapUsedMb: roundTo2(mem.heapUsed / 1024 / 1024),
    heapTotalMb: roundTo2(mem.heapTotal / 1024 / 1024),
    externalMb: roundTo2(mem.external / 1024 / 1024),
    timestamp: Date.now(),
  };

  return stats;
}

// 采样历史
const sampleHistory: MemoryStats[] = [];

/**
 * 启动周期性内存采样
 * @param intervalMs 采样间隔（毫秒），默认 5000
 * @returns 定时器 ID，用于 stopMemoryMonitoring
 */
export function startMemoryMonitoring(
  intervalMs: number = 5000
): NodeJS.Timeout {
  console.log(
    `[memory] 启动内存监控，采样间隔 ${intervalMs}ms`
  );

  const timer = setInterval(async () => {
    const stats = await measureContextMemory();
    sampleHistory.push(stats);

    // 保留最近 120 个样本（约 10 分钟 @ 5s 间隔）
    if (sampleHistory.length > 120) {
      sampleHistory.shift();
    }

    // 简单输出当前状态
    const rssWarning =
      stats.rssMb > 200 ? ' [WARNING: RSS > 200MB]' : '';
    console.log(
      `[memory] RSS=${stats.rssMb}MB ` +
        `Heap=${stats.heapUsedMb}/${stats.heapTotalMb}MB` +
        rssWarning
    );
  }, intervalMs);

  return timer;
}

/**
 * 停止内存监控
 * @param timer startMemoryMonitoring 返回的定时器
 */
export function stopMemoryMonitoring(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  console.log(
    `[memory] 已停止监控，共采集 ${sampleHistory.length} 个样本`
  );
}

/**
 * 获取采样历史
 * @returns 内存采样记录
 */
export function getSampleHistory(): MemoryStats[] {
  return [...sampleHistory];
}

/**
 * 格式化内存报告
 * @param stats 内存统计（可选，不传则用最新样本）
 * @returns 人类可读的报告文本
 */
export function formatMemoryReport(stats?: MemoryStats): string {
  const s = stats || sampleHistory[sampleHistory.length - 1];
  if (!s) {
    return '[memory] 暂无采样数据';
  }

  const lines: string[] = [
    '--- 内存报告 ---',
    `  RSS:        ${s.rssMb} MB`,
    `  堆已用:     ${s.heapUsedMb} MB`,
    `  堆总量:     ${s.heapTotalMb} MB`,
    `  外部内存:   ${s.externalMb} MB`,
    `  时间:       ${new Date(s.timestamp).toLocaleTimeString()}`,
  ];

  // Go/No-Go 判断
  const goNogo = s.rssMb < 200 ? 'PASS (< 200MB)' : 'FAIL (>= 200MB)';
  lines.push(`  Go/No-Go:   ${goNogo}`);

  // 如果有历史数据，显示趋势
  if (sampleHistory.length > 1) {
    const first = sampleHistory[0];
    const last = sampleHistory[sampleHistory.length - 1];
    const deltaRss = roundTo2(last.rssMb - first.rssMb);
    const trend = deltaRss > 0 ? '+' : '';
    lines.push(
      `  趋势:       RSS ${trend}${deltaRss} MB ` +
        `(${sampleHistory.length} 个样本)`
    );

    // 峰值
    const peak = sampleHistory.reduce(
      (max, item) => (item.rssMb > max.rssMb ? item : max),
      sampleHistory[0]
    );
    lines.push(`  峰值 RSS:   ${peak.rssMb} MB`);
  }

  lines.push('--- 报告结束 ---');
  return lines.join('\n');
}

// -----------------------------------------------------------
// 工具函数
// -----------------------------------------------------------

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MemoryCheckResult {
  withinLimit: boolean;
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
}

export function checkMemoryUsage(): MemoryCheckResult {
  const mem = process.memoryUsage();
  const rssMB = roundTo2(mem.rss / 1024 / 1024);
  const heapUsedMB = roundTo2(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = roundTo2(mem.heapTotal / 1024 / 1024);

  return {
    withinLimit: rssMB < 200,
    rssMB,
    heapUsedMB,
    heapTotalMB,
  };
}
