import type { JobAnalysis } from '@/lib/api';
import { shouldShowScoreImprovementGuide } from '@/lib/scoreImprovement';

export type TailorStatus = 'none' | 'in_progress' | 'completed';
export type TailorCtaMode = 'start' | 'continue' | 'view';

export type TailorUiState = {
  tailorStatus: TailorStatus;
  isTailorComplete: boolean;
  tailorEditorOpenable: boolean;
  tailorCtaLabel: string;
  tailorCtaMode: TailorCtaMode;
  pendingTailorSections: string[];
  tailorDraftId: string | null;
};

function parseTailorStatus(raw: unknown): TailorStatus {
  if (typeof raw !== 'string') return 'none';
  const s = raw.trim().toLowerCase();
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress';
  if (s === 'completed' || s === 'complete') return 'completed';
  return 'none';
}

function parseTailorCtaMode(raw: unknown, fallback: TailorCtaMode): TailorCtaMode {
  if (typeof raw !== 'string') return fallback;
  const s = raw.trim().toLowerCase();
  if (s === 'start' || s === 'continue' || s === 'view') return s;
  return fallback;
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
}

/** Parse tailor UX fields from API row (camel or snake). */
export function parseTailorUiFields(
  body: Record<string, unknown>,
  hasTailorDraft?: boolean,
): Partial<TailorUiState> {
  const tailorStatus = parseTailorStatus(body.tailorStatus ?? body.tailor_status);
  const isTailoredRaw = body.isTailored === true || body.is_tailored === true;
  const tailorDraftIdRaw =
    (typeof body.tailorDraftId === 'string' && body.tailorDraftId.trim()) ||
    (typeof body.tailor_draft_id === 'string' && body.tailor_draft_id.trim()) ||
    null;

  const resolvedStatus: TailorStatus =
    tailorStatus !== 'none'
      ? tailorStatus
      : isTailoredRaw
        ? 'completed'
        : hasTailorDraft
          ? 'in_progress'
          : 'none';

  const isTailorComplete = isTailoredRaw && resolvedStatus === 'completed';

  const tailorCtaMode = parseTailorCtaMode(
    body.tailorCtaMode ?? body.tailor_cta_mode,
    resolvedStatus === 'completed'
      ? 'view'
      : resolvedStatus === 'in_progress'
        ? 'continue'
        : 'start',
  );

  const tailorCtaLabelRaw =
    (typeof body.tailorCtaLabel === 'string' && body.tailorCtaLabel.trim()) ||
    (typeof body.tailor_cta_label === 'string' && body.tailor_cta_label.trim()) ||
    '';

  const tailorEditorOpenableRaw = body.tailorEditorOpenable ?? body.tailor_editor_openable;
  const tailorEditorOpenable =
    typeof tailorEditorOpenableRaw === 'boolean'
      ? tailorEditorOpenableRaw
      : isTailorComplete || hasTailorDraft === true || Boolean(tailorDraftIdRaw);

  return {
    tailorStatus: resolvedStatus,
    isTailorComplete,
    tailorEditorOpenable,
    tailorCtaMode,
    tailorCtaLabel:
      tailorCtaLabelRaw ||
      (tailorCtaMode === 'view'
        ? 'View tailored CV'
        : tailorCtaMode === 'continue'
          ? 'Continue tailoring'
          : 'Tailor your CV to this job'),
    pendingTailorSections: parseStringList(
      body.pendingTailorSections ?? body.pending_tailor_sections,
    ),
    tailorDraftId: tailorDraftIdRaw,
  };
}

export function resolveTailorUiState(
  analysis: JobAnalysis | null | undefined,
  hasTailorDraft = false,
): TailorUiState {
  const a = analysis as JobAnalysis & Partial<TailorUiState>;
  const draftId = a.tailorDraftId ?? analysis?.tailorDraft?.id?.trim() ?? null;
  const hasDraft = hasTailorDraft || Boolean(draftId);

  const parsed = parseTailorUiFields(
    {
      tailorStatus: a.tailorStatus,
      isTailored: analysis?.isTailored,
      tailorDraftId: draftId,
      tailorEditorOpenable: a.tailorEditorOpenable,
      tailorCtaLabel: a.tailorCtaLabel,
      tailorCtaMode: a.tailorCtaMode,
      pendingTailorSections: a.pendingTailorSections,
    },
    hasDraft,
  );

  return {
    tailorStatus: parsed.tailorStatus ?? 'none',
    isTailorComplete: parsed.isTailorComplete === true,
    tailorEditorOpenable: parsed.tailorEditorOpenable === true,
    tailorCtaLabel: parsed.tailorCtaLabel ?? 'Tailor your CV to this job',
    tailorCtaMode: parsed.tailorCtaMode ?? 'start',
    pendingTailorSections: parsed.pendingTailorSections ?? [],
    tailorDraftId: draftId,
  };
}

/** Headline score delta only after full tailor — not during partial in-progress. */
export function displayScoreBeforeTailorForAnalysis(
  analysis: JobAnalysis | null | undefined,
  localBefore: number | null,
): number | null {
  if (!effectiveIsTailoredForAnalysis(analysis)) return null;
  if (localBefore != null && Number.isFinite(localBefore)) return localBefore;
  const a = analysis?.scoreBeforeTailoring;
  return a != null && Number.isFinite(a) ? a : null;
}

/** Show whenever the API includes a parsed guide — including high post-tailor scores (≥75%). */
export function shouldShowScoreImprovementForAnalysis(
  analysis: JobAnalysis | null | undefined,
): boolean {
  return shouldShowScoreImprovementGuide(analysis?.scoreImprovement);
}

/** Authoritative tailored flag: completed draft only (not sticky after undo). */
export function effectiveIsTailoredForAnalysis(
  analysis: JobAnalysis | null | undefined,
): boolean {
  if (!analysis) return false;
  const ui = resolveTailorUiState(analysis);
  return ui.isTailorComplete;
}
