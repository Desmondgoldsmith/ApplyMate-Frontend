import type { JobAnalysis, JobDetailForForm } from '@/lib/api';

/**
 * CV profile for the editor/dropdown when opening a saved job (`selectedCvProfileId` semantics).
 */
export function resolveCvProfileIdForSavedJob(detail: JobDetailForForm): string | null {
  const a = detail.analysis;
  const selected = a.selectedCvProfileId?.trim();
  if (selected) return selected;

  const tailored = a.tailoredCvProfileId?.trim();
  if (tailored) return tailored;

  const source = a.sourceCvProfileId?.trim() || a.cvProfileId?.trim();
  if (source) return source;

  const draftCv = detail.tailorDraft?.cvProfileId?.trim();
  if (draftCv) return draftCv;

  return null;
}

/** CV the UI should select after analyze or GET /jobs/:id (editor/dropdown — not scoring). */
export function resolveSelectedCvProfileId(
  analysis: JobAnalysis | null | undefined,
  fallbackProfileId?: string | null,
): string | null {
  if (!analysis) return (fallbackProfileId ?? '').trim() || null;
  return (
    analysis.selectedCvProfileId?.trim() ||
    analysis.tailoredCvProfileId?.trim() ||
    analysis.sourceCvProfileId?.trim() ||
    analysis.cvProfileId?.trim() ||
    (fallbackProfileId ?? '').trim() ||
    null
  );
}

/** CV used to compute stored match scores on read (`matchCvProfileId` semantics). */
export function resolveMatchCvProfileId(
  analysis: JobAnalysis | null | undefined,
): string | null {
  if (!analysis) return null;
  return (
    analysis.matchCvProfileId?.trim() ||
    analysis.sourceCvProfileId?.trim() ||
    analysis.cvProfileId?.trim() ||
    null
  );
}
