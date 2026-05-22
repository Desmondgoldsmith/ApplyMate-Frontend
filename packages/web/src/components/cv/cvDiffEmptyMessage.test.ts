import { describe, expect, it } from 'vitest';

import { CV_DIFF_EMPTY_PREVIEW_MESSAGE } from '@/lib/cvDiffCopy';

describe('CV diff empty preview copy', () => {
  it('matches product copy for empty changedFields', () => {
    expect(CV_DIFF_EMPTY_PREVIEW_MESSAGE).toBe(
      'AI suggested improvements. Preview not available, but changes can still be applied.',
    );
  });
});
