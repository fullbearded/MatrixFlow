import type { Account, PublishTask } from '@electron/data/types';
import type { ITask } from '@electron/core/types/task';

export function createMockAccount(overrides?: Partial<Account>): Account {
  return {
    id: 'account_001',
    platform: 'douyin',
    nickname: '测试账号',
    avatar_url: null,
    cookie_path: '/tmp/cookies/account_001.json',
    cookie_valid: 1,
    last_login: new Date().toISOString(),
    last_publish: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTask(overrides?: Partial<ITask>): ITask {
  return {
    id: 'task_001',
    type: 'publish',
    platform: 'douyin',
    accountId: 'account_001',
    priority: 5,
    payload: { contentId: 'content_001' },
    status: 'queued',
    createdAt: new Date().toISOString(),
    scheduledAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

export function createMockPublishTask(overrides?: Partial<PublishTask>): PublishTask {
  return {
    id: 'pub_task_001',
    content_id: 'content_001',
    group_id: 'group_001',
    platform: 'douyin',
    account_id: 'account_001',
    proxy_id: null,
    fingerprint_id: null,
    scheduled_at: null,
    publish_mode: 'client_direct',
    status: 'pending',
    result: null,
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
