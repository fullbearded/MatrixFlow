import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import { Logger } from './Logger';

const logger = new Logger('AutoUpdater');

type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = 'not-available';
  private downloadedInfo: UpdateInfo | null = null;

  initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    if (process.env.NODE_ENV === 'development') {
      logger.info('开发模式，跳过自动更新');
      return;
    }

    autoUpdater.on('checking-for-update', () => {
      this.status = 'checking';
      this.sendToRenderer('update:status', { status: 'checking' });
      logger.info('正在检查更新...');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.status = 'available';
      this.sendToRenderer('update:status', {
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      });
      logger.info(`发现新版本: ${info.version}`);
    });

    autoUpdater.on('update-not-available', () => {
      this.status = 'not-available';
      this.sendToRenderer('update:status', { status: 'not-available' });
      logger.info('当前已是最新版本');
    });

    autoUpdater.on('download-progress', (progress: UpdateProgress) => {
      this.status = 'downloading';
      this.sendToRenderer('update:progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
      logger.info(`下载进度: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.status = 'downloaded';
      this.downloadedInfo = info;
      this.sendToRenderer('update:status', {
        status: 'downloaded',
        version: info.version,
      });
      logger.info(`更新已下载: ${info.version}`);
    });

    autoUpdater.on('error', (error: Error) => {
      this.status = 'error';
      this.sendToRenderer('update:status', { status: 'error', message: error.message });
      logger.error(`更新错误: ${error.message}`);
    });

    this.schedulePeriodicCheck();
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      await autoUpdater.checkForUpdates();
      return this.status;
    } catch (error) {
      logger.error(`检查更新失败: ${(error as Error).message}`);
      return 'error';
    }
  }

  async downloadUpdate(): Promise<void> {
    if (this.status !== 'available') {
      logger.warn('没有可用更新可下载');
      return;
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error(`下载更新失败: ${(error as Error).message}`);
    }
  }

  async installUpdate(): Promise<void> {
    if (this.status !== 'downloaded' || !this.downloadedInfo) {
      logger.warn('没有已下载的更新可安装');
      return;
    }

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      autoUpdater.quitAndInstall();
      return;
    }

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '安装更新',
      message: `MatrixFlow ${this.downloadedInfo.version} 已下载完成`,
      detail: '需要重启应用以完成安装。是否现在重启？',
      buttons: ['稍后重启', '立即重启'],
      defaultId: 1,
      cancelId: 0,
    });

    if (result.response === 1) {
      autoUpdater.quitAndInstall();
    }
  }

  getStatus(): { status: UpdateStatus; version?: string } {
    return {
      status: this.status,
      version: this.downloadedInfo?.version,
    };
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private schedulePeriodicCheck(): void {
    const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

    setTimeout(() => {
      this.checkForUpdates();
    }, 30 * 1000);

    setInterval(() => {
      this.checkForUpdates();
    }, CHECK_INTERVAL);
  }
}

export const autoUpdaterService = new AutoUpdaterService();
