import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const Module = createRequire(import.meta.url).resolve('module');
const ModuleClass = require(Module) as any;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DATA_DIR = path.join(PROJECT_ROOT, 'data', 'test');

const MOCK_APP = {
  getPath: (name: string) => {
    const dirs: Record<string, string> = {
      userData: TEST_DATA_DIR,
      logs: path.join(TEST_DATA_DIR, 'logs'),
      temp: path.join(TEST_DATA_DIR, 'temp'),
    };
    const resolved = dirs[name] || TEST_DATA_DIR;
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  },
  getVersion: () => '0.1.0-test',
  isPackaged: false,
  quit: () => process.exit(0),
};

const MOCK_ELECTRON_LOG = {
  info: (...a: unknown[]) => console.log('[INFO]', ...a),
  warn: (...a: unknown[]) => console.warn('[WARN]', ...a),
  error: (...a: unknown[]) => console.error('[ERROR]', ...a),
  debug: () => {},
  transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' } },
};

const originalResolveFilename = ModuleClass._resolveFilename;
ModuleClass._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === 'electron') return 'electron-mock';
  if (request === 'electron-log') return 'electron-log-mock';
  return originalResolveFilename.call(this, request, ...args);
};

require.cache['electron-mock'] = {
  id: 'electron-mock',
  filename: 'electron-mock',
  loaded: true,
  exports: { app: MOCK_APP, ipcMain: { on: () => {}, handle: () => {} } },
} as any;

require.cache['electron-log-mock'] = {
  id: 'electron-log-mock',
  filename: 'electron-log-mock',
  loaded: true,
  exports: { default: MOCK_ELECTRON_LOG },
} as any;

export { MOCK_APP, TEST_DATA_DIR };
