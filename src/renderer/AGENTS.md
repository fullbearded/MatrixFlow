# src/renderer/ — Vue 3 前端知识库

## OVERVIEW

渲染进程 Vue 3 应用。所有 UI 在此，通过 `window.electronAPI`（preload 暴露）调用主进程。

## STRUCTURE

```
renderer/
├── main.ts            # Vue app 入口，挂载 Pinia + Router
├── App.vue            # 根组件
├── router/index.ts    # 路由定义（11 个视图）
├── views/             # 页面级组件（与路由 1:1）
├── components/        # 可复用组件
│   ├── account/       # 账号相关组件
│   ├── charts/        # ECharts 图表组件
│   ├── common/        # 通用组件（Empty, Loading）
│   ├── content/       # 内容管理组件
│   ├── group/         # 分组组件
│   ├── publish/       # 发布相关组件
│   ├── settings/      # 设置面板组件
│   └── task/          # 任务组件
├── stores/            # Pinia stores（8 个）
├── layouts/           # 布局组件
└── styles/            # CSS 变量 + 全局样式
```

## WHERE TO LOOK

| 任务 | 位置 |
|------|------|
| 添加新页面 | `views/` + `router/index.ts` |
| 全局状态 | `stores/{domain}.ts` |
| 调用主进程 | `window.electronAPI.{channel}(args)` |
| 图表组件 | `components/charts/` |
| 设置面板 | `components/settings/` + `views/Settings.vue` |

## CONVENTIONS

- 路径别名 `@/` → `src/`（不是 `src/renderer/`）
- 组件用 `<script setup lang="ts">` + Composition API
- 状态管理只用 `src/renderer/stores/`，忽略 `src/stores/`（遗留）
- IPC 调用统一通过 `window.electronAPI`，不直接用 `ipcRenderer`

## ANTI-PATTERNS

- 不要在渲染进程 import Node.js 模块（fs, path 等）
- 不要在 `src/stores/` 添加新 store（遗留目录）
- 不要在组件中直接调用 `ipcRenderer`，必须通过 preload 暴露的 API
