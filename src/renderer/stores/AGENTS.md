# src/renderer/stores/ — Pinia Stores 知识库

## OVERVIEW

8 个 Pinia store，覆盖所有前端状态域。每个 store 对应一个业务域，通过 IPC 与主进程同步。

## WHERE TO LOOK

| Store | 文件 | 状态域 |
|-------|------|--------|
| 账号 | `account.ts` | 账号列表、登录状态、当前账号 |
| 内容 | `content.ts` | 内容库、标签、筛选 |
| 分组 | `group.ts` | 账号分组、发布规则 |
| 多开面板 | `panel.ts` | 面板会话管理 |
| 发布 | `publish.ts` | 发布任务、日历、冲突检测 |
| 设置 | `settings.ts` | 应用配置、AI 配置、代理配置 |
| 统计 | `stats.ts` | 数据统计、趋势、平台对比 |
| 任务 | `task.ts` | 任务队列、状态、进度 |

## CONVENTIONS

- Store 用 `defineStore` + Options API 风格（与现有保持一致）
- IPC 调用放在 actions 中，不在 getters/state 初始化时调用
- 错误状态统一用 `error: string | null` 字段

## ANTI-PATTERNS

- 不要在 `src/stores/` 添加新 store（那是遗留目录，`src/types/ai.ts` 也是遗留）
- 不要在 store 中直接操作 DOM
