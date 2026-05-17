# mcp-server/ — MCP Server 知识库

## OVERVIEW

独立 npm 包，提供 18 个 MCP Tool 供 AI Agent 集成。有独立的 `package.json` 和 `node_modules`，不依赖主项目。

## WHERE TO LOOK

| 任务 | 文件 |
|------|------|
| 添加/修改 Tool | `index.ts`（18 个 Tool 定义） |
| IPC Bridge 通信 | `src/bridge.ts` |
| 包配置 | `package.json`（独立，与根目录无关） |

## Tool 列表（18 个）

**账号管理：** account_list, account_status, account_add, account_remove  
**内容管理：** content_list, content_upload, content_delete, content_search, content_tags  
**发布管理：** publish_create, publish_list, publish_cancel, publish_status, publish_schedule, publish_batch  
**数据统计：** stats_overview, stats_platform, stats_trend

## CONVENTIONS

- Tool 参数用 JSON Schema 验证（zod）
- 传输协议：stdio
- 与主应用通信：通过 `src/bridge.ts` IPC Bridge 或直连 SQLite

## ANTI-PATTERNS

- **不要引入主项目（`../electron/` 或 `../src/`）的依赖**，会导致 TypeScript 模块冲突
- 不要在 mcp-server/ 运行 `npm install` 时安装主项目的包
- 独立运行：`cd mcp-server && npm install && npm start`
