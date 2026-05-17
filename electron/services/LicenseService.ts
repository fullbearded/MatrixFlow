import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Logger } from '../core/Logger';
import { getDatabase, isDatabaseAvailable } from '../data/Database';

const logger = new Logger('LicenseService');

export interface License {
  id: string;
  key: string;
  email: string;
  plan: 'starter' | 'pro' | 'enterprise';
  devices: number;
  activatedDevices: string[];
  expiresAt: Date;
  createdAt: Date;
  features: Record<string, boolean>;
}

export interface ActivationResult {
  success: boolean;
  error?: string;
  license?: License;
}

class LicenseService {
  private static instance: LicenseService;
  private currentLicense: License | null = null;
  private publicKey: string;
  private deviceId: string;
  private offlinePath: string;

  private constructor() {
    this.publicKey = this.loadPublicKey();
    this.deviceId = this.getOrCreateDeviceId();
    this.offlinePath = path.join(app.getPath('userData'), 'license.lic');
  }

  static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  async activateLicense(licenseKey: string, email: string): Promise<ActivationResult> {
    try {
      const licenseData = this.parseLicenseKey(licenseKey);
      if (!licenseData) {
        return { success: false, error: '无效的许可证密钥格式' };
      }

      if (!this.verifySignature(licenseData)) {
        return { success: false, error: '许可证签名验证失败' };
      }

      if (new Date(licenseData.expiresAt) < new Date()) {
        return { success: false, error: '许可证已过期' };
      }

      if (licenseData.activatedDevices.length >= licenseData.devices) {
        if (!licenseData.activatedDevices.includes(this.deviceId)) {
          return { success: false, error: '已达到最大设备数量限制' };
        }
      }

      if (!licenseData.activatedDevices.includes(this.deviceId)) {
        licenseData.activatedDevices.push(this.deviceId);
      }

      const license: License = {
        id: licenseData.id,
        key: licenseKey,
        email,
        plan: licenseData.plan,
        devices: licenseData.devices,
        activatedDevices: licenseData.activatedDevices,
        expiresAt: new Date(licenseData.expiresAt),
        createdAt: new Date(licenseData.createdAt),
        features: licenseData.features,
      };

      this.saveLicense(license);
      this.saveOfflineLicense(license);
      this.currentLicense = license;

      logger.info(`许可证激活成功: ${license.plan} - ${email}`);
      return { success: true, license };
    } catch (error) {
      logger.error('许可证激活失败', error);
      return { success: false, error: String(error) };
    }
  }

  async activateOffline(activationFile: string): Promise<ActivationResult> {
    try {
      const content = fs.readFileSync(activationFile, 'utf-8');
      const data = JSON.parse(content);

      if (data.deviceId !== this.deviceId) {
        return { success: false, error: '激活文件与本设备不匹配' };
      }

      if (!this.verifyOfflineSignature(data)) {
        return { success: false, error: '离线激活签名验证失败' };
      }

      const license: License = {
        id: data.licenseId,
        key: data.key,
        email: data.email,
        plan: data.plan,
        devices: data.devices,
        activatedDevices: [this.deviceId],
        expiresAt: new Date(data.expiresAt),
        createdAt: new Date(data.createdAt),
        features: data.features,
      };

      this.saveLicense(license);
      this.currentLicense = license;

      logger.info('离线激活成功');
      return { success: true, license };
    } catch (error) {
      logger.error('离线激活失败', error);
      return { success: false, error: String(error) };
    }
  }

