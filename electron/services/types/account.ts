/**
 * 账号管理服务类型定义
 *
 * 涵盖账号实体、登录状态、分组、事件及服务接口。
 */

// ─── 账号实体 ───────────────────────────────────────────────

export type AccountStatus = 'active' | 'inactive' | 'expired';

export interface Account {
  id: string;
  platform: string;
  name: string;
  avatar?: string;
  cookieEncrypted: string;
  cookieValid: boolean;
  lastCookieCheck?: Date;
  groupId?: string;
  fingerprintId?: string;
  proxyId?: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── 数据库行映射 ────────────────────────────────────────────

export interface AccountRow {
  id: string;
  platform: string;
  name: string;
  avatar: string | null;
  cookie_encrypted: string;
  cookie_valid: number;
  last_cookie_check: string | null;
  group_id: string | null;
  fingerprint_id: string | null;
  proxy_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── 登录状态 ────────────────────────────────────────────────

export type LoginStep =
  | 'waiting'
  | 'scanned'
  | 'confirmed'
  | 'expired'
  | 'error';

export interface LoginStatus {
  status: LoginStep;
  cookie?: string;
  accountInfo?: { name: string; avatar: string };
}

// ─── 扫码会话 ────────────────────────────────────────────────

export interface QRLoginSession {
  sessionId: string;
  platform: string;
  groupId?: string;
  qrPath?: string;
  startedAt: Date;
  status: LoginStep;
}

// ─── 分组 ────────────────────────────────────────────────────

export interface AccountGroup {
  id: string;
  name: string;
  createdAt: Date;
}

export interface AccountGroupRow {
  id: string;
  name: string;
  created_at: string;
}

// ─── 事件名 ──────────────────────────────────────────────────

export enum AccountEvent {
  /** 账号绑定成功 */
  ACCOUNT_BOUND = 'account:bound',
  /** 账号删除 */
  ACCOUNT_DELETED = 'account:deleted',
  /** 状态变更（active / inactive / expired） */
  STATUS_CHANGED = 'account:status-changed',
  /** Cookie 验证完成 */
  COOKIE_VALIDATED = 'account:cookie-validated',
  /** Cookie 刷新完成 */
  COOKIE_REFRESHED = 'account:cookie-refreshed',
  /** 分组变更 */
  GROUP_CHANGED = 'account:group-changed',
  /** 扫码状态更新 */
  LOGIN_STATUS_UPDATED = 'account:login-status-updated',
}

// ─── 服务接口 ────────────────────────────────────────────────

export interface IAccountService {
  // 账号绑定（扫码登录）
  bindAccount(platform: string, groupId?: string): Promise<Account>;
  getQRCode(platform: string): Promise<string>;
  checkLoginStatus(sessionId: string): Promise<LoginStatus>;

  // Cookie 管理
  validateCookie(accountId: string): Promise<boolean>;
  refreshCookie(accountId: string): Promise<boolean>;

  // 账号查询
  getAccount(accountId: string): Promise<Account | null>;
  getAccountsByPlatform(platform: string): Promise<Account[]>;
  getAccountsByGroup(groupId: string): Promise<Account[]>;
  getAllAccounts(): Promise<Account[]>;

  // 分组操作
  setGroup(accountId: string, groupId: string): Promise<void>;
  removeFromGroup(accountId: string): Promise<void>;

  // 批量操作
  batchValidateCookies(accountIds: string[]): Promise<Map<string, boolean>>;
  batchSetGroup(accountIds: string[], groupId: string): Promise<void>;

  // 状态管理
  updateStatus(accountId: string, status: AccountStatus): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
}

// ─── 事件载荷 ────────────────────────────────────────────────

export interface AccountBoundPayload {
  accountId: string;
  platform: string;
  groupId?: string;
}

export interface AccountStatusPayload {
  accountId: string;
  oldStatus: AccountStatus;
  newStatus: AccountStatus;
}

export interface CookieValidatedPayload {
  accountId: string;
  valid: boolean;
}

export interface GroupChangedPayload {
  accountId: string;
  oldGroupId?: string;
  newGroupId?: string;
}
