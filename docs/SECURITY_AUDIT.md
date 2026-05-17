# MatrixFlow 安全审计报告

**审计日期**: 2026-05-17
**项目版本**: 0.1.0
**审计范围**: 代码安全、依赖安全、数据安全

---

## 执行摘要

本次安全审计发现 11 个漏洞（4 低、2 中、5 高）。主要风险来自 Electron 版本过旧和依赖包漏洞。建议升级关键依赖并修复代码层面的安全问题。

---

## 一、依赖安全审计

### 1.1 npm audit 结果

运行 `npm audit` 发现 11 个漏洞：

| 漏洞级别 | 数量 | 主要影响 |
|---------|------|---------|
| 高危 | 5 | Electron 多个 CVE、tar 路径遍历 |
| 中危 | 2 | esbuild 开发服务器、Vite |
| 低危 | 4 | electron-builder 传递依赖 |

### 1.2 高危漏洞详情

**Electron <= 39.8.4 (当前 35.x)**

多个 CVE：
- GHSA-5rqw-r77c-jp79: AppleScript 注入
- GHSA-xj5x-m3f3-5x3h: Service Worker IPC 欺骗
- GHSA-r5p7-gp4j-qhrx: iframe 权限请求处理不当
- GHSA-3c8v-cfp5-9885: macOS/Linux IPC 越界读取
- GHSA-xwr5-m59h-vwqr: nodeIntegrationInWorker 作用域问题
- 多个 Use-after-free 漏洞

**修复建议**: 升级到 Electron 42.1.0+

**tar <= 7.5.10**

多个路径遍历和符号链接漏洞：
- GHSA-34x7-hfp2-rc4v: 硬链接路径遍历
- GHSA-8qq5-rm4j-mr97: 符号链接污染
- GHSA-83g3-92jg-28cx: 符号链接链逃逸

**修复建议**: 升级 electron-builder 到 26.8.1+

---

## 二、代码安全审计

### 2.1 P0 级别问题（严重）

#### 2.1.1 db:query 任意 SQL 执行

**文件**: `electron/ipc/handlers.ts:518`

```typescript
ipcMain.handle('db:query', async (_, sql: string, params?: any[]) => {
  return db.prepare(sql).run(...(params || []));
});
```

**风险**: 渲染进程可执行任意 SQL，包括读取/修改所有数据。

**修复建议**:
- 移除通用 query 接口
- 改为具体的数据访问接口

#### 2.1.2 License HMAC 密钥硬编码

**文件**: `electron/services/LicenseServerClient.ts:164-165`

```typescript
private getApiKey(): string {
  return process.env.MATRIXFLOW_API_KEY || 'default-api-key-replace-in-production';
}
```

**风险**: 攻击者可伪造 License API 请求签名。

**修复建议**:
```typescript
private getApiKey(): string {
  const key = process.env.MATRIXFLOW_API_KEY;
  if (!key) throw new Error('MATRIXFLOW_API_KEY 未配置');
  return key;
}
```

#### 2.1.3 License 离线签名使用截断哈希

**文件**: `electron/services/LicenseService.ts:299-306`

使用 SHA256 的前 16 字节作为设备 ID，碰撞概率较高。

**修复建议**: 使用完整 SHA256 哈希。

#### 2.1.4 License 公钥为占位符

**文件**: `electron/services/LicenseService.ts:326`

公钥为占位符字符串，实际部署时必须替换。

**修复建议**: 生成真实 RSA 密钥对并替换。

### 2.2 P1 级别问题（高危）

#### 2.2.1 Cookie 明文文件并存

**文件**: `electron/platform/*/cookie.ts`

虽然数据库中 Cookie 已加密，但各平台适配器同时将完整 storageState 以明文 JSON 保存到磁盘：
- `{userData}/cookies/douyin/{accountId}.json`
- `{userData}/cookies/xiaohongshu/{accountId}.json`
- 等等

**修复建议**: 
- 加密写入磁盘文件
- 或完全依赖数据库加密存储

#### 2.2.2 测试 Cookie 数据泄露

**文件**: `data/cookies/douyin_poc_test.json`

包含完整抖音登录 Cookie。

**修复建议**:
```bash
echo "data/cookies/" >> .gitignore
git rm --cached data/cookies/douyin_poc_test.json
```

### 2.3 P2 级别问题（中危）

#### 2.3.1 IPC 白名单绕过

**文件**: `electron/preload.ts:213-232`

`onPublishStatus`、`onTaskProgress`、`onTaskStatusChange` 直接调用 `ipcRenderer.on()`，绕过了白名单检查。

**修复建议**: 统一使用白名单机制。

#### 2.3.2 CryptoService 和 SecurityLayer 不一致

两个加密服务并存，职责重叠：
- `electron/core/CryptoService.ts`
- `electron/core/SecurityLayer.ts`

**修复建议**: 统一加密 API。

### 2.4 P3 级别问题（低危）

#### 2.4.1 未启用 sandbox

**文件**: `electron/main.ts:30-34`

建议显式启用 `sandbox: true`。

#### 2.4.2 BrowserPool getBrowserId 线性扫描

**文件**: `electron/services/BrowserPool.ts:302`

使用 `Array.find()` 线性扫描，建议改用 Map。

---

## 三、数据安全审计

### 3.1 Cookie 安全

- 存储加密：AES-256-GCM
- 密钥管理：从 master password 派生
- 问题：明文文件并存（见 2.2.1）

### 3.2 License 安全

- 签名算法：RSA-2048
- 设备绑定：SHA256 截断（需改进）
- 问题：公钥占位符、HMAC 密钥硬编码

### 3.3 敏感数据处理

- 密码：不明文存储
- API Key：从环境变量读取
- Token：存储在 Cookie 中（加密）

---

## 四、修复优先级

| 优先级 | 问题 | 文件 | 状态 |
|-------|------|------|------|
| P0 | db:query 任意 SQL | handlers.ts | ✅ 已禁用 |
| P0 | HMAC 密钥硬编码 | LicenseServerClient.ts | ✅ 已修复 |
| P0 | License 签名截断 | LicenseService.ts | ✅ 已修复 |
| P0 | 公钥占位符 | LicenseService.ts | ✅ 支持环境变量 |
| P1 | 升级 Electron | package.json | 待升级 |
| P1 | Cookie 明文文件 | platform/*/cookie.ts | 待修复 |
| P1 | 升级 electron-builder | package.json | 待升级 |
| P2 | Cookie 数据泄露 | data/cookies/ | 待删除 |
| P2 | IPC 白名单绕过 | preload.ts | 待修复 |
| P3 | 启用 sandbox | main.ts | 待添加 |

---

## 五、建议措施

### 5.1 立即执行

1. 移除 `db:query` 接口，改为具体数据访问接口
2. 修复 HMAC 密钥硬编码问题
3. 删除泄露的测试 Cookie 文件并添加到 .gitignore
4. 加密磁盘上的 Cookie 文件

### 5.2 短期计划（1-2周）

1. 升级 Electron 到 42.x
2. 升级 electron-builder 到 26.x
3. 统一加密服务 API
4. 完善 IPC 白名单

### 5.3 长期计划

1. 定期安全审计（每月）
2. 依赖自动更新检查
3. 渗透测试
4. 安全培训

---

## 六、结论

MatrixFlow 项目存在若干安全隐患，主要集中在：
1. 依赖版本过旧
2. License 系统安全实现不足
3. Cookie 存在明文副本

建议在正式发布前修复所有 P0 和 P1 级别问题。
