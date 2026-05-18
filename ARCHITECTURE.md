# MatrixFlow 架构设计文档

## 系统架构

MatrixFlow 采用 Electron 主进程-渲染进程架构，通过 IPC 通信连接前后端。

### 分层架构

```
+------------------------------------------+
|           渲染进程 (Vue 3)                 |
|  Views / Components / Stores (Pinia)     |
+------------------------------------------+
                  | IPC (contextBridge)
+------------------------------------------+
|           预加载层 (preload.ts)            |
|  API 暴露 / 通道白名单 / 数据序列化        |
+------------------------------------------+
                  |
+------------------------------------------+
|           主进程 (Electron)                |
|  Services / Adapters / AI / Database      |
+------------------------------------------+
                  |
+------------------------------------------+
|           外部依赖                         |
|  Patchright / SQLite / LLM APIs           |
+------------------------------------------+
```

## 核心模块

### 1. 浏览器池 (BrowserPool)

管理多个 BrowserContext 实例，支持：

- 按需创建和销毁浏览器上下文
- Cookie 隔离（每个账号独立上下文）
- 资源限制（最大并发数、内存监控）
- 空闲回收（超时自动关闭）

```
BrowserPool
  +-- contexts: Map<accountId, BrowserContext>
  +-- maxConcurrent: number
  +-- createContext(accountId)
  +-- getContext(accountId)
  +-- releaseContext(accountId)
```

### 2. 任务调度 (TaskScheduler)

管理发布任务的调度和执行：

- 优先级队列（定时任务 > 即时任务）
- 限流控制（按平台配置）
- 任务状态机（pending -> running -> success/failed）
- 重试机制（指数退避）
- 事件通知（EventBus）

```
TaskScheduler
  +-- queue: PriorityQueue
  +-- rateLimiter: RateLimiter
  +-- eventBus: EventBus
  +-- schedule(task)
  +-- cancel(taskId)
  +-- retry(taskId)
```

### 3. 平台适配器

每个平台一个适配器目录，包含：

- `publish.ts` - 发布流程
- `login.ts` - 登录流程
- `cookie.ts` - Cookie 管理
- `comment.ts` - 评论功能
- `selectors.ts` - CSS 选择器

平台差异处理：

- 抖音：支持 serverScheduledPublish，maxScheduleDays=30
- 小红书：不支持定时发布，maxScheduleDays=0
- 视频号：支持 serverScheduledPublish，maxScheduleDays=7
- 快手：支持 serverScheduledPublish，maxScheduleDays=7

### 4. 数据层

SQLite + WAL 模式，22 张表：

- accounts - 账号信息
- contents - 内容库
- publish_tasks - 发布任务
- video_stats - 视频统计
- drafts - 草稿
- comment_templates - 评论模板
- comment_tasks - 评论任务
- license - License 信息
- panel_sessions - 多开面板会话

数据库迁移：`electron/data/migrations/001-005.sql`

### 5. AI 服务

```
AIService
  +-- LLMService (多提供商)
  |     +-- OpenAI
  |     +-- DeepSeek
  |     +-- Qwen
  |     +-- Anthropic
  +-- AICache (LRU + TTL)
  +-- AnomalyService (异常检测)
```

AI 建议三档：

- 强建议（紫色）：30+ 天历史数据
- 弱建议（灰色）：7-30 天数据
- 异常提醒（红色）：数据异常

### 6. MCP Server

独立 npm 包，提供 18 个 Tool：

- 通过 IPC Bridge 或直连 SQLite 与主应用通信
- 支持 stdio 传输
- JSON Schema 参数验证

### 7. 安全层

```
SecurityLayer
  +-- CryptoService
  |     +-- AES-256-GCM (Cookie 加密)
  |     +-- RSA (License 签名验证)
  +-- LicenseService
  |     +-- 在线激活
  |     +-- 离线激活
  |     +-- 设备绑定
  +-- SignatureVerifier
        +-- Ed25519 (远程选择器签名验证)
```

### 8. 签名验证 (SignatureVerifier)

使用 Node.js 内置 `crypto.verify` 对远程 YAML 选择器进行 Ed25519 签名验证，防止供应链攻击。

- 公钥硬编码在 `electron/config/selector-public-key.ts`
- 支持 strict/loose 模式（向后兼容）
- SelectorUpdateService 在 `yaml.parse()` 前验证原始数据

### 9. Worker Threads (BrowserAutomationWorker)

使用 Node.js Worker Threads 实现浏览器自动化任务的并行执行：

- 主线程与 Worker 通过 MessagePort 通信
- 支持任务取消和进度上报
- 自动资源回收和错误恢复

### 10. 错误监控 (Sentry)

```typescript
SentryInit
  +-- scrubEvent() — 脱敏处理（移除 Cookie/Token/IP）
  +-- DSN 配置（环境变量）
  +-- 集成 Electron crashReporter
```

### 11. 通知服务 (NotificationService)

```typescript
NotificationService
  +-- 系统通知 (Electron Notification API)
  +-- 通知偏好配置
  +-- 测试通知发送
```

## 数据流

### 发布流程

1. 用户在渲染进程创建发布任务
2. IPC 传到主进程 TaskScheduler
3. TaskScheduler 按优先级调度
4. BrowserPool 获取/创建浏览器上下文
5. 平台适配器执行发布操作
6. EventBus 发布状态事件
7. 渲染进程更新 UI

### 定时发布流程

1. 用户设置定时发布时间
2. TaskScheduler 注册定时任务
3. 到时间后检查限流
4. 执行发布（同上）
5. 如果平台支持 serverScheduledPublish，使用平台定时

## IPC 通信

所有 IPC 通信通过 preload.ts 白名单过滤：

- `account:*` - 账号相关
- `content:*` - 内容相关
- `publish:*` - 发布相关
- `stats:*` - 统计相关
- `task:*` - 任务相关
- `ai:*` - AI 相关
- `panel:*` - 多开面板
- `draft:*` - 草稿
- `comment:*` - 评论
- `license:*` - License
- `update:*` - 自动更新
- `draft:*` - 草稿
- `proxy:*` - 代理
- `fingerprint:*` - 指纹
- `monitor:*` - 监控
- `report:*` - 报表
- `data:*` - 数据管理
- `settings:*` - 设置
- `notification:*` - 通知

## 设计决策

### 为什么选择 Patchright 而非 Playwright

Patchright 是 Playwright 的 stealth 分支，内置反检测能力。对于自动化发布场景，反检测是核心需求。

### 为什么使用 SQLite 而非 LevelDB

SQLite 支持复杂查询（JOIN、聚合），适合数据统计场景。WAL 模式提供良好的并发性能。

### 为什么 MCP Server 独立

MCP Server 作为独立 npm 包，避免与主项目的 TypeScript 模块冲突，同时支持独立安装和运行。

### 为什么评论功能使用模板模式

评论内容容易触发平台风控。使用模板 + 变量替换 + 随机选择，可以生成差异化的评论内容，降低风控风险。
