import { describe, it, expect, vi } from 'vitest';

vi.mock('@sentry/electron/main', () => ({
  init: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/matrixflow-test'),
    getVersion: vi.fn(() => '0.2.0'),
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

import { scrubEvent } from '@electron/core/SentryInit';

describe('SentryInit', () => {
  describe('scrubEvent', () => {
    it('scrubs cookie headers', () => {
      const event = { request: { headers: { cookie: 'session=abc123' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers.cookie).toBe('[Filtered]');
    });

    it('scrubs token/authorization headers', () => {
      const event = {
        request: { headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' } },
      };
      const result = scrubEvent(event as any);
      expect(result.request!.headers.authorization).toBe('[Filtered]');
      expect(result.request!.headers['content-type']).toBe('application/json');
    });

    it('scrubs password headers', () => {
      const event = { request: { headers: { Password: 'secret123' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers.Password).toBe('[Filtered]');
    });

    it('scrubs apiKey headers', () => {
      const event = { request: { headers: { 'X-Api-Key': 'key123' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers['X-Api-Key']).toBe('[Filtered]');
    });

    it('scrubs session headers', () => {
      const event = { request: { headers: { session: 'sid123' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers.session).toBe('[Filtered]');
    });

    it('scrubs credential headers', () => {
      const event = { request: { headers: { credentials: 'cred123' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers.credentials).toBe('[Filtered]');
    });

    it('passes through clean headers', () => {
      const event = { request: { headers: { 'content-type': 'text/html', accept: '*/*' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers['content-type']).toBe('text/html');
      expect(result.request!.headers.accept).toBe('*/*');
    });

    it('scrubs sensitive keys in breadcrumbs data', () => {
      const event = {
        breadcrumbs: [
          { data: { token: 'abc', safeKey: 'ok' } },
          { data: { api_key: 'secret', name: 'test' } },
        ],
      };
      const result = scrubEvent(event as any);
      expect(result.breadcrumbs![0].data!.token).toBe('[Filtered]');
      expect(result.breadcrumbs![0].data!.safeKey).toBe('ok');
      expect(result.breadcrumbs![1].data!.api_key).toBe('[Filtered]');
      expect(result.breadcrumbs![1].data!.name).toBe('test');
    });

    it('scrubs sensitive keys in extra', () => {
      const event = { extra: { password: 'pass123', normalField: 'safe' } };
      const result = scrubEvent(event as any);
      expect(result.extra!.password).toBe('[Filtered]');
      expect(result.extra!.normalField).toBe('safe');
    });

    it('handles event without request breadcrumbs or extra', () => {
      const event = {};
      const result = scrubEvent(event as any);
      expect(result).toEqual({});
    });

    it('handles breadcrumbs without data', () => {
      const event = { breadcrumbs: [{ message: 'nav' }, { message: 'click' }] };
      const result = scrubEvent(event as any);
      expect(result.breadcrumbs).toEqual([{ message: 'nav' }, { message: 'click' }]);
    });

    it('scrubs secret and auth keys', () => {
      const event = { request: { headers: { secret: 's', auth: 'a' } } };
      const result = scrubEvent(event as any);
      expect(result.request!.headers.secret).toBe('[Filtered]');
      expect(result.request!.headers.auth).toBe('[Filtered]');
    });
  });
});
