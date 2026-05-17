# tests/ — 测试知识库

## OVERVIEW

Vitest 测试套件。单元测试 + 集成测试用 happy-dom，E2E 用 Patchright 驱动真实 Chrome。

## STRUCTURE

```
tests/
├── unit/              # 单元测试（electron/core/, electron/ai/ 等）
│   ├── ai/            # AICache 测试
│   └── core/          # EventBus, RateLimiter 测试
├── e2e/               # E2E 测试（需要 Chrome）
│   ├── douyin.test.ts # 抖音发布流程
│   ├── helpers.ts     # E2E 工具函数
│   └── setup.ts       # E2E 环境初始化
├── mocks/             # Mock 实现
│   ├── BrowserPool.ts
│   ├── Database.ts
│   ├── LLMService.ts
│   └── TaskScheduler.ts
├── utils/             # 测试工具
│   ├── factories.ts   # 测试数据工厂
│   ├── helpers.ts     # 通用测试辅助
│   └── index.ts
└── setup.ts           # 全局测试初始化
```

## CONVENTIONS

- 覆盖率阈值：statements/functions/lines ≥ 70%，branches ≥ 60%
- Mock 放 `tests/mocks/`，不要在测试文件内联 mock
- 测试数据用 `tests/utils/factories.ts` 工厂函数生成
- E2E 测试单独运行（`npm run test:e2e`），不包含在 `npm test` 中

## COMMANDS

```bash
npm test                    # 单元 + 集成（排除 e2e）
npm run test:coverage       # 带覆盖率
npm run test:e2e            # E2E（需要 Chrome + Patchright）
npm run test:login          # 手动测试登录流程
npm run test:publish        # 手动测试发布流程
```

## ANTI-PATTERNS

- E2E 测试不要放在 `tests/unit/` 下
- 不要在单元测试中真实调用 Patchright/浏览器，用 `tests/mocks/BrowserPool.ts`
