# MatrixFlow API 文档

**版本**: 0.2.0 | **更新**: 2026-05-18

所有 IPC 调用通过 `window.matrixflow` 访问，受 preload.ts 白名单保护。返回统一格式 `IpcResult<T> = { success: boolean, data?: T, message?: string }`。

## 通道统计

| 域 | 通道数 |
|---|--------|
| Account | 10 |
| Content | 5 |
| Group | 5 |
| Publish | 9 |
| Task | 2 |
| Platform | 5 |
| Stats | 3 |
| AI | 5 |
| Monitor | 5 |
| Report | 2 |
| Panel | 4 |
| Draft | 5 |
| Comment | 7 |
| License | 5 |
| Proxy | 6 |
| Fingerprint | 5 |
| Data | 5 |
| Settings | 2 |
| Notification | 3 |
| Update | 4 |

---

## Account

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `account:list` | — | `Account[]` | 账号列表 |
| `account:add` | `platform, groupId?` | `Account` | 添加账号 |
| `account:remove` | `accountId` | `void` | 移除账号 |
| `account:validate` | `accountId` | `{ valid }` | Cookie 有效性验证 |
| `account:setFingerprint` | `accountId, fingerprintId` | `void` | 绑定指纹 |
| `account:setProxy` | `accountId, proxyId` | `void` | 绑定代理 |
| `accounts:list` | — | `Account[]` | 兼容通道 |
| `accounts:create` | `platform, groupId?` | `Account` | 兼容通道 |
| `accounts:delete` | `accountId` | `void` | 兼容通道 |
| `accounts:login` | `accountId` | `CookieResult` | 发起登录 |
| `accounts:checkCookie` | `accountId` | `{ valid }` | Cookie 检查 |
| `accounts:getQRCode` | `platform` | `{ qrUrl }` | 获取二维码 |

## Content

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `content:list` | — | `Content[]` | 内容列表 |
| `content:create` | `Partial<Content>` | `Content` | 创建内容 |
| `content:update` | `id, Partial<Content>` | `Content` | 更新内容 |
| `content:delete` | `id` | `void` | 删除内容 |
| `content:uploadVideo` | `contentId, filePath` | `Content` | 上传视频 |

## Group

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `groups:list` | — | `Group[]` | 分组列表 |
| `groups:create` | `{ name, publishRules? }` | `Group` | 创建分组 |
| `groups:update` | `id, Partial<Group>` | `Group` | 更新分组 |
| `groups:delete` | `id` | `void` | 删除分组 |
| `groups:bindAccounts` | `groupId, accountIds[]` | `void` | 绑定账号 |

## Publish

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `publish:submit` | `PublishRequest` | `PublishResult` | 提交发布 |
| `publish:cancel` | `taskId` | `void` | 取消发布 |
| `publish:status` | `taskId` | `PublishTaskStatusDetail` | 发布状态 |
| `publish:createTask` | `Partial<PublishTask>` | `PublishTask` | 创建定时任务 |
| `publish:updateTask` | `taskId, Partial<PublishTask>` | `PublishTask` | 更新任务 |
| `publish:deleteTask` | `taskId` | `void` | 删除任务 |
| `publish:cancelTask` | `taskId` | `void` | 取消任务 |
| `publish:retryTask` | `taskId` | `void` | 重试任务 |
| `publish:listTasks` | `TaskFilters?` | `PublishTask[]` | 任务列表 |

## Task

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `task:list` | `filters?` | `Task[]` | 任务列表 |
| `task:retry` | `taskId` | `void` | 重试任务 |

## Platform

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `platform:list` | — | `PlatformConfig[]` | 平台列表 |
| `platform:login` | `platform, accountId` | `CookieResult` | 发起登录 |
| `platforms:list` | — | `PlatformConfig[]` | 兼容通道 |
| `platforms:getConfig` | `platform` | `PlatformConfig` | 平台配置 |
| `platforms:getCapabilities` | `platform` | `PlatformCapabilities` | 平台能力 |

## Stats

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `stats:overview` | `{ range: { start, end } }` | `StatsOverview` | 数据概览 |
| `stats:platform` | `{ platform, range }` | `PlatformStats` | 平台数据 |
| `stats:trend` | `{ metric, range }` | `TrendDataPoint[]` | 趋势分析 |

## AI

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `ai:prePublishCheck` | `PrePublishContext` | `PrePublishCheckResult` | 发布前 AI 检查 |
| `ai:optimizeRule` | `RuleOptimizationContext` | `RuleOptimizationResult` | AI 优化规则 |
| `ai:getCostSummary` | `{ range }` | `CostRecord[]` | 成本汇总 |
| `ai:getAlerts` | — | `Alert[]` | 异常告警 |
| `ai:dismissAlert` | `alertId` | `void` | 忽略告警 |

