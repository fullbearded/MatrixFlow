import './register-mock.js';

import path from 'path';
import fs from 'fs';

const ACCOUNT_ID = 'test_account';

async function main() {
  console.log('=== 抖音扫码登录测试 ===\n');

  const { qrCodeLogin, validateExistingCookie } = await import('../electron/platform/douyin/login');
  const { getCookiePath, cookieExists } = await import('../electron/platform/douyin/cookie');

  const cookiePath = getCookiePath(ACCOUNT_ID);

  // 阶段 1：检查已有 cookie
  console.log('[阶段 1] 检查已有 cookie...');
  if (cookieExists(cookiePath)) {
    console.log(`  Cookie 文件存在: ${cookiePath}`);
    const valid = await validateExistingCookie(cookiePath);
    if (valid) {
      console.log('  ✅ Cookie 有效，无需重新登录\n');
      console.log('=== 测试完成：Cookie 有效 ===');
      return;
    }
    console.log('  ⚠️ Cookie 已失效，需要重新登录');
  } else {
    console.log('  无已有 cookie，需要扫码登录');
  }

  // 阶段 2：扫码登录
  console.log('\n[阶段 2] 启动扫码登录...');
  console.log('  📱 请准备抖音 APP 扫描二维码\n');

  const result = await qrCodeLogin(
    ACCOUNT_ID,
    false,
    (qrPath) => console.log(`  📸 二维码已生成: ${qrPath}`),
    (qrPath) => console.log(`  🔄 二维码已刷新: ${qrPath}`)
  );

  console.log('\n--- 登录结果 ---');
  console.log(`  成功: ${result.success}`);
  console.log(`  消息: ${result.message}`);
  console.log(`  Cookie 路径: ${result.cookiePath}`);

  // 阶段 3：验证 cookie 持久化
  if (result.success) {
    console.log('\n[阶段 3] 验证 cookie 持久化...');
    const persisted = cookieExists(cookiePath);
    if (persisted) {
      const stat = fs.statSync(cookiePath);
      console.log(`  ✅ Cookie 已持久化 (${stat.size} bytes): ${cookiePath}`);
    } else {
      console.log('  ❌ Cookie 文件未找到（持久化失败）');
      process.exit(1);
    }

    // 阶段 4：二次验证
    console.log('\n[阶段 4] 二次验证 cookie 有效性...');
    const revalidated = await validateExistingCookie(cookiePath);
    console.log(`  ${revalidated ? '✅' : '⚠️'} Cookie ${revalidated ? '有效' : '失效'}`);
  }

  console.log('\n=== 测试完成 ===');
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
