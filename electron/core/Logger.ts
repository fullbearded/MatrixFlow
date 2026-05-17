import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import * as electronLog from 'electron-log';

electronLog.transports.file.resolvePathFn = () => {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, 'main.log');
};

electronLog.transports.file.maxSize = 10 * 1024 * 1024;
electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

export class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private formatMessage(message: string): string {
    return `[${this.module}] ${message}`;
  }

  info(message: string, ...args: any[]): void {
    electronLog.info(this.formatMessage(message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    electronLog.warn(this.formatMessage(message), ...args);
  }

  error(message: string, ...args: any[]): void {
    electronLog.error(this.formatMessage(message), ...args);
  }

  debug(message: string, ...args: any[]): void {
    electronLog.debug(this.formatMessage(message), ...args);
  }
}