## Monitor

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `monitor:createPlan` | `Partial<MonitorPlan>` | `MonitorPlan` | 创建监控计划 |
| `monitor:updatePlan` | `id, Partial<MonitorPlan>` | `MonitorPlan` | 更新计划 |
| `monitor:deletePlan` | `id` | `void` | 删除计划 |
| `monitor:listPlans` | — | `MonitorPlan[]` | 计划列表 |
| `monitor:getAlerts` | `planId?` | `MonitorAlert[]` | 监控告警 |

## Report

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `report:generate` | `{ type, range }` | `Report` | 生成周报 |
| `report:getLatest` | `{ type }` | `Report` | 最新周报 |

## Panel

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `panel:open` | `accountId` | `PanelSession` | 打开多开面板 |
| `panel:close` | `sessionId` | `void` | 关闭面板 |
| `panel:focus` | `sessionId` | `void` | 聚焦面板 |
| `panel:list` | — | `PanelSession[]` | 面板列表 |

## Draft

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `draft:create` | `Partial<Draft>` | `Draft` | 创建草稿 |
| `draft:update` | `id, Partial<Draft>` | `Draft` | 更新草稿 |
| `draft:delete` | `id` | `void` | 删除草稿 |
| `draft:list` | `status?` | `Draft[]` | 草稿列表 |
| `draft:duplicate` | `id` | `Draft` | 复制草稿 |

## Comment

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `comment:template:create` | `Partial<CommentTemplate>` | `CommentTemplate` | 创建模板 |
| `comment:template:update` | `id, Partial<CommentTemplate>` | `CommentTemplate` | 更新模板 |
| `comment:template:delete` | `id` | `void` | 删除模板 |
| `comment:template:list` | — | `CommentTemplate[]` | 模板列表 |
| `comment:schedule` | `CommentTask` | `void` | 定时评论 |
| `comment:execute` | `CommentTask` | `void` | 立即评论 |
| `comment:task:list` | — | `CommentTask[]` | 评论任务列表 |

## License

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `license:status` | — | `{ valid, license? }` | 许可证状态 |
| `license:activate` | `key, email` | `{ license }` | 在线激活 |
| `license:activate:offline` | `filePath` | `{ license }` | 离线激活 |
| `license:offline:request` | `key, email` | `{ data }` | 生成离线请求 |
| `license:deactivate` | — | `void` | 注销许可证 |

## Proxy

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `proxy:list` | — | `Proxy[]` | 代理列表 |
| `proxy:get` | `id` | `Proxy` | 获取代理 |
| `proxy:create` | `Partial<Proxy>` | `Proxy` | 创建代理 |
| `proxy:update` | `id, Partial<Proxy>` | `Proxy` | 更新代理 |
| `proxy:delete` | `id` | `void` | 删除代理 |
| `proxy:check` | `id` | `{ available }` | 检查可用性 |

## Fingerprint

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `fingerprint:list` | — | `FingerprintTemplate[]` | 模板列表 |
| `fingerprint:get` | `id` | `FingerprintTemplate` | 获取模板 |
| `fingerprint:create` | `Partial<FingerprintTemplate>` | `FingerprintTemplate` | 创建模板 |
| `fingerprint:update` | `id, Partial<FingerprintTemplate>` | `FingerprintTemplate` | 更新模板 |
| `fingerprint:delete` | `id` | `void` | 删除模板 |

## Data Management

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `data:createBackup` | — | `BackupInfo` | 创建备份 |
| `data:listBackups` | — | `BackupInfo[]` | 备份列表 |
| `data:restoreBackup` | `backupId` | `void` | 恢复备份 |
| `data:deleteBackup` | `backupId` | `void` | 删除备份 |
| `data:clear` | `type: 'all'\|'tasks'\|'stats'\|'logs'` | `void` | 清除数据 |

## Settings

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `settings:get` | `key` | `unknown` | 获取配置 |
| `settings:set` | `key, value` | `void` | 设置配置 |

## Notification

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `notification:getPreferences` | — | `NotificationPreferences` | 通知偏好 |
| `notification:updatePreferences` | `Partial<NotificationPreferences>` | `void` | 更新偏好 |
| `notification:test` | — | `void` | 测试通知 |

## Update

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `update:check` | — | `{ available, version? }` | 检查更新 |
| `update:download` | — | `void` | 下载更新 |
| `update:install` | — | `void` | 安装更新 |
| `update:getStatus` | — | `{ status, progress? }` | 更新状态 |

---

## Event Listeners

通过 `window.matrixflow.on(channel, callback)` 或便捷方法监听，受白名单保护。

| 事件通道 | 便捷方法 | 说明 |
|----------|----------|------|
| `publish:status` | `onPublishStatus` | 发布状态变更 |
| `task:progress` | `onTaskProgress` | 任务进度更新 |
| `task:status-change` | `onTaskStatusChange` | 任务状态变更 |
| `account:login-status-updated` | — | 账号登录状态 |
| `update:status` | — | 更新状态 |
| `update:progress` | — | 下载进度 |

---

## MCP Server API

MCP Server 提供 18 个 Tool，支持 stdio 传输。

### 启动

```bash
cd mcp-server && npm run start
```

