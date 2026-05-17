import path from 'path';
import fs from 'fs';

export const TEST_ACCOUNT = 'test_account';
export const TEST_VIDEO = path.resolve(process.cwd(), 'test-video.mp4');
export const TEST_DATA_DIR = path.resolve(process.cwd(), 'data', 'test');
export const TEST_COOKIE_DIR = path.join(TEST_DATA_DIR, 'cookies', 'douyin');
export const TEST_QR_DIR = path.join(TEST_DATA_DIR, 'qrcodes', 'douyin');

export function ensureTestDirs(): void {
  [TEST_COOKIE_DIR, TEST_QR_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function cleanupTestData(): void {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

export function cookiePathFor(accountId: string): string {
  return path.join(TEST_COOKIE_DIR, `${accountId}.json`);
}

export function formatResult(label: string, result: Record<string, unknown>): string {
  return `\n[${label}]\n${JSON.stringify(result, null, 2)}\n`;
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}
