import { describe, expect, it } from 'vitest';

import { shouldShowTruthfulnessAdjustNotice, truncateTruthfulnessWarning, visibleTruthfulnessWarnings } from '@/lib/cvTruthfulnessUi';

describe('cvTruthfulnessUi', () => {
  it('shouldShowTruthfulnessAdjustNotice is false when no signals', () => {
    expect(shouldShowTruthfulnessAdjustNotice({})).toBe(false);
    expect(shouldShowTruthfulnessAdjustNotice({ factualityValidated: true })).toBe(false);
  });

  it('shouldShowTruthfulnessAdjustNotice when factualityValidated is false', () => {
    expect(shouldShowTruthfulnessAdjustNotice({ factualityValidated: false })).toBe(true);
  });

  it('shouldShowTruthfulnessAdjustNotice when unsupportedChangesDetected > 0', () => {
    expect(shouldShowTruthfulnessAdjustNotice({ unsupportedChangesDetected: 1 })).toBe(true);
  });

  it('shouldShowTruthfulnessAdjustNotice when warnings exist', () => {
    expect(shouldShowTruthfulnessAdjustNotice({ truthfulnessWarnings: ['a'] })).toBe(true);
  });

  it('visibleTruthfulnessWarnings caps and truncates', () => {
    const long = 'x'.repeat(300);
    const out = visibleTruthfulnessWarnings([long, 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    expect(out.length).toBeLessThanOrEqual(8);
    expect(out[0].endsWith('…')).toBe(true);
  });

  it('truncateTruthfulnessWarning leaves short strings', () => {
    expect(truncateTruthfulnessWarning('ok')).toBe('ok');
  });
});
