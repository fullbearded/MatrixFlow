import * as Sentry from '@sentry/electron/main';

const SENTRY_DSN = 'https://placeholder@o0.ingest.sentry.io/0';

const SENSITIVE_KEYS = [
  /cookie/i,
  /token/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /session/i,
  /credential/i,
];

export function scrubEvent(event: Sentry.Event): Sentry.Event {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_KEYS.some((re) => re.test(key))) {
        event.request.headers[key] = '[Filtered]';
      }
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (crumb.data) {
        for (const key of Object.keys(crumb.data)) {
          if (SENSITIVE_KEYS.some((re) => re.test(key))) {
            crumb.data[key] = '[Filtered]';
          }
        }
      }
      return crumb;
    });
  }

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_KEYS.some((re) => re.test(key))) {
        event.extra[key] = '[Filtered]';
      }
    }
  }

  return event;
}

export function initSentryMain(): void {
  const { app } = require('electron') as typeof import('electron');

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `matrixflow@${app.getVersion()}`,
    environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    transportOptions: {
      maxAgeDays: 7,
      maxQueueSize: 30,
    },
    maxBreadcrumbs: 50,
    attachStacktrace: true,
    sendDefaultPii: false,
    beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
      return scrubEvent(event) as Sentry.ErrorEvent;
    },
  });
}