### Tool 列表

| 分类 | Tools |
|------|-------|
| 账号 | account_list, account_status, account_add, account_remove |
| 内容 | content_list, content_upload, content_delete, content_search, content_tags |
| 发布 | publish_create, publish_list, publish_cancel, publish_status, publish_schedule, publish_batch |
| 统计 | stats_overview, stats_platform, stats_trend |

---

## 核心服务接口

### BrowserPool

```typescript
class BrowserPool {
  createContext(accountId: string): Promise<BrowserContext>;
  getContext(accountId: string): Promise<BrowserContext | null>;
  releaseContext(accountId: string): Promise<void>;
  getActiveCount(): number;
}
```

### TaskScheduler

```typescript
class TaskScheduler {
  schedule(task: PublishTask): void;
  cancel(taskId: string): void;
  retry(taskId: string): void;
  getStatus(taskId: string): TaskStatus;
}
```

### AIService

```typescript
class AIService {
  prePublishCheck(context: PrePublishContext): Promise<PrePublishCheckResult>;
  optimizeRule(context: RuleOptimizationContext): Promise<RuleOptimizationResult>;
  getCostSummary(range: DateRange): Promise<CostRecord[]>;
}
```

### LicenseService

```typescript
class LicenseService {
  activate(key: string, email: string): Promise<ActivateResult>;
  activateOffline(filePath: string): Promise<ActivateResult>;
  verify(): Promise<boolean>;
  getInfo(): LicenseInfo;
  deactivate(): Promise<boolean>;
}
```

部分兼容旧频道的通道直接返回数据（不包装 `IpcResult`），具体见各通道说明。

---

## 账号管理（主 API）

通道前缀：`account:`

### `account:list`

获取所有已绑定的平台账号列表。

```typescript
// 调用
const result = await window.matrixflow.account.list();
// 返回: IpcResult<Account[]>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

### `account:add`

绑定新账号（创建账号记录并触发平台登录流程）。

```typescript
const result = await window.matrixflow.account.add(platform, groupId?);
// 返回: IpcResult<Account>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | `string` | 是 | 平台标识：`douyin` / `xiaohongshu` / `channels` / `kuaishou` |
| `groupId` | `string` | 否 | 所属分组 ID |

### `account:remove`

删除指定账号。

```typescript
const result = await window.matrixflow.account.remove(accountId);
// 返回: IpcResult<void>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

### `account:validate`

验证账号 Cookie 是否仍然有效。

```typescript
const result = await window.matrixflow.account.validate(accountId);
// 返回: IpcResult<boolean>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

### `account:setFingerprint`

为账号绑定浏览器指纹模板。

```typescript
const result = await window.matrixflow.account.setFingerprint(accountId, fingerprintId);
// 返回: IpcResult<void>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |
| `fingerprintId` | `string \| null` | 是 | 指纹模板 ID，传 `null` 解绑 |

### `account:setProxy`

为账号绑定代理配置。

```typescript
const result = await window.matrixflow.account.setProxy(accountId, proxyId);
// 返回: IpcResult<void>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |
| `proxyId` | `string \| null` | 是 | 代理 ID，传 `null` 解绑 |

---

## 账号管理（兼容旧频道）

通道前缀：`accounts:`

> 这些通道为向后兼容保留，返回格式不统一（部分直接返回数据，部分返回 `{ success, data/message }`）。

### `accounts:list`

获取所有账号列表。

```typescript
const result = await window.matrixflow.accounts.list();
// 返回: Account[]（直接返回，不包装 IpcResult）
```

### `accounts:create`

创建/绑定新账号。

```typescript
const result = await window.matrixflow.accounts.create({ platform, groupId? });
// 返回: { success: boolean, data?: Account, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data.platform` | `string` | 是 | 平台标识 |
| `data.groupId` | `string` | 否 | 分组 ID |

### `accounts:delete`

删除账号。

```typescript
const result = await window.matrixflow.accounts.delete(id);
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 账号 ID |

### `accounts:login`

触发账号登录（扫码/弹出浏览器窗口）。

```typescript
const result = await window.matrixflow.accounts.login(accountId);
// 返回: { success: boolean, data?: CookieResult, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

### `accounts:checkCookie`

检查账号 Cookie 有效性。

```typescript
const result = await window.matrixflow.accounts.checkCookie(accountId);
// 返回: { success: boolean, valid?: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

### `accounts:getQRCode`

获取账号登录二维码。

```typescript
const result = await window.matrixflow.accounts.getQRCode(accountId);
// 返回: { success: boolean, data?: string, message?: string }  // data 为 QR Code 数据
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

---

## 内容管理

通道前缀：`content:`

> 注意：兼容旧频道，直接返回数据或 `{ success, data, message }` 格式。

### `content:list`

获取所有内容列表。

```typescript
const result = await window.matrixflow.content.list();
// 返回: Content[]（直接返回）
```

### `content:create`

从文件导入内容到内容库。

