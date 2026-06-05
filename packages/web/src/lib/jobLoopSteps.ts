/**
 * Per-job "CV-to-Job loop" step state (3.7).
 *
 * Completion for most steps is derived from server-backed signals (tailored CV,
 * generated cover letter, saved application, hub reminder). The two pieces that
 * have no dedicated server field — whether the user explicitly saved the job to
 * the hub from the analyzer, and whether they chose to skip the cover letter —
 * are persisted here keyed by the JobAnalysis id, so returning to the analyzer
 * shows the user exactly where they left off.
 */

export type JobLoopStepState = {
  /** User explicitly saved this job to the Job Hub (or it was saved via cover letter). */
  savedToHub?: boolean;
  /** User chose to skip generating a cover letter for this job. */
  coverLetterSkipped?: boolean;
  /** User opened the job posting to apply from the analyzer. */
  appliedToJob?: boolean;
  /** User opened interview prep for this job from the analyzer. */
  interviewPrepStarted?: boolean;
};

const KEY_PREFIX = 'applymate:job-loop-steps:';

function storageKey(jobAnalysisId: string): string {
  return `${KEY_PREFIX}${jobAnalysisId}`;
}

export function readJobLoopSteps(
  jobAnalysisId: string | null | undefined,
): JobLoopStepState {
  if (!jobAnalysisId?.trim() || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(jobAnalysisId.trim()));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const o = parsed as Record<string, unknown>;
    return {
      savedToHub: o.savedToHub === true,
      coverLetterSkipped: o.coverLetterSkipped === true,
      appliedToJob: o.appliedToJob === true,
      interviewPrepStarted: o.interviewPrepStarted === true,
    };
  } catch {
    return {};
  }
}

export function writeJobLoopSteps(
  jobAnalysisId: string | null | undefined,
  patch: Partial<JobLoopStepState>,
): JobLoopStepState {
  const current = readJobLoopSteps(jobAnalysisId);
  const next: JobLoopStepState = { ...current, ...patch };
  if (!jobAnalysisId?.trim() || typeof window === 'undefined') return next;
  try {
    window.localStorage.setItem(
      storageKey(jobAnalysisId.trim()),
      JSON.stringify(next),
    );
  } catch {
    /* storage unavailable — non-blocking */
  }
  return next;
}
