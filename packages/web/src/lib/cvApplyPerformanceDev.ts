import type { CvPerformanceMeta } from '@/lib/api';

const PERF_KEYS = [
  'cacheHit',
  'usedSectionScopedPrompt',
  'usedFallback',
  'latencyMs',
  'inputCharacters',
  'outputCharacters',
  'promptTokenCount',
  'completionTokenCount',
  'totalTokenCount',
] as const satisfies readonly (keyof CvPerformanceMeta)[];

/** Keep only defined telemetry keys for diff preview state (avoids stale nested fields). */
export function compactDiffPreviewPerformance(meta: CvPerformanceMeta): CvPerformanceMeta | undefined {
  const o: CvPerformanceMeta = {};
  for (const k of PERF_KEYS) {
    const v = meta[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return Object.keys(o).length > 0 ? o : undefined;
}

/** Dev-only: log materialization telemetry from apply / accept / accept-all responses. */
export function logCvMaterializePerformanceDev(source: string, meta: CvPerformanceMeta): void {
  if (process.env.NODE_ENV !== 'development') return;
  const row: Record<string, unknown> = { source };
  for (const k of PERF_KEYS) {
    if (meta[k] !== undefined) row[k] = meta[k];
  }
  if (Object.keys(row).length <= 1) return;
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.info('[cv:apply-performance]', row);
}