  generateOfflineRequest(licenseKey: string, email: string): string {
    const request = {
      deviceId: this.deviceId,
      licenseKey,
      email,
      timestamp: Date.now(),
      fingerprint: this.getDeviceFingerprint(),
    };

    const requestPath = path.join(app.getPath('userData'), 'activation_request.json');
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));

    logger.info('离线激活请求已生成');
    return requestPath;
  }

  validateLicense(): boolean {
    if (!this.currentLicense) {
      this.loadLicense();
    }

    if (!this.currentLicense) {
      return false;
    }

    if (this.currentLicense.expiresAt < new Date()) {
      logger.warn('许可证已过期');
      return false;
    }

    if (!this.currentLicense.activatedDevices.includes(this.deviceId)) {
      logger.warn('当前设备未激活');
      return false;
    }

    return true;
  }

  getLicense(): License | null {
    if (!this.currentLicense) {
      this.loadLicense();
    }
    return this.currentLicense;
  }

  hasFeature(feature: string): boolean {
    if (!this.validateLicense()) return false;
    return this.currentLicense?.features[feature] === true;
  }

  getMaxDevices(): number {
    if (!this.currentLicense) return 1;
    return this.currentLicense.devices;
  }

  deactivate(): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    db.prepare('DELETE FROM license').run();
    this.currentLicense = null;

    if (fs.existsSync(this.offlinePath)) {
      fs.unlinkSync(this.offlinePath);
    }

    logger.info('许可证已注销');
  }

  private loadLicense(): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT id, key, email, plan, devices, activated_devices, expires_at, created_at, features
      FROM license
      LIMIT 1
    `).get() as {
      id: string;
      key: string;
      email: string;
      plan: string;
      devices: number;
      activated_devices: string;
      expires_at: string;
      created_at: string;
      features: string;
    } | undefined;

    if (row) {
      this.currentLicense = {
        id: row.id,
        key: row.key,
        email: row.email,
        plan: row.plan as License['plan'],
        devices: row.devices,
        activatedDevices: JSON.parse(row.activated_devices),
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.created_at),
        features: JSON.parse(row.features),
      };
    }
  }

  private saveLicense(license: License): void {
    if (!isDatabaseAvailable()) return;
    const db = getDatabase();

    db.prepare('DELETE FROM license').run();

    db.prepare(`
      INSERT INTO license (id, key, email, plan, devices, activated_devices, expires_at, created_at, features)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      license.id,
      license.key,
      license.email,
      license.plan,
      license.devices,
      JSON.stringify(license.activatedDevices),
      license.expiresAt.toISOString(),
      license.createdAt.toISOString(),
      JSON.stringify(license.features)
    );
  }

  private saveOfflineLicense(license: License): void {
    const offlineData = {
      id: license.id,
      key: license.key,
      email: license.email,
      plan: license.plan,
      devices: license.devices,
      expiresAt: license.expiresAt.toISOString(),
      createdAt: license.createdAt.toISOString(),
      features: license.features,
      deviceId: this.deviceId,
      signature: this.signOffline(license),
    };

    fs.writeFileSync(this.offlinePath, JSON.stringify(offlineData));
  }

  private parseLicenseKey(key: string): (License & { signature: string }) | null {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private verifySignature(licenseData: License & { signature: string }): boolean {
    const { signature, ...data } = licenseData;
    const payload = JSON.stringify(data);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payload);
    return verifier.verify(this.publicKey, signature, 'base64');
  }

  private verifyOfflineSignature(data: Record<string, unknown>): boolean {
    const { signature, ...payload } = data;
    const license = payload as unknown as License;
    return this.signOffline(license) === signature;
  }

  private signOffline(license: License): string {
    const payload = JSON.stringify({
      id: license.id,
      plan: license.plan,
      expiresAt: license.expiresAt.toISOString(),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private getOrCreateDeviceId(): string {
    const idPath = path.join(app.getPath('userData'), 'device_id');
    if (fs.existsSync(idPath)) {
      return fs.readFileSync(idPath, 'utf-8').trim();
    }

    const id = crypto.randomUUID();
    fs.writeFileSync(idPath, id);
    return id;
  }

  private getDeviceFingerprint(): string {
    const cpus = 'unknown';
    return crypto.createHash('md5').update(cpus + this.deviceId).digest('hex');
  }

  private loadPublicKey(): string {
    const envKey = process.env.MATRIXFLOW_LICENSE_PUBLIC_KEY;
    if (envKey) {
      return envKey;
    }
    logger.warn('使用占位符公钥（仅开发环境），生产环境请设置 MATRIXFLOW_LICENSE_PUBLIC_KEY 环境变量');
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArTREPLACEWITHREALPUBLICKEY
-----END PUBLIC KEY-----`;
  }
}

export const licenseService = LicenseService.getInstance();
