import type { CvMutationCommitMeta, CvPerformanceMeta } from '@/lib/api';

/** Dev-only: log Phase 2–3 mutation metadata (fast accept path, background jobs). */
export function logCvMutationCommitDev(
  source: string,
  meta: CvMutationCommitMeta & CvPerformanceMeta,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  const row: Record<string, unknown> = { source };
  const keys: (keyof (CvMutationCommitMeta & CvPerformanceMeta))[] = [
    'backgroundTasksScheduled',
    'transactionLatencyMs',
    'acceptedSuggestionIds',
    'rejectedSuggestionIds',
    'scoringTriggered',
    'cacheHit',
    'usedSectionScopedPrompt',
    'usedFallback',
    'latencyMs',
    'inputCharacters',
    'outputCharacters',
  ];
  for (const k of keys) {
    const v = meta[k];
    if (v !== undefined) {
      if (k === 'acceptedSuggestionIds' || k === 'rejectedSuggestionIds') {
        row[k] = Array.isArray(v) ? `(n=${(v as unknown[]).length})` : v;
      } else {
        row[k] = v;
      }
    }
  }
  if (Object.keys(row).length <= 1) return;
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.info('[cv:mutation-commit]', row);
}
