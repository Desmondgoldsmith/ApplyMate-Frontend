import type { JobDetailForForm } from '@/lib/api';

/**
 * Which CV profile should be selected when opening a saved job analysis so the UI matches the score / tailoring.
 *
 * Priority: tailored fork (when present) → explicit source CV from analysis → tailor draft base profile.
 */
export function resolveCvProfileIdForSavedJob(detail: JobDetailForForm): string | null {
  const a = detail.analysis;
  const tailored = a.tailoredCvProfileId?.trim();
  if (tailored) return tailored;

  const source = a.cvProfileId?.trim() || a.sourceCvProfileId?.trim();
  if (source) return source;

  const draftCv = detail.tailorDraft?.cvProfileId?.trim();
  if (draftCv) return draftCv;

  return null;
}
