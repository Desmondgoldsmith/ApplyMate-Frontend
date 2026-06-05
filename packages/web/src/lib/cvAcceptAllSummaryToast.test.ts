import { describe, expect, it } from 'vitest';

import type { CvSuggestionsBulkMutationResult } from '@/lib/api';
import { buildAcceptAllSuggestionsSummaryMessage } from '@/lib/cvAcceptAllSummaryToast';

describe('buildAcceptAllSuggestionsSummaryMessage', () => {
  it('formats acceptAllSummary when provided', () => {
    const r: CvSuggestionsBulkMutationResult = {
      acceptAllSummary: {
        applied: 4,
        skippedDuplicate: 1,
        skippedNoop: 0,
        failedTruthfulness: 1,
        skippedAiBudget: 0,
        leftPending: 2,
        queueOverflow: false,
      },
    };
    const msg = buildAcceptAllSuggestionsSummaryMessage(r);
    expect(msg).toContain('4 applied');
    expect(msg).toContain('1 skipped');
    expect(msg).toContain('1 failed validation');
    expect(msg).toContain('2 remaining pending');
  });

  it('falls back to legacy counts when summary absent', () => {
    const r: CvSuggestionsBulkMutationResult = {
      acceptedCount: 3,
      failedTruthfulnessCount: 0,
      pendingSuggestionsCount: 0,
    };
    const msg = buildAcceptAllSuggestionsSummaryMessage(r, 5);
    expect(msg).toMatch(/3 applied/);
    expect(msg).toMatch(/0 remaining pending/);
  });

  it('notes single daily AI use when acceptAllAiCalls is 1', () => {
    const msg = buildAcceptAllSuggestionsSummaryMessage({
      acceptAllAiCalls: 1,
      acceptAllSummary: { applied: 3, leftPending: 0 },
    });
    expect(msg).toContain('1 daily AI use');
  });
});
