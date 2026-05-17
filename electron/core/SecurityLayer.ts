import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';
import { Logger } from './Logger';
import {
  ISecurityLayer,
  EncryptedData,
  SECURITY_CONSTANTS,
} from './types/security';

const logger = new Logger('SecurityLayer');

type KeyMaterial = { salt: Buffer; key: Buffer };

export class SecurityLayer implements ISecurityLayer {
  private static instance: SecurityLayer;
  private keyMaterial: KeyMaterial | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): SecurityLayer {
    if (!SecurityLayer.instance) {
      SecurityLayer.instance = new SecurityLayer();
    }
    return SecurityLayer.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const keyPath = this.getKeyFilePath();
    const keyDir = path.dirname(keyPath);

    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }

    if (fs.existsSync(keyPath)) {
      await this.loadExistingKey(keyPath);
    } else {
      await this.deriveAndStoreNewKey(keyPath);
    }

    this.initialized = true;
    logger.info('安全加密层初始化完成');
  }

  async encrypt(data: string): Promise<string> {
    this.ensureInitialized();

    const iv = crypto.randomBytes(SECURITY_CONSTANTS.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      SECURITY_CONSTANTS.ALGORITHM,
      this.keyMaterial!.key,
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const payload: EncryptedData = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      version: SECURITY_CONSTANTS.VERSION,
    };

    return JSON.stringify(payload);
  }

  async decrypt(encrypted: string): Promise<string> {
    this.ensureInitialized();

    let payload: EncryptedData;
    try {
      payload = JSON.parse(encrypted);
    } catch {
      throw new SecurityError('解密失败：无效的加密数据格式');
    }

    this.validatePayload(payload);

    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv(
      SECURITY_CONSTANTS.ALGORITHM,
      this.keyMaterial!.key,
      iv
    );
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err) {
      throw new SecurityError(
        '解密失败：数据可能已被篡改或密钥不匹配',
        err instanceof Error ? err : undefined
      );
    }
  }

  async encryptObject<T>(obj: T): Promise<string> {
    return this.encrypt(JSON.stringify(obj));
  }

  async decryptObject<T>(encrypted: string): Promise<T> {
    const json = await this.decrypt(encrypted);
    return JSON.parse(json) as T;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.keyMaterial) {
      throw new SecurityError('安全层未初始化，请先调用 initialize()');
    }
  }

  private validatePayload(payload: EncryptedData): void {
    if (
      !payload.iv ||
      !payload.authTag ||
      !payload.ciphertext ||
      typeof payload.version !== 'number'
    ) {
      throw new SecurityError('解密失败：加密数据字段不完整');
    }
    if (payload.version !== SECURITY_CONSTANTS.VERSION) {
      throw new SecurityError(
        `解密失败：版本不匹配 (期望 ${SECURITY_CONSTANTS.VERSION}, 实际 ${payload.version})`
      );
    }
  }

  private async loadExistingKey(keyPath: string): Promise<void> {
    try {
      const raw = fs.readFileSync(keyPath);
      const saltLen = raw.readUInt32BE(0);
      const salt = raw.subarray(4, 4 + saltLen);
      const key = raw.subarray(4 + saltLen);

      this.keyMaterial = { salt, key };
      logger.info('已加载现有加密密钥');
    } catch (err) {
      logger.error('加载密钥失败，将重新派生', err);
      await this.deriveAndStoreNewKey(keyPath);
    }
  }

  private async deriveAndStoreNewKey(keyPath: string): Promise<void> {
    const salt = crypto.randomBytes(SECURITY_CONSTANTS.SALT_LENGTH);
    const fingerprint = await this.getMachineFingerprint();
    const key = crypto.scryptSync(
      fingerprint,
      salt,
      SECURITY_CONSTANTS.KEY_LENGTH,
      {
        N: SECURITY_CONSTANTS.SCRYPT_COST,
        r: SECURITY_CONSTANTS.SCRYPT_BLOCK_SIZE,
        p: SECURITY_CONSTANTS.SCRYPT_PARALLELIZATION,
      }
    );

    this.keyMaterial = { salt, key };
    this.persistKey(keyPath, salt, key);
    logger.info('已派生并存储新加密密钥');
  }

  private persistKey(keyPath: string, salt: Buffer, key: Buffer): void {
    const saltLenBuf = Buffer.alloc(4);
    saltLenBuf.writeUInt32BE(salt.length, 0);
    const buf = Buffer.concat([saltLenBuf, salt, key]);

    fs.writeFileSync(keyPath, buf, { mode: 0o600 });
    logger.info(`密钥已保存至 ${keyPath}`);
  }

  private getKeyFilePath(): string {
    return path.join(app.getPath('userData'), 'key.bin');
  }

  private async getMachineFingerprint(): Promise<string> {
    const components: string[] = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model ?? 'unknown-cpu',
      this.getPrimaryMacAddress(),
      this.getDiskIdentifier(),
    ];
    const raw = components.join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private getPrimaryMacAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (!nets) continue;
      for (const net of nets) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          return net.mac;
        }
      }
    }
    return 'no-mac';
  }

  private getDiskIdentifier(): string {
    try {
      const homedir = os.homedir();
      const stat = fs.statSync(homedir);
      return `${stat.dev}:${stat.ino}`;
    } catch {
      return 'unknown-disk';
    }
  }
}

export class SecurityError extends Error {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'SecurityError';
    this.cause = cause;
  }
}

export const securityLayer = SecurityLayer.getInstance();
