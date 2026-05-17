# electron/core/ — 基础设施层知识库

## OVERVIEW

主进程基础设施。所有跨服务共享的能力在此，是 `electron/browser/` 和 `electron/scheduler/` 的权威替代。

## WHERE TO LOOK

| 模块 | 文件 | 职责 |
|------|------|------|
| 浏览器池 | `BrowserPool.ts` | 管理 BrowserContext，按账号隔离 Cookie |
| 浏览器上下文 | `BrowserContext.ts` | 单个上下文封装 |
| 任务调度 | `TaskScheduler.ts` | 优先级队列，pending→running→success/failed |
| 队列管理 | `QueueManager.ts` | 底层队列实现 |
| 限流 | `RateLimiter.ts` | 按平台限流，配合 config/rate-limits.ts |
| 事件总线 | `EventBus.ts` | 跨模块事件通知 |
| 加密 | `CryptoService.ts` | AES-256-GCM（Cookie）+ RSA（License） |
| 安全层 | `SecurityLayer.ts` | 安全策略封装 |
| 配置管理 | `ConfigManager.ts` | 持久化配置读写 |
| 平台配置加载 | `PlatformConfigLoader.ts` | 加载平台特定配置 |
| 日志 | `Logger.ts` | 封装 electron-log |
| 自动更新 | `AutoUpdater.ts` | electron-updater 封装 |
| 选择器更新 | `SelectorUpdateService.ts` | 远程热更新平台选择器 |
| 应用生命周期 | `AppLifecycle.ts` | app ready/quit 事件处理 |

## ANTI-PATTERNS

- `electron/browser/BrowserPool.ts` 和 `electron/scheduler/TaskScheduler.ts` 是废弃重复，**不要修改或引用**
- 不要在 core/ 中引入 services/ 的依赖（单向依赖：services → core）
