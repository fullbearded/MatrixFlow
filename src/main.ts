// ============================================================
// MatrixFlow PoC — Electron 主进程入口
// 职责：Electron 窗口管理、IPC 注册、Patchright 启动、PoC 调度
// ============================================================

import { app, BrowserWindow, ipcMain } from 'electron';
import { chromium } from 'patchright';
import type { Browser, BrowserContext } from 'patchright';
import path from 'path';

// 全局 Patchright 浏览器实例
let browser: Browser | null = null;

// ============================================================
// Patchright 启动
// ============================================================

/**
 * 启动 Patchright 浏览器
 * 关键：channel: 'chrome' 使用系统 Chrome 实现最大隐蔽性
 */
async function launchPatchright(): Promise<Browser> {
  console.log('[main] 正在启动 Patchright...');
  browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
    ],
  });
  console.log('[main] Patchright 已启动');
  return browser;
}

/**
 * 创建持久化浏览器上下文（带 Cookie 持久化）
 * @param accountId 账号标识，用于隔离用户数据
 */
async function createPersistentContext(accountId: string): Promise<BrowserContext> {
  const userDataDir = path.join(process.cwd(), 'data', 'userdata', accountId);
  console.log(`[main] 创建持久上下文: ${userDataDir}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: [
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
    ],
  });
  return context;
}

// ============================================================
// IPC 处理器注册
// ============================================================

function registerIpcHandlers(): void {
  // PoC 运行请求（来自渲染进程）
  ipcMain.handle('poc:run', async (_event, type: string) => {
    try {
      const result = await runPoc(type);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 启动 Patchright（验证能否在 Electron 中加载）
  ipcMain.handle('poc:launch', async () => {
    try {
      const b = await launchPatchright();
      const version = b.version();
      await b.close();
      return { success: true, version };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 抖音登录
  ipcMain.handle('poc:login', async () => {
    try {
      const { PoCRunner } = await import('./poc-runner');
      const runner = new PoCRunner();
      const result = await runner.testLogin();
      return { success: result.passed, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 抖音上传
  ipcMain.handle('poc:upload', async () => {
    try {
      const { PoCRunner } = await import('./poc-runner');
      const runner = new PoCRunner();
      const result = await runner.testUpload();
      return { success: result.passed, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 反检测测试
  ipcMain.handle('poc:anti-detect', async () => {
    try {
      const { PoCRunner } = await import('./poc-runner');
      const runner = new PoCRunner();
      const result = await runner.testAntiDetect();
      return { success: result.passed, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 完整流程测试
  ipcMain.handle('poc:full', async () => {
    try {
      const { PoCRunner } = await import('./poc-runner');
      const runner = new PoCRunner();
      const result = await runner.testFull();
      return { success: result.passed, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 内存监控测试
  ipcMain.handle('poc:memory', async () => {
    try {
      const { PoCRunner } = await import('./poc-runner');
      const runner = new PoCRunner();
      const result = await runner.testMemory();
      return { success: result.passed, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

// ============================================================
// PoC 调度
// ============================================================

async function runPoc(type: string): Promise<unknown> {
  const { PoCRunner } = await import('./poc-runner');
  const runner = new PoCRunner();

  switch (type) {
    case 'login':
      return await runner.testLogin();
    case 'upload':
      return await runner.testUpload();
    case 'anti-detect':
      return await runner.testAntiDetect();
    case 'full':
      return await runner.testFull();
    case 'memory':
      return await runner.testMemory();
    default:
      throw new Error(`未知的 PoC 类型: ${type}`);
  }
}

// ============================================================
// Electron 窗口创建
// ============================================================

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 500,
    height: 400,
    title: 'MatrixFlow PoC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 简单的 PoC 状态页面
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head><title>MatrixFlow PoC</title></head>
      <body style="font-family: -apple-system, sans-serif; padding: 24px;">
        <h1>MatrixFlow PoC</h1>
        <p>Patchright + Electron 验证</p>
        <hr>
        <p>使用方法:</p>
        <pre style="background:#f0f0f0; padding:12px; border-radius:6px;">
npm run poc:login        # 抖音扫码登录测试
npm run poc:upload       # 视频上传测试
npm run poc:anti-detect  # 反检测测试
npm run poc:full         # 完整流程测试
npm run poc:memory       # 内存监控测试
        </pre>
        <div id="status"></div>
        <script>
          if (window.matrixflow) {
            window.matrixflow.onStatus((msg) => {
              document.getElementById('status').innerHTML += '<p>' + msg + '</p>';
            });
          }
        </script>
      </body>
      </html>
    `)}`
  );

  return win;
}

// ============================================================
// 应用生命周期
// ============================================================

app.whenReady().then(async () => {
  // 注册所有 IPC 处理器
  registerIpcHandlers();

  // 解析 CLI 参数 --poc=<type>
  const pocArg = process.argv.find((a) => a.startsWith('--poc='));
  const pocType = pocArg?.split('=')[1];

  if (pocType) {
    console.log(`[MatrixFlow PoC] 启动测试: ${pocType}`);
    console.log('='.repeat(60));

    try {
      await runPoc(pocType);
      console.log('='.repeat(60));
      console.log(`[MatrixFlow PoC] 测试完成: ${pocType}`);
    } catch (error) {
      console.error('[MatrixFlow PoC] 测试失败:', error);
    }

    // 上传和完整流程测试不自动退出（需要人工在平台上验证）
    if (pocType !== 'upload' && pocType !== 'full') {
      console.log('[MatrixFlow PoC] 3 秒后退出...');
      setTimeout(() => app.quit(), 3000);
    }
  } else {
    // 无 --poc 参数时打开窗口
    createWindow();
  }
});

// macOS 点击 dock 图标时重新创建窗口
app.on('window-all-closed', () => {
  // macOS 上通常不退出应用
});

app.on('before-quit', async () => {
  // 关闭浏览器实例
  if (browser) {
    try {
      await browser.close();
    } catch {
      // 忽略关闭时的错误
    }
  }
});

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('[MatrixFlow PoC] 未捕获异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MatrixFlow PoC] 未处理的 Promise 拒绝:', reason);
});
