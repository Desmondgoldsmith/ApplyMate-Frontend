/** Shared observability env helpers (no Sentry/PostHog imports). */

export function resolveObservabilityEnvironment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    'development'
  );
}

export function resolveObservabilityRelease(): string | undefined {
  const fromEnv =
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim();
  if (fromEnv) return fromEnv;
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim();
  if (sha) return `applymate-web@${sha.slice(0, 12)}`;
  return process.env.NODE_ENV === 'production'
    ? 'applymate-web@unknown'
    : 'applymate-web@dev';
}

export function resolveSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}
