import type { CVImprovementItem } from '@/lib/api';

function hasText(item: CVImprovementItem): boolean {
  return Boolean((item.message ?? item.issue ?? item.suggestion ?? '').trim());
}

/**
 * Pending queue rows only — same contract as GET /cv/suggestions default filter.
 * No score-breakdown hints: empty queue means success state, not fabricated tasks.
 */
export function filterPendingSuggestionsForDisplay(apiItems: CVImprovementItem[] | undefined): CVImprovementItem[] {
  return (apiItems ?? []).filter((item) => {
    if (!hasText(item)) return false;
    const st = item.status ?? 'pending';
    return st === 'pending' && item.resolved !== true;
  });
}
