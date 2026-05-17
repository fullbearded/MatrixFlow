import crypto from 'crypto';
import { Logger } from '../core/Logger';
import { License, ActivationResult } from './LicenseService';

const logger = new Logger('LicenseServerClient');

interface ServerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LicenseServerConfig {
  endpoint: string;
  timeout: number;
  retryCount: number;
}

class LicenseServerClient {
  private config: LicenseServerConfig = {
    endpoint: 'https://api.matrixflow.io/license',
    timeout: 10000,
    retryCount: 3,
  };

  async validateOnline(key: string): Promise<ServerResponse<License>> {
    for (let i = 0; i < this.config.retryCount; i++) {
      try {
        const response = await this.request('/validate', { key });
        return response as ServerResponse<License>;
      } catch (error) {
        logger.warn(`验证失败，重试 ${i + 1}/${this.config.retryCount}`, error);
        if (i === this.config.retryCount - 1) {
          return { success: false, error: '网络连接失败，请使用离线激活' };
        }
      }
    }
    return { success: false, error: '未知错误' };
  }

  async activateOnline(key: string, email: string, deviceId: string): Promise<ActivationResult> {
    try {
      const response = await this.request('/activate', {
        key,
        email,
        deviceId,
        fingerprint: this.generateFingerprint(),
      });

      if (response.success && response.data) {
        return {
          success: true,
          license: response.data as License,
        };
      }

      return {
        success: false,
        error: response.error || '激活失败',
      };
    } catch (error) {
      logger.error('在线激活失败', error);
      return {
        success: false,
        error: '网络连接失败，请使用离线激活',
      };
    }
  }

  async deactivateOnline(key: string, deviceId: string): Promise<boolean> {
    try {
      const response = await this.request('/deactivate', { key, deviceId });
      return response.success;
    } catch (error) {
      logger.error('在线注销失败', error);
      return false;
    }
  }

  async checkUpdate(key: string): Promise<{ hasUpdate: boolean; version?: string }> {
    try {
      const response = await this.request('/check-update', { key });
      const data = response.data as { hasUpdate?: boolean; version?: string } | undefined;
      return {
        hasUpdate: response.success && data?.hasUpdate === true,
        version: data?.version,
      };
    } catch {
      return { hasUpdate: false };
    }
  }

  async generateOfflineActivation(
    licenseKey: string,
    email: string,
    deviceId: string,
    fingerprint: string
  ): Promise<string | null> {
    try {
      const response = await this.request('/offline/generate', {
        key: licenseKey,
        email,
        deviceId,
        fingerprint,
      });

      const data = response.data as { activationCode?: string } | undefined;
      if (response.success && data?.activationCode) {
        return data.activationCode;
      }
      return null;
    } catch (error) {
      logger.error('生成离线激活码失败', error);
      return null;
    }
  }

  private async request(endpoint: string, data: Record<string, unknown>): Promise<ServerResponse<unknown>> {
    const url = `${this.config.endpoint}${endpoint}`;
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');

    const payload = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', this.getApiKey())
      .update(`${timestamp}${nonce}${payload}`)
      .digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': String(timestamp),
          'X-Nonce': nonce,
          'X-Signature': signature,
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as ServerResponse<unknown>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private generateFingerprint(): string {
    const platform = process.platform;
    const arch = process.arch;
    const nodeVersion = process.version;
    return crypto.createHash('md5').update(`${platform}-${arch}-${nodeVersion}`).digest('hex');
  }

  private getApiKey(): string {
    const key = process.env.MATRIXFLOW_API_KEY;
    if (!key) {
      throw new Error('MATRIXFLOW_API_KEY 环境变量未配置，无法进行 License 验证');
    }
    return key;
  }
}

export const licenseServerClient = new LicenseServerClient();
