/**
 * Shared Sentry init options for server, edge, and client runtimes.
 * Set env vars in production; omit DSN locally to disable reporting.
 */

import type * as Sentry from '@sentry/nextjs';

import {
  resolveObservabilityEnvironment,
  resolveObservabilityRelease,
  resolveSentryDsn,
} from './src/lib/observability/env';

function readSampleRate(
  envValue: string | undefined,
  productionDefault: number,
): number {
  if (envValue?.trim()) {
    const n = Number(envValue);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return process.env.NODE_ENV === 'production' ? productionDefault : 1;
}

export function resolveSentryRelease(): string | undefined {
  return resolveObservabilityRelease();
}

export function resolveSentryEnvironment(): string {
  return resolveObservabilityEnvironment();
}

export { resolveSentryDsn };

export function buildSentryInitOptions(
  extra?: Partial<Parameters<typeof Sentry.init>[0]>,
): Parameters<typeof Sentry.init>[0] {
  const dsn = resolveSentryDsn();
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease(),
    tracesSampleRate: readSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE ??
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    enableLogs: true,
    sendDefaultPii: true,
    ...extra,
  };
}
