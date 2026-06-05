import type { CvApplyImprovementResult, CvDiffPreviewOpenParams } from '@/lib/api';
import { normalizeCvDiffPreviewParams } from '@/lib/cvAiPatchDisplay';
import { compactDiffPreviewPerformance } from '@/lib/cvApplyPerformanceDev';

/** Virtual key for assistant-driven CV diff (not a real improvement id). */
export const CV_ASSISTANT_DIFF_PREVIEW_KEY = '__assistant__';

export type CvDiffPreviewMap = Record<string, CvDiffPreviewOpenParams>;

/** Stable map bucket for a clinic preview (per suggestion id). */
export function cvDiffPreviewStorageKey(params: CvDiffPreviewOpenParams): string {
  const explicit = (params as { previewMapKey?: string }).previewMapKey?.trim();
  if (explicit) return explicit;
  if (params.pointer === CV_ASSISTANT_DIFF_PREVIEW_KEY) return CV_ASSISTANT_DIFF_PREVIEW_KEY;
  const sid = (params as { suggestionId?: string | null }).suggestionId?.trim();
  if (sid) return sid;
  return String(params.pointer ?? '').trim() || '__unknown__';
}

/** True when structured before/after carry meaningful content (avoid bogus empty-preview copy). */
export function cvStructuralDiffPayloadPresent(before: unknown, after: unknown): boolean {
  const substantive = (v: unknown): boolean => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length > 0;
    return false;
  };
  return substantive(before) || substantive(after);
}

export function cvOpenParamsFromApplyResult(
  result: CvApplyImprovementResult,
  stableRowId: string,
): CvDiffPreviewOpenParams {
  const suggestionId =
    (typeof result.suggestionId === 'string' && result.suggestionId.trim()) ||
    (result.improvementId?.trim() ?? '') ||
    (typeof result.pointer === 'string' ? result.pointer.trim() : '') ||
    stableRowId.trim();
  const pointer =
    (result.improvementId?.trim() || (typeof result.pointer === 'string' ? result.pointer.trim() : '')) ||
    stableRowId.trim();
  return normalizeCvDiffPreviewParams({
    previewMapKey: stableRowId.trim(),
    suggestionId: suggestionId || undefined,
    pointer,
    draftHash: result.draftHash,
    section: result.section,
    before: result.before,
    after: result.after,
    changedFields: result.changedFields ?? [],
    factualityValidated: result.factualityValidated,
    unsupportedChangesDetected: result.unsupportedChangesDetected,
    truthfulnessWarnings: result.truthfulnessWarnings,
    performance: compactDiffPreviewPerformance(result),
  });
}
