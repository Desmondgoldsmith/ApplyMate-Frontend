/**
 * Development-only timing for CV / AI UX (Phase 7 instrumentation).
 * No-op in production builds.
 */
export function logCvDevPerf(label: string, startedAtMs: number, extra?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') return;
  const ms = Math.round(performance.now() - startedAtMs);
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.info('[cv:perf]', { label, clientMs: ms, ...extra });
}

/** When start time was captured with `Date.now()` (not `performance.now()`). */
export function logCvDevPerfWallMs(label: string, startedAtWallMs: number, extra?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') return;
  const ms = Math.round(Date.now() - startedAtWallMs);
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.info('[cv:perf]', { label, clientMs: ms, ...extra });
}
