import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { getBridge } from './src/bridge.js';
import type { BridgeResult } from './src/bridge.js';

const PLATFORMS = ['douyin', 'xiaohongshu', 'channels', 'kuaishou'] as const;
const PUBLISH_MODES = ['server', 'client'] as const;
const TASK_STATUSES = ['pending', 'scheduled', 'running', 'completed', 'failed', 'cancelled'] as const;
const METRICS = ['play_count', 'like_count', 'comment_count', 'share_count', 'collect_count'] as const;
const CONTENT_TYPES = ['video', 'image'] as const;

const TOOLS: Tool[] = [
  // ═══════════════════════════════════════════════════════════
  // 账号管理（4 个）
  // ═══════════════════════════════════════════════════════════

  {
    name: 'account_list',
    description: '获取所有已绑定的平台账号列表，包含平台、状态、Cookie 有效性等信息',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: [...PLATFORMS],
          description: '按平台筛选（可选）',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'expired'],
          description: '按状态筛选（可选）',
        },
      },
    },
  },
  {
    name: 'account_status',
    description: '检查指定账号的登录状态和 Cookie 有效性',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: {
          type: 'string',
          description: '账号 ID',
        },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'account_add',
    description: '添加新的平台账号（创建待绑定记录，实际登录需通过 MatrixFlow 主程序完成扫码）',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: [...PLATFORMS],
          description: '平台标识',
        },
        groupId: {
          type: 'string',
          description: '所属分组 ID（可选）',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'account_remove',
    description: '移除已绑定的平台账号',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: {
          type: 'string',
          description: '要移除的账号 ID',
        },
      },
      required: ['accountId'],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 内容管理（5 个）
  // ═══════════════════════════════════════════════════════════

  {
    name: 'content_list',
    description: '获取内容库列表，包含视频和图片的所有已导入内容',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['importing', 'ready', 'published', 'error'],
          description: '按状态筛选（可选）',
        },
        type: {
          type: 'string',
          enum: [...CONTENT_TYPES],
          description: '按内容类型筛选（可选）',
        },
      },
    },
  },
  {
    name: 'content_upload',
    description: '上传视频或图片文件到内容库（指定本地文件路径）',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '本地文件的绝对路径（支持 mp4/mov/avi/mkv/webm/jpg/png/gif/webp）',
        },
        title: {
          type: 'string',
          description: '自定义标题（可选，默认使用文件名）',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'content_delete',
    description: '从内容库中删除指定内容',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'string',
          description: '内容 ID',
        },
      },
      required: ['contentId'],
    },
  },
  {
    name: 'content_search',
    description: '按关键词搜索内容库（匹配标题、描述、标签）',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'content_tags',
    description: '管理内容标签——为指定内容设置或更新标签列表',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'string',
          description: '内容 ID',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签列表',
        },
      },
      required: ['contentId', 'tags'],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 发布管理（6 个）
  // ═══════════════════════════════════════════════════════════

  {
    name: 'publish_create',
    description: '创建新的发布任务，将内容发布到指定平台的指定账号',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'string',
          description: '要发布的内容 ID',
        },
        platform: {
          type: 'string',
          enum: [...PLATFORMS],
          description: '目标平台',
        },
        accountId: {
          type: 'string',
          description: '目标账号 ID',
        },
        publishMode: {
          type: 'string',
          enum: [...PUBLISH_MODES],
          description: '发布模式：server（服务端发布）或 client（客户端发布）',
        },
        scheduledAt: {
          type: 'string',
          description: '定时发布时间（ISO 8601 格式，如 2025-06-01T10:00:00Z），不填则立即发布',
        },
      },
      required: ['contentId', 'platform', 'accountId', 'publishMode'],
    },
  },
  {
    name: 'publish_list',
    description: '获取发布任务列表，支持按内容筛选',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'string',
          description: '按内容 ID 筛选（可选）',
        },
      },
    },
  },
  {
    name: 'publish_cancel',
    description: '取消待执行或已调度的发布任务（运行中或已完成的任务不可取消）',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '发布任务 ID',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'publish_status',
    description: '获取发布任务的详细状态，包含子项进度（上传/发布结果）',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '发布任务 ID',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'publish_schedule',
    description: '设置或更新发布任务的定时发布时间',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '发布任务 ID',
        },
        scheduledAt: {
          type: 'string',
          description: '定时发布时间（ISO 8601 格式）',
        },
      },
      required: ['taskId', 'scheduledAt'],
    },
  },
  {
    name: 'publish_batch',
    description: '批量创建发布任务，将同一内容发布到多个账号',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'string',
          description: '要发布的内容 ID',
        },
        accountIds: {
          type: 'array',
          items: { type: 'string' },
          description: '目标账号 ID 列表',
        },
        platform: {
          type: 'string',
          enum: [...PLATFORMS],
          description: '目标平台',
        },
        publishMode: {
          type: 'string',
          enum: [...PUBLISH_MODES],
          description: '发布模式',
        },
      },
      required: ['contentId', 'accountIds'],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 数据统计（3 个）
  // ═══════════════════════════════════════════════════════════

  {
    name: 'stats_overview',
    description: '获取数据概览：总账号数、总视频数、总发布数、总播放量、总点赞数及各平台汇总',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'stats_platform',
    description: '获取指定平台的数据统计：账号数、活跃账号数、视频数、播放量、点赞数',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: [...PLATFORMS],
          description: '平台标识',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'stats_trend',
    description: '获取趋势数据，按天聚合指定指标的统计变化',
    inputSchema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: [...METRICS],
          description: '统计指标（默认 play_count）',
        },
      },
    },
  },
];

