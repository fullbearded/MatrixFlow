/**
 * 安全加密层类型定义
 *
 * AES-256-GCM 加密方案，用于保护 Cookie、密码等敏感数据。
 */

/** 加密后的数据结构 */
export interface EncryptedData {
  /** 初始化向量 (Base64, 12 bytes) */
  iv: string;
  /** 认证标签 (Base64, 16 bytes) */
  authTag: string;
  /** 密文 (Base64) */
  ciphertext: string;
  /** 加密方案版本号，便于未来迁移 */
  version: number;
}

/** 安全层公开接口 */
export interface ISecurityLayer {
  /** 初始化密钥（读取或派生），必须在加解密前调用 */
  initialize(): Promise<void>;
  /** 加密明文字符串，返回 JSON 序列化的 EncryptedData */
  encrypt(data: string): Promise<string>;
  /** 解密 JSON 序列化的 EncryptedData，返回明文 */
  decrypt(encrypted: string): Promise<string>;
  /** 加密任意可序列化对象 */
  encryptObject<T>(obj: T): Promise<string>;
  /** 解密为指定类型的对象 */
  decryptObject<T>(encrypted: string): Promise<T>;
}

/** 加密方案常量 */
export const SECURITY_CONSTANTS = {
  /** 加密算法 */
  ALGORITHM: 'aes-256-gcm',
  /** 密钥长度 (bytes) */
  KEY_LENGTH: 32,
  /** IV 长度 (bytes) */
  IV_LENGTH: 12,
  /** 认证标签长度 (bytes) */
  AUTH_TAG_LENGTH: 16,
  /** scrypt 参数 */
  SCRYPT_COST: 16384,
  SCRYPT_BLOCK_SIZE: 8,
  SCRYPT_PARALLELIZATION: 1,
  /** salt 长度 (bytes) */
  SALT_LENGTH: 32,
  /** 当前版本 */
  VERSION: 1,
} as const;
