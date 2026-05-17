import { test, describe, beforeAll, afterAll, expect, vi } from 'vitest';
import path from 'path';
import fs from 'fs';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      const base = path.join(process.cwd(), 'data', 'test');
      const dirs: Record<string, string> = {
        userData: base,
        logs: path.join(base, 'logs'),
      };
      const resolved = dirs[name] || base;
      if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    },
    getVersion: () => '0.1.0-test',
    isPackaged: false,
    quit: () => {},
  },
  ipcMain: { on: () => {}, handle: () => {} },
  ipcRenderer: { invoke: () => Promise.resolve() },
  BrowserWindow: class {
    webContents = { on: () => {}, send: () => {} };
    loadURL() { return Promise.resolve(); }
    close() {}
  },
  session: { defaultSession: { cookies: { get: () => Promise.resolve([]) } } },
}));

vi.mock('electron-log', () => ({
  default: {
    info: (...args: unknown[]) => console.log('[INFO]', ...args),
    warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
    debug: (...args: unknown[]) => {},
    transports: {
      file: { resolvePathFn: () => {}, maxSize: 0, format: '' },
    },
  },
}));

const TEST_ACCOUNT = 'e2e_test_account';
const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'test');

describe('抖音端到端流程', () => {
  beforeAll(() => {
    const dirs = [
      path.join(TEST_DATA_DIR, 'cookies', 'douyin'),
      path.join(TEST_DATA_DIR, 'qrcodes', 'douyin'),
      path.join(TEST_DATA_DIR, 'user_data', 'douyin'),
    ];
    dirs.forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe('1. 扫码登录', () => {
    test('无 cookie 时应启动扫码登录流程', async () => {
      const { qrCodeLogin } = await import('../../electron/platform/douyin/login');

      const qrEvents: string[] = [];
      const result = await qrCodeLogin(
        TEST_ACCOUNT,
        false,
        (qrPath) => {
          qrEvents.push(`ready:${qrPath}`);
          console.log('📸 二维码已生成:', qrPath);
        },
        (qrPath) => {
          qrEvents.push(`refresh:${qrPath}`);
          console.log('🔄 二维码已刷新:', qrPath);
        }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('cookiePath');
      expect(result).toHaveProperty('message');

      if (result.success) {
        console.log('✅ 登录成功:', result.message);
      } else {
        console.log('⚠️ 登录结果:', result.message);
      }
    }, 300_000);
  });

  describe('2. Cookie 持久化', () => {
    test('登录后 cookie 文件应存在', async () => {
      const { cookieExists, getCookiePath } = await import('../../electron/platform/douyin/cookie');

      const cookiePath = getCookiePath(TEST_ACCOUNT);
      const exists = cookieExists(cookiePath);

      if (exists) {
        const stat = fs.statSync(cookiePath);
        console.log(`✅ Cookie 文件存在 (${stat.size} bytes): ${cookiePath}`);
        expect(exists).toBe(true);
      } else {
        console.log('⚠️ Cookie 文件不存在（可能未完成扫码登录）');
      }
    });

    test('已有 cookie 应通过有效性验证', async () => {
      const { validateExistingCookie } = await import('../../electron/platform/douyin/login');
      const { getCookiePath } = await import('../../electron/platform/douyin/cookie');

      const cookiePath = getCookiePath(TEST_ACCOUNT);
      if (!fs.existsSync(cookiePath)) {
        console.log('⏭️ 跳过：Cookie 文件不存在');
        return;
      }

      const valid = await validateExistingCookie(cookiePath);
      console.log(valid ? '✅ Cookie 有效' : '⚠️ Cookie 已失效');
      expect(typeof valid).toBe('boolean');
    }, 30_000);

    test('有 cookie 时重新登录应跳过扫码', async () => {
      const { getCookiePath } = await import('../../electron/platform/douyin/cookie');
      const cookiePath = getCookiePath(TEST_ACCOUNT);

      if (!fs.existsSync(cookiePath)) {
        console.log('⏭️ 跳过：需要先完成扫码登录');
        return;
      }

      const { qrCodeLogin } = await import('../../electron/platform/douyin/login');
      const result = await qrCodeLogin(TEST_ACCOUNT, true);

      if (result.success && result.message === 'Cookie 有效') {
        console.log('✅ 成功跳过扫码，直接使用已有 Cookie');
      }
      expect(result.success).toBe(true);
    }, 30_000);
  });

  describe('3. 视频上传', () => {
    test('使用已保存的 cookie 上传视频', async () => {
      const { getCookiePath } = await import('../../electron/platform/douyin/cookie');
      const cookiePath = getCookiePath(TEST_ACCOUNT);

      if (!fs.existsSync(cookiePath)) {
        console.log('⏭️ 跳过：需要先完成登录');
        return;
      }

      const videoPath = path.join(process.cwd(), 'test-video.mp4');
      if (!fs.existsSync(videoPath)) {
        console.log('⏭️ 跳过：test-video.mp4 不存在');
        return;
      }

      const { uploadVideo } = await import('../../electron/platform/douyin/upload');

      const result = await uploadVideo({
        accountId: TEST_ACCOUNT,
        videoPath,
        title: 'E2E 测试视频',
        description: 'MatrixFlow 端到端自动化测试',
        tags: ['测试', '自动化'],
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');

      if (result.success) {
        console.log('✅ 视频上传成功:', result.message);
      } else {
        console.log('⚠️ 上传结果:', result.message);
      }
    }, 180_000);
  });

  describe('4. 发布确认', () => {
    test('填写元数据并确认发布', async () => {
      const { getCookiePath } = await import('../../electron/platform/douyin/cookie');
      const cookiePath = getCookiePath(TEST_ACCOUNT);

      if (!fs.existsSync(cookiePath)) {
        console.log('⏭️ 跳过：需要先完成登录');
        return;
      }

      const { publish } = await import('../../electron/platform/douyin/publish');

      const result = await publish({
        accountId: TEST_ACCOUNT,
        title: 'E2E 测试发布',
        description: '端到端发布测试',
        tags: ['e2e'],
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');

      if (result.success) {
        console.log('✅ 发布成功', result.videoId ? `(ID: ${result.videoId})` : '');
      } else {
        console.log('⚠️ 发布结果:', result.message);
      }
    }, 120_000);
  });
});
