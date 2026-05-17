# electron/ — 主进程知识库

## OVERVIEW

Electron 主进程代码。所有 Node.js/系统级操作在此，渲染进程通过 IPC 调用。

## STRUCTURE

```
electron/
├── main.ts            # 入口：初始化 app、BrowserWindow、IPC handlers
├── preload.ts         # contextBridge 白名单（新 IPC 通道必须在此注册）
├── ipc/handlers.ts    # 所有 IPC 处理器集中注册
├── core/              # 基础设施层（权威目录）
├── services/          # 业务逻辑层
├── platform/          # 平台适配器
├── ai/                # AI 服务
├── data/              # 数据库层
├── config/            # 配置文件
├── browser/           # ⚠️ 废弃重复目录，勿用
└── scheduler/         # ⚠️ 废弃重复目录，勿用
```

## WHERE TO LOOK

| 任务 | 文件 |
|------|------|
| 新增 IPC 通道 | `ipc/handlers.ts` + `preload.ts`（两处都要改） |
| 浏览器上下文管理 | `core/BrowserPool.ts` |
| 任务调度/队列 | `core/TaskScheduler.ts`, `core/QueueManager.ts` |
| 限流 | `core/RateLimiter.ts` + `config/rate-limits.ts` |
| 加密/安全 | `core/CryptoService.ts`, `core/SecurityLayer.ts` |
| 事件总线 | `core/EventBus.ts` |
| 配置持久化 | `core/ConfigManager.ts` |
| 自动更新 | `core/AutoUpdater.ts` |
| 选择器热更新 | `core/SelectorUpdateService.ts` |

## ANTI-PATTERNS

- `electron/browser/BrowserPool.ts` 和 `electron/scheduler/TaskScheduler.ts` 是重复文件，**只用 `electron/core/` 下的版本**
- 不要在 `main.ts` 或 `preload.ts` 写业务逻辑，放到 `services/` 或 `core/`
- IPC handler 必须做参数校验，不信任渲染进程输入
