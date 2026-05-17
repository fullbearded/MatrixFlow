import { Logger } from '../core/Logger';
import { getDatabase, isDatabaseAvailable } from '../data/Database';
import type { Proxy } from '../data/types';
import { randomUUID } from 'crypto';

const logger = new Logger('ProxyService');

interface CreateProxyData {
  name: string;
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

interface UpdateProxyData {
  name?: string;
  protocol?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  status?: string;
}

class ProxyService {
  private static instance: ProxyService;

  private constructor() {}

  static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  async getAllProxies(): Promise<Proxy[]> {
    if (!isDatabaseAvailable()) {
      logger.warn('数据库不可用');
      return [];
    }

    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM proxies ORDER BY created_at DESC
    `).all() as Proxy[];

    return rows;
  }

  async getProxyById(id: string): Promise<Proxy | null> {
    if (!isDatabaseAvailable()) {
      return null;
    }

    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM proxies WHERE id = ?
    `).get(id) as Proxy | undefined;

    return row || null;
  }

  async createProxy(data: CreateProxyData): Promise<Proxy> {
    if (!isDatabaseAvailable()) {
      throw new Error('数据库不可用');
    }

    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO proxies (id, name, protocol, host, port, username, password, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      data.name,
      data.protocol,
      data.host,
      data.port,
      data.username || null,
      data.password || null,
      now,
      now
    );

    const proxy = await this.getProxyById(id);
    if (!proxy) {
      throw new Error('创建代理失败');
    }

    logger.info(`创建代理: ${data.name}`);
    return proxy;
  }

  async updateProxy(id: string, data: UpdateProxyData): Promise<Proxy> {
    if (!isDatabaseAvailable()) {
      throw new Error('数据库不可用');
    }

    const existing = await this.getProxyById(id);
    if (!existing) {
      throw new Error('代理不存在');
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.protocol !== undefined) {
      updates.push('protocol = ?');
      values.push(data.protocol);
    }
    if (data.host !== undefined) {
      updates.push('host = ?');
      values.push(data.host);
    }
    if (data.port !== undefined) {
      updates.push('port = ?');
      values.push(data.port);
    }
    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.password !== undefined) {
      updates.push('password = ?');
      values.push(data.password);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(id);

      db.prepare(`
        UPDATE proxies SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);
    }

    const proxy = await this.getProxyById(id);
    if (!proxy) {
      throw new Error('更新代理失败');
    }

    logger.info(`更新代理: ${id}`);
    return proxy;
  }

  async deleteProxy(id: string): Promise<void> {
    if (!isDatabaseAvailable()) {
      throw new Error('数据库不可用');
    }

    const db = getDatabase();
    db.prepare('DELETE FROM proxies WHERE id = ?').run(id);
    logger.info(`删除代理: ${id}`);
  }

  async checkProxy(id: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const proxy = await this.getProxyById(id);
    if (!proxy) {
      return { success: false, message: '代理不存在' };
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        await this.updateProxyCheckResult(id, 'active', `连接成功，延迟 ${latency}ms`);

        return { success: true, message: `连接成功，延迟 ${latency}ms`, latency };
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      await this.updateProxyCheckResult(id, 'inactive', `连接失败: ${errorMsg}`);

      return { success: false, message: `连接失败: ${errorMsg}` };
    }
  }

  private async updateProxyCheckResult(id: string, status: string, result: string): Promise<void> {
    if (!isDatabaseAvailable()) return;

    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE proxies 
      SET status = ?, last_check_at = ?, last_check_result = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now, result, now, id);
  }

  async getActiveProxies(): Promise<Proxy[]> {
    if (!isDatabaseAvailable()) {
      return [];
    }

    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM proxies WHERE status = 'active' ORDER BY created_at DESC
    `).all() as Proxy[];

    return rows;
  }
}

export const proxyService = ProxyService.getInstance();
