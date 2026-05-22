import { describe, expect, it } from 'vitest';

import type { CvApplyImprovementResult } from '@/lib/api';

import { isCvApplyImprovementTerminalNoDiff, toastCopyForTerminalNoDiffApply } from './cvApplyImprovementQueue';

const base = (): CvApplyImprovementResult => ({
  success: true,
  pointer: 'p',
  improvementId: 'i',
  section: 'x',
  before: null,
  after: null,
  changedFields: [],
  draftHash: null,
  message: '',
});

describe('isCvApplyImprovementTerminalNoDiff', () => {
  it('is true for alreadyApplied or autoResolved (not duplicateSuppressed alone)', () => {
    expect(
      isCvApplyImprovementTerminalNoDiff({ ...base(), alreadyApplied: true, duplicateSuppressed: true }),
    ).toBe(true);
    expect(isCvApplyImprovementTerminalNoDiff({ ...base(), autoResolved: true })).toBe(true);
    expect(
      isCvApplyImprovementTerminalNoDiff({ ...base(), duplicateSuppressed: true, cacheHit: true }),
    ).toBe(false);
  });
});

describe('toastCopyForTerminalNoDiffApply', () => {
  it('uses handoff copy when both alreadyApplied and autoResolved', () => {
    expect(
      toastCopyForTerminalNoDiffApply({
        ...base(),
        alreadyApplied: true,
        autoResolved: true,
      }),
    ).toBe('Applied — your CV already matched this suggestion.');
  });

  it('uses generic copy otherwise', () => {
    expect(toastCopyForTerminalNoDiffApply({ ...base(), alreadyApplied: true })).toBe(
      'This improvement is already reflected in your CV.',
    );
    expect(toastCopyForTerminalNoDiffApply({ ...base(), autoResolved: true })).toBe(
      'This improvement is already reflected in your CV.',
    );
  });
});
