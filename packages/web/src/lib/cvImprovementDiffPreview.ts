import { normalizeCvDiffPreviewParams } from '@/lib/cvAiPatchDisplay';
import type { CvDiffPreviewOpenParams } from '@/lib/api';
import {
  logMissingCvDiffRenderer,
  resolveCvPreviewSectionDiff,
} from '@/lib/cvDocumentPreviewDiffContext';
import { cvDiffPreviewBuilderSection } from '@/lib/cvDiffPreviewSection';
import { cvStructuralDiffPayloadPresent } from '@/lib/cvDiffPreviewMap';

/** Preview section ids that can host inline Accept/Reject diff cards. */
export const CV_DIFF_PREVIEW_SECTION_IDS = [
  'personal',
  'summary',
  'experience',
  'skills',
  'education',
  'projects',
  'certifications',
] as const;

function previewSectionShowsDiff(
  previewSectionId: string,
  apiSection: string,
  builderSection: string,
  changedFields: ReturnType<typeof normalizeCvDiffPreviewParams>['changedFields'],
  hasStructural: boolean,
): boolean {
  for (const diffSection of [builderSection, apiSection]) {
    if (!diffSection) continue;
    const state = resolveCvPreviewSectionDiff(
      previewSectionId,
      diffSection,
      changedFields,
    );
    if (!state.isDiff) continue;
    if (state.fields?.length) return true;
    if (hasStructural) return true;
  }
  return false;
}

/** True when Apply-with-AI params will render a visible diff card in the CV preview. */
export function canDisplayCvImprovementDiffPreview(
  params: CvDiffPreviewOpenParams,
): boolean {
  const apiSection = (params.section ?? '').trim();
  const normalized = normalizeCvDiffPreviewParams(params);
  const fields = normalized.changedFields ?? [];
  const hasFieldContent = fields.some(
    (cf) => cf.before.trim().length > 0 || cf.after.trim().length > 0,
  );
  const hasStructural = cvStructuralDiffPayloadPresent(
    normalized.before,
    normalized.after,
  );

  if (!hasFieldContent && !hasStructural) return false;

  const builderSection =
    cvDiffPreviewBuilderSection(apiSection) ?? apiSection;

  for (const previewId of CV_DIFF_PREVIEW_SECTION_IDS) {
    if (
      previewSectionShowsDiff(
        previewId,
        apiSection,
        builderSection,
        fields,
        hasStructural,
      )
    ) {
      return true;
    }
  }

  if (apiSection) logMissingCvDiffRenderer(apiSection);
  return false;
}
