import type { CvTruthfulnessMeta } from '@/lib/api';

export type { CvDiffPreviewMap } from '@/lib/cvDiffPreviewMap';
export { cvDiffPreviewStorageKey, cvStructuralDiffPayloadPresent } from '@/lib/cvDiffPreviewMap';

/** Payload from Apply with AI → parent `setDiffPreview` (optional truthfulness from server). */
export type CvImprovementDiffPreviewParams = CvTruthfulnessMeta & {
  section: string;
  before: unknown;
  after: unknown;
  pointer: string;
  draftHash?: string | null;
  changedFields: Array<{
    field?: string;
    fieldPath: string;
    fieldLabel?: string;
    before: string;
    after: string;
    type: 'added' | 'removed' | 'changed';
  }>;
};
