import * as Sentry from '@sentry/electron/renderer';

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

function scrubEvent(event: Sentry.Event): Sentry.Event {
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

export function initSentryRenderer(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: 'matrixflow@0.1.0',
    environment: import.meta.env.DEV ? 'development' : 'production',
    maxBreadcrumbs: 50,
    attachStacktrace: true,
    sendDefaultPii: false,
    beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
      return scrubEvent(event) as Sentry.ErrorEvent;
    },
  });
}
