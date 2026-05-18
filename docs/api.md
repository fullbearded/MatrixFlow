# MatrixFlow API 文档

**版本**: 0.2.0 | **更新**: 2026-05-18

所有 IPC 调用通过 `window.matrixflow` 访问，受 preload.ts 白名单保护。返回统一格式 `IpcResult<T> = { success: boolean, data?: T, message?: string }`。

## 通道统计

| 域 | 通道数 | 说明 |
|---|--------|------|
| Account (`account:*`) | 6 | 账号管理（主 API） |
| Accounts (`accounts:*`) | 6 | 账号管理（兼容旧频道） |
| Content (`content:*`) | 5 | 内容管理 |
| Group (`groups:*`) | 5 | 分组管理 |
| Publish (`publish:*`) | 9 | 发布任务管理（含兼容频道） |
| Task (`task:*`) | 2 | 任务查询 |
| Platform (`platform:*`) | 2 | 平台适配器 |
| Platforms (`platforms:*`) | 3 | 平台配置查询 |
| Stats (`stats:*`) | 3 | 数据统计 |
| AI (`ai:*`) | 5 | AI 功能 |
| Comment (`comment:*`) | 7 | 评论管理 |
| Draft (`draft:*`) | 5 | 草稿管理 |
| License (`license:*`) | 5 | 授权管理 |
| Proxy (`proxy:*`) | 6 | 代理管理 |
| Fingerprint (`fingerprint:*`) | 5 | 浏览器指纹 |
| Data (`data:*`) | 5 | 数据备份/清理 |
| Settings (`settings:*`) | 2 | 设置读写 |
| Notification (`notification:*`) | 3 | 通知偏好 |
| Monitor (`monitor:*`) | 5 | 监控计划 |
| Report (`report:*`) | 2 | 周报生成 |
| Panel (`panel:*`) | 4 | 多面板/多开 |
| Update (`update:*`) | 4 | 自动更新 |
| **ipcMain.handle 合计** | **99** | — |
| Event Listeners (`ipcRenderer.on`) | 6 | 推送事件监听 |

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

---