type ToolName = (typeof TOOLS)[number]['name'];

const CHANNEL_MAP: Record<ToolName, { channel: string; transform?: (args: Record<string, unknown>) => unknown[] }> = {
  'account_list': { channel: 'account:list' },
  'account_status': { channel: 'account:status' },
  'account_add': { channel: 'account:add' },
  'account_remove': { channel: 'account:remove' },
  'content_list': { channel: 'content:list' },
  'content_upload': { channel: 'content:create', transform: (args) => [{ filePath: args.filePath }] },
  'content_delete': { channel: 'content:delete' },
  'content_search': { channel: 'content:search' },
  'content_tags': { channel: 'content:tags' },
  'publish_create': { channel: 'publish:createTask', transform: (args) => [args] },
  'publish_list': { channel: 'publish:listTasks', transform: (args) => [args.contentId ? { contentId: args.contentId } : undefined] },
  'publish_cancel': { channel: 'publish:cancelTask' },
  'publish_status': { channel: 'publish:status' },
  'publish_schedule': { channel: 'publish:schedule', transform: (args) => [args.taskId, args.scheduledAt] },
  'publish_batch': { channel: 'publish:batch', transform: (args) => [args] },
  'stats_overview': { channel: 'stats:overview' },
  'stats_platform': { channel: 'stats:platform' },
  'stats_trend': { channel: 'stats:trend', transform: (args) => [args.metric] },
};

function validateRequired(args: Record<string, unknown>, required: string[]): void {
  for (const key of required) {
    if (args[key] === undefined || args[key] === null) {
      throw new Error(`缺少必填参数: ${key}`);
    }
  }
}

function validateEnum(value: unknown, allowed: readonly string[], fieldName: string): void {
  if (value !== undefined && !allowed.includes(value as string)) {
    throw new Error(`参数 ${fieldName} 值无效: ${value}，允许值: ${allowed.join(', ')}`);
  }
}

class MatrixFlowMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'matrixflow-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
        const { name, arguments: args } = request.params;
        const toolArgs = args ?? {};

        try {
          const result = await this.handleToolCall(name as ToolName, toolArgs);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
          };
        }
      }
    );
  }

  private async handleToolCall(name: ToolName, args: Record<string, unknown>): Promise<unknown> {
    const mapping = CHANNEL_MAP[name];
    if (!mapping) {
      throw new Error(`未知的工具: ${name}`);
    }

    this.validateArgs(name, args);

    const bridge = getBridge();
    if (!bridge.isAvailable()) {
      throw new Error('数据库不可用，请确认 MatrixFlow 数据目录存在或设置 MATRIXFLOW_DB 环境变量');
    }

    const bridgeArgs = mapping.transform ? mapping.transform(args) : this.defaultArgs(name, args);
    const result: BridgeResult = await bridge.invoke(mapping.channel, ...bridgeArgs);

    if (!result.success) {
      throw new Error(result.message ?? '操作失败');
    }

    return this.postProcess(name, result.data, args);
  }

  private defaultArgs(name: ToolName, args: Record<string, unknown>): unknown[] {
    switch (name) {
      case 'account_status':
      case 'account_remove':
        return [args.accountId as string];
      case 'account_add':
        return [{ platform: args.platform, groupId: args.groupId }];
      case 'content_upload':
        return [{ filePath: args.filePath }];
      case 'content_delete':
        return [args.contentId as string];
      case 'content_search':
        return [args.query as string];
      case 'content_tags':
        return [args.contentId as string, args.tags as string[]];
      case 'publish_cancel':
      case 'publish_status':
        return [args.taskId as string];
      case 'stats_platform':
        return [args.platform as string];
      case 'stats_trend':
        return [args.metric as string | undefined];
      default:
        return [];
    }
  }

  private validateArgs(name: ToolName, args: Record<string, unknown>): void {
    switch (name) {
      case 'account_add':
        validateRequired(args, ['platform']);
        validateEnum(args.platform, PLATFORMS, 'platform');
        break;
      case 'account_status':
      case 'account_remove':
        validateRequired(args, ['accountId']);
        break;
      case 'content_upload':
        validateRequired(args, ['filePath']);
        break;
      case 'content_delete':
        validateRequired(args, ['contentId']);
        break;
      case 'content_search':
        validateRequired(args, ['query']);
        break;
      case 'content_tags':
        validateRequired(args, ['contentId', 'tags']);
        if (!Array.isArray(args.tags)) throw new Error('tags 必须是字符串数组');
        break;
      case 'publish_create':
        validateRequired(args, ['contentId', 'platform', 'accountId', 'publishMode']);
        validateEnum(args.platform, PLATFORMS, 'platform');
        validateEnum(args.publishMode, PUBLISH_MODES, 'publishMode');
        break;
      case 'publish_cancel':
      case 'publish_status':
        validateRequired(args, ['taskId']);
        break;
      case 'publish_schedule':
        validateRequired(args, ['taskId', 'scheduledAt']);
        break;
      case 'publish_batch':
        validateRequired(args, ['contentId', 'accountIds']);
        if (!Array.isArray(args.accountIds)) throw new Error('accountIds 必须是字符串数组');
        break;
      case 'stats_platform':
        validateRequired(args, ['platform']);
        validateEnum(args.platform, PLATFORMS, 'platform');
        break;
      case 'stats_trend':
        if (args.metric) validateEnum(args.metric, METRICS, 'metric');
        break;
    }
  }

  private postProcess(name: ToolName, data: unknown, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'account_list': {
        let result = data as unknown[];
        if (args.platform) {
          result = result.filter((a: any) => a.platform === args.platform);
        }
        if (args.status) {
          result = result.filter((a: any) => a.status === args.status);
        }
        return result;
      }
      case 'content_list': {
        let result = data as unknown[];
        if (args.type) {
          result = result.filter((c: any) => c.type === args.type);
        }
        if (args.status) {
          result = result.filter((c: any) => c.status === args.status);
        }
        return result;
      }
      default:
        return data;
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MatrixFlow MCP Server started');
    console.error(`Registered ${TOOLS.length} tools: ${TOOLS.map(t => t.name).join(', ')}`);
  }
}

async function main() {
  const server = new MatrixFlowMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error('MCP Server failed:', error);
  process.exit(1);
});
