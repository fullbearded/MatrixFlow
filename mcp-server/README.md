# MatrixFlow MCP Server

MatrixFlow 多平台内容分发系统的 MCP (Model Context Protocol) Server，提供 18 个工具供 AI 助手管理账号、内容、发布和数据统计。

## 安装

```bash
cd mcp-server
npm install
npm run build
```

## 配置

### 方式一：Claude Desktop / Cursor

在 MCP 客户端配置文件中添加：

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

### 方式二：npx 运行

```bash
npx matrixflow-mcp-server
```

### 环境变量

- `MATRIXFLOW_DB` — SQLite 数据库路径（可选，默认自动查找 `./data/matrixflow.db` 或 `~/.matrixflow/data/matrixflow.db`）

## 工具列表

### 账号管理（4 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `account_list` | 获取账号列表 | — |
| `account_status` | 检查账号状态 | `accountId` |
| `account_add` | 添加账号 | `platform` |
| `account_remove` | 移除账号 | `accountId` |

### 内容管理（5 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `content_list` | 获取内容列表 | — |
| `content_upload` | 上传文件 | `filePath` |
| `content_delete` | 删除内容 | `contentId` |
| `content_search` | 搜索内容 | `query` |
| `content_tags` | 设置标签 | `contentId`, `tags` |

### 发布管理（6 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `publish_create` | 创建发布任务 | `contentId`, `platform`, `accountId`, `publishMode` |
| `publish_list` | 获取任务列表 | — |
| `publish_cancel` | 取消任务 | `taskId` |
| `publish_status` | 获取任务状态 | `taskId` |
| `publish_schedule` | 定时发布 | `taskId`, `scheduledAt` |
| `publish_batch` | 批量发布 | `contentId`, `accountIds` |

### 数据统计（3 个）

| 工具 | 说明 | 必填参数 |
|------|------|----------|
| `stats_overview` | 数据概览 | — |
| `stats_platform` | 平台数据 | `platform` |
| `stats_trend` | 趋势数据 | — |

## 支持的平台

- `douyin` — 抖音
- `xiaohongshu` — 小红书
- `channels` — 微信视频号
- `kuaishou` — 快手

## 架构

```
mcp-server/
├── index.ts          # MCP Server 入口，18 个 Tool 定义和路由
├── src/
│   └── bridge.ts     # IPC Bridge，独立模式直连 SQLite
├── package.json
└── tsconfig.json
```

Bridge 层支持两种模式：
1. **独立模式**（默认）：直接通过 better-sqlite3 操作数据库
2. **Electron IPC 模式**（预留）：在 Electron 环境中转发到主进程服务

## 开发

```bash
npm run dev       # 监听模式编译
npm run build     # 单次编译
npm start         # 启动服务器
```
