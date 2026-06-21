import { describe, expect, it } from 'vitest';

import {
  cvImprovementAcceptPreviewSyncUserMessage,
  shouldRecoverCvImprovementAcceptPreviewSync,
} from '@/lib/cvImprovementAcceptRecovery';

describe('cvImprovementAcceptRecovery', () => {
  it('detects preview sync errors without auto re-apply', () => {
    expect(
      shouldRecoverCvImprovementAcceptPreviewSync(
        { response: { data: { error: { code: 'IMPROVEMENT_STALE_INDEX' } } } },
        'IMPROVEMENT_STALE_INDEX',
      ),
    ).toBe(true);
    expect(
      shouldRecoverCvImprovementAcceptPreviewSync(
        { response: { data: { error: { code: 'IMPROVEMENT_DRAFT_FIELD_MISMATCH' } } } },
        'IMPROVEMENT_DRAFT_FIELD_MISMATCH',
      ),
    ).toBe(true);
    expect(
      shouldRecoverCvImprovementAcceptPreviewSync(
        new Error('No draft found — run apply first'),
        null,
      ),
    ).toBe(true);
  });

  it('maps field mismatch to user-friendly copy', () => {
    expect(
      cvImprovementAcceptPreviewSyncUserMessage('IMPROVEMENT_DRAFT_FIELD_MISMATCH'),
    ).toContain('Fix with AI');
  });
});
