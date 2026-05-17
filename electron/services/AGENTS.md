# electron/services/ — 业务服务层知识库

## OVERVIEW

主进程业务逻辑层。IPC handlers 调用这里，services 调用 core/ 和 data/。

## WHERE TO LOOK

| 服务 | 文件 | 职责 |
|------|------|------|
| 账号管理 | `AccountService.ts` | 账号 CRUD、登录状态、Cookie 管理 |
| 发布管理 | `PublishService.ts` | 创建/取消发布任务，调用平台适配器 |
| 内容管理 | `ContentService.ts` | 内容库 CRUD、标签、搜索 |
| 数据统计 | `StatsService.ts` | 发布数据聚合、趋势分析 |
| 草稿管理 | `DraftService.ts` | 草稿 CRUD |
| 评论管理 | `CommentService.ts` | 评论模板、定时评论任务 |
| 数据服务 | `DataService.ts` | 通用数据访问封装 |
| 异常检测 | `AnomalyService.ts` | 数据异常检测，配合 AI 建议 |
| 周报生成 | `WeeklyReportService.ts` | AI 运营周报 |
| License | `LicenseService.ts` | 在线/离线激活、设备绑定 |
| License 服务端 | `LicenseServerClient.ts` | 与 License 服务器通信 |
| 监控 | `MonitorService.ts` | 账号状态监控 |
| 多开面板 | `MultiPanelService.ts` | 多窗口面板管理 |
| 分组 | `GroupService.ts` | 账号分组管理 |
| 代理 | `ProxyService.ts` | 代理池管理 |

## CONVENTIONS

- 服务通过构造函数注入依赖（Database, BrowserPool 等）
- 不直接操作 SQLite，通过 `data/repositories/` 层
- 错误向上抛出，由 IPC handler 统一处理并返回给渲染进程