```typescript
const result = await window.matrixflow.content.create({ filePath });
// 返回: { success: boolean, data?: Content, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data.filePath` | `string` | 是 | 文件路径 |

### `content:update`

更新内容信息。

```typescript
const result = await window.matrixflow.content.update(id, data);
// 返回: { success: boolean, data?: Content, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 内容 ID |
| `data` | `Record<string, unknown>` | 是 | 更新字段 |

### `content:delete`

删除内容。

```typescript
const result = await window.matrixflow.content.delete(id);
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 内容 ID |

### `content:uploadVideo`

上传视频文件（与 `content:create` 功能相同，兼容别名）。

```typescript
const result = await window.matrixflow.content.uploadVideo({ filePath });
// 返回: { success: boolean, data?: Content, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data.filePath` | `string` | 是 | 视频文件路径 |

---

## 分组管理

通道前缀：`groups:`

> 兼容旧频道，返回 `{ success, data?, message? }` 格式。

### `groups:list`

获取所有分组。

```typescript
const result = await window.matrixflow.groups.list();
// 返回: Group[]（直接返回）
```

### `groups:create`

创建新分组。

```typescript
const result = await window.matrixflow.groups.create({ name, description?, color? });
// 返回: { success: boolean, data?: Group, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data.name` | `string` | 是 | 分组名称 |
| `data.description` | `string` | 否 | 分组描述 |
| `data.color` | `string` | 否 | 标识颜色 |

### `groups:update`

更新分组信息。

```typescript
const result = await window.matrixflow.groups.update(id, data);
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 分组 ID |
| `data` | `Record<string, unknown>` | 是 | 更新字段 |

### `groups:delete`

删除分组。

```typescript
const result = await window.matrixflow.groups.delete(id);
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 分组 ID |

### `groups:bindAccounts`

将账号批量绑定到分组。

```typescript
const result = await window.matrixflow.groups.bindAccounts(groupId, accountIds);
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `groupId` | `string` | 是 | 分组 ID |
| `accountIds` | `string[]` | 是 | 账号 ID 列表 |

---

## 发布管理（主 API）

通道前缀：`publish:`

### `publish:submit`

创建发布任务并提交到调度器。

```typescript
const result = await window.matrixflow.publish.submit(request);
// 返回: IpcResult<PublishTask>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `request` | `PublishRequest` | 是 | 发布请求对象 |

**PublishRequest 结构**（推断自 PublishTask 类型）：
```typescript
interface PublishRequest {
  contentId: string;
  accountId: string;
  platform: string;
  publishMode?: 'server' | 'client';
  scheduledAt?: string;      // ISO 时间戳
  title?: string;
  description?: string;
  tags?: string[];
}
```

### `publish:cancel`

取消正在执行的发布任务。

```typescript
const result = await window.matrixflow.publish.cancel(taskId);
// 返回: IpcResult<void>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |

### `publish:status`

查询单个任务的详细状态。

```typescript
const result = await window.matrixflow.publish.status(taskId);
// 返回: IpcResult<PublishTaskStatusDetail>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |

---

## 发布管理（兼容旧频道）

### `publish:createTask`

创建发布任务（兼容通道）。

```typescript
const result = await window.matrixflow.accounts.create(data);  // 通过直接 invoke
// 等效: ipcRenderer.invoke('publish:createTask', data)
// 返回: { success: boolean, data?: PublishTask, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `PublishRequest` | 是 | 发布请求 |

### `publish:updateTask`

更新发布任务配置。

```typescript
// ipcRenderer.invoke('publish:updateTask', taskId, data)
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |
| `data` | `any` | 是 | 更新字段 |

### `publish:cancelTask`

取消发布任务（兼容通道）。

```typescript
// ipcRenderer.invoke('publish:cancelTask', taskId)
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |

### `publish:deleteTask`

删除发布任务记录。

```typescript
// ipcRenderer.invoke('publish:deleteTask', taskId)
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |

### `publish:retryTask`

重试失败的发布任务。

```typescript
// ipcRenderer.invoke('publish:retryTask', taskId)
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |

### `publish:listTasks`

获取发布任务列表。

```typescript
// ipcRenderer.invoke('publish:listTasks', filter?)
// 返回: PublishTask[]
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filter.contentId` | `string` | 否 | 按内容 ID 筛选 |

---

## 任务管理

通道前缀：`task:`

### `task:list`

获取任务列表（按内容 ID 筛选）。

```typescript
const result = await window.matrixflow.task.list(contentId?);
// 返回: IpcResult<PublishTask[]>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `contentId` | `string` | 否 | 内容 ID，不传则返回全部 |

### `task:retry`

立即重试指定任务。

