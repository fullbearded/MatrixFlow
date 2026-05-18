# MatrixFlow - 多平台内容分发工具

## 项目简介

MatrixFlow 是一款桌面端多平台内容分发工具，支持抖音、小红书、视频号、快手四大平台的自动化内容发布。基于 Electron + Vue 3 构建，提供账号管理、内容库、定时发布、数据分析、自动评论等功能。

## 核心特性

- 多平台支持：抖音、小红书、视频号、快手
- 账号管理：多账号登录、Cookie 持久化、状态监控
- 内容库：视频/图片管理、标签分类、批量操作
- 分组管理：按组发布、发布规则配置、批量绑定账号
- 定时发布：可视化日历、冲突检测、智能调度
- 自动评论：模板管理、定时评论、触发条件
- 数据中心：多维度统计、趋势分析、平台对比
- 监控告警：运营数据监控、异常告警、运营周报
- AI 增强：智能建议、异常检测、规则优化
- 草稿管理：内容草稿、平台配置、批量操作
- 代理池：HTTP/SOCKS5 代理管理、可用性检测
- 指纹管理：浏览器指纹模板、反检测配置
- 数据管理：备份/恢复、数据导入导出、清理
- MCP Server：支持 AI Agent 集成

## 技术栈

- Electron 35+
- Vue 3 + TypeScript
- Pinia + Element Plus
- SQLite + better-sqlite3
- Patchright (Playwright stealth)
- ECharts + vue-echarts
- LLM: OpenAI / DeepSeek / Qwen / Anthropic

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+
- Google Chrome (Patchright 需要)

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/MatrixFlow.git
cd MatrixFlow

# 安装依赖
npm install

# 安装 Patchright 浏览器
npx patchright install chrome
```

### 开发模式

```bash
# 启动开发服务器
npm run dev
```

### 构建

```bash
# 构建前端
npm run build

# 打包 macOS
npm run pack:mac

# 打包 Windows
npm run pack:win

# 完整发布
npm run dist
```

## 项目结构

```
MatrixFlow/
  electron/
    main.ts              -- Electron 主进程
    preload.ts           -- 预加载脚本
    ipc/
      handlers.ts        -- IPC 处理器
    services/            -- 核心服务
      BrowserPool.ts     -- 浏览器池
      TaskScheduler.ts   -- 任务调度
      DataService.ts     -- 数据服务
      LicenseService.ts  -- License 验证
    platform/            -- 平台适配器
      douyin/            -- 抖音
      xiaohongshu/       -- 小红书
      channels/          -- 视频号
      kuaishou/          -- 快手
    ai/                  -- AI 服务
      AIService.ts
      LLMService.ts
    data/                -- 数据库
      Database.ts
      migrations/
  src/
    renderer/            -- Vue 前端
      views/             -- 页面组件
      components/        -- 通用组件
      stores/            -- Pinia stores
  mcp-server/            -- MCP Server
    index.ts             -- 18 个 Tool 定义
    src/bridge.ts        -- IPC Bridge
  tests/
    unit/                -- 单元测试
    mocks/               -- Mock 文件
    utils/               -- 测试工具
  resources/             -- 打包资源
  scripts/               -- 构建脚本
```

## 功能模块

### 账号管理

- 扫码登录
- 多账号切换
- 登录状态监控
- Cookie 加密存储

### 内容库

- 视频/图片上传
- 标签分类
- 批量管理
- 内容搜索

### 发布管理

- 即时发布
- 定时发布
- 批量发布
- 发布日历
- 冲突检测

### 数据统计

- 发布数据概览
- 平台数据对比
- 趋势分析
- 互动统计

### AI 功能

- 发布建议
- 最佳发布时间推荐
- 异常检测
- AI 运营周报

### MCP Server

提供 18 个 MCP Tool，支持 AI Agent 集成：

- 账号管理：account_list, account_status, account_add, account_remove
- 内容管理：content_list, content_upload, content_delete, content_search, content_tags
- 发布管理：publish_create, publish_list, publish_cancel, publish_status, publish_schedule, publish_batch
- 数据统计：stats_overview, stats_platform, stats_trend

## 配置

### AI 配置

编辑 `electron/config/ai.config.ts`：

```typescript
export const aiConfig = {
  providers: {
    openai: { apiKey: 'your-key', model: 'gpt-4' },
    deepseek: { apiKey: 'your-key', model: 'deepseek-chat' },
  },
  cache: { ttl: 24 * 60 * 60 * 1000, maxSize: 1000 },
};
```

### 平台限流

编辑 `electron/config/rate-limits.ts`：

```typescript
export const rateLimits = {
  douyin: { hourly: 10, daily: 50, minInterval: 3 },
  xiaohongshu: { hourly: 5, daily: 20, minInterval: 2 },
  channels: { hourly: 8, daily: 30, minInterval: 2 },
  kuaishou: { hourly: 6, daily: 25, minInterval: 2 },
};
```

## 测试

```bash
# 运行单元测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

## 发布流程

```bash
# 交互式发布
npm run release

# 或手动发布
npm version patch  # minor | major
git push --tags
```

推送 tag 后，GitHub Actions 自动构建并发布到 Releases。

## 安全注意事项

- Cookie 使用 AES-256-GCM 加密存储
- License 使用 RSA 签名验证
- 远程选择器使用 Ed25519 签名验证（防供应链攻击）
- 建议设置环境变量 `MATRIXFLOW_API_KEY`
- 生产环境请更换 License 公钥和 Ed25519 选择器公钥
- 渲染进程启用 sandbox 模式

## License

MIT License

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 技术支持

- Issues: https://github.com/your-org/MatrixFlow/issues
- Docs: https://matrixflow.docs.example.com
