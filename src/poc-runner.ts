// ============================================================
// PoC 测试编排器
// Go/No-Go 决策点验证
// ============================================================

import path from 'path';
import fs from 'fs';
import { chromium } from 'patchright';
import { qrCodeLogin, validateExistingCookie } from './douyin/login';
import { uploadVideo } from './douyin/upload';
import { getCookiePath } from './douyin/cookie';
import { runAntiDetectTest } from './anti-detect';
import { checkMemoryUsage } from './memory-monitor';

const TEST_ACCOUNT = 'douyin_poc_test';
const TEST_VIDEO = path.join(process.cwd(), 'test-video.mp4');

export interface PocResult {
  test: string;
  passed: boolean;
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export class PoCRunner {
  results: PocResult[] = [];

  private async runTest(
    name: string,
    testFn: () => Promise<{ passed: boolean; message: string; details?: Record<string, unknown> }>
  ): Promise<PocResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[PoC] 开始测试: ${name}`);
    console.log('='.repeat(60));

    try {
      const result = await testFn();
      const durationMs = Date.now() - startTime;

      const pocResult: PocResult = {
        test: name,
        passed: result.passed,
        message: result.message,
        durationMs,
        details: result.details,
      };

      this.results.push(pocResult);

      console.log(`[PoC] ${result.passed ? '✓ 通过' : '✗ 失败'}: ${result.message}`);
      console.log(`[PoC] 耗时: ${durationMs}ms`);

      return pocResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const pocResult: PocResult = {
        test: name,
        passed: false,
        message: `测试异常: ${error}`,
        durationMs,
      };

      this.results.push(pocResult);
      console.log(`[PoC] ✗ 异常: ${error}`);
      return pocResult;
    }
  }

  async testPatchrightLaunch(): Promise<PocResult> {
    return this.runTest('Patchright 启动验证', async () => {
      const browser = await chromium.launch({
        channel: 'chrome',
        headless: false,
        args: [
          '--disable-gpu',
          '--disable-gpu-sandbox',
          '--disable-software-rasterizer',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-sandbox',
        ],
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://www.baidu.com');
      const title = await page.title();

      await context.close();
      await browser.close();

      if (title.includes('百度')) {
        return { passed: true, message: 'Patchright 成功启动并访问百度' };
      }
      return { passed: false, message: '页面标题不匹配' };
    });
  }

  async testAntiDetect(): Promise<PocResult> {
    return this.runTest('反检测验证', async () => {
      const result = await runAntiDetectTest();
      
      return {
        passed: result.passed,
        message: result.passed
          ? `通过 ${result.passedTests}/${result.totalTests} 项检测`
          : `未通过检测阈值 (${result.passedTests}/${result.totalTests})`,
        details: {
          passedTests: result.passedTests,
          totalTests: result.totalTests,
          failedChecks: result.failedChecks,
        },
      };
    });
  }

  async testMemoryUsage(): Promise<PocResult> {
    return this.runTest('内存占用验证', async () => {
      const memory = checkMemoryUsage();
      
      return {
        passed: memory.withinLimit,
        message: memory.withinLimit
          ? `RSS ${memory.rssMB}MB < 200MB 限制`
          : `RSS ${memory.rssMB}MB 超出 200MB 限制`,
        details: {
          withinLimit: memory.withinLimit,
          rssMB: memory.rssMB,
          heapUsedMB: memory.heapUsedMB,
          heapTotalMB: memory.heapTotalMB,
        },
      };
    });
  }

  async testLogin(): Promise<PocResult> {
    return this.runTest('抖音扫码登录', async () => {
      const result = await qrCodeLogin(TEST_ACCOUNT, false);

      if (result.success) {
        return {
          passed: true,
          message: `登录成功 (${result.status})`,
          details: { cookiePath: result.cookiePath },
        };
      }

      return {
        passed: false,
        message: `登录失败: ${result.message} (${result.status})`,
      };
    });
  }

  async testCookieValidity(): Promise<PocResult> {
    return this.runTest('Cookie 有效性验证', async () => {
      const cookiePath = getCookiePath(TEST_ACCOUNT);

      if (!fs.existsSync(cookiePath)) {
        return { passed: false, message: 'Cookie 文件不存在，请先执行登录测试' };
      }

      const valid = await validateExistingCookie(cookiePath);

      return {
        passed: valid,
        message: valid ? 'Cookie 有效' : 'Cookie 已失效',
      };
    });
  }

  async testUpload(): Promise<PocResult> {
    return this.runTest('视频上传验证', async () => {
      if (!fs.existsSync(TEST_VIDEO)) {
        return { passed: false, message: '测试视频文件不存在' };
      }

      const result = await uploadVideo({
        videoPath: TEST_VIDEO,
        title: `PoC 测试视频 ${Date.now()}`,
        description: 'MatrixFlow PoC 自动化测试视频',
        accountId: TEST_ACCOUNT,
      });

      return {
        passed: result.success,
        message: result.message,
        details: result.publishUrl ? { publishUrl: result.publishUrl } : undefined,
      };
    });
  }

  async runFullTest(): Promise<PocResult[]> {
    console.log('\n' + '#'.repeat(60));
    console.log('# MatrixFlow PoC 完整测试');
    console.log('#'.repeat(60) + '\n');

    await this.testPatchrightLaunch();
    await this.testAntiDetect();
    await this.testMemoryUsage();

    return this.results;
  }

  async testFull(): Promise<PocResult> {
    await this.runFullTest();
    this.printSummary();
    return {
      test: 'full',
      passed: this.isGoDecision(),
      message: this.isGoDecision() ? '所有测试通过' : '存在失败项',
      durationMs: this.results.reduce((sum, r) => sum + r.durationMs, 0),
    };
  }

  async testMemory(): Promise<PocResult> {
    return this.testMemoryUsage();
  }

  async runLoginTest(): Promise<PocResult[]> {
    console.log('\n' + '#'.repeat(60));
    console.log('# 抖音登录测试流程');
    console.log('#'.repeat(60) + '\n');

    await this.testPatchrightLaunch();
    await this.testLogin();
    await this.testCookieValidity();

    return this.results;
  }

  async runUploadTest(): Promise<PocResult[]> {
    console.log('\n' + '#'.repeat(60));
    console.log('# 抖音上传测试流程');
    console.log('#'.repeat(60) + '\n');

    await this.testPatchrightLaunch();
    await this.testCookieValidity();
    await this.testUpload();

    return this.results;
  }

  printSummary(): void {
    console.log('\n' + '#'.repeat(60));
    console.log('# 测试结果汇总');
    console.log('#'.repeat(60) + '\n');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    for (const result of this.results) {
      const icon = result.passed ? '✓' : '✗';
      console.log(`${icon} ${result.test}: ${result.message} (${result.durationMs}ms)`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log(`总计: ${passed}/${total} 通过`);

    const allPassed = passed === total;
    console.log(`\n${allPassed ? '✓ Go' : '✗ No-Go'}: ${allPassed ? '所有测试通过，可以继续开发' : '存在失败项，需要修复'}`);
    console.log('#'.repeat(60) + '\n');
  }

  isGoDecision(): boolean {
    return this.results.every(r => r.passed);
  }
}

export async function runPoc(type: 'login' | 'upload' | 'anti-detect' | 'full' | 'memory' = 'full'): Promise<PocResult[]> {
  const runner = new PoCRunner();

  switch (type) {
    case 'login':
      return runner.runLoginTest();
    case 'upload':
      return runner.runUploadTest();
    case 'anti-detect':
      await runner.testAntiDetect();
      break;
    case 'memory':
      await runner.testMemoryUsage();
      break;
    case 'full':
    default:
      return runner.runFullTest();
  }

  runner.printSummary();
  return runner.results;
}
