<div align="center">

# MatrixFlow

**AI Native 多平台矩阵式内容分发系统**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

一键管理抖音 · 小红书 · 视频号 · 快手四大平台的内容发布、数据分析与智能运营。

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [架构设计](#-架构设计) · [技术栈](#-技术栈) · [贡献指南](#-贡献指南)

</div>

---

## ✨ 为什么选择 MatrixFlow

内容创作者和运营团队每天在不同平台之间反复操作——登录、上传、填写标题、设置标签、选择发布时间。MatrixFlow 把这些流程**自动化、智能化、一体化**。

| 传统方式 | MatrixFlow |
|---------|-----------|
| 逐个平台手动发布 | 四平台一键矩阵分发 |
| 靠经验猜最佳发布时间 | AI 分析历史数据推荐最优时间 |
| 手动检查各平台数据 | 统一数据中心 + 趋势分析 |
| Cookie 过期反复登录 | Cookie 加密持久化 + 状态监控 |
| 群控工具容易被风控 | Patchright stealth + 指纹管理 |

## 🚀 功能特性

### 📡 多平台矩阵分发

支持**抖音、小红书、视频号、快手**四大主流平台，统一管理，一键分发。

- **智能调度** — 根据平台限流策略自动排队，避免触发风控
- **定时发布** — 可视化日历视图，冲突检测，支持平台原生定时
- **分组管理** — 按账号分组配置发布规则（激进/稳健/保守三档模板）
- **批量操作** — 批量创建、复制、定时，支持草稿管理

### 🤖 AI Native

AI 不是插件，是核心引擎。贯穿发布全流程的智能辅助。

- **发布前检查** — AI 审核标题、描述、标签，给出优化建议和质量评分
- **最佳时间推荐** — 基于历史数据分析各平台最佳发布时间窗口
- **规则优化** — AI 根据账号表现自动调整发布策略
- **异常检测** — 实时监控数据异常，主动告警
- **运营周报** — AI 自动生成周度运营分析报告

### 📊 数据中心

多维度数据聚合，一目了然。

- **数据概览** — 全平台发布量、成功率、互动数据聚合展示
- **平台对比** — 横向对比各平台表现差异
- **趋势分析** — 发布量、播放量、互动指标时间趋势
- **监控告警** — 自定义监控计划，数据异常实时推送

### 🔐 安全与隐私

数据安全是底线，不是可选项。

- **Cookie 加密** — AES-256-GCM 加密存储，密钥从主密码派生
- **账号隔离** — 每个账号独立浏览器上下文，Cookie 互不泄露
- **指纹管理** — 浏览器指纹模板库，反检测配置
- **代理池** — HTTP/SOCKS5 代理管理，按账号绑定
- **签名验证** — 远程选择器 Ed25519 签名验证，防供应链攻击
- **沙箱模式** — 渲染进程 sandbox 启用，IPC 白名单保护

### 🛠 MCP Server

内置 [Model Context Protocol](https://modelcontextprotocol.io/) Server，支持 AI Agent 集成。

提供 18 个标准化 Tool，可被 Claude、GPT 等主流 AI Agent 直接调用：

```json
{
  "tools": ["account_list", "publish_create", "stats_overview", ...],
  "transport": "stdio"
}
```

### 📦 更多功能

- **引导向导** — 首次使用 Onboarding 流程
- **数据管理** — 备份/恢复/清理，支持数据导出导入
- **多开面板** — 多账号并行操作
- **自动更新** — 应用内一键更新
- **错误监控** — Sentry 集成，实时错误追踪

## 🏃 快速开始

### 环境要求

- **Node.js** 18+
- **npm** 9+
- **Google Chrome**（Patchright 需要）

### 安装

```bash
git clone https://github.com/fullbearded/MatrixFlow.git
cd MatrixFlow
npm install
npx patchright install chrome
```

### 开发

```bash
npm run dev          # 启动开发模式（Vite HMR + Electron）
npm run build        # 完整构建
npm test             # 单元 + 集成测试
npm run typecheck    # TypeScript 类型检查
```

### 打包

```bash
npm run pack:mac     # macOS
npm run pack:win     # Windows
```

## 🏗 架构设计

```
┌─────────────────────────────────────────┐
│           渲染进程 (Vue 3)                │
│  Views · Components · Pinia Stores      │
│  Element Plus · ECharts · vue-echarts   │
└──────────────────┬──────────────────────┘
                   │ IPC (contextBridge + 白名单)
┌──────────────────┴──────────────────────┐
│           预加载层 (preload.ts)           │
│  API 暴露 · 通道白名单 · 数据序列化       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│              主进程 (Electron)            │
│                                         │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │Services │ │ Platform  │ │    AI    │ │
│  │Account  │ │ Douyin    │ │ LLM Multi│ │
│  │Publish  │ │ XHS       │ │ Anomaly  │ │
│  │Stats    │ │ Channels  │ │ Cache    │ │
│  │Monitor  │ │ Kuaishou  │ │ Rules    │ │
│  │Comment  │ │           │ │          │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │           Core Infrastructure       │ │
│  │ BrowserPool · TaskScheduler         │ │
│  │ EventBus · RateLimiter · Logger     │ │
│  │ SignatureVerifier · SentryInit      │ │
│  │ NotificationService · CryptoService │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌──────────┐ ┌────────────────────────┐ │
│  │ SQLite   │ │ Patchright (Stealth)   │ │
│  │ WAL Mode │ │ Worker Threads         │ │
│  │ 22 Tables│ │ Browser Automation     │ │
│  └──────────┘ └────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 🛠 技术栈

| 层 | 技术 |
|---|------|
| **桌面框架** | Electron 41 |
| **前端** | Vue 3 + TypeScript + Pinia + Element Plus |
| **可视化** | ECharts + vue-echarts |
| **数据库** | SQLite + better-sqlite3 (WAL 模式, 22 张表) |
| **浏览器自动化** | Patchright (Playwright Stealth 分支) |
| **AI / LLM** | OpenAI · DeepSeek · Qwen · Anthropic (多提供商) |
| **错误监控** | Sentry (@sentry/electron) |
| **安全** | AES-256-GCM · RSA-2048 · Ed25519 |
| **Agent 集成** | MCP Server (Model Context Protocol) |
| **测试** | Vitest (单元 + 集成) · Patchright (E2E) |

## 📁 项目结构

```
MatrixFlow/
├── electron/                  # 主进程
│   ├── main.ts               # Electron 入口
│   ├── preload.ts            # IPC 白名单
│   ├── core/                 # 基础设施 (BrowserPool, TaskScheduler, EventBus...)
│   ├── services/             # 业务服务 (Account, Publish, Stats, Monitor...)
│   ├── platform/             # 平台适配器 (douyin/xhs/channels/kuaishou)
│   ├── ai/                   # AI 服务 (LLM Multi-Provider, Anomaly, Cache)
│   ├── data/                 # SQLite 数据库 + 迁移
│   ├── config/               # 配置 (限流, AI, Ed25519 公钥)
│   └── ipc/                  # IPC 处理器 (97 个通道)
├── src/renderer/             # 渲染进程 (Vue 3)
│   ├── views/                # 页面组件 (12 个视图)
│   ├── components/           # UI 组件 (10 个组件域)
│   ├── stores/               # Pinia 状态管理 (11 个 Store)
│   └── router/               # 路由配置
├── mcp-server/               # MCP Server (独立 npm 包, 18 个 Tool)
├── tests/                    # 测试
│   ├── unit/                 # 单元测试 (96 tests)
│   └── integration/          # 集成测试
└── docs/                     # 文档 (API, 安全审计, 架构)
```

## 📈 项目状态

MatrixFlow 正在**积极开发中**。核心功能已完整实现：

- ✅ 四平台适配器（发布/登录/Cookie/评论/选择器）
- ✅ 完整的 IPC 通信层（97 个通道）
- ✅ AI 驱动的发布优化和数据分析
- ✅ MCP Server for AI Agent 集成
- ✅ 安全加固（Ed25519 签名验证、Cookie 加密、沙箱模式）
- ✅ 单元测试 + 集成测试
- ✅ macOS / Windows 打包

## 🤝 贡献指南

我们欢迎所有形式的贡献！

1. **Fork** 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 **Pull Request**

### 开发规范

- TypeScript strict mode
- Vue 3 `<script setup>` + Composition API
- Pinia composition-style stores
- IPC 通道命名: `{domain}:{action}`
- 测试覆盖率: statements/functions/lines ≥ 70%

## 📄 License

[MIT License](LICENSE) © 2024-2026 MatrixFlow

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

</div>
