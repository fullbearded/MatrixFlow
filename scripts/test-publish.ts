import './register-mock.js';

import path from 'path';
import fs from 'fs';

const ACCOUNT_ID = 'test_account';
const TEST_VIDEO = path.resolve(process.cwd(), 'test-video.mp4');

async function main() {
  console.log('=== 抖音发布流程测试 ===\n');

  const { getCookiePath, cookieExists } = await import('../electron/platform/douyin/cookie');
  const cookiePath = getCookiePath(ACCOUNT_ID);

  if (!cookieExists(cookiePath)) {
    console.error('❌ Cookie 不存在，请先运行: npm run test:login');
    process.exit(1);
  }
  console.log('✅ Cookie 文件存在');

  if (!fs.existsSync(TEST_VIDEO)) {
    console.error(`❌ 测试视频不存在: ${TEST_VIDEO}`);
    process.exit(1);
  }
  console.log(`✅ 测试视频存在: ${TEST_VIDEO} (${(fs.statSync(TEST_VIDEO).size / 1024 / 1024).toFixed(2)} MB)`);

  console.log('\n--- 步骤 1: 视频上传 ---');
  const { uploadVideo } = await import('../electron/platform/douyin/upload');

  const uploadResult = await uploadVideo({
    accountId: ACCOUNT_ID,
    videoPath: TEST_VIDEO,
    title: 'MatrixFlow E2E 测试',
    description: '自动化端到端测试视频',
    tags: ['测试', '自动化'],
  });

  console.log(`  成功: ${uploadResult.success}`);
  console.log(`  消息: ${uploadResult.message}`);
  if (uploadResult.videoId) {
    console.log(`  视频 ID: ${uploadResult.videoId}`);
  }

  if (!uploadResult.success) {
    console.log('\n⚠️ 上传失败，跳过发布测试');
    return;
  }

  console.log('\n--- 步骤 2: 发布确认 ---');
  const { publish } = await import('../electron/platform/douyin/publish');

  const publishResult = await publish({
    accountId: ACCOUNT_ID,
    title: 'MatrixFlow E2E 测试',
    description: '自动化端到端测试视频',
    tags: ['测试'],
  });

  console.log(`  成功: ${publishResult.success}`);
  console.log(`  消息: ${publishResult.message}`);
  if (publishResult.videoId) {
    console.log(`  视频 ID: ${publishResult.videoId}`);
  }

  console.log('\n=== 测试完成 ===');
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