```typescript
const result = await window.matrixflow.task.retry(taskId);
// 返回: IpcResult<PublishResult>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 任务 ID |

---

## 平台管理（主 API）

通道前缀：`platform:`

### `platform:list`

获取所有已注册的平台适配器信息。

```typescript
const result = await window.matrixflow.platform.list();
// 返回: IpcResult<PlatformInfo[]>
```

**PlatformInfo 结构**：
```typescript
interface PlatformInfo {
  platformId: string;           // 'douyin' | 'xiaohongshu' | 'channels' | 'kuaishou'
  config: PlatformConfig;       // 平台配置（名称、域名、限流等）
  capabilities: PlatformCapabilities;  // 平台能力（支持的发布类型等）
}
```

### `platform:login`

触发平台登录流程（打开浏览器窗口供用户扫码）。

```typescript
const result = await window.matrixflow.platform.login(accountId);
// 返回: IpcResult<CookieResult>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

---

## 平台管理（兼容频道）

通道前缀：`platforms:`

### `platforms:list`

获取支持的平台列表。

```typescript
const result = await window.matrixflow.platforms.list();
// 返回: string[]（平台 ID 数组）
```

### `platforms:getConfig`

获取指定平台的配置信息。

```typescript
const result = await window.matrixflow.platforms.getConfig(platformId);
// 返回: PlatformConfig | null
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platformId` | `string` | 是 | 平台标识 |

### `platforms:getCapabilities`

获取指定平台的能力信息。

```typescript
const result = await window.matrixflow.platforms.getCapabilities(platformId);
// 返回: PlatformCapabilities | null
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platformId` | `string` | 是 | 平台标识 |

---

## 数据统计

通道前缀：`stats:`

### `stats:overview`

获取发布数据概览。

```typescript
const result = await window.matrixflow.stats.getOverview(range?);
// 返回: OverviewStats | null
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `range` | `string` | 否 | 时间范围：`'today'` / `'week'` / `'month'`，默认 90 天 |

### `stats:platform`

获取指定平台的统计数据。

```typescript
const result = await window.matrixflow.stats.getPlatformStats(platform, range?);
// 返回: PlatformStats | null
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | `string` | 是 | 平台标识 |
| `range` | `string` | 否 | 时间范围（同上） |

### `stats:trend`

获取趋势数据。

```typescript
const result = await window.matrixflow.stats.getTrend(metric?, range?);
// 返回: TrendDataPoint[]
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `metric` | `string` | 否 | 指标类型：`'play_count'`（默认）/ `'like_count'` / `'comment_count'` / `'share_count'` 等 |
| `range` | `string` | 否 | 时间范围（同上） |

---

## AI 功能

通道前缀：`ai:`

### `ai:prePublishCheck`

发布前 AI 检查（内容合规性、最佳发布时间、冲突检测等）。

```typescript
const result = await window.matrixflow.ai.prePublishCheck(context);
// 返回: PrePublishCheckResult
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `context` | `PrePublishContext` | 是 | 预发布上下文 |

**返回结构**：
```typescript
interface PrePublishCheckResult {
  suggestions: string[];
  checks: {
    scheduleReasonable: boolean;
    accountHealth: boolean;
    historicalDataAvailable: boolean;
    conflictsDetected: boolean;
  };
}
```

### `ai:optimizeRule`

AI 优化发布规则。

```typescript
const result = await window.matrixflow.ai.optimizeRule(context);
// 返回: RuleOptimizationResult（{ suggestions: string[] }）
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `context` | `RuleOptimizationContext` | 是 | 规则优化上下文 |

### `ai:getCostSummary`

获取 AI 调用成本汇总。

```typescript
const result = await window.matrixflow.ai.getCostSummary();
// 返回: { totalCost: number; totalTokens: number; records: CostRecord[] }
```

### `ai:getAlerts`

获取异常告警列表。

```typescript
const result = await window.matrixflow.ai.getAlerts(accountId?);
// 返回: Alert[]
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 否 | 指定账号，不传则返回所有活跃告警 |

### `ai:dismissAlert`

忽略/关闭指定告警。

```typescript
const result = await window.matrixflow.ai.dismissAlert(alertId);
// 返回: boolean
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `alertId` | `string` | 是 | 告警 ID |

---

## 评论管理

通道前缀：`comment:`

### `comment:template:create`

创建评论模板。

```typescript
const result = await window.matrixflow.comment.template.create(data);
// 返回: IpcResult<CommentTemplate>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `any` | 是 | 模板数据（内容、平台、触发条件等） |

### `comment:template:update`

更新评论模板。

