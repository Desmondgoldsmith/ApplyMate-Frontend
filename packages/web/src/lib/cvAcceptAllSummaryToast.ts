import type { CvAcceptAllSummary, CvSuggestionsBulkMutationResult } from '@/lib/api';

function nz(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * User-facing summary after POST /cv/suggestions/accept-all.
 * Uses additive `acceptAllSummary` when present; otherwise falls back to legacy count fields.
 */
export function buildAcceptAllSuggestionsSummaryMessage(
  r: CvSuggestionsBulkMutationResult,
  fallbackAppliedCount?: number,
): string {
  const s: CvAcceptAllSummary | undefined = r.acceptAllSummary;
  const applied = nz(
    s?.applied !== undefined ? s.applied : r.acceptedCount ?? fallbackAppliedCount,
  );
  const skippedDup = nz(s?.skippedDuplicate);
  const skippedNoop = nz(s?.skippedNoop);
  const skippedBudget = nz(s?.skippedAiBudget);
  const skippedTotal = skippedDup + skippedNoop + skippedBudget;
  const failedTruth = nz(
    s?.failedTruthfulness !== undefined ? s.failedTruthfulness : r.failedTruthfulnessCount,
  );
  const leftPending = nz(
    s?.leftPending !== undefined
      ? s.leftPending
      : r.pendingSuggestionsCount !== undefined
        ? r.pendingSuggestionsCount
        : r.remainingPendingCount,
  );
  const overflow = s?.queueOverflow === true || r.acceptAllQueueOverflow === true;

  const parts: string[] = [];
  parts.push(`${applied} applied`);
  if (skippedTotal > 0) {
    const detail: string[] = [];
    if (skippedDup) detail.push(`${skippedDup} duplicate`);
    if (skippedNoop) detail.push(`${skippedNoop} unchanged`);
    if (skippedBudget) detail.push(`${skippedBudget} AI budget`);
    parts.push(`${skippedTotal} skipped${detail.length ? ` (${detail.join(', ')})` : ''}`);
  }
  if (failedTruth > 0) {
    parts.push(`${failedTruth} failed validation`);
  }
  parts.push(`${leftPending} remaining pending`);
  if (overflow) {
    parts.push('batch capped');
  }
  return parts.join(' · ');
}
