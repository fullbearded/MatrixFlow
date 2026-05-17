import { Logger } from '../core/Logger';
import { getDatabase, isDatabaseAvailable } from '../data/Database';
import { getAIService } from '../ai/AIService';

const logger = new Logger('WeeklyReportService');

export interface WeeklyReport {
  id: string;
  startDate: Date;
  endDate: Date;
  summary: {
    totalPublishes: number;
    successRate: number;
    totalViews: number;
    totalLikes: number;
    avgViewsPerVideo: number;
    topPlatform: string;
    topPlatformViews: number;
  };
  trends: {
    viewsTrend: number;
    likesTrend: number;
    publishesTrend: number;
  };
  insights: Array<{
    type: 'success' | 'warning' | 'info';
    title: string;
    description: string;
    recommendation?: string;
  }>;
  topPerformingContent: Array<{
    contentId: string;
    title: string;
    platform: string;
    views: number;
    likes: number;
  }>;
  platformBreakdown: Array<{
    platform: string;
    publishes: number;
    views: number;
    likes: number;
    successRate: number;
  }>;
  generatedAt: Date;
}

class WeeklyReportService {
  private static instance: WeeklyReportService;

  private constructor() {}

  static getInstance(): WeeklyReportService {
    if (!WeeklyReportService.instance) {
      WeeklyReportService.instance = new WeeklyReportService();
    }
    return WeeklyReportService.instance;
  }

  async generateReport(startDate?: Date, endDate?: Date): Promise<WeeklyReport> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const summary = await this.calculateSummary(start, end);
    const trends = await this.calculateTrends(start, end);
    const topContent = await this.getTopPerformingContent(start, end, 5);
    const platformBreakdown = await this.getPlatformBreakdown(start, end);
    const insights = await this.generateInsights(summary, trends, platformBreakdown);

    const report: WeeklyReport = {
      id: `report_${Date.now()}`,
      startDate: start,
      endDate: end,
      summary,
      trends,
      insights,
      topPerformingContent: topContent,
      platformBreakdown,
      generatedAt: new Date(),
    };

    this.saveReport(report);
    logger.info(`生成周报: ${start.toISOString()} - ${end.toISOString()}`);

