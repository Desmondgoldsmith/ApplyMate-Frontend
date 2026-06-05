import { describe, expect, it } from 'vitest';

import {
  extractAcceptAllQuotaFromApiBody,
  isAcceptAllBlockedByDailyQuota,
  parseAcceptAllQuota,
} from '@/lib/cvAcceptAllQuota';

describe('cvAcceptAllQuota', () => {
  it('parses acceptAllQuota from suggestions GET shape', () => {
    const quota = parseAcceptAllQuota({
      tier: 'FREE',
      aiUsesRemaining: 1,
      pendingCount: 5,
      pendingNeedingAi: 5,
      pendingReusePreview: 0,
      canAcceptWithAiToday: 5,
      acceptAllCountsAsOneAiUse: true,
      message: 'Apply all uses 1 of your 1 remaining AI action(s) today for 5 suggestion(s) needing generation.',
    });
    expect(quota?.acceptAllCountsAsOneAiUse).toBe(true);
    expect(quota?.message).toContain('1 remaining');
  });

  it('blocks apply-all when no AI uses remain but suggestions need AI', () => {
    expect(
      isAcceptAllBlockedByDailyQuota({
        tier: 'FREE',
        aiUsesRemaining: 0,
        pendingCount: 3,
        pendingNeedingAi: 3,
        pendingReusePreview: 0,
        canAcceptWithAiToday: 0,
        acceptAllCountsAsOneAiUse: true,
        message: 'No actions left',
      }),
    ).toBe(true);
  });

  it('extracts quota from 429 error envelope', () => {
    const quota = extractAcceptAllQuotaFromApiBody({
      error: {
        code: 'ACCEPT_ALL_DAILY_QUOTA_EXHAUSTED',
        acceptAllQuota: {
          aiUsesRemaining: 0,
          pendingNeedingAi: 2,
          message: 'Quota exhausted',
        },
      },
    });
    expect(quota?.message).toBe('Quota exhausted');
  });
});
