# electron/platform/ — 平台适配器知识库

## OVERVIEW

四个平台的浏览器自动化适配器。每个平台一个子目录，结构相同。

## STRUCTURE

```
platform/
├── base/              # 基类和共享工具
├── douyin/            # 抖音（maxScheduleDays=30）
├── xiaohongshu/       # 小红书（不支持定时发布）
├── channels/          # 视频号（maxScheduleDays=7）
└── kuaishou/          # 快手（maxScheduleDays=7）
```

每个平台目录包含：
- `publish.ts` — 发布流程
- `login.ts` — 登录/扫码
- `cookie.ts` — Cookie 读写
- `comment.ts` — 评论功能
- `selectors.ts` — CSS 选择器（平台 DOM 变更时只改这里）

## WHERE TO LOOK

| 任务 | 位置 |
|------|------|
| 添加新平台 | 复制 `base/` 模板，实现上述 5 个文件 |
| 修复选择器失效 | `{platform}/selectors.ts` |
| 定时发布逻辑 | `{platform}/publish.ts` → 检查 serverScheduledPublish |
| 登录态失效处理 | `{platform}/cookie.ts` + `{platform}/login.ts` |

## CONVENTIONS

- 选择器变更只改 `selectors.ts`，不散落在 publish/login 逻辑中
- 所有平台操作必须用 Patchright（`import { chromium } from 'patchright'`），禁止 Playwright
- 小红书发布前检查 `maxScheduleDays === 0`，不传定时参数

## ANTI-PATTERNS

- 不要硬编码 CSS 选择器在 publish.ts/login.ts 中
- 不要在平台适配器中直接操作数据库，通过 services/ 层
