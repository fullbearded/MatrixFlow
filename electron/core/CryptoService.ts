import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const VERSION = 1;

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
  version: number;
  salt: string;
}

export interface CryptoService {
  encrypt(data: string): Promise<string>;
  decrypt(encrypted: string): Promise<string>;
  deriveKey(): Promise<Buffer>;
}

export class AESCryptoService implements CryptoService {
  private static instance: AESCryptoService;
  private key: Buffer | null = null;
  private salt: Buffer | null = null;

  private constructor() {}

  static getInstance(): AESCryptoService {
    if (!AESCryptoService.instance) {
      AESCryptoService.instance = new AESCryptoService();
    }
    return AESCryptoService.instance;
  }

  async initialize(): Promise<void> {
    if (this.key) return;

    const keyPath = this.getKeyFilePath();
    const keyDir = path.dirname(keyPath);

    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }

    if (fs.existsSync(keyPath)) {
      this.loadKey(keyPath);
    } else {
      this.salt = crypto.randomBytes(SALT_LENGTH);
      this.key = await this.deriveKey();
      this.persistKey(keyPath);
    }
  }

  async encrypt(data: string): Promise<string> {
    if (!this.key || !this.salt) {
      throw new CryptoError('CryptoService 未初始化，请先调用 initialize()');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      salt: this.salt.toString('base64'),
      version: VERSION,
    };

    return JSON.stringify(payload);
  }

  async decrypt(encrypted: string): Promise<string> {
    if (!this.key) {
      throw new CryptoError('CryptoService 未初始化，请先调用 initialize()');
    }

    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(encrypted);
    } catch {
      throw new CryptoError('解密失败：无效的数据格式');
    }

    if (
      !payload.iv ||
      !payload.authTag ||
      !payload.ciphertext ||
      !payload.salt
    ) {
      throw new CryptoError('解密失败：加密数据字段不完整');
    }

    if (payload.version !== VERSION) {
      throw new CryptoError(
        `解密失败：版本不匹配 (期望 ${VERSION}, 实际 ${payload.version})`
      );
    }

    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err) {
      throw new CryptoError(
        '解密失败：数据可能已被篡改或在另一台机器上加密',
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

  async deriveKey(): Promise<Buffer> {
    if (this.key) return this.key;

    if (!this.salt) {
      this.salt = crypto.randomBytes(SALT_LENGTH);
    }

    const fingerprint = this.getMachineFingerprint();
    return crypto.scryptSync(fingerprint, this.salt, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
  }

  private getMachineFingerprint(): string {
    const mac = this.getPrimaryMacAddress();
    const cpuId = os.cpus()[0]?.model ?? 'unknown-cpu';
    const components = [
      mac,
      cpuId,
      os.hostname(),
      os.platform(),
      os.arch(),
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

  private getKeyFilePath(): string {
    return path.join(app.getPath('userData'), 'crypto', 'key.bin');
  }

  private loadKey(keyPath: string): void {
    try {
      const raw = fs.readFileSync(keyPath);
      const saltLen = raw.readUInt32BE(0);
      this.salt = raw.subarray(4, 4 + saltLen);
      this.key = raw.subarray(4 + saltLen);
    } catch {
      throw new CryptoError('加载密钥失败，可能需要重新登录');
    }
  }

  private persistKey(keyPath: string): void {
    if (!this.salt || !this.key) return;

    const saltLenBuf = Buffer.alloc(4);
    saltLenBuf.writeUInt32BE(this.salt.length, 0);
    const buf = Buffer.concat([saltLenBuf, this.salt, this.key]);

    fs.writeFileSync(keyPath, buf, { mode: 0o600 });
  }
}

export class CryptoError extends Error {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'CryptoError';
    this.cause = cause;
  }
}

export const cryptoService = AESCryptoService.getInstance();
