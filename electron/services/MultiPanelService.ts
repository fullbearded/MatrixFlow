import { BrowserWindow, BrowserView } from 'electron';
import { Logger } from '../core/Logger';
import { getDatabase, isDatabaseAvailable } from '../data/Database';
import { browserPool } from '../core/BrowserPool';

const logger = new Logger('MultiPanelService');

interface PanelSession {
  id: string;
  accountId: string;
  platform: string;
  nickname: string;
  view: BrowserView | null;
  createdAt: Date;
}

class MultiPanelService {
  private static instance: MultiPanelService;
  private sessions: Map<string, PanelSession> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private maxPanels = 10;

  private constructor() {}

  static getInstance(): MultiPanelService {
    if (!MultiPanelService.instance) {
      MultiPanelService.instance = new MultiPanelService();
    }
    return MultiPanelService.instance;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async openPanel(accountId: string): Promise<PanelSession | null> {
    if (!this.mainWindow) {
      logger.error('主窗口未设置');
      return null;
    }

    if (this.sessions.size >= this.maxPanels) {
      logger.warn('已达到最大面板数量限制');
      return null;
    }

    const existing = Array.from(this.sessions.values()).find(s => s.accountId === accountId);
    if (existing) {
      this.focusPanel(existing.id);
      return existing;
    }

    const account = this.getAccount(accountId);
    if (!account) {
      logger.error(`账号不存在: ${accountId}`);
      return null;
    }

    const id = `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await browserPool.acquireContext(accountId);

      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const session: PanelSession = {
        id,
        accountId,
        platform: account.platform,
        nickname: account.nickname || account.platform,
        view,
        createdAt: new Date(),
      };

      this.sessions.set(id, session);
      this.layoutPanels();

      const creatorUrl = this.getCreatorCenterUrl(account.platform);
      view.webContents.loadURL(creatorUrl);

      logger.info(`打开面板: ${account.nickname} (${account.platform})`);
      return session;
    } catch (error) {
      logger.error(`打开面板失败: ${accountId}`, error);
      return null;
    }
  }

  closePanel(panelId: string): void {
    const session = this.sessions.get(panelId);
    if (!session) return;

    if (session.view) {
      this.mainWindow?.removeBrowserView(session.view);
      session.view.webContents.close();
    }

    this.sessions.delete(panelId);
    this.layoutPanels();
    logger.info(`关闭面板: ${panelId}`);
  }

  focusPanel(panelId: string): void {
    const session = this.sessions.get(panelId);
    if (!session || !session.view) return;

    this.mainWindow?.setTopBrowserView(session.view);
    session.view.webContents.focus();
  }

  getActivePanels(): PanelSession[] {
    return Array.from(this.sessions.values());
  }

  private layoutPanels(): void {
    if (!this.mainWindow) return;

    const { width, height } = this.mainWindow.getBounds();
    const sidebarWidth = 280;
    const headerHeight = 60;

    const panels = Array.from(this.sessions.values());
    const panelWidth = (width - sidebarWidth) / Math.max(panels.length, 1);
    const panelHeight = height - headerHeight;

    panels.forEach((session, index) => {
      if (session.view) {
        session.view.setBounds({
          x: sidebarWidth + index * panelWidth,
          y: headerHeight,
          width: panelWidth,
          height: panelHeight,
        });
      }
    });
  }

  private getAccount(accountId: string): { platform: string; nickname: string } | null {
    if (!isDatabaseAvailable()) return null;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT a.platform, a.nickname
      FROM accounts a
      WHERE a.id = ?
    `).get(accountId) as { platform: string; nickname: string | null } | undefined;

    return row ? { platform: row.platform, nickname: row.nickname || '' } : null;
  }

  private getCreatorCenterUrl(platform: string): string {
    const urls: Record<string, string> = {
      douyin: 'https://creator.douyin.com/',
      xiaohongshu: 'https://creator.xiaohongshu.com/',
      kuaishou: 'https://cp.kuaishou.com/',
      wechat: 'https://channels.weixin.qq.com/',
    };
    return urls[platform] || 'about:blank';
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      if (session.view) {
        this.mainWindow?.removeBrowserView(session.view);
        session.view.webContents.close();
      }
    }
    this.sessions.clear();
    logger.info('MultiPanelService 已释放');
  }
}

export const multiPanelService = MultiPanelService.getInstance();