    return report;
  }

  private async calculateSummary(start: Date, end: Date): Promise<WeeklyReport['summary']> {
    if (!isDatabaseAvailable()) {
      return this.getEmptySummary();
    }
    const db = getDatabase();

    const publishRow = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success
      FROM task_items
      WHERE created_at >= ? AND created_at <= ?
    `).get(start.toISOString(), end.toISOString()) as { total: number; success: number } | undefined;

    const statsRow = db.prepare(`
      SELECT
        COALESCE(SUM(vs.play_count), 0) as views,
        COALESCE(SUM(vs.like_count), 0) as likes
      FROM video_stats vs
      JOIN task_items ti ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
      WHERE ti.completed_at >= ? AND ti.completed_at <= ?
    `).get(start.toISOString(), end.toISOString()) as { views: number; likes: number } | undefined;

    const platformRow = db.prepare(`
      SELECT
        ti.platform,
        SUM(vs.play_count) as views
      FROM task_items ti
      LEFT JOIN video_stats vs ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
      WHERE ti.completed_at >= ? AND ti.completed_at <= ? AND ti.status = 'completed'
      GROUP BY ti.platform
      ORDER BY views DESC
      LIMIT 1
    `).get(start.toISOString(), end.toISOString()) as { platform: string; views: number } | undefined;

    const totalPublishes = publishRow?.total ?? 0;
    const successCount = publishRow?.success ?? 0;
    const totalViews = statsRow?.views ?? 0;
    const videoCount = totalPublishes > 0 ? totalPublishes : 1;

    return {
      totalPublishes,
      successRate: totalPublishes > 0 ? successCount / totalPublishes : 0,
      totalViews,
      totalLikes: statsRow?.likes ?? 0,
      avgViewsPerVideo: Math.round(totalViews / videoCount),
      topPlatform: platformRow?.platform ?? '',
      topPlatformViews: platformRow?.views ?? 0,
    };
  }

  private async calculateTrends(start: Date, end: Date): Promise<WeeklyReport['trends']> {
    if (!isDatabaseAvailable()) {
      return { viewsTrend: 0, likesTrend: 0, publishesTrend: 0 };
    }
    const db = getDatabase();

    const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevEnd = start;

    const currentStats = this.getPeriodStats(db, start, end);
    const prevStats = this.getPeriodStats(db, prevStart, prevEnd);

    return {
      viewsTrend: this.calculateTrendPercent(currentStats.views, prevStats.views),
      likesTrend: this.calculateTrendPercent(currentStats.likes, prevStats.likes),
      publishesTrend: this.calculateTrendPercent(currentStats.publishes, prevStats.publishes),
    };
  }

  private getPeriodStats(db: ReturnType<typeof getDatabase>, start: Date, end: Date) {
    const row = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM task_items WHERE created_at >= ? AND created_at <= ?) as publishes,
        (SELECT COALESCE(SUM(vs.play_count), 0) FROM video_stats vs
         JOIN task_items ti ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
         WHERE ti.completed_at >= ? AND ti.completed_at <= ?) as views,
        (SELECT COALESCE(SUM(vs.like_count), 0) FROM video_stats vs
         JOIN task_items ti ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
         WHERE ti.completed_at >= ? AND ti.completed_at <= ?) as likes
    `).get(
      start.toISOString(), end.toISOString(),
      start.toISOString(), end.toISOString(),
      start.toISOString(), end.toISOString()
    ) as { publishes: number; views: number; likes: number } | undefined;

    return {
      publishes: row?.publishes ?? 0,
      views: row?.views ?? 0,
      likes: row?.likes ?? 0,
    };
  }

  private calculateTrendPercent(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  }

  private async getTopPerformingContent(
    start: Date,
    end: Date,
    limit: number
  ): Promise<WeeklyReport['topPerformingContent']> {
    if (!isDatabaseAvailable()) return [];
    const db = getDatabase();

    const rows = db.prepare(`
      SELECT
        ti.content_id,
        c.title,
        ti.platform,
        vs.play_count as views,
        vs.like_count as likes
      FROM task_items ti
      JOIN video_stats vs ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
      LEFT JOIN contents c ON c.id = ti.content_id
      WHERE ti.completed_at >= ? AND ti.completed_at <= ? AND ti.status = 'completed'
      ORDER BY vs.play_count DESC
      LIMIT ?
    `).all(start.toISOString(), end.toISOString(), limit) as Array<{
      content_id: string;
      title: string | null;
      platform: string;
      views: number;
      likes: number;
    }>;

    return rows.map(r => ({
      contentId: r.content_id,
      title: r.title || '未知内容',
      platform: r.platform,
      views: r.views ?? 0,
      likes: r.likes ?? 0,
    }));
  }

  private async getPlatformBreakdown(
    start: Date,
    end: Date
  ): Promise<WeeklyReport['platformBreakdown']> {
    if (!isDatabaseAvailable()) return [];
    const db = getDatabase();

    const rows = db.prepare(`
      SELECT
        ti.platform,
        COUNT(*) as publishes,
        SUM(CASE WHEN ti.status = 'completed' THEN 1 ELSE 0 END) as success,
        COALESCE(SUM(vs.play_count), 0) as views,
        COALESCE(SUM(vs.like_count), 0) as likes
      FROM task_items ti
      LEFT JOIN video_stats vs ON ti.published_url LIKE '%' || vs.platform_video_id || '%'
      WHERE ti.created_at >= ? AND ti.created_at <= ?
      GROUP BY ti.platform
    `).all(start.toISOString(), end.toISOString()) as Array<{
      platform: string;
      publishes: number;
      success: number;
      views: number;
      likes: number;
    }>;

    return rows.map(r => ({
      platform: r.platform,
      publishes: r.publishes,
      views: r.views ?? 0,
      likes: r.likes ?? 0,
      successRate: r.publishes > 0 ? r.success / r.publishes : 0,
    }));
  }

  private async generateInsights(
    summary: WeeklyReport['summary'],
    trends: WeeklyReport['trends'],
    platformBreakdown: WeeklyReport['platformBreakdown']
  ): Promise<WeeklyReport['insights']> {
    const insights: WeeklyReport['insights'] = [];

    if (summary.successRate < 0.8) {
      insights.push({
        type: 'warning',
        title: '发布成功率偏低',
        description: `本周发布成功率仅 ${Math.round(summary.successRate * 100)}%，建议检查账号状态和网络连接`,
        recommendation: '检查失败任务详情，优先处理 Cookie 过期和限流问题',
      });
    } else if (summary.successRate >= 0.95) {
      insights.push({
        type: 'success',
        title: '发布表现优秀',
        description: `发布成功率 ${Math.round(summary.successRate * 100)}%，保持当前策略`,
      });
    }

    if (trends.viewsTrend > 20) {
      insights.push({
        type: 'success',
        title: '播放量显著增长',
        description: `播放量较上周增长 ${trends.viewsTrend}%`,
        recommendation: '分析本周热门内容特征，继续优化内容策略',
      });
    } else if (trends.viewsTrend < -20) {
      insights.push({
        type: 'warning',
        title: '播放量下滑',
        description: `播放量较上周下降 ${Math.abs(trends.viewsTrend)}%`,
        recommendation: '检查发布时间、内容质量是否变化',
      });
    }

    if (platformBreakdown.length > 1) {
      const sorted = [...platformBreakdown].sort((a, b) => b.views - a.views);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];

      if (top.views > 0 && bottom.views > 0 && top.views / bottom.views > 3) {
        insights.push({
          type: 'info',
          title: '平台表现差异大',
          description: `${top.platform} 表现最佳，${bottom.platform} 相对较弱`,
          recommendation: `考虑调整 ${bottom.platform} 的发布策略或内容适配`,
        });
      }
    }

    try {
      const aiService = getAIService();
      const aiInsights = await this.getAIInsights(aiService, summary, trends);
      if (aiInsights) {
        insights.push(aiInsights);
      }
    } catch {
      // AI 服务不可用，跳过
    }

    return insights;
  }

  private async getAIInsights(
    aiService: ReturnType<typeof getAIService>,
    summary: WeeklyReport['summary'],
    trends: WeeklyReport['trends']
  ): Promise<WeeklyReport['insights'][number] | null> {
    const insights: WeeklyReport['insights'] = [];

    try {
      const prompt = `分析以下周度数据并给出运营建议：
- 发布数: ${summary.totalPublishes}
- 成功率: ${Math.round(summary.successRate * 100)}%
- 总播放: ${summary.totalViews}
- 总点赞: ${summary.totalLikes}
- 播放趋势: ${trends.viewsTrend}%
- 点赞趋势: ${trends.likesTrend}%

请给出 2-3 条简洁的运营建议，每条包含标题和建议内容。`;

      const response = await aiService['llm']?.call({
        prompt,
        systemPrompt: '你是一个社交媒体运营专家，给出简洁可执行的建议。',
        temperature: 0.5,
        maxTokens: 500,
      });

      if (response?.content) {
        return {
          type: 'info',
          title: 'AI 运营建议',
          description: response.content,
        };
      }
    } catch (error) {
      logger.warn('AI 洞察生成失败', error);
    }

    return null;
  }

  private getEmptySummary(): WeeklyReport['summary'] {
    return {
      totalPublishes: 0,
      successRate: 0,
      totalViews: 0,
      totalLikes: 0,
      avgViewsPerVideo: 0,
      topPlatform: '',
      topPlatformViews: 0,
    };
  }

  private saveReport(report: WeeklyReport): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    try {
      db.prepare(`
        INSERT INTO weekly_reports (id, start_date, end_date, summary, trends, insights, top_content, platform_breakdown, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        report.id,
        report.startDate.toISOString(),
        report.endDate.toISOString(),
        JSON.stringify(report.summary),
        JSON.stringify(report.trends),
        JSON.stringify(report.insights),
        JSON.stringify(report.topPerformingContent),
        JSON.stringify(report.platformBreakdown),
        report.generatedAt.toISOString()
      );
    } catch (error) {
      logger.error('保存周报失败', error);
    }
  }

  async getLatestReport(): Promise<WeeklyReport | null> {
    if (!isDatabaseAvailable()) return null;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT id, start_date, end_date, summary, trends, insights, top_content, platform_breakdown, generated_at
      FROM weekly_reports
      ORDER BY generated_at DESC
      LIMIT 1
    `).get() as {
      id: string;
      start_date: string;
      end_date: string;
      summary: string;
      trends: string;
      insights: string;
      top_content: string;
      platform_breakdown: string;
      generated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      summary: JSON.parse(row.summary),
      trends: JSON.parse(row.trends),
      insights: JSON.parse(row.insights),
      topPerformingContent: JSON.parse(row.top_content),
      platformBreakdown: JSON.parse(row.platform_breakdown),
      generatedAt: new Date(row.generated_at),
    };
  }
}

export const weeklyReportService = WeeklyReportService.getInstance();
