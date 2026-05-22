import { describe, expect, it } from 'vitest';

import type { CvApplyImprovementResult, CvDiffPreviewOpenParams } from '@/lib/api';

import {
  CV_ASSISTANT_DIFF_PREVIEW_KEY,
  cvDiffPreviewStorageKey,
  cvOpenParamsFromApplyResult,
  cvStructuralDiffPayloadPresent,
} from '@/lib/cvDiffPreviewMap';

function applyStub(
  overrides: Partial<CvApplyImprovementResult> & Pick<CvApplyImprovementResult, 'pointer' | 'improvementId'>,
): CvApplyImprovementResult {
  return {
    success: true,
    section: 'summary',
    before: {},
    after: {},
    changedFields: [],
    draftHash: 'h1',
    message: '',
    ...overrides,
  };
}

describe('cvDiffPreviewMap', () => {
  it('stores five previews under distinct keys when each apply has a stable row id', () => {
    const map: Record<string, CvDiffPreviewOpenParams> = {};
    const ids = ['imp_a', 'imp_b', 'imp_c', 'imp_d', 'imp_e'];
    for (const id of ids) {
      const p = cvOpenParamsFromApplyResult(
        applyStub({
          pointer: id,
          improvementId: id,
          suggestionId: id,
          changedFields: [{ field: 'x', fieldPath: `${id}.x`, before: 'a', after: 'b', type: 'changed' }],
        }),
        id,
      );
      map[cvDiffPreviewStorageKey(p)] = p;
    }
    expect(Object.keys(map)).toHaveLength(5);
  });

  it('prefers previewMapKey for storage key', () => {
    const p: CvDiffPreviewOpenParams = {
      previewMapKey: 'imp_stable',
      pointer: '999',
      section: 'summary',
      before: null,
      after: null,
      changedFields: [],
    };
    expect(cvDiffPreviewStorageKey(p)).toBe('imp_stable');
  });

  it('uses assistant virtual key', () => {
    const p: CvDiffPreviewOpenParams = {
      pointer: CV_ASSISTANT_DIFF_PREVIEW_KEY,
      section: 'summary',
      before: null,
      after: null,
      changedFields: [],
    };
    expect(cvDiffPreviewStorageKey(p)).toBe(CV_ASSISTANT_DIFF_PREVIEW_KEY);
  });

  it('cvStructuralDiffPayloadPresent is true when structured objects have keys', () => {
    expect(cvStructuralDiffPayloadPresent({}, { summary: { text: 'x' } })).toBe(true);
    expect(cvStructuralDiffPayloadPresent(null, null)).toBe(false);
  });

  it('cvOpenParamsFromApplyResult carries changedFields for field-level UI', () => {
    const r = applyStub({
      pointer: 'imp_1',
      improvementId: 'imp_1',
      suggestionId: 'imp_1',
      changedFields: [
        { field: 'Summary', fieldPath: 'summary.text', before: 'old', after: 'new', type: 'changed' },
      ],
    });
    const p = cvOpenParamsFromApplyResult(r, 'imp_1');
    expect(p.changedFields).toHaveLength(1);
    expect(p.changedFields[0]?.fieldPath).toBe('summary.text');
  });
});

describe('CV diff empty copy policy', () => {
  it('does not use legacy empty message when structured payload exists', () => {
    const hasStructural = cvStructuralDiffPayloadPresent({ x: 1 }, null);
    expect(hasStructural).toBe(true);
  });
});
