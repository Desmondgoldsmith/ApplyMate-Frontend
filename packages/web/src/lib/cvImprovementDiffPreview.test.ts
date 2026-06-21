import { describe, expect, it } from 'vitest';

import type { CvDiffPreviewOpenParams } from '@/lib/api';
import { canDisplayCvImprovementDiffPreview } from '@/lib/cvImprovementDiffPreview';

describe('canDisplayCvImprovementDiffPreview', () => {
  it('returns true for summary changedFields', () => {
    const params: CvDiffPreviewOpenParams = {
      pointer: 'imp_1',
      section: 'summary',
      before: '',
      after: '',
      changedFields: [
        {
          fieldPath: 'summary',
          before: 'Old summary',
          after: 'New summary',
          type: 'changed',
        },
      ],
    };
    expect(canDisplayCvImprovementDiffPreview(params)).toBe(true);
  });

  it('returns true for headline/contact mapped to personal', () => {
    const params: CvDiffPreviewOpenParams = {
      pointer: 'imp_2',
      section: 'headline',
      before: '',
      after: '',
      changedFields: [
        {
          fieldPath: 'headline',
          before: 'Dev',
          after: 'Senior Engineer',
          type: 'changed',
        },
      ],
    };
    expect(canDisplayCvImprovementDiffPreview(params)).toBe(true);
  });

  it('returns false when there is no previewable content', () => {
    const params: CvDiffPreviewOpenParams = {
      pointer: 'imp_3',
      section: 'summary',
      before: '',
      after: '',
      changedFields: [],
    };
    expect(canDisplayCvImprovementDiffPreview(params)).toBe(false);
  });
});
