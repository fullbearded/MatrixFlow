# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-17
**Branch:** main (no commits yet)

## OVERVIEW

MatrixFlow 是 Electron 35 + Vue 3 + TypeScript 桌面应用，自动化发布内容到抖音/小红书/视频号/快手四平台。主进程用 Patchright（Playwright stealth 分支）驱动浏览器，渲染进程用 Pinia + Element Plus，数据层用 SQLite + better-sqlite3，附带独立 MCP Server 包。

## STRUCTURE

```
MatrixFlow/
├── electron/          # 主进程：服务、平台适配器、AI、数据库
│   ├── main.ts        # Electron 入口
│   ├── preload.ts     # contextBridge IPC 白名单
│   ├── ipc/           # IPC handlers
│   ├── core/          # 基础设施（BrowserPool, TaskScheduler, EventBus, RateLimiter...）
│   ├── services/      # 业务服务（AccountService, PublishService, StatsService...）
│   ├── platform/      # 平台适配器（douyin/xiaohongshu/channels/kuaishou）
│   ├── ai/            # AI 服务（AIService, LLMService, AICache）
│   ├── data/          # SQLite 数据库 + migrations
│   ├── scheduler/     # TaskScheduler（与 core/ 有重复，以 electron/core/ 为准）
│   └── browser/       # BrowserPool（与 core/ 有重复，以 electron/core/ 为准）
├── src/
│   ├── renderer/      # Vue 3 前端（views, components, stores, router）
│   ├── douyin/        # 遗留 PoC 代码（非生产用）
│   └── stores/        # 遗留 stores（非生产用，生产用 src/renderer/stores/）
├── mcp-server/        # 独立 MCP Server npm 包，18 个 Tool
├── tests/
│   ├── unit/          # 单元测试（vitest）
│   ├── e2e/           # E2E 测试（Patchright）
│   ├── mocks/         # Mock 实现
│   └── utils/         # 测试工具函数
├── scripts/           # 构建/发布/测试脚本
├── resources/         # electron-builder 打包资源
└── docs/              # API 文档、安全审计
```

## WHERE TO LOOK

| 任务 | 位置 | 备注 |
|------|------|------|
| 添加新平台 | `electron/platform/{platform}/` | 需实现 publish.ts, login.ts, cookie.ts, selectors.ts |
| IPC 通道 | `electron/ipc/handlers.ts` + `electron/preload.ts` | preload 有白名单，新通道两处都要加 |
| 浏览器池/调度 | `electron/core/BrowserPool.ts`, `electron/core/TaskScheduler.ts` | 忽略 electron/browser/ 和 electron/scheduler/（重复） |
| 数据库 schema | `electron/data/Database.ts` + `electron/data/migrations/` | 22 张表，WAL 模式 |
| 前端页面 | `src/renderer/views/` | 11 个视图 |
| 前端状态 | `src/renderer/stores/` | 8 个 Pinia store |
| AI 配置 | `electron/config/ai.config.ts` | 多 LLM 提供商 |
| 限流配置 | `electron/config/rate-limits.ts` | 按平台配置 |
| MCP Tools | `mcp-server/index.ts` | 18 个 Tool |
| 安全/加密 | `electron/core/CryptoService.ts`, `electron/core/SecurityLayer.ts` | AES-256-GCM + RSA |

## ARCHITECTURE

**IPC 通道命名约定：** `{domain}:{action}` — account:*, content:*, publish:*, stats:*, task:*, ai:*, panel:*, draft:*, comment:*, license:*, update:*

**平台差异（定时发布）：**
- 抖音：serverScheduledPublish=true, maxScheduleDays=30
- 小红书：不支持定时，maxScheduleDays=0
- 视频号：serverScheduledPublish=true, maxScheduleDays=7
- 快手：serverScheduledPublish=true, maxScheduleDays=7

**任务状态机：** pending → running → success/failed（重试用指数退避）

## CONVENTIONS

- TypeScript strict mode 开启（`tsconfig.json`）
- 路径别名：`@/*` → `src/*`，`@electron/*` → `electron/*`
- 测试覆盖率阈值：statements/functions/lines ≥ 70%，branches ≥ 60%
- 测试环境：happy-dom（单元），Patchright（E2E）
- 测试命令：`npm test`（unit+integration），`npm run test:e2e`（E2E 单独跑）

## ANTI-PATTERNS (THIS PROJECT)

- **不要用 Playwright**，必须用 Patchright（stealth 反检测）
- **不要直接操作 `electron/browser/` 或 `electron/scheduler/`**，这是重复目录，以 `electron/core/` 为准
- **不要在 `src/douyin/` 或 `src/stores/` 添加生产代码**，这是遗留 PoC 目录
- **不要绕过 preload.ts 白名单**，所有 IPC 通道必须在 preload.ts 注册
- **不要在渲染进程直接访问 Node.js API**，必须通过 IPC
- **不要在 mcp-server/ 引入主项目依赖**，MCP Server 是独立包，避免 TypeScript 模块冲突

## COMMANDS

```bash
npm run dev              # 开发模式（Vite + Electron 并发）
npm run build:electron   # 仅编译主进程 TypeScript
npm run build            # 完整构建（主进程 + 前端）
npm test                 # 单元 + 集成测试
npm run test:coverage    # 带覆盖率报告
npm run test:e2e         # E2E 测试（需要 Chrome）
npm run typecheck        # vue-tsc + tsc 类型检查
npm run lint             # ESLint
npm run pack:mac         # 打包 macOS
npm run pack:win         # 打包 Windows
npm run release          # 交互式发布（scripts/release.sh）
```

## NOTES

- Patchright 需要单独安装浏览器：`npx patchright install chrome`
- SQLite 数据库文件在 `data/` 目录，迁移文件 `electron/data/migrations/001-005.sql`
- License 使用 RSA 签名验证，生产环境需替换公钥
- Cookie 用 AES-256-GCM 加密存储
- MCP Server 有独立的 `mcp-server/package.json` 和 `node_modules`
- `src/anti-detect.ts` 和 `src/memory-monitor.ts` 是独立工具脚本，非渲染进程入口
