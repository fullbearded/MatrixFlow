# MatrixFlow API 文档

## IPC API

所有 IPC 调用通过 `window.api` 访问，受 preload.ts 白名单保护。

### 账号管理

#### account:list

获取账号列表。

```typescript
const accounts = await window.api.invoke('account:list');
// Returns: Account[]
```

#### account:status

检查账号登录状态。

```typescript
const status = await window.api.invoke('account:status', { accountId: string });
// Returns: { online: boolean, lastActive: Date }
```

#### account:add

添加账号。

```typescript
const accountId = await window.api.invoke('account:add', {
  platform: 'douyin' | 'xiaohongshu' | 'channels' | 'kuaishou',
  name: string,
});
// Returns: string (accountId)
```

#### account:remove

移除账号。

```typescript
await window.api.invoke('account:remove', { accountId: string });
```

### 内容管理

#### content:list

获取内容列表。

```typescript
const contents = await window.api.invoke('content:list', {
  page?: number,
  pageSize?: number,
  tags?: string[],
  type?: 'video' | 'image',
});
// Returns: { items: Content[], total: number }
```

#### content:upload

上传内容到库。

```typescript
const contentId = await window.api.invoke('content:upload', {
  filePath: string,
  title?: string,
  tags?: string[],
});
// Returns: string (contentId)
```

#### content:delete

删除内容。

```typescript
await window.api.invoke('content:delete', { contentId: string });
```

### 发布管理

#### publish:create

创建发布任务。

```typescript
const taskId = await window.api.invoke('publish:create', {
  accountId: string,
  contentId: string,
  scheduledAt?: Date,
  title?: string,
  description?: string,
  tags?: string[],
});
// Returns: string (taskId)
```

#### publish:list

获取发布任务列表。

```typescript
const tasks = await window.api.invoke('publish:list', {
  status?: 'pending' | 'running' | 'success' | 'failed',
  accountId?: string,
  startDate?: Date,
  endDate?: Date,
});
// Returns: PublishTask[]
```

#### publish:cancel

取消发布任务。

```typescript
await window.api.invoke('publish:cancel', { taskId: string });
```

#### publish:status

获取发布状态。

```typescript
const status = await window.api.invoke('publish:status', { taskId: string });
// Returns: { status: string, progress: number, error?: string }
```

### 数据统计

#### stats:overview

获取数据概览。

```typescript
const stats = await window.api.invoke('stats:overview', {
  dateRange: { start: Date, end: Date },
  platformIds?: string[],
});
// Returns: { totalPublished: number, successRate: number, ... }
```

#### stats:platform

获取平台数据。

```typescript
const platformStats = await window.api.invoke('stats:platform', {
  platformId: string,
  dateRange: { start: Date, end: Date },
});
// Returns: PlatformStats
```

#### stats:trend

获取趋势数据。

```typescript
const trend = await window.api.invoke('stats:trend', {
  metric: 'publish' | 'views' | 'likes' | 'comments',
  dateRange: { start: Date, end: Date },
});
// Returns: TrendDataPoint[]
```

### AI 功能

#### ai:suggest

获取发布建议。

```typescript
const suggestions = await window.api.invoke('ai:suggest', {
  accountId: string,
  contentId: string,
});
// Returns: AISuggestion[]
```

#### ai:check

检查发布内容。

```typescript
const result = await window.api.invoke('ai:check', {
  title: string,
  description: string,
  tags: string[],
});
// Returns: { score: number, issues: string[], suggestions: string[] }
```

### 事件监听

#### on:task:progress

监听任务进度。

```typescript
window.api.on('task:progress', (data: { taskId: string, progress: number }) => {
  console.log(`Task ${data.taskId}: ${data.progress}%`);
});
```

#### on:task:status

监听任务状态变化。

```typescript
window.api.on('task:status', (data: { taskId: string, status: string }) => {
  console.log(`Task ${data.taskId}: ${data.status}`);
});
```

#### on:publish:status

监听发布状态。

```typescript
window.api.on('publish:status', (data: { taskId: string, status: string }) => {
  console.log(`Publish ${data.taskId}: ${data.status}`);
});
```

## MCP Server API

MCP Server 提供 18 个 Tool，支持 stdio 传输。

### 启动 MCP Server

```bash
cd mcp-server
npm run start
```

### Tool 列表

#### 账号管理

- `account_list` - 获取账号列表
- `account_status` - 检查账号状态
- `account_add` - 添加账号
- `account_remove` - 移除账号

#### 内容管理

- `content_list` - 获取内容列表
- `content_upload` - 上传内容
- `content_delete` - 删除内容
- `content_search` - 搜索内容
- `content_tags` - 管理标签

#### 发布管理

- `publish_create` - 创建发布任务
- `publish_list` - 获取任务列表
- `publish_cancel` - 取消任务
- `publish_status` - 获取任务状态
- `publish_schedule` - 定时发布
- `publish_batch` - 批量发布

#### 数据统计

- `stats_overview` - 数据概览
- `stats_platform` - 平台数据
- `stats_trend` - 趋势数据

### Tool 参数示例

#### publish_create

```json
{
  "accountId": "acc_123",
  "contentId": "cnt_456",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "title": "测试视频",
  "description": "视频描述",
  "tags": ["测试", "自动化"]
}
```

#### stats_overview

```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "platformIds": ["douyin", "xiaohongshu"]
}
```

## 核心服务接口

### BrowserPool

```typescript
class BrowserPool {
  createContext(accountId: string): Promise<BrowserContext>;
  getContext(accountId: string): Promise<BrowserContext | null>;
  releaseContext(accountId: string): Promise<void>;
  getActiveCount(): number;
}
```

### TaskScheduler

```typescript
class TaskScheduler {
  schedule(task: PublishTask): void;
  cancel(taskId: string): void;
  retry(taskId: string): void;
  getStatus(taskId: string): TaskStatus;
}
```

### AIService

```typescript
class AIService {
  suggest(context: SuggestContext): Promise<AISuggestion[]>;
  check(content: ContentCheckInput): Promise<ContentCheckResult>;
  detectAnomaly(stats: StatsData): Promise<AnomalyResult>;
}
```

### LicenseService

```typescript
class LicenseService {
  activate(licenseKey: string): Promise<ActivateResult>;
  activateOffline(request: OfflineRequest): Promise<ActivateResult>;
  verify(): Promise<boolean>;
  getInfo(): LicenseInfo;
}
```