```typescript
const result = await window.matrixflow.comment.template.update(templateId, updates);
// 返回: IpcResult<CommentTemplate>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `templateId` | `string` | 是 | 模板 ID |
| `updates` | `any` | 是 | 更新字段 |

### `comment:template:delete`

删除评论模板。

```typescript
const result = await window.matrixflow.comment.template.delete(templateId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `templateId` | `string` | 是 | 模板 ID |

### `comment:template:list`

获取评论模板列表。

```typescript
const result = await window.matrixflow.comment.template.list(platform?);
// 返回: IpcResult<CommentTemplate[]>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | `string` | 否 | 按平台筛选 |

### `comment:schedule`

创建定时评论任务。

```typescript
const result = await window.matrixflow.comment.schedule(templateId, accountId, videoId);
// 返回: IpcResult<CommentTask>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `templateId` | `string` | 是 | 评论模板 ID |
| `accountId` | `string` | 是 | 账号 ID |
| `videoId` | `string` | 是 | 视频 ID |

### `comment:execute`

立即执行评论任务。

```typescript
const result = await window.matrixflow.comment.execute(taskId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | `string` | 是 | 评论任务 ID |

### `comment:task:list`

获取评论任务列表。

```typescript
const result = await window.matrixflow.comment.task.list();
// 返回: IpcResult<[]>
```

> 注意：当前实现返回空数组，功能待完善。

---

## 草稿管理

通道前缀：`draft:`

### `draft:create`

创建新草稿。

```typescript
const result = await window.matrixflow.draft.create(data);
// 返回: IpcResult<Draft>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `any` | 是 | 草稿数据 |

### `draft:update`

更新草稿内容。

```typescript
const result = await window.matrixflow.draft.update(draftId, updates);
// 返回: IpcResult<Draft>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `draftId` | `string` | 是 | 草稿 ID |
| `updates` | `any` | 是 | 更新字段 |

### `draft:delete`

删除草稿。

```typescript
const result = await window.matrixflow.draft.delete(draftId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `draftId` | `string` | 是 | 草稿 ID |

### `draft:list`

获取草稿列表。

```typescript
const result = await window.matrixflow.draft.list(status?);
// 返回: IpcResult<Draft[]>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | `string` | 否 | 按状态筛选 |

### `draft:duplicate`

复制草稿。

```typescript
const result = await window.matrixflow.draft.duplicate(draftId);
// 返回: IpcResult<Draft>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `draftId` | `string` | 是 | 草稿 ID |

---

## 授权管理

通道前缀：`license:`

### `license:status`

获取当前授权状态。

```typescript
const result = await window.matrixflow.license.status();
// 返回: IpcResult<{ valid: boolean; license: LicenseInfo | null }>
```

### `license:activate`

在线激活授权。

```typescript
const result = await window.matrixflow.license.activate(key, email);
// 返回: ActivateResult（由 LicenseService 返回）
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 授权密钥 |
| `email` | `string` | 是 | 绑定邮箱 |

### `license:activate:offline`

离线激活授权（导入授权文件）。

```typescript
const result = await window.matrixflow.license.activateOffline(filePath);
// 返回: ActivateResult
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 离线授权文件路径 |

### `license:offline:request`

生成离线授权请求文件。

```typescript
const result = await window.matrixflow.license.offlineRequest(key, email);
// 返回: IpcResult<string>（请求文件路径）
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 授权密钥 |
| `email` | `string` | 是 | 绑定邮箱 |

### `license:deactivate`

注销当前授权。

```typescript
const result = await window.matrixflow.license.deactivate();
// 返回: IpcResult<null>
```

---

## 代理管理

通道前缀：`proxy:`

### `proxy:list`

获取所有代理配置。

```typescript
const result = await window.matrixflow.proxy.list();
// 返回: IpcResult<Proxy[]>
```

### `proxy:get`

获取指定代理详情。

```typescript
const result = await window.matrixflow.proxy.get(id);
// 返回: IpcResult<Proxy>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 代理 ID |

### `proxy:create`

创建代理配置。

```typescript
const result = await window.matrixflow.proxy.create(data);
// 返回: IpcResult<Proxy>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data.name` | `string` | 是 | 代理名称 |
| `data.protocol` | `string` | 是 | 协议：`http` / `https` / `socks5` |
| `data.host` | `string` | 是 | 主机地址 |
| `data.port` | `number` | 是 | 端口号 |
| `data.username` | `string` | 否 | 认证用户名 |
| `data.password` | `string` | 否 | 认证密码 |

### `proxy:update`

更新代理配置。

```typescript
const result = await window.matrixflow.proxy.update(id, data);
// 返回: IpcResult<Proxy>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 代理 ID |
| `data` | `any` | 是 | 更新字段 |

### `proxy:delete`

删除代理配置。

```typescript
const result = await window.matrixflow.proxy.delete(id);
// 返回: IpcResult<void>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 代理 ID |

### `proxy:check`

测试代理连通性。

```typescript
const result = await window.matrixflow.proxy.check(id);
// 返回: IpcResult<ProxyCheckResult>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 代理 ID |

---

## 浏览器指纹管理

通道前缀：`fingerprint:`

### `fingerprint:list`

获取所有指纹模板。

```typescript
const result = await window.matrixflow.fingerprint.list();
// 返回: IpcResult<FingerprintTemplate[]>
```

### `fingerprint:get`

获取指定指纹模板详情。

```typescript
const result = await window.matrixflow.fingerprint.get(id);
// 返回: IpcResult<FingerprintTemplate>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 指纹模板 ID |

### `fingerprint:create`

创建浏览器指纹模板。

```typescript
const result = await window.matrixflow.fingerprint.create(data);
// 返回: IpcResult<FingerprintTemplate>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `any` | 是 | 指纹模板数据 |

### `fingerprint:update`

更新指纹模板。

```typescript
const result = await window.matrixflow.fingerprint.update(id, data);
// 返回: IpcResult<FingerprintTemplate>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 指纹模板 ID |
| `data` | `any` | 是 | 更新字段 |

### `fingerprint:delete`

删除指纹模板。

```typescript
const result = await window.matrixflow.fingerprint.delete(id);
// 返回: IpcResult<void>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 指纹模板 ID |

---

## 设置管理

通道前缀：`settings:`

### `settings:get`

读取配置项。

```typescript
const result = await window.matrixflow.settings.get(key);
// 返回: any | null（JSON 解析后的值）
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 配置键名 |

### `settings:set`

写入配置项（UPSERT）。

```typescript
const result = await window.matrixflow.settings.set(key, value);
// 返回: { success: boolean, message?: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 配置键名 |
| `value` | `any` | 是 | 配置值（自动 JSON 序列化） |

---

## 数据管理

通道前缀：`data:`

### `data:createBackup`

创建数据库备份。

```typescript
const result = await window.matrixflow.data.createBackup();
// 返回: IpcResult<BackupInfo>
```

### `data:listBackups`

获取备份列表。

```typescript
const result = await window.matrixflow.data.listBackups();
// 返回: IpcResult<BackupInfo[]>
```

### `data:restoreBackup`

从备份恢复数据库。

```typescript
const result = await window.matrixflow.data.restoreBackup(backupId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `backupId` | `string` | 是 | 备份 ID |

### `data:deleteBackup`

删除备份记录。

```typescript
const result = await window.matrixflow.data.deleteBackup(backupId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `backupId` | `string` | 是 | 备份 ID |

### `data:clear`

清理数据（日志/缓存/全部）。

```typescript
const result = await window.matrixflow.data.clearData(type);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `'logs' \| 'cache' \| 'all'` | 是 | 清理类型 |

---

## 通知管理

通道前缀：`notification:`

### `notification:getPreferences`

获取通知偏好设置。

```typescript
const result = await window.matrixflow.notification.getPreferences();
// 返回: IpcResult<NotificationPreferences>
```

### `notification:updatePreferences`

更新通知偏好设置。

```typescript
const result = await window.matrixflow.notification.updatePreferences(prefs);
// 返回: IpcResult<NotificationPreferences>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prefs` | `Record<string, unknown>` | 是 | 偏好设置对象 |

### `notification:test`

发送测试通知。

```typescript
const result = await window.matrixflow.notification.test();
// 返回: IpcResult<null>
```

---

## 监控管理

通道前缀：`monitor:`

### `monitor:createPlan`

创建监控计划。

```typescript
const result = await window.matrixflow.monitor.createPlan(plan);
// 返回: MonitorPlan | { success: false, message: string }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plan` | `Omit<MonitorPlan, 'id' \| 'createdAt'>` | 是 | 计划数据 |

### `monitor:updatePlan`

更新监控计划。

```typescript
const result = await window.matrixflow.monitor.updatePlan(id, updates);
// 返回: MonitorPlan（由 MonitorService 返回）
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 计划 ID |
| `updates` | `Partial<MonitorPlan>` | 是 | 更新字段 |

### `monitor:deletePlan`

删除监控计划。

```typescript
const result = await window.matrixflow.monitor.deletePlan(id);
// 返回: boolean
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 计划 ID |

### `monitor:listPlans`

获取所有监控计划。

```typescript
const result = await window.matrixflow.monitor.listPlans();
// 返回: MonitorPlan[]
```

### `monitor:getAlerts`

获取监控告警列表。

```typescript
const result = await window.matrixflow.monitor.getAlerts();
// 返回: MonitorAlert[]
```

---

## 周报管理

通道前缀：`report:`

### `report:generate`

生成运营周报。

```typescript
const result = await window.matrixflow.report.generate();
// 返回: WeeklyReport | { success: false, message: string }
```

### `report:getLatest`

获取最新生成的周报。

```typescript
const result = await window.matrixflow.report.getLatest();
// 返回: WeeklyReport | null
```

---

## 多面板管理

通道前缀：`panel:`

### `panel:open`

为指定账号打开独立浏览器面板。

```typescript
const result = await window.matrixflow.panel.open(accountId);
// 返回: IpcResult<PanelInfo>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `accountId` | `string` | 是 | 账号 ID |

### `panel:close`

关闭指定面板。

```typescript
const result = await window.matrixflow.panel.close(panelId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `panelId` | `string` | 是 | 面板 ID |

### `panel:focus`

聚焦到指定面板窗口。

```typescript
const result = await window.matrixflow.panel.focus(panelId);
// 返回: IpcResult<null>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `panelId` | `string` | 是 | 面板 ID |

### `panel:list`

获取当前活跃面板列表。

```typescript
const result = await window.matrixflow.panel.list();
// 返回: IpcResult<PanelInfo[]>
```

---

## 自动更新

通道前缀：`update:`

### `update:check`

检查是否有可用更新。

```typescript
const result = await window.matrixflow.update.check();
// 返回: IpcResult<UpdateStatus>
```

### `update:download`

下载最新更新。

```typescript
const result = await window.matrixflow.update.download();
// 返回: IpcResult<null>
```

### `update:install`

安装已下载的更新（会重启应用）。

```typescript
const result = await window.matrixflow.update.install();
// 返回: IpcResult<null>
```

### `update:getStatus`

获取当前更新状态。

```typescript
const result = await window.matrixflow.update.getStatus();
// 返回: IpcResult<UpdateStatus>
```

---

## 事件监听

渲染进程通过 `ipcRenderer.on` 接收主进程推送的事件。所有监听通道必须在 `preload.ts` 的 `ALLOWED_CHANNELS` 白名单中。

### `publish:status`

发布状态批量推送（节流 500ms，批量发送）。

```typescript
const unsubscribe = window.matrixflow.onPublishStatus((batch: PublishEvent[]) => {
  for (const event of batch) {
    console.log(`任务 ${event.taskId}: ${event.status}`);
  }
});
```

> 主进程通过 `EventBus` 订阅发布事件，节流后批量推送到渲染进程。

### `task:progress`

任务进度更新推送。

```typescript
const unsubscribe = window.matrixflow.onTaskProgress(
  (taskId: string, progress: number, message?: string) => {
    console.log(`任务 ${taskId}: ${progress}% — ${message}`);
  }
);
```

### `task:status-change`

任务状态变更推送。

```typescript
const unsubscribe = window.matrixflow.onTaskStatusChange(
  (taskId: string, status: string, data?: unknown) => {
    console.log(`任务 ${taskId} 状态变更为 ${status}`);
  }
);
```

### `account:login-status-updated`

账号登录状态更新推送（白名单中但无专用便捷方法，通过 `window.matrixflow.on` 监听）。

```typescript
const unsubscribe = window.matrixflow.on(
  'account:login-status-updated',
  (...args: unknown[]) => {
    console.log('账号登录状态更新', args);
  }
);
```

### `update:status`

更新状态变更推送（白名单中，通过 `window.matrixflow.on` 监听）。

```typescript
const unsubscribe = window.matrixflow.on('update:status', (...args: unknown[]) => {
  console.log('更新状态', args);
});
```

### `update:progress`

更新下载进度推送（白名单中，通过 `window.matrixflow.on` 监听）。

```typescript
const unsubscribe = window.matrixflow.on('update:progress', (...args: unknown[]) => {
  console.log('下载进度', args);
});
```

### 通用事件监听方法

```typescript
// 通用监听（需在白名单中）
const unsubscribe = window.matrixflow.on(channel, callback);

// 取消监听
unsubscribe();
```

**白名单中的通道**：
- `publish:status`
- `task:progress`
- `task:status-change`
- `account:login-status-updated`
- `update:status`
- `update:progress`

---

## MCP Server API

MCP Server 是独立 npm 包，提供 18 个 Tool 供 AI Agent 集成。传输协议：stdio。

### 启动

```bash
cd mcp-server
npm install
npm run build
npm start
```

### 配置（Claude Desktop / Cursor）

```json
{
  "mcpServers": {
    "matrixflow": {
      "command": "node",
      "args": ["/path/to/MatrixFlow/mcp-server/dist/index.js"],
      "env": {
        "MATRIXFLOW_DB": "/path/to/MatrixFlow/data/matrixflow.db"
      }
    }
  }
}
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `MATRIXFLOW_DB` | SQLite 数据库路径（可选，默认自动查找） |

### Tool 列表

#### 账号管理（4 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `account_list` | 获取账号列表 | — |
| `account_status` | 检查账号状态 | `accountId` |
| `account_add` | 添加账号 | `platform` |
| `account_remove` | 移除账号 | `accountId` |

#### 内容管理（5 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `content_list` | 获取内容列表 | — |
| `content_upload` | 上传文件 | `filePath` |
| `content_delete` | 删除内容 | `contentId` |
| `content_search` | 搜索内容 | `query` |
| `content_tags` | 设置标签 | `contentId`, `tags` |

#### 发布管理（6 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `publish_create` | 创建发布任务 | `contentId`, `platform`, `accountId`, `publishMode` |
| `publish_list` | 获取任务列表 | — |
| `publish_cancel` | 取消任务 | `taskId` |
| `publish_status` | 获取任务状态 | `taskId` |
| `publish_schedule` | 定时发布 | `taskId`, `scheduledAt` |
| `publish_batch` | 批量发布 | `contentId`, `accountIds` |

#### 数据统计（3 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `stats_overview` | 数据概览 | — |
| `stats_platform` | 平台数据 | `platform` |
| `stats_trend` | 趋势数据 | — |

### 支持的平台

| 标识 | 名称 |
|------|------|
| `douyin` | 抖音 |
| `xiaohongshu` | 小红书 |
| `channels` | 微信视频号 |
| `kuaishou` | 快手 |
