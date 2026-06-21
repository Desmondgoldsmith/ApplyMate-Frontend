import type { CvAcceptAllSummary, CvSuggestionsBulkMutationResult } from '@/lib/api';

function nz(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function nzOverflowCount(r: CvSuggestionsBulkMutationResult): number {
  if (
    typeof r.acceptAllQueueOverflowCount === 'number' &&
    Number.isFinite(r.acceptAllQueueOverflowCount)
  ) {
    return Math.max(0, Math.floor(r.acceptAllQueueOverflowCount));
  }
  const s = r.acceptAllSummary;
  if (typeof s?.queueOverflowCount === 'number' && s.queueOverflowCount > 0) {
    return Math.floor(s.queueOverflowCount);
  }
  return 0;
}

function hasAcceptAllOverflow(r: CvSuggestionsBulkMutationResult): boolean {
  if (nzOverflowCount(r) > 0) return true;
  return (
    r.acceptAllSummary?.queueOverflow === true ||
    r.acceptAllQueueOverflow === true
  );
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
  const overflowCount = nzOverflowCount(r);
  const overflow = hasAcceptAllOverflow(r);

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
  parts.push(`${leftPending} remaining`);
  if (overflow) {
    if (overflowCount > 0) {
      parts.push(`${overflowCount} not processed this batch`);
    } else {
      parts.push('batch capped');
    }
  }
  const aiCalls =
    typeof r.acceptAllAiCalls === 'number' && Number.isFinite(r.acceptAllAiCalls)
      ? Math.max(0, Math.floor(r.acceptAllAiCalls))
      : null;
  if (aiCalls === 0) {
    parts.push('no daily AI use charged');
  } else if (aiCalls === 1) {
    parts.push('1 daily AI use');
  } else if (aiCalls != null && aiCalls > 1) {
    parts.push(`${aiCalls} daily AI uses`);
  }
  return parts.join(' · ');
}

/** Prefer server `message`, then structured rollup; append overflow CTA when capped. */
export function buildAcceptAllSuccessToastMessage(
  r: CvSuggestionsBulkMutationResult,
  fallbackAppliedCount?: number,
): string {
  const summary = buildAcceptAllSuggestionsSummaryMessage(r, fallbackAppliedCount);
  const server = r.message?.trim();
  const base =
    server && summary ? `${server} (${summary})` : server || summary;
  if (hasAcceptAllOverflow(r)) {
    return `${base} — click Accept All again for the rest.`;
  }
  return base;
}

/** Optional info toast when single accept auto-resolves sibling suggestions (Round 4). */
export function buildAutoResolvedSuggestionsMessage(autoResolvedIds?: string[]): string | null {
  const n = autoResolvedIds?.map((id) => id.trim()).filter(Boolean).length ?? 0;
  if (n <= 0) return null;
  return `Also resolved ${n} related suggestion${n === 1 ? '' : 's'}.`;
}
