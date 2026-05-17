import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AppLifecycle } from './core/AppLifecycle';
import { ConfigManager } from './core/ConfigManager';
import { EventBus } from './core/EventBus';
import { Logger } from './core/Logger';
import { browserPool } from './core/BrowserPool';
import { securityLayer } from './core/SecurityLayer';
import { taskScheduler } from './core/TaskScheduler';
import { selectorUpdateService } from './core/SelectorUpdateService';
import { platformConfigLoader } from './core/PlatformConfigLoader';
import { registerIpcHandlers } from './ipc/handlers';
import { autoUpdaterService } from './core/AutoUpdater';
import { initDatabase, closeDatabase } from './data/Database';
import { PlatformRegistry } from './platform/base/PlatformRegistry';
import { douyinAdapter } from './platform/douyin';
import { xiaohongshuAdapter } from './platform/xiaohongshu';
import { channelsAdapter } from './platform/channels';
import { kuaishouAdapter } from './platform/kuaishou';
import { multiPanelService } from './services/MultiPanelService';

const logger = new Logger('Main');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  autoUpdaterService.initialize(mainWindow);
  multiPanelService.setMainWindow(mainWindow);

  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  logger.info('MatrixFlow 启动中...');

  initDatabase();
  logger.info('数据库初始化完成');

  const config = ConfigManager.getInstance();
  await config.initialize();

  await securityLayer.initialize();
  logger.info('安全层初始化完成');

  await browserPool.initialize();
  logger.info('浏览器池初始化完成');

  taskScheduler.start();
  logger.info('任务调度器已启动');

  await selectorUpdateService.initialize();
  logger.info('选择器更新服务已启动');

  await platformConfigLoader.initialize();
  logger.info('平台配置加载器已启动');

  const eventBus = EventBus.getInstance();
  const lifecycle = new AppLifecycle(config, eventBus);
  await lifecycle.initialize();

  PlatformRegistry.register(douyinAdapter);
  PlatformRegistry.register(xiaohongshuAdapter);
  PlatformRegistry.register(channelsAdapter);
  PlatformRegistry.register(kuaishouAdapter);
  logger.info(`已注册平台: ${PlatformRegistry.getSupportedPlatforms().join(', ')}`);

  registerIpcHandlers();

  await createWindow();

  logger.info('MatrixFlow 启动完成');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  logger.info('MatrixFlow 正在关闭...');

  taskScheduler.stop();
  logger.info('任务调度器已停止');

  await browserPool.shutdown();
  logger.info('浏览器池已关闭');

  closeDatabase();
  logger.info('数据库已关闭');

  const lifecycle = AppLifecycle.getInstance();
  await lifecycle.shutdown();
  logger.info('MatrixFlow 已关闭');
});
