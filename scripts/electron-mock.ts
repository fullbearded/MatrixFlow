import path from 'path';
import fs from 'fs';

const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'test');

const app = {
  getPath: (name: string): string => {
    const dirs: Record<string, string> = {
      userData: TEST_DATA_DIR,
      logs: path.join(TEST_DATA_DIR, 'logs'),
      temp: path.join(TEST_DATA_DIR, 'temp'),
    };
    const resolved = dirs[name] || TEST_DATA_DIR;
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  },
  getVersion: () => '0.1.0-test',
  getName: () => 'MatrixFlow-Test',
  isPackaged: false,
  quit: () => process.exit(0),
};

const ipcMain = {
  on: () => {},
  handle: () => {},
  removeHandler: () => {},
};

const ipcRenderer = {
  invoke: () => Promise.resolve(),
  on: () => {},
  send: () => {},
};

const BrowserWindow = class {
  loadURL() { return Promise.resolve(); }
  loadFile() { return Promise.resolve(); }
  webContents = { on: () => {}, send: () => {}, openDevTools: () => {} };
  on() { return this; }
  once() { return this; }
  close() {}
  destroy() {}
};

const session = {
  defaultSession: {
    cookies: { get: () => Promise.resolve([]), set: () => Promise.resolve() },
  },
};

export { app, ipcMain, ipcRenderer, BrowserWindow, session };
export default { app, ipcMain, ipcRenderer, BrowserWindow, session };
