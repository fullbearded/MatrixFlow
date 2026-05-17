import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const Module = require('module');

const mockPath = path.resolve(__dirname, 'electron-mock.ts').replace(/\.ts$/, '.js');

const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
  if (request === 'electron' || request === 'electron-log') {
    return path.resolve(__dirname, 'electron-mock');
  }
  return originalResolveFilename.call(this, request, ...args);
};

console.log('[test-setup] Electron mock registered');
